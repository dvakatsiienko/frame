package main

import (
	"cmp"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

const (
	gateRunsKept = 50
	gateRunTail  = 30
)

var gateRunLogName = regexp.MustCompile(`^\d{8}T\d{6}Z-\d+\.log$`)

// gate run takes the long turn for one command, keeps everything it prints in a file and prints the exit, the file and
// the last lines: what a pipe to tail was after, with the exit code kept and the whole log one read away
func gateRun(r *Run, args []string, flags Flags) (any, error) {
	const example = "x gate run -- pnpm typecheck"
	// the command is every word after a leading --: a dash further in would be dropped by the flag parser, and the
	// command run would no longer be the one x-mod-guard read
	if dash, _ := flags[argsBeforeDash].(int); dash != 0 || len(args) == 0 {
		return nil, usageFail("the command starts right after -- : x gate run -- <command…>", example)
	}
	if _, err := exec.LookPath(args[0]); err != nil {
		return nil, usageFail("no "+args[0]+" to run: the command is argv, its first word a program, never one quoted shell string", example)
	}
	dir := filepath.Join(stateDir(), "gate-runs")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	keepNewest(dir, gateRunsKept, gateRunLogName)
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

// keepNewest makes room for one more file in a dir of x's own logs: the oldest go, by write time, then by name
func keepNewest(dir string, kept int, ours *regexp.Regexp) {
	// only a plain file named as x names its logs is x's to remove, and only in a real dir
	if at, err := os.Lstat(dir); err != nil || !at.IsDir() {
		return
	}
	entries, _ := os.ReadDir(dir)
	logs := slices.DeleteFunc(entries, func(entry os.DirEntry) bool {
		return !entry.Type().IsRegular() || !ours.MatchString(entry.Name())
	})
	written := func(log os.DirEntry) time.Time {
		info, err := log.Info()
		if err != nil {
			return time.Time{}
		}
		return info.ModTime()
	}
	slices.SortFunc(logs, func(a, b os.DirEntry) int {
		return cmp.Or(written(a).Compare(written(b)), strings.Compare(a.Name(), b.Name()))
	})
	for _, old := range logs[:max(0, len(logs)-kept+1)] {
		_ = os.Remove(filepath.Join(dir, old.Name()))
	}
}
