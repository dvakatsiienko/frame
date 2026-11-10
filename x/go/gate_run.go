package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const (
	gateRunsKept = 50
	gateRunTail  = 30
)

// gate run takes the long turn for one command, keeps everything it prints in a file and prints the exit, the file and
// the last lines: what a pipe to tail was after, with the exit code kept and the whole log one read away
func gateRun(r *Run, args []string, _ Flags) (any, error) {
	const example = "x gate run -- pnpm typecheck"
	if len(args) == 0 {
		return nil, usageFail("no command after -- : x gate run -- <command…>", example)
	}
	if _, err := exec.LookPath(args[0]); err != nil {
		return nil, usageFail("no "+args[0]+" to run: the command is argv, its first word a program, never one quoted shell string", example)
	}
	dir := filepath.Join(stateDir(), "gate-runs")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	dropOldGateRuns(dir)
	path := filepath.Join(dir, fmt.Sprintf("%s-%d.log", time.Now().UTC().Format("20060102T150405Z"), os.Getpid()))
	log, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o600)
	if err != nil {
		return nil, err
	}
	command := queuedGateRun(args)
	child := exec.Command(command[0], command[1:]...)
	// one file for both streams, so the log keeps the order the command wrote in
	child.Stdout, child.Stderr = log, log
	err = child.Run()
	_ = log.Close()
	code := 0
	if err != nil {
		exit, ran := errors.AsType[*exec.ExitError](err)
		if !ran {
			return nil, err
		}
		code = max(exit.ExitCode(), 1)
		traced.Kind = "external"
	}
	raw, _ := os.ReadFile(path)
	lines := strings.Split(strings.TrimRight(string(raw), "\n"), "\n")
	fmt.Printf("exit %d\nlog %s\n%s\n", code, path, strings.Join(lines[max(0, len(lines)-gateRunTail):], "\n"))
	r.passthrough, r.code = true, code
	return nil, nil
}

// the queue's own script keeps the turn's rules, and marks the turn for the command's children; a go test takes none
// unless it asks, as takeGateTurn does
func queuedGateRun(command []string) []string {
	script := filepath.Join(frameRoot(), gateQueueScript)
	if (os.Getenv("X_TEST") != "" && os.Getenv("X_GATE_TURN") == "") || !exists(script) {
		return command
	}
	return append([]string{script, "--long"}, command...)
}

// a log's name opens with its utc stamp, so the names sort oldest first
func dropOldGateRuns(dir string) {
	logs, _ := filepath.Glob(filepath.Join(dir, "*.log"))
	slices.Sort(logs)
	for _, old := range logs[:max(0, len(logs)-gateRunsKept+1)] {
		_ = os.Remove(old)
	}
}
