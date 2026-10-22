package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// side is a second clone that moves main and pushes to the branch behind the coder's back
type rebaseWorld struct {
	origin, clone, side string
}

func newRebaseWorld(t *testing.T, branch string) *rebaseWorld {
	t.Helper()
	origin := filepath.Join(t.TempDir(), "origin.git")
	gitT(t, filepath.Dir(origin), "init", "-q", "--bare", "-b", "main", origin)
	side := repo(t)
	gitT(t, side, "remote", "add", "origin", origin)
	gitT(t, side, "push", "-q", "origin", "main")
	gitT(t, side, "switch", "-q", "-c", branch)
	write(t, filepath.Join(side, "mine.txt"), "the coder's change\n")
	gitT(t, side, "add", "mine.txt")
	gitT(t, side, "commit", "-q", "-m", "the coder's change")
	gitT(t, side, "push", "-q", "origin", branch)
	gitT(t, side, "switch", "-q", "main")

	clone := filepath.Join(t.TempDir(), "clone")
	gitT(t, filepath.Dir(clone), "clone", "-q", origin, clone)
	gitT(t, clone, "switch", "-q", branch)
	return &rebaseWorld{origin, clone, side}
}

func (w *rebaseWorld) mainMoves(t *testing.T, name, body string) {
	t.Helper()
	gitT(t, w.side, "switch", "-q", "main")
	gitT(t, w.side, "pull", "-q", "--ff-only", "origin", "main")
	write(t, filepath.Join(w.side, name), body)
	gitT(t, w.side, "add", name)
	gitT(t, w.side, "commit", "-q", "-m", "main: "+name)
	gitT(t, w.side, "push", "-q", "origin", "main")
}

func (w *rebaseWorld) run(t *testing.T, args ...string) ran {
	t.Helper()
	return xIn(t, w.clone, nil, append([]string{"lane", "rebase-main"}, args...)...)
}

func remoteHead(t *testing.T, w *rebaseWorld, branch string) string {
	t.Helper()
	sha, _, _ := strings.Cut(gitT(t, w.clone, "ls-remote", "origin", "refs/heads/"+branch), "\t")
	return sha
}

func TestRebaseMainRefusesABranchOutsideCoder(t *testing.T) {
	for _, branch := range []string{"main", "dima/try", "scratch/x"} {
		t.Run(branch, func(t *testing.T) {
			w := newRebaseWorld(t, "coder/x")
			if branch != "main" {
				gitT(t, w.clone, "switch", "-q", "-c", branch)
			} else {
				gitT(t, w.clone, "switch", "-q", "main")
			}
			w.mainMoves(t, "one.txt", "one\n")
			before := gitT(t, w.clone, "rev-parse", "HEAD")

			got := w.run(t, "--apply")

			if after := gitT(t, w.clone, "rev-parse", "HEAD"); got.code != 2 || after != before {
				t.Fatalf("exit %d, HEAD %s → %s, want exit 2 and HEAD untouched:\n%s", got.code, short(before), short(after), got.stdout)
			}
		})
	}
}

// a post-rewrite hook runs after the rebase and before the push: a teammate's push lands in that gap
func TestRebaseMainKeepsAPushThatLandedAfterItsRead(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "one.txt", "one\n")
	gitT(t, w.side, "fetch", "-q", "origin")
	gitT(t, w.side, "switch", "-q", "-C", "rival", "origin/coder/x")
	write(t, filepath.Join(w.side, "theirs.txt"), "a teammate's commit\n")
	gitT(t, w.side, "add", "theirs.txt")
	gitT(t, w.side, "commit", "-q", "-m", "a teammate's commit")
	theirs := gitT(t, w.side, "rev-parse", "HEAD")
	write(t, filepath.Join(w.clone, ".git/hooks/post-rewrite"),
		"#!/bin/sh\ngit -C '"+w.side+"' push -q origin rival:refs/heads/coder/x\n")

	got := w.run(t, "--apply")

	if remote := remoteHead(t, w, "coder/x"); got.code == 0 || remote != theirs || !strings.Contains(envelopeOf(got).Error, "moved to "+short(theirs)) {
		t.Fatalf("exit %d, remote %s, want the teammate's %s kept and named:\n%s", got.code, short(remote), short(theirs), got.stdout)
	}
}

// the teammate pushed before the run: the lease matches the remote, so only an ancestry check keeps the push
func TestRebaseMainRefusesWhenTheRemoteHoldsACommitHeadLacks(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "one.txt", "one\n")
	gitT(t, w.side, "fetch", "-q", "origin")
	gitT(t, w.side, "switch", "-q", "-C", "rival", "origin/coder/x")
	write(t, filepath.Join(w.side, "theirs.txt"), "a teammate's commit\n")
	gitT(t, w.side, "add", "theirs.txt")
	gitT(t, w.side, "commit", "-q", "-m", "a teammate's commit")
	gitT(t, w.side, "push", "-q", "origin", "rival:refs/heads/coder/x")
	theirs := gitT(t, w.side, "rev-parse", "HEAD")
	before := gitT(t, w.clone, "rev-parse", "HEAD")

	got := w.run(t, "--apply")

	after := gitT(t, w.clone, "rev-parse", "HEAD")
	if got.code == 0 || remoteHead(t, w, "coder/x") != theirs || after != before || !strings.Contains(envelopeOf(got).Error, short(theirs)) {
		t.Fatalf("exit %d, remote %s, HEAD %s → %s, want the teammate's %s kept, HEAD untouched and named:\n%s",
			got.code, short(remoteHead(t, w, "coder/x")), short(before), short(after), short(theirs), got.stdout)
	}
}

func TestRebaseMainStopsInTheRebaseOnAConflict(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "mine.txt", "main's version\n")

	got := w.run(t, "--apply")

	inRebase := exists(filepath.Join(w.clone, ".git/rebase-merge")) || exists(filepath.Join(w.clone, ".git/rebase-apply"))
	out := got.stdout
	if got.code == 0 || !inRebase || !strings.Contains(out, "mine.txt") || !strings.Contains(out, "git rebase --continue") || !strings.Contains(out, "git rebase --abort") {
		t.Fatalf("exit %d, in rebase %v, want the conflicted path and both lines:\n%s", got.code, inRebase, out)
	}
}

// the want line: main moves twice under a coder lane, and the branch never holds a merge commit
func TestRebaseMainLeavesNoMergeCommitAcrossTwoMainMoves(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	for _, name := range []string{"one.txt", "two.txt"} {
		w.mainMoves(t, name, name+"\n")
		if got := w.run(t, "--apply"); got.code != 0 {
			t.Fatalf("exit %d after main moved with %s:\n%s", got.code, name, got.stdout)
		}
	}

	gitT(t, w.clone, "fetch", "-q", "origin")
	if merges := gitT(t, w.clone, "log", "--merges", "--oneline", "origin/main..origin/coder/x"); merges != "" {
		t.Fatalf("the branch holds merge commits:\n%s", merges)
	}
}

func TestRebaseMainPutsTheBranchOnMainWithoutAMergeCommit(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "one.txt", "one\n")
	w.mainMoves(t, "two.txt", "two\n")

	got := w.run(t, "--apply")

	gitT(t, w.clone, "fetch", "-q", "origin")
	head := gitT(t, w.clone, "rev-parse", "HEAD")
	mainHead := remoteHead(t, w, "main")
	merges := gitT(t, w.clone, "log", "--merges", "--oneline", "origin/main..HEAD")
	base := gitT(t, w.clone, "merge-base", "HEAD", mainHead)
	if got.code != 0 || merges != "" || base != mainHead || remoteHead(t, w, "coder/x") != head {
		t.Fatalf("exit %d, merges %q, base %s (main %s), remote %s (head %s):\n%s",
			got.code, merges, short(base), short(mainHead), short(remoteHead(t, w, "coder/x")), short(head), got.stdout)
	}
}
