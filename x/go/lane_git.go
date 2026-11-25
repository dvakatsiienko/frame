package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
)

func midOperation() bool {
	return slices.ContainsFunc(gitPaths("", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"), exists)
}

func isMerging() bool {
	path, _ := git("rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD")
	return path.ok && exists(path.out)
}

// worktreeOf answers the repo's common git dir and whether tree is a linked worktree of it
func worktreeOf(tree string) (common string, linked bool, err error) {
	both, err := mustGitIn(tree, "rev-parse", "rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir")
	if err != nil {
		return "", false, err
	}
	own, common, _ := strings.Cut(both, "\n")
	return common, own != common, nil
}

// where git keeps each named file, one spawn for them all; nil when git could not say
func gitPaths(cwd string, names ...string) []string {
	args := []string{"rev-parse", "--path-format=absolute"}
	for _, name := range names {
		args = append(args, "--git-path", name)
	}
	got, _ := gitIn(cwd, args...)
	if !got.ok {
		return nil
	}
	return strings.Split(got.out, "\n")
}

func top() (string, error)  { return mustGit("rev-parse", "rev-parse", "--show-toplevel") }
func head() (string, error) { return mustGit("rev-parse", "rev-parse", "HEAD") }

func branch() (string, error) {
	found, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	if !found.ok {
		return "", &Fail{Refused: true, Msg: "detached HEAD", Next: "git switch -c <branch>"}
	}
	return found.out, nil
}

type result struct {
	ok       bool
	out, log string
}

func mustGit(step string, args ...string) (string, error) { return mustGitIn("", step, args...) }

func mustGitIn(cwd, step string, args ...string) (string, error) {
	got, _ := gitIn(cwd, args...)
	if !got.ok {
		return "", &Fail{Msg: "git " + step + " failed: " + got.log, Next: "git status"}
	}
	return got.out, nil
}

func git(args ...string) (result, error)               { return gitIn("", args...) }
func gitIn(cwd string, args ...string) (result, error) { return run(cwd, nil, "", "git", args...) }

func run(cwd string, env []string, input, command string, args ...string) (result, error) {
	c := exec.Command(command, args...)
	c.Dir = cwd
	c.Env = append(os.Environ(), env...)
	if input != "" {
		c.Stdin = strings.NewReader(input)
	}
	return runCmd(c)
}

func runCmd(c *exec.Cmd) (result, error) {
	command, args := c.Path, c.Args[1:]
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	err := c.Run()
	logger.Debug("spawn", "cmd", command, "args", args, "err", err)
	out := strings.TrimSpace(stdout.String())
	errText := stderr.String()
	if err != nil && errText == "" {
		errText = err.Error()
	}
	return result{ok: err == nil, out: out, log: strings.TrimSpace(out + "\n" + errText)}, err
}

func ok(got result, _ error) bool { return got.ok }

func exists(path string) bool { _, err := os.Stat(path); return err == nil }

// the sha origin holds for a branch, "" with none or with no origin at all
func remoteBranch(dir, ref string) (string, error) {
	if !ok(gitIn(dir, "remote", "get-url", "origin")) {
		return "", nil
	}
	listed, err := mustGitIn(dir, "ls-remote", "ls-remote", "origin", "refs/heads/"+ref)
	sha, _, _ := strings.Cut(listed, "\t")
	return sha, err
}

func mainCheckout(dir string) string {
	if common, linked, err := worktreeOf(dir); err == nil && linked {
		return filepath.Dir(common)
	}
	return dir
}
