package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// a refused commit: the whole hook log goes to a file, the reply carries only the lines that say why — the caller
// never pipes the commit into `tail` (8 guard refusals on 10-14)
var hookRed = regexp.MustCompile(`(?i)error|fail|refus|✖|×|lane gate|exit status|did not match|not found`)

var (
	ansiColor    = regexp.MustCompile(`\x1b\[[0-9;]*m`)
	hookRedGate  = regexp.MustCompile(`(?m)^\s*🥊 (\S+) \(`)
	hookRedRow   = regexp.MustCompile(`(?m)^\s*(\(fail\) |FAIL )`)
	hookTimedOut = regexp.MustCompile(`(?m)^\s*(?:Error|TestTimeoutError): (timed out after \d+ ms|Test timed out in \d+ms)`)
)

// a load flake, never a real red: only the test gates failed, and every row they failed carries the runner's timeout
// line. 5 s bounds red the gate at load 10–22 on a commit that is fine (FRM-470)
func timeoutOnly(log string) bool {
	log = ansiColor.ReplaceAllString(log, "")
	for _, gate := range hookRedGate.FindAllStringSubmatch(log, -1) {
		if gate[1] != "test" && gate[1] != "mods-test" {
			return false
		}
	}
	// vitest groups rows with one error under several FAIL lines, so a group is read, never a count
	rows, open := 0, false
	for line := range strings.SplitSeq(log, "\n") {
		switch {
		case hookRedRow.MatchString(line):
			rows++
			open = true
		case open && strings.TrimSpace(line) != "":
			if !hookTimedOut.MatchString(line) {
				return false
			}
			open = false
		}
	}
	return rows > 0 && !open
}

const commitLogsKept = 20

var commitLogName = regexp.MustCompile(`^x-commit-\d+\.log$`)

// the whole log of a refused commit lives under the state dir, the newest few kept: nothing ever took one out of the temp dir
// messageReds runs the commit-msg hook on a copy of the message when a pre-commit red stopped git before it, so the
// message's reds (the lint, the lane gate) join this try instead of the next; a hook that edits edits only the copy
func messageReds(tree, message, log string) []string {
	if strings.Contains(log, "commit-msg") {
		return nil
	}
	hook, err := gitIn(tree, "rev-parse", "--path-format=absolute", "--git-path", "hooks/commit-msg")
	if err != nil || !hook.ok {
		return nil
	}
	if info, statErr := os.Stat(hook.out); statErr != nil || info.Mode()&0o111 == 0 {
		return nil
	}
	raw, err := os.ReadFile(message)
	if err != nil {
		return nil
	}
	copied, err := os.CreateTemp("", "x-msg-check-*")
	if err != nil {
		return nil
	}
	defer os.Remove(copied.Name())
	_, _ = copied.Write(raw)
	_ = copied.Close()
	run := exec.Command(hook.out, copied.Name())
	run.Dir = tree
	out, runErr := run.CombinedOutput()
	if runErr == nil {
		return nil
	}
	lines := []string{"the commit message's own reds, read in the same try:"}
	for _, line := range nonBlank(string(out)) {
		if len(lines) > 20 {
			break
		}
		lines = append(lines, line)
	}
	return lines
}

func hookFail(log, next string) *Fail {
	dir := filepath.Join(stateDir(), "commit-logs")
	_ = os.MkdirAll(dir, 0o755)
	keepNewest(dir, commitLogsKept, commitLogName)
	full := filepath.Join(dir, fmt.Sprintf("x-commit-%d.log", os.Getpid()))
	saved := os.WriteFile(full, []byte(log), 0o600) == nil
	var why []string
	for _, line := range nonBlank(log) {
		if hookRed.MatchString(line) && len(why) < 20 {
			why = append(why, line)
		}
	}
	if len(why) == 0 {
		why = nonBlank(log)
		why = why[max(0, len(why)-20):]
	}
	msg := "commit failed — the hook's own lines are below"
	if saved {
		msg += ", the whole log at " + full
	}
	return &Fail{Msg: msg, Next: next, Log: why}
}
