package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// `x thread rename <thread> --role main|wing:<n>`: the main seat moves between two live clio threads in one call, no reboot
// (FRM-596). the role record is the one truth: threads.json is written first, then the main-session file the fork guard reads,
// both under the store's lock, so two switches at once end with one coordinator

// the file the fork guard reads for who is main: `pid=` and `session=` lines; X_MAIN_SESSION points a test at a fixture
func mainSessionPath() string {
	return storePath("X_MAIN_SESSION", ".local/state/clio/main-session")
}

// under X_TEST a wait says so in the file X_SEAT_LOG names, so a test waits on the line and not on a clock
func seatSaid(line string) {
	if os.Getenv("X_TEST") == "" || os.Getenv("X_SEAT_LOG") == "" {
		return
	}
	if f, err := os.OpenFile(os.Getenv("X_SEAT_LOG"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644); err == nil {
		_, _ = fmt.Fprintln(f, line)
		_ = f.Close()
	}
}

// the old main's `x lane commit` holds the main checkout's index lock while it commits: the seat waits for it to clear and never
// breaks it, up to the commit's own wait (X_LOCK_WAIT under X_TEST), then refuses with nothing written
func waitMainIndexLock() error {
	common, err := exec.Command("git", "-C", frameRoot(), "rev-parse", "--path-format=absolute", "--git-common-dir").Output()
	if err != nil {
		return nil
	}
	lock := filepath.Join(strings.TrimSpace(string(common)), "index.lock")
	deadline := durationEnv("X_LOCK_WAIT", lockWait)
	started := time.Now()
	for isWaiting := false; ; time.Sleep(lockPause) {
		if !exists(lock) {
			return nil
		}
		if !isWaiting {
			seatSaid("waiting on the main checkout's index lock")
			isWaiting = true
		}
		if time.Since(started) >= deadline {
			return &Fail{Refused: true, Msg: "the main checkout's index lock is still held after " + deadline.String() + ": " + lock + ", so the seat did not move", Next: "x thread rename <thread> --role main|wing:<n>"}
		}
	}
}

var wingAlias = regexp.MustCompile(`^wing(\d+)$`)

// the thread a switch names: the alias `main` or `wing<n>`, else a session id or display
func threadForSwitch(threads []thread, key string) (int, error) {
	isSeat := func(t thread) bool { return t.Role != "" && !t.Fallback }
	if key == "main" {
		for i, t := range threads {
			if isSeat(t) && t.Role == "coordinator" {
				return i, nil
			}
		}
		return -1, &Fail{Refused: true, Msg: "no thread holds the main seat", Next: "x thread list"}
	}
	if m := wingAlias.FindStringSubmatch(key); m != nil {
		n, _ := strconv.Atoi(m[1])
		for i, t := range threads {
			if isSeat(t) && t.Role == "wing" && t.Wing == n {
				return i, nil
			}
		}
		return -1, &Fail{Refused: true, Msg: "no thread is wing " + m[1], Next: "x thread list"}
	}
	return threadToRename(threads, key)
}

// the new seat holder and the old one, by index; the old steps down to the wing number the new one held. wing:<n> is the same
// swap read from the main's side: the main takes wing n and that wing takes the seat
func seatSwap(threads []thread, target int, role string) (promote, demote int, err error) {
	usage := "x thread rename <thread> --role main|wing:<n>"
	switch {
	case role == "main":
		if threads[target].Role == "coordinator" {
			return 0, 0, &Fail{Refused: true, Msg: threads[target].SessionID + " holds the main seat already", Next: "x thread list"}
		}
		if threads[target].Role != "wing" {
			return 0, 0, &Fail{Refused: true, Msg: threads[target].SessionID + " is a " + threads[target].Role + ", and only a wing takes the main seat", Next: "x thread list"}
		}
		for i, t := range threads {
			if t.Role == "coordinator" && !t.Fallback {
				return target, i, nil
			}
		}
		return target, -1, nil
	case strings.HasPrefix(role, "wing:"):
		n, convErr := strconv.Atoi(strings.TrimPrefix(role, "wing:"))
		if convErr != nil || n < 1 {
			return 0, 0, usageFail("--role wing:<n> takes a wing number from 1", usage)
		}
		if threads[target].Role != "coordinator" {
			return 0, 0, &Fail{Refused: true, Msg: "only the main takes a wing number, by handing the seat to that wing: run --role main on the thread that should hold it", Next: usage}
		}
		for i, t := range threads {
			if t.Role == "wing" && t.Wing == n && !t.Fallback {
				return i, target, nil
			}
		}
		return 0, 0, &Fail{Refused: true, Msg: "no thread is wing " + strconv.Itoa(n) + " to take the seat", Next: "x thread list"}
	}
	return 0, 0, usageFail("--role is main or wing:<n>, not "+role, usage)
}

func writeMainSession(path string, pid int, sid string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(fmt.Sprintf("pid=%d\nsession=%s\n", pid, sid)), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// the switch: both records and the main-session file under one lock, then every live place of both threads takes its new
// name; a place that does not take it at once follows in the background, so a busy thread never holds the call
func threadRoleSwitch(r *Run, key, role string, grant *seatGrant) (any, error) {
	path := threadStorePath()
	if path == "" {
		return nil, &Fail{Msg: "no thread store to write", Next: "x thread list"}
	}
	r.Open("the thread store")
	if err := waitMainIndexLock(); err != nil {
		return nil, err
	}
	unlock, err := lockThreadStore(path)
	if err != nil {
		return nil, err
	}
	before, _ := os.ReadFile(path)
	store, err := readThreadStore(path)
	if err != nil {
		unlock()
		return nil, &Fail{Msg: err.Error(), Next: "jq . " + quote(path)}
	}
	target, err := threadForSwitch(store.Threads, key)
	if err != nil {
		unlock()
		return nil, err
	}
	promote, demote, err := seatSwap(store.Threads, target, role)
	if err != nil {
		unlock()
		return nil, err
	}
	next := store.Threads[promote]
	if sessionPid(next.SessionID) == 0 {
		unlock()
		return nil, &Fail{Refused: true, Msg: next.SessionID + " is not a live session, so it cannot take the main seat", Next: "x thread list"}
	}
	if grant != nil {
		if err := grant.take(key, role); err != nil {
			unlock()
			return nil, err
		}
	}
	wing := next.Wing
	store.Threads[promote].Role, store.Threads[promote].Wing, store.Threads[promote].Title = "coordinator", 0, ""
	drawNames(&store.Threads[promote])
	moved := []string{next.SessionID}
	if demote >= 0 {
		store.Threads[demote].Role, store.Threads[demote].Wing, store.Threads[demote].Title = "wing", wing, ""
		drawNames(&store.Threads[demote])
		moved = append(moved, store.Threads[demote].SessionID)
	}
	err = writeThreadStore(path, time.Now(), store.Threads)
	if err == nil {
		err = writeMainSession(mainSessionPath(), sessionPid(next.SessionID), next.SessionID)
	}
	if err != nil && before != nil {
		// the second write failed after the first took: the store goes back as it was, so no half-moved seat is left
		if restoreErr := os.WriteFile(path, before, 0o644); restoreErr != nil {
			unlock()
			return nil, &Fail{Msg: "the seat file was not written (" + err.Error() + ") and the store could not be put back (" + restoreErr.Error() + "): " + path + " holds the new seat, main-session the old", Next: "x thread list"}
		}
		err = fmt.Errorf("%w; the store is as it was", err)
	}
	unlock()
	if err != nil {
		return nil, &Fail{Msg: "the seat was not moved: " + err.Error(), Next: "x thread list"}
	}
	wait, nudge := renameWait()
	var places []ordered
	behind := 0
	for _, sid := range moved {
		rows := renamePlaces(sid, recordDisplay(sid), wait, nudge)
		behind += followUntaken(sid, rows[1:])
		places = append(places, rows...)
	}
	r.Done(next.SessionID+" holds the main seat", "")
	data := ordered{{"main", next.SessionID}, {"places", places}, {"behind", behind}}
	if demote >= 0 {
		data = append(data, kv{"wing", ordered{{"session", store.Threads[demote].SessionID}, {"number", wing}}})
	}
	return data, nil
}

// whether x runs under a registered claude session, a thread, and not at dima's own terminal; a process table that cannot be
// read stands as a thread, so the gate fails closed
func callerIsThread() bool {
	table, err := readProcessTable()
	return threadFromTable(table, err, powerSessionsDir())
}

func threadFromTable(table processTable, tableErr error, sessionsDir string) bool {
	return tableErr != nil || len(callerChain(table, sessionsDir)) > 0
}

// from a thread the switch runs while dima's operator override is on, or on the grant x-mod-guard wrote from his tick; his own
// terminal needs neither. the grant comes back for the switch to take under the store's lock, nil when no grant is needed
func seatLeave(key, role string) (*seatGrant, error) {
	if !callerIsThread() || seatOverrideOn(overrideStore()) {
		return nil, nil
	}
	if grant, on := seatGrantFor(overrideStore(), seatCaller(), key, role); on {
		return &grant, nil
	}
	command := "x thread rename " + quote(key) + " --role " + role
	return nil, &Fail{Refused: true, Msg: "moving the main seat from a thread runs while dima's operator override is on, or on his tick of a board ask whose pick quotes the whole command; neither stands", Next: command + " (with the override on, on his tick, or in dima's own terminal)"}
}

// x-mod-guard's grant (hooks/operator-override.ts, writeSeatGrant): `seat:<session>` in the override store, one switch, 60 s. any
// Bash of this mac user can write one, so it is named, not proven
type seatGrant struct {
	By     string `json:"by"`
	At     string `json:"at"`
	Until  string `json:"until"`
	Role   string `json:"role"`
	Thread string `json:"thread"`

	session string
}

const seatGrantLife = 60 * time.Second

// the session x runs under, "" at no thread
func seatCaller() string {
	table, err := readProcessTable()
	if err != nil {
		return ""
	}
	if chain := callerChain(table, powerSessionsDir()); len(chain) > 0 {
		return chain[0].SessionID
	}
	return ""
}

func seatGrantFor(store, session, key, role string) (seatGrant, bool) {
	if store == "" || session == "" {
		return seatGrant{}, false
	}
	body, err := os.ReadFile(store)
	if err != nil {
		return seatGrant{}, false
	}
	var grants map[string]json.RawMessage
	if json.Unmarshal(body, &grants) != nil {
		return seatGrant{}, false
	}
	grant := seatGrant{session: session}
	if raw, held := grants["seat:"+session]; !held || json.Unmarshal(raw, &grant) != nil {
		return seatGrant{}, false
	}
	at, err := time.Parse(time.RFC3339, grant.At)
	age := clock().Sub(at)
	tick, isTick := strings.CutPrefix(grant.By, "tick ")
	isMine := isTick && tick != "" && grant.Thread == key && grant.Role == role
	return grant, isMine && err == nil && age >= 0 && age <= seatGrantLife
}

// takes the grant, under the store's lock: gone from the file before the seat moves, so it moves one seat once
func (g *seatGrant) take(key, role string) error {
	store := overrideStore()
	gone := &Fail{Refused: true, Msg: "the grant from dima's tick is no longer there, so the seat did not move", Next: "x thread rename " + quote(key) + " --role " + role + " (on a new tick)"}
	if _, on := seatGrantFor(store, g.session, key, role); !on {
		return gone
	}
	body, err := os.ReadFile(store)
	if err != nil {
		return gone
	}
	var grants map[string]json.RawMessage
	if json.Unmarshal(body, &grants) != nil {
		return gone
	}
	delete(grants, "seat:"+g.session)
	next, err := json.Marshal(grants)
	if err == nil {
		err = atomicWrite(store, next)
	}
	if err != nil {
		return &Fail{Msg: "the grant could not be taken, so the seat did not move: " + err.Error(), Next: "ls -l " + store}
	}
	// the log is the one place a forged grant would show; a line that cannot land stops nothing
	_ = overrideLogPass(&overrideUsed{Scope: "seat", By: g.By, At: g.At, DevBuild: isDevBuild()}, "moved the seat from session "+g.session+": "+key+" to "+role)
	return nil
}

// twin of x-mod-guard's masterOverride (hooks/operator-override.ts), the one rule for «override on»: a live `all`, by its until or
// by the process that typed it, else `prs` by his band press, which holds until he presses off. prs by a shift or a typed word lands
// prs alone and never moves the seat
func seatOverrideOn(store string) bool {
	if _, on := overrideGrantIn(store, "all", ""); on {
		var raw map[string]struct {
			Pid   int    `json:"pid"`
			Start string `json:"start"`
			Until string `json:"until"`
		}
		body, err := os.ReadFile(store)
		if err != nil || json.Unmarshal(body, &raw) != nil {
			return false
		}
		if all := raw["all"]; all.Until != "" || (all.Pid > 0 && all.Start != "" && processStart(all.Pid) == all.Start) {
			return true
		}
	}
	press, on := overrideGrantIn(store, overrideScopePrs, "")
	return on && press.By == "band"
}

// the start time the guard wrote beside the pid, read the same way, so a reused pid reads gone
func processStart(pid int) string {
	got, _ := run("", nil, "", "ps", "-o", "lstart=", "-p", strconv.Itoa(pid))
	if !got.ok {
		return ""
	}
	return strings.TrimSpace(got.out)
}
