package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func gitDirOf(t *testing.T, tree string) string {
	t.Helper()
	pointer, err := os.ReadFile(filepath.Join(tree, ".git"))
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimPrefix(strings.TrimSpace(string(pointer)), "gitdir: ")
}

// what a tree untouched since `at` looks like: every file of its git admin dir, and the dir, last changed then
func setGitDirTimes(t *testing.T, tree string, at time.Time) {
	t.Helper()
	err := filepath.WalkDir(gitDirOf(t, tree), func(path string, _ fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		return os.Chtimes(path, at, at)
	})
	if err != nil {
		t.Fatal(err)
	}
}

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
	setGitDirTimes(t, verify, time.Now().Add(-3*time.Hour))

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
	setGitDirTimes(t, verify, time.Now().Add(-3*time.Hour))

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
	setGitDirTimes(t, verify, time.Now().Add(-3*time.Hour))
	write(t, filepath.Join(verify, "unsaved.txt"), "a half-done probe\n")

	envelope, _ := w.landed(t, "--apply")

	if out := linesOf(envelope); !exists(verify) || !strings.Contains(out, "verify-"+sha[:7]+" stays") || !strings.Contains(out, "✅ trees") {
		t.Errorf("tree there: %v, want it kept, named as staying, and the trees line green (another lane's tree never holds this landing):\n%s", exists(verify), out)
	}
}

// a session that only reads a tree by path moves nothing in its git dir (probed on apfs, 24 Nov), so that dir's newest file is the
// one age a tree has: touched in the last 2 hours it stays, named, and never holds this landing. a pure reader on an older tree is
// the gap the FTR line names
func TestLandedKeepsAnotherLanesVerifyTreeTouchedInTheLastTwoHours(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		age   time.Duration // the whole git dir's age; 0 leaves it as created
		index time.Duration // the index alone, set after; 0 leaves it with the rest
		kept  bool
	}{
		{"created just now", 0, 0, true},
		{"untouched for 1h50", 110 * time.Minute, 0, true},
		{"untouched for 2h10", 130 * time.Minute, 0, false},
		{"3h old, git ran in it 30 min ago", 3 * time.Hour, 30 * time.Minute, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			write(t, filepath.Join(w.repo, "other.txt"), "another lane\n")
			gitT(t, w.repo, "add", "other.txt")
			gitT(t, w.repo, "commit", "-q", "-m", "🔧 herdr: another lane's step (FRM-12)")
			gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
			sha := gitT(t, w.repo, "rev-parse", "HEAD")
			verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+sha[:7])
			gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, sha)
			if c.age > 0 {
				setGitDirTimes(t, verify, time.Now().Add(-c.age))
			}
			if c.index > 0 {
				at := time.Now().Add(-c.index)
				if err := os.Chtimes(filepath.Join(gitDirOf(t, verify), "index"), at, at); err != nil {
					t.Fatal(err)
				}
			}

			envelope, _ := w.landed(t, "--apply")

			out := linesOf(envelope)
			if c.kept && (!exists(verify) || !strings.Contains(out, "verify-"+sha[:7]+" stays: recently touched") || !strings.Contains(out, "✅ trees")) {
				t.Errorf("tree there: %v, want it kept, named «recently touched», the trees line green:\n%s", exists(verify), out)
			}
			if !c.kept && exists(verify) {
				t.Errorf("a tree untouched past 2 hours was kept:\n%s", out)
			}
		})
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
