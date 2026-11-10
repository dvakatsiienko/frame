package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestCommitTakesItsMessageOnStdin(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "readme.txt"), "piped\n")
	c := exec.Command(xbin, "lane", "commit", "-", "--", "readme.txt")
	c.Dir = dir
	c.Env = append(cleanEnv(), "X_TEST=1")
	c.Stdin = strings.NewReader("🔧 piped: the message came on stdin\n")
	var out bytes.Buffer
	c.Stdout = &out

	code := exitOf(c.Run())

	if subject := gitT(t, dir, "log", "-1", "--format=%s"); code != 0 || subject != "🔧 piped: the message came on stdin" {
		t.Fatalf("exit %d, subject %q, out %s", code, subject, out.String())
	}
}

func TestCommitRefusesAnEmptyStdinMessage(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "readme.txt"), "piped\n")
	c := exec.Command(xbin, "lane", "commit", "-", "--", "readme.txt")
	c.Dir = dir
	c.Env = append(cleanEnv(), "X_TEST=1")
	c.Stdin = strings.NewReader("  \n")

	if code := exitOf(c.Run()); code != 2 {
		t.Fatalf("exit %d, want 2 for an empty message", code)
	}
}

func TestRedCommitLeavesItsLogInTheTestRunsOwnDir(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\necho the hook said no\nexit 1\n")
	write(t, filepath.Join(dir, "readme.txt"), "edit\n")

	got := xIn(t, dir, nil, "lane", "commit", message(t), "--", "readme.txt")

	path := regexp.MustCompile(`\S*x-commit-\d+\.log`).FindString(got.stdout)
	if got.code == 0 || path == "" {
		t.Fatalf("exit %d, no log named:\n%s", got.code, got.stdout)
	}
	if !strings.HasPrefix(path, filepath.Dir(xbin)+string(filepath.Separator)) {
		t.Errorf("the log is at %s, outside this run's %s", path, filepath.Dir(xbin))
	}
	if body := readFile(t, path); !strings.Contains(body, "the hook said no") {
		t.Errorf("the named log holds %q", body)
	}
}

func TestCommitLeavesNoLogInTheTempDir(t *testing.T) {
	t.Parallel()
	dir, temp, state := repo(t), t.TempDir(), t.TempDir()
	env := []string{"TMPDIR=" + temp, "X_STATE=" + state}
	hook := filepath.Join(dir, ".git/hooks/pre-commit")
	write(t, hook, "#!/bin/sh\necho the hook said no\nexit 1\n")
	write(t, filepath.Join(dir, "readme.txt"), "edit\n")

	red := xIn(t, dir, env, "lane", "commit", message(t), "--", "readme.txt")
	write(t, hook, "#!/bin/sh\nexit 0\n")
	green := xIn(t, dir, env, "lane", "commit", message(t), "--", "readme.txt")

	if red.code == 0 || green.code != 0 {
		t.Fatalf("exits %d then %d, want a red commit, then a green one:\n%s", red.code, green.code, green.stdout)
	}
	if left, _ := filepath.Glob(filepath.Join(temp, "x-commit-*.log")); len(left) != 0 {
		t.Errorf("the temp dir holds %v", left)
	}
	path := regexp.MustCompile(`\S*x-commit-\d+\.log`).FindString(red.stdout)
	if !strings.HasPrefix(path, filepath.Join(state, "commit-logs")+string(filepath.Separator)) || !strings.Contains(readOr(path, ""), "the hook said no") {
		t.Errorf("the failure names %q, want a log that exists under the state dir's commit-logs", path)
	}
}

func TestARedCommitKeepsTheNewestLogs(t *testing.T) {
	t.Parallel()
	dir, state := repo(t), t.TempDir()
	logs := filepath.Join(state, "commit-logs")
	for i := range commitLogsKept + 5 {
		write(t, filepath.Join(logs, fmt.Sprintf("x-commit-9%05d.log", i)), "old\n")
	}
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\necho the hook said no\nexit 1\n")
	write(t, filepath.Join(dir, "readme.txt"), "edit\n")

	got := xIn(t, dir, []string{"X_STATE=" + state}, "lane", "commit", message(t), "--", "readme.txt")

	kept, _ := os.ReadDir(logs)
	path := regexp.MustCompile(`\S*x-commit-\d+\.log`).FindString(got.stdout)
	if len(kept) != commitLogsKept || !exists(path) || exists(filepath.Join(logs, "x-commit-900005.log")) || !exists(filepath.Join(logs, "x-commit-900006.log")) {
		t.Errorf("%d logs, the new one there %v: want %d, the six oldest gone, the new one kept", len(kept), exists(path), commitLogsKept)
	}
}

func TestHookFailKeepsOnlyTheLinesThatSayWhy(t *testing.T) {
	t.Parallel()
	log := strings.Repeat("│  some-check (skip) no matching staged files\n", 40) +
		"lane gate: a.md grows by 3 lines — groom it\nexit status 1\n" +
		strings.Repeat("summary: (done in 0.15 seconds)\n", 5)

	got := hookFail(log, "x lane commit m -- a.md")

	if strings.Join(got.Log, "|") != "lane gate: a.md grows by 3 lines — groom it|exit status 1" {
		t.Fatalf("log %q", got.Log)
	}
	path := got.Msg[strings.LastIndex(got.Msg, " ")+1:]
	saved, err := os.ReadFile(path)
	if err != nil || string(saved) != log {
		t.Errorf("the whole log is not at %q (%v)", path, err)
	}
}
