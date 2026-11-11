package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
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
	send := exec.Command(hcBin(), "send", terminal, "/rename "+display)
	send.Env = slices.DeleteFunc(os.Environ(), func(pair string) bool { return len(pair) > 15 && pair[:15] == "HC_TERMINAL_ID=" })
	if out, err := send.CombinedOutput(); err != nil {
		return append(row, kv{"renamed", false}, kv{"command", command}, kv{"error", string(out)})
	}
	return append(row, kv{"renamed", true}, kv{"command", command})
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
