package main

import (
	"os"
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

func TestRebaseMainContinuesAResolvedRebase(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "mine.txt", "main's version\n")
	if got := w.run(t, "--apply"); got.code == 0 {
		t.Fatalf("control: the first run did not stop on the conflict:\n%s", got.stdout)
	}
	write(t, filepath.Join(w.clone, "mine.txt"), "both, resolved\n")

	got := w.run(t, "--apply")

	gitT(t, w.clone, "fetch", "-q", "origin")
	inRebase := exists(filepath.Join(w.clone, ".git/rebase-merge"))
	body := gitT(t, w.clone, "show", "origin/coder/x:mine.txt")
	if got.code != 0 || inRebase || body != "both, resolved" || gitT(t, w.clone, "log", "--merges", "--oneline", "origin/main..origin/coder/x") != "" {
		t.Fatalf("exit %d, in rebase %v, mine.txt on the remote %q, want the resolution pushed:\n%s", got.code, inRebase, body, got.stdout)
	}
}

// run from a subdir, with a markdown heading of seven = in the resolution
func TestRebaseMainContinuesFromASubdirOverASetextHeading(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	gitT(t, w.clone, "switch", "-q", "main")
	write(t, filepath.Join(w.clone, "sub/keep.txt"), "a dir to run from\n")
	gitT(t, w.clone, "add", "sub/keep.txt")
	gitT(t, w.clone, "commit", "-q", "-m", "sub")
	gitT(t, w.clone, "push", "-q", "origin", "main")
	gitT(t, w.clone, "switch", "-q", "coder/x")
	w.mainMoves(t, "mine.txt", "main's version\n")
	w.run(t, "--apply")
	write(t, filepath.Join(w.clone, "mine.txt"), "Title\n=======\nresolved\n")

	got := xIn(t, filepath.Join(w.clone, "sub"), nil, "lane", "rebase-main", "--apply")

	gitT(t, w.clone, "fetch", "-q", "origin")
	if body := gitT(t, w.clone, "show", "origin/coder/x:mine.txt"); got.code != 0 || body != "Title\n=======\nresolved" {
		t.Fatalf("exit %d, mine.txt on the remote %q:\n%s", got.code, body, got.stdout)
	}
}

// a modify/delete conflict leaves no marker to read: the verb hands it back rather than guess
func TestRebaseMainRefusesToContinueAConflictWithoutMarkers(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	gitT(t, w.side, "switch", "-q", "main")
	gitT(t, w.side, "pull", "-q", "--ff-only", "origin", "main")
	gitT(t, w.side, "fetch", "-q", "origin")
	gitT(t, w.side, "merge", "-q", "--ff-only", "origin/coder/x")
	gitT(t, w.side, "rm", "-q", "mine.txt")
	gitT(t, w.side, "commit", "-q", "-m", "main drops mine.txt")
	gitT(t, w.side, "push", "-q", "origin", "main")
	write(t, filepath.Join(w.clone, "mine.txt"), "the coder edits it\n")
	gitT(t, w.clone, "commit", "-q", "-am", "edit mine.txt")
	gitT(t, w.clone, "push", "-q", "origin", "coder/x")
	w.run(t, "--apply")

	got := w.run(t, "--apply")

	inRebase := exists(filepath.Join(w.clone, ".git/rebase-merge"))
	if got.code == 0 || !inRebase || !strings.Contains(envelopeOf(got).Error, "mine.txt") {
		t.Fatalf("exit %d, in rebase %v, want a refusal naming mine.txt:\n%s", got.code, inRebase, got.stdout)
	}
}

func TestRebaseMainRefusesToContinueOverConflictMarkers(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "mine.txt", "main's version\n")
	w.run(t, "--apply")
	before := remoteHead(t, w, "coder/x")
	if err := os.MkdirAll(filepath.Join(w.clone, "deep/er"), 0o755); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, filepath.Join(w.clone, "deep/er"), nil, "lane", "rebase-main", "--apply")

	inRebase := exists(filepath.Join(w.clone, ".git/rebase-merge"))
	if got.code == 0 || !inRebase || remoteHead(t, w, "coder/x") != before || !strings.Contains(envelopeOf(got).Error, "mine.txt") {
		t.Fatalf("exit %d, in rebase %v, want a refusal naming mine.txt and the rebase kept:\n%s", got.code, inRebase, got.stdout)
	}
}

// a server hook moves the ref after the push lands: the read-back must catch it
func TestRebaseMainNamesARemoteThatDiffersAfterThePush(t *testing.T) {
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "one.txt", "one\n")
	mainSha := remoteHead(t, w, "main")
	write(t, filepath.Join(w.origin, "hooks/post-receive"), "#!/bin/sh\ngit update-ref refs/heads/coder/x "+mainSha+"\n")

	got := w.run(t, "--apply")

	if got.code == 0 || !strings.Contains(envelopeOf(got).Error, "remote is "+mainSha) {
		t.Fatalf("exit %d, error %q, want the read-back to name the remote", got.code, envelopeOf(got).Error)
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
