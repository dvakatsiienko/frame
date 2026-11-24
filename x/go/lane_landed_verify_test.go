package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// dima's o4 (FRM-660, 23 Nov) reverses FRM-649: a clean verify-<sha> tree whose sha is on origin/main is decamped whichever lane
// made it. FRM-649 protected a tree a live sixth sense sat in (the herdr lane's verify-ba8bcd9, 2026-11-18); that stays kept by
// treeStay's live-session read, proven in TestLandedKeepsATreeALiveSessionLocked
func TestLandedDecampsAnotherLanesCleanVerifyTreeOnMain(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	gitT(t, w.repo, "reset", "-q", "--hard", "HEAD~1")
	write(t, filepath.Join(w.repo, "q.txt"), "the quick change\n")
	gitT(t, w.repo, "add", "q.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 x-mod-guard: a rule refuses (FRM-1)", "-m", "Agent: codie · Claude Sonnet 5.5")
	write(t, filepath.Join(w.repo, "other.txt"), "another lane\n")
	gitT(t, w.repo, "add", "other.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 herdr: another lane's step (FRM-12)")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	other := gitT(t, w.repo, "rev-parse", "HEAD")
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+other[:7])
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, other)

	envelope, _ := w.landed(t, "--apply")

	if exists(verify) {
		t.Errorf("another lane's clean verify-<sha> tree on main was not decamped:\n%s", linesOf(envelope))
	}
}

func TestLandedDryRunNamesACleanVerifyTreeOnMainAndKeepsIt(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, "other.txt"), "another lane\n")
	gitT(t, w.repo, "add", "other.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 herdr: another lane's step (FRM-12)")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	sha := gitT(t, w.repo, "rev-parse", "HEAD")
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+sha[:7])
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, sha)

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !exists(verify) || !strings.Contains(out, "verify-"+sha[:7]+" is clean, decamped on --apply") {
		t.Errorf("tree there: %v, want it kept and named as decamped on --apply:\n%s", exists(verify), out)
	}
}

func TestLandedNamesADirtyVerifyTreeOnMainAndLeavesIt(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, "other.txt"), "another lane\n")
	gitT(t, w.repo, "add", "other.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 herdr: another lane's step (FRM-12)")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	sha := gitT(t, w.repo, "rev-parse", "HEAD")
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+sha[:7])
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, sha)
	write(t, filepath.Join(verify, "unsaved.txt"), "a half-done probe\n")

	envelope, _ := w.landed(t, "--apply")

	if out := linesOf(envelope); !exists(verify) || !strings.Contains(out, "verify-"+sha[:7]+" stays") || !strings.Contains(out, "✅ trees") {
		t.Errorf("tree there: %v, want it kept, named as staying, and the trees line green (another lane's tree never holds this landing):\n%s", exists(verify), out)
	}
}

func TestLandedLeavesAVerifyTreeWhoseShaIsNotOnMain(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, "ahead.txt"), "not on origin/main\n")
	gitT(t, w.repo, "add", "ahead.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "an unpushed change")
	sha := gitT(t, w.repo, "rev-parse", "HEAD")
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+sha[:7])
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, sha)

	envelope, _ := w.landed(t, "--apply")

	if out := linesOf(envelope); !exists(verify) || strings.Contains(out, "verify-"+sha[:7]) {
		t.Errorf("tree there: %v, want it kept and not named at all:\n%s", exists(verify), out)
	}
}
