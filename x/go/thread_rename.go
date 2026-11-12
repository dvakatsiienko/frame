package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
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

// renameThread gives a live session the display its record now draws: typed as a /rename into its herdr terminal when
// that terminal sits idle, or handed back as the exact command when it is busy or out of reach. a slash command typed
// from inside a herdr thread arrives wrapped in an <hc from> tag and never runs, so the send drops HC_TERMINAL_ID
func renameThread(sid, display string) ordered {
	row := ordered{{"session", sid}, {"display", display}}
	terminal, idle := herdrTerminalOf(sessionPid(sid))
	if terminal == "" {
		return append(row, kv{"renamed", false}, kv{"command", "/rename " + display + " in the thread's own chat: no herdr terminal holds it"})
	}
	command := "env -u HC_TERMINAL_ID hc send " + terminal + " " + quote("/rename "+display)
	if !idle {
		return append(row, kv{"renamed", false}, kv{"command", command})
	}
	// a send waits out a typing pause, then lands in the box after the draft: dima's half-typed prompt would carry it
	if !isInputBoxEmpty(terminal) {
		return append(row, kv{"renamed", false}, kv{"command", command}, kv{"why", "its input box holds text, or did not read"})
	}
	send := exec.Command(hcBin(), "send", terminal, "/rename "+display)
	send.Env = slices.DeleteFunc(os.Environ(), func(pair string) bool { return len(pair) > 15 && pair[:15] == "HC_TERMINAL_ID=" })
	if out, err := send.CombinedOutput(); err != nil {
		return append(row, kv{"renamed", false}, kv{"command", command}, kv{"error", string(out)})
	}
	return append(row, kv{"renamed", true}, kv{"command", command})
}

// a rename on dima's word: the record's title, behind summon's caller gate, then the live thread's own /rename; a later
// refresh keeps the title, since the record carries it
func threadRenameRun(r *Run, args []string, _ Flags) (any, error) {
	sid, title := args[0], strings.TrimSpace(args[1])
	if title == "" {
		return nil, usageFail("an empty name draws nothing", "x thread rename <sid> '<name>'")
	}
	// a newline would end the /rename typed into the thread and send the rest as a prompt
	if strings.ContainsFunc(title, unicode.IsControl) {
		return nil, usageFail("a name holds no newline or control character", "x thread rename <sid> '<name>'")
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
	i := slices.IndexFunc(store.Threads, func(t thread) bool { return t.SessionID == sid && t.Role != "" && !t.Fallback })
	if i < 0 {
		unlock()
		return nil, &Fail{Refused: true, Msg: sid + " has no record to rename: x brief summon gives one", Next: "x thread list"}
	}
	store.Threads[i].Title = title
	drawNames(&store.Threads[i])
	err = writeThreadStore(path, time.Now(), store.Threads)
	unlock()
	if err != nil {
		return nil, &Fail{Msg: "the thread store was not written: " + err.Error(), Next: "x thread list"}
	}
	r.Done(sid+" is "+title, "")
	return renameThread(sid, title), nil
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
