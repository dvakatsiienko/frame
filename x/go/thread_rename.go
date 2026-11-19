package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unicode"
)

// hcBin is the herdr cli a rename speaks through; X_HC points a test at a fake, and under X_TEST without it there is none,
// so no test reaches the live herdr
func hcBin() string {
	if bin := os.Getenv("X_HC"); bin != "" {
		return bin
	}
	if os.Getenv("X_TEST") != "" {
		return ""
	}
	return "hc"
}

// herdrAppBin is the herdr window's cli a tab rename speaks through; X_HERDR_APP points a test at a fake, and under X_TEST
// without it there is none, so no test reaches the live window
func herdrAppBin() string {
	if bin := os.Getenv("X_HERDR_APP"); bin != "" {
		return bin
	}
	if os.Getenv("X_TEST") != "" {
		return ""
	}
	return "herdr-app"
}

// renameTab gives the herdr tab holding a terminal its name: the tab id from `herdr-app ls`, one made by terminal.keep
// when the terminal sits in none; the row says whether it took, with the exact commands left when it did not
func renameTab(terminal, name string) ordered {
	row := ordered{{"place", "herdr tab"}}
	bin := herdrAppBin()
	if terminal == "" {
		return append(row, kv{"renamed", false}, kv{"command", "none: no herdr terminal holds the thread, so it has no tab"}, kv{"isAbsent", true})
	}
	rename := func(tab string) string {
		return "herdr-app do tab.rename " + quote(`{"id":"`+tab+`","name":`+marshal(name)+`}`)
	}
	if bin == "" {
		return append(row, kv{"renamed", false}, kv{"command", rename("<tab>")}, kv{"error", "no herdr-app to ask"})
	}
	listed, err := exec.Command(bin, "ls").Output()
	var window struct {
		Spaces []struct {
			Tabs []struct {
				ID        string `json:"id"`
				Terminals []struct {
					Terminal string `json:"terminal"`
				} `json:"terminals"`
			} `json:"tabs"`
		} `json:"spaces"`
	}
	if err != nil || json.Unmarshal(listed, &window) != nil {
		return append(row, kv{"renamed", false}, kv{"command", rename("<tab>")}, kv{"error", "herdr-app ls did not answer"})
	}
	tab, isKept := "", false
	for _, space := range window.Spaces {
		for _, candidate := range space.Tabs {
			if slices.ContainsFunc(candidate.Terminals, func(t struct {
				Terminal string `json:"terminal"`
			}) bool {
				return t.Terminal == terminal
			}) {
				tab = candidate.ID
			}
		}
	}
	if tab == "" {
		keep := `{"terminal":"` + terminal + `","place":"tab"}`
		out, err := exec.Command(bin, "do", "terminal.keep", keep).Output()
		var kept struct {
			Tab string `json:"tab"`
		}
		if err != nil || json.Unmarshal(out, &kept) != nil || kept.Tab == "" {
			return append(row, kv{"renamed", false}, kv{"command", "herdr-app do terminal.keep " + quote(keep) + ", then " + rename("<tab>")}, kv{"error", "the terminal got no tab"})
		}
		tab, isKept = kept.Tab, true
	}
	// a tab terminal.keep just made stays unknown to a rename for a moment (probe 2026-11-10, thread-tab.ts): retry up to 4 s
	var out []byte
	tries := 1
	if isKept {
		tries = 20
	}
	for ; tries > 0; tries-- {
		if out, err = exec.Command(bin, "do", "tab.rename", `{"id":"`+tab+`","name":`+marshal(name)+`}`).CombinedOutput(); err == nil {
			return append(row, kv{"renamed", true}, kv{"command", rename(tab)})
		}
		time.Sleep(renamePoll() / 5)
	}
	return append(row, kv{"renamed", false}, kv{"command", rename(tab)}, kv{"error", strings.TrimSpace(string(out))})
}

// renameThread gives a live session the display its record now draws: typed as a /rename into its herdr terminal when
// that terminal sits idle, or handed back as the exact command when it is busy or out of reach. with a wait, a busy
// terminal or a draft in its box is retried until the deadline, then reads pending; a thread still busy after nudgeAfter is
// asked once to end its turn at its next step, and told to resume once renamed — never an Esc or a forced stop
// display is read again before each try, so a later rename of the record wins over an earlier one still waiting
func renameThread(sid string, display func() string, wait, nudgeAfter, poll time.Duration) ordered {
	start := time.Now()
	isNudged := false
	// a thread that was asked to end its turn is told to resume however the rename ended: landed, failed or timed out
	finish := func(row ordered) ordered {
		if isNudged {
			sent, command := tellThread(sid, "resume")
			row = append(row, kv{"nudged", true}, kv{"resumed", sent})
			if !sent {
				row = append(row, kv{"resumeCommand", command})
			}
		}
		return row
	}
	for {
		row, blocked := renameOnce(sid, display())
		if blocked == "" || wait <= 0 {
			return finish(row)
		}
		if time.Since(start) > wait {
			return finish(append(row, kv{"pending", true}))
		}
		if blocked == "busy" && !isNudged && time.Since(start) >= nudgeAfter {
			isNudged, _ = tellThread(sid, "end your turn at your next step")
		}
		time.Sleep(poll)
	}
}

// a plain message to a thread's herdr terminal, as one member writes to another: whether it was sent, and the exact
// command that sends it. a message waits for an empty input box, or it would join dima's draft and send it
func tellThread(sid, text string) (bool, string) {
	terminal, _ := herdrTerminalOf(sessionPid(sid))
	if terminal == "" {
		return false, ""
	}
	command := "env -u HC_TERMINAL_ID hc send " + terminal + " " + quote(text)
	if !isInputBoxEmpty(terminal) {
		return false, command
	}
	return exec.Command(hcBin(), "send", terminal, text).Run() == nil, command
}

// how long a thread rename waits for an idle terminal, and how long before it asks the thread to end its turn;
// X_RENAME_WAIT and X_RENAME_NUDGE (seconds) shorten them under X_TEST only
func renameWait() (time.Duration, time.Duration) {
	wait, nudge := 5*time.Minute, 2*time.Minute
	if os.Getenv("X_TEST") != "" {
		if seconds, err := strconv.ParseFloat(os.Getenv("X_RENAME_WAIT"), 64); err == nil {
			wait = time.Duration(seconds * float64(time.Second))
		}
		if seconds, err := strconv.ParseFloat(os.Getenv("X_RENAME_NUDGE"), 64); err == nil {
			nudge = time.Duration(seconds * float64(time.Second))
		}
	}
	return wait, nudge
}

func renamePoll() time.Duration {
	if os.Getenv("X_TEST") != "" {
		return 20 * time.Millisecond
	}
	return time.Second
}

// one try: the row, and why only the thread's state stood in the way ("busy", "draft"; "" when nothing did), so a later try may land. a slash command
// typed from inside a herdr thread arrives wrapped in an <hc from> tag and never runs, so the send drops HC_TERMINAL_ID
func renameOnce(sid, display string) (ordered, string) {
	row := ordered{{"session", sid}, {"display", display}}
	terminal, idle := herdrTerminalOf(sessionPid(sid))
	if terminal == "" {
		return append(row, kv{"renamed", false}, kv{"command", "/rename " + display + " in the thread's own chat: no herdr terminal holds it"}, kv{"noTerminal", true}), ""
	}
	command := "env -u HC_TERMINAL_ID hc send " + terminal + " " + quote("/rename "+display)
	if !idle {
		return append(row, kv{"renamed", false}, kv{"command", command}), "busy"
	}
	// a send waits out a typing pause, then lands in the box after the draft: dima's half-typed prompt would carry it
	if !isInputBoxEmpty(terminal) {
		return append(row, kv{"renamed", false}, kv{"command", command}, kv{"why", "its input box holds text, or did not read"}), "draft"
	}
	send := exec.Command(hcBin(), "send", terminal, "/rename "+display)
	send.Env = slices.DeleteFunc(os.Environ(), func(pair string) bool { return len(pair) > 15 && pair[:15] == "HC_TERMINAL_ID=" })
	if out, err := send.CombinedOutput(); err != nil {
		return append(row, kv{"renamed", false}, kv{"command", command}, kv{"error", string(out)}), ""
	}
	return append(row, kv{"renamed", true}, kv{"command", command}), ""
}

// every live place a thread's name sits in besides its record, after the record took it: the herdr tab and cc's name
func renamePlaces(sid, name string, wait, nudgeAfter time.Duration) []ordered {
	terminal, _ := herdrTerminalOf(sessionPid(sid))
	return []ordered{{{"place", "record"}, {"renamed", true}}, renameTab(terminal, name), renameThread(sid, func() string { return name }, wait, nudgeAfter, renamePoll())}
}

// the display a session's record draws now, read fresh from the store; "" when it has no record
func recordDisplay(sid string) string {
	store, err := readThreadStore(threadStorePath())
	if err != nil {
		return ""
	}
	for _, t := range store.Threads {
		if t.SessionID == sid && t.Role != "" && !t.Fallback {
			return threadDisplay(t)
		}
	}
	return ""
}

// a live place that did not take a record's new name follows it in the background, once the thread idles: `x thread sync`,
// detached, so a landing or a dispatch never holds for a busy thread and no surface is left on the old name. under X_TEST
// the call is logged to X_RENAME_FOLLOW instead, so no test starts a process that outlives it
func followRename(sid string) {
	if os.Getenv("X_TEST") != "" {
		if log := os.Getenv("X_RENAME_FOLLOW"); log != "" {
			if f, err := os.OpenFile(log, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
				_, _ = fmt.Fprintln(f, "thread sync "+sid)
				_ = f.Close()
			}
		}
		return
	}
	exe, err := os.Executable()
	if err != nil {
		return
	}
	follow := exec.Command(exe, "thread", "sync", sid)
	follow.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	if follow.Start() == nil {
		_ = follow.Process.Release()
	}
}

// renames that did not take, followed in the background; the count of live places left behind. a cc name no herdr
// terminal holds is out of every follow's reach, so it starts none
func followUntaken(sid string, places []ordered) int {
	behind := 0
	for _, place := range places {
		if !placeTook(place) && !slices.ContainsFunc(place, func(field kv) bool { return field.key == "noTerminal" }) {
			behind++
		}
	}
	if behind > 0 {
		followRename(sid)
	}
	return behind
}

// whether a rename row took, or has nothing to take (a thread with no herdr tab)
func placeTook(row ordered) bool {
	for _, field := range row {
		if (field.key == "renamed" || field.key == "isAbsent") && field.value == true {
			return true
		}
	}
	return false
}

// the live places of a recorded thread take the name its record draws now: the herdr tab, then cc's own name once the
// thread idles, re-read before each try; what a landing or a dispatch leaves behind runs here, detached. it writes no
// record and asks no thread to end its turn, so it needs no caller gate: a detached child outlives the coordinator that
// started it, and its ancestry no longer reads as one. one sync a session at a time; a second leaves it to the first
func threadSyncRun(r *Run, args []string, _ Flags) (any, error) {
	sid := args[0]
	display := recordDisplay(sid)
	if display == "" {
		return nil, &Fail{Refused: true, Msg: sid + " has no record to sync from", Next: "x thread list"}
	}
	if lock, err := os.OpenFile(threadStorePath()+"."+sid+".sync", os.O_CREATE|os.O_RDWR, 0o644); err == nil {
		defer lock.Close()
		if syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB) != nil {
			return ordered{{"session", sid}, {"display", display}, {"following", "another sync holds it"}}, nil
		}
	}
	terminal, _ := herdrTerminalOf(sessionPid(sid))
	wait := syncWait()
	// a record gone mid-wait keeps its last name: a rename to "" would draw nothing
	current := func() string { return cmp.Or(recordDisplay(sid), display) }
	places := []ordered{renameTab(terminal, display)}
	if !sameName(sessionName(sid), display) {
		// a slow poll: a half-hour wait on 1 s ticks would spawn hc thousands of times
		places = append(places, renameThread(sid, current, wait, 2*wait, 5*renamePoll()))
	}
	r.Done(sid+" is "+current(), "")
	for _, place := range places {
		if !placeTook(place) {
			return nil, &Fail{Msg: sid + " is " + current() + " in its record, not in every live place", Next: "x thread rename " + sid + " " + quote(current())}
		}
	}
	return ordered{{"session", sid}, {"display", current()}, {"places", places}}, nil
}

// how long a background sync waits for its thread to idle: a working codie can hold a turn for half an hour;
// X_SYNC_WAIT (seconds) shortens it under X_TEST only
func syncWait() time.Duration {
	if os.Getenv("X_TEST") != "" {
		if seconds, err := strconv.ParseFloat(os.Getenv("X_SYNC_WAIT"), 64); err == nil {
			return time.Duration(seconds * float64(time.Second))
		}
	}
	return 30 * time.Minute
}

// cc's own name for a live session, from its registry file; "" when none reads
func sessionName(sid string) string {
	files, _ := filepath.Glob(filepath.Join(sessionsDir(), "*.json"))
	for _, file := range files {
		var entry struct {
			SessionID string `json:"sessionId"`
			Name      string `json:"name"`
		}
		if raw, err := os.ReadFile(file); err == nil && json.Unmarshal(raw, &entry) == nil && entry.SessionID == sid {
			return entry.Name
		}
	}
	return ""
}

// clearThreadTicket takes a landed ticket off each thread record that names it, so its display drops the unit; a title that
// only spells the role name for a ticket goes with it, or the landed ticket would stay in the name. best effort, since a
// merged lane stands whatever its store says
func clearThreadTicket(id string) (string, error) {
	path := threadStorePath()
	if path == "" {
		return "no thread store", nil
	}
	unlock, err := lockThreadStore(path)
	if err != nil {
		return "", err
	}
	store, err := readThreadStore(path)
	if err != nil {
		unlock()
		return "", err
	}
	var renamed []thread
	for i := range store.Threads {
		if store.Threads[i].Ticket == id {
			if _, unit, _ := strings.Cut(store.Threads[i].Title, " | "); unit == id && isRoleName(store.Threads[i], store.Threads[i].Title) {
				store.Threads[i].Title = ""
			}
			store.Threads[i].Ticket = ""
			drawNames(&store.Threads[i])
			renamed = append(renamed, store.Threads[i])
		}
	}
	if len(renamed) == 0 {
		unlock()
		return "no record names it", nil
	}
	err = writeThreadStore(path, time.Now(), store.Threads)
	// the store is free before any slow call: every refresh and hook waits on this lock
	unlock()
	if err != nil {
		return "", err
	}
	// a landing never holds for a busy thread: what does not take at once follows in the background
	followed := []string{}
	for _, t := range renamed {
		if followUntaken(t.SessionID, renamePlaces(t.SessionID, t.Display, 0, 0)) > 0 {
			followed = append(followed, t.SessionID)
		}
	}
	detail := plural(len(renamed), "record") + " cleared"
	if len(followed) > 0 {
		detail += ", the live names following once idle: x thread sync " + strings.Join(followed, ", ")
	}
	return detail, nil
}

// the record a rename means: a session id, else the one thread drawing that display; a display two threads draw is refused
func threadToRename(threads []thread, key string) (int, error) {
	isNamed := func(t thread) bool { return t.Role != "" && !t.Fallback }
	if i := slices.IndexFunc(threads, func(t thread) bool { return t.SessionID == key && isNamed(t) }); i >= 0 {
		return i, nil
	}
	var held []int
	for i, t := range threads {
		if isNamed(t) && threadDisplay(t) == key {
			held = append(held, i)
		}
	}
	switch len(held) {
	case 0:
		return -1, &Fail{Refused: true, Msg: key + " is no session id or display with a record to rename: x brief summon gives one", Next: "x thread list"}
	case 1:
		return held[0], nil
	}
	ids := []string{}
	for _, i := range held {
		ids = append(ids, threads[i].SessionID)
	}
	return -1, &Fail{Refused: true, Msg: "«" + key + "» is the display of " + plural(len(ids), "thread") + ": " + strings.Join(ids, ", ") + ". rename one by its session id", Next: "x thread rename " + ids[0] + " " + quote("<name>")}
}

// a rename on dima's word, by session id or display: the record's title, behind summon's caller gate, then the herdr tab
// and the live thread's own /rename; a later refresh keeps the title, since the record carries it. every place is said,
// and any place that did not take the name fails the verb with its exact command
func threadRenameRun(r *Run, args []string, _ Flags) (any, error) {
	key, title := args[0], strings.TrimSpace(args[1])
	if title == "" {
		return nil, usageFail("an empty name draws nothing", "x thread rename <sid or display> '<name>'")
	}
	// a newline would end the /rename typed into the thread and send the rest as a prompt
	if strings.ContainsFunc(title, unicode.IsControl) {
		return nil, usageFail("a name holds no newline or control character", "x thread rename <sid or display> '<name>'")
	}
	if err := coordinatorOnly("x thread rename"); err != nil {
		return nil, err
	}
	path := threadStorePath()
	if path == "" {
		return nil, &Fail{Msg: "no thread store to write", Next: "x thread list"}
	}
	r.Open("the thread store")
	unlock, err := lockThreadStore(path)
	if err != nil {
		return nil, err
	}
	store, err := readThreadStore(path)
	if err != nil {
		unlock()
		return nil, &Fail{Msg: err.Error(), Next: "jq . " + quote(path)}
	}
	i, err := threadToRename(store.Threads, key)
	if err != nil {
		unlock()
		return nil, err
	}
	sid := store.Threads[i].SessionID
	// a rename to the name the record draws anyway pins nothing, so the next chunk's ticket and a landing still redraw it
	untitled := store.Threads[i]
	untitled.Title = ""
	store.Threads[i].Title = title
	if sameName(threadDisplay(untitled), title) {
		store.Threads[i].Title = ""
	}
	drawNames(&store.Threads[i])
	// every place takes the record's own string, so a name typed with a stray space still reads as one name everywhere
	title = store.Threads[i].Display
	err = writeThreadStore(path, time.Now(), store.Threads)
	unlock()
	if err != nil {
		return nil, &Fail{Msg: "the thread store was not written: " + err.Error(), Next: "x thread list"}
	}
	wait, nudge := renameWait()
	places := renamePlaces(sid, title, wait, nudge)
	followUntaken(sid, places[1:])
	taken, left, next := []string{}, []string{}, ""
	for _, row := range places {
		place, command, why, resumeCommand, isRenamed, isAbsent, isPending := "", "", "", "", false, false, false
		for _, field := range row {
			switch field.key {
			case "place":
				place, _ = field.value.(string)
			case "command":
				command, _ = field.value.(string)
			case "renamed":
				isRenamed, _ = field.value.(bool)
			case "isAbsent":
				isAbsent, _ = field.value.(bool)
			case "why":
				why, _ = field.value.(string)
			case "resumeCommand":
				resumeCommand, _ = field.value.(string)
			case "pending":
				isPending, _ = field.value.(bool)
			}
		}
		// a nudged thread whose «resume» met a draft in its box is left for the caller to send
		if resumeCommand != "" {
			left = append(left, "«resume» left to send: "+resumeCommand)
			next = cmp.Or(next, resumeCommand)
		}
		switch {
		case isRenamed:
			taken = append(taken, cmp.Or(place, "cc name"))
		case isAbsent:
		default:
			label := cmp.Or(place, "cc name")
			if isPending {
				label += " (pending: busy past the wait)"
			}
			entry := label + ": " + command
			if why != "" {
				entry += " — " + why
			}
			left = append(left, entry)
			next = cmp.Or(next, command)
		}
	}
	r.Done(sid+" is "+title, "")
	// the claude apps' card is not read from here: if it still shows the old name, dima renames it by hand to this one
	card := "the claude apps' card, if it still shows the old name: rename it there to the name in the block"
	if r.human {
		fmt.Printf("%s\n\n📋 **copy → claude app card** 📋\n\n```\n%s\n```\n\n✂️ **end** ✂️\n", card, title)
	}
	if len(left) > 0 {
		return nil, &Fail{Msg: sid + " is " + title + " in " + strings.Join(taken, ", ") + ", not yet in " + strings.Join(left, "; "), Next: next}
	}
	return ordered{{"session", sid}, {"display", title}, {"places", places}, {"card", ordered{{"say", card}, {"name", title}}}}, nil
}

// the pid the session registry holds for a live session id; 0 when none
func sessionPid(sid string) int {
	files, _ := filepath.Glob(filepath.Join(sessionsDir(), "*.json"))
	for _, file := range files {
		var entry struct {
			SessionID string `json:"sessionId"`
			Pid       int    `json:"pid"`
		}
		if raw, err := os.ReadFile(file); err == nil && json.Unmarshal(raw, &entry) == nil && entry.SessionID == sid && pidAlive(entry.Pid) {
			return entry.Pid
		}
	}
	return 0
}

// cc's input box on a terminal's screen: the lines between its last two rules, the first led by ❯; true only when that
// box reads and holds nothing past the ❯
func isInputBoxEmpty(terminal string) bool {
	screen, err := exec.Command(hcBin(), "read", terminal, "--lines", "0").Output()
	if err != nil {
		return false
	}
	var rules []int
	lines := strings.Split(string(screen), "\n")
	for i, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), strings.Repeat("─", 10)) {
			rules = append(rules, i)
		}
	}
	if len(rules) < 2 {
		return false
	}
	box := lines[rules[len(rules)-2]+1 : rules[len(rules)-1]]
	first, isPrompt := strings.CutPrefix(strings.TrimSpace(strings.Join(box, "\n")), "❯")
	return isPrompt && strings.TrimSpace(first) == ""
}

// the herdr terminal whose program is that pid, and whether its claude is between turns; "" when herdr holds none
func herdrTerminalOf(pid int) (string, bool) {
	bin := hcBin()
	if pid == 0 || bin == "" {
		return "", false
	}
	listed, err := exec.Command(bin, "ls", "--json").Output()
	var all struct {
		Terminals []struct {
			Address string `json:"address"`
			Agent   string `json:"agent"`
		} `json:"terminals"`
	}
	if err != nil || json.Unmarshal(listed, &all) != nil {
		return "", false
	}
	for _, t := range all.Terminals {
		if t.Agent != "claude-code" {
			continue
		}
		got, err := exec.Command(bin, "get", t.Address, "--json").Output()
		var one struct {
			Pid    int `json:"pid"`
			Status struct {
				State string `json:"state"`
			} `json:"status"`
		}
		if err == nil && json.Unmarshal(got, &one) == nil && one.Pid == pid {
			return t.Address, one.Status.State == "done" || one.Status.State == "idle"
		}
	}
	return "", false
}
