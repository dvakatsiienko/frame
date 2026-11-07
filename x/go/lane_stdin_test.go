package main

import (
	"bytes"
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

func TestRedCommitLeavesItsLogInTheTestRunsOwnTempDir(t *testing.T) {
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
