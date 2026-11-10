package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// the reason cc writes on the tree it locks, copied from a real row: `locked claude session <name> (pid <n> start <lstart>)`
func ccLock(pid int, started string) string {
	return fmt.Sprintf("claude session FRM-1-tree (pid %d start %s)", pid, started)
}

func deadPid(t *testing.T) int {
	t.Helper()
	gone := exec.Command("sh", "-c", "exit 0")
	if err := gone.Run(); err != nil {
		t.Fatal(err)
	}
	return gone.Process.Pid
}

func treeLockCases(t *testing.T) []struct {
	name, reason string
	stale        bool
} {
	t.Helper()
	self := os.Getpid()
	return []struct {
		name, reason string
		stale        bool
	}{
		{"a dead pid", ccLock(deadPid(t), "Tue Nov 10 17:25:12 2026"), true},
		{"a live pid with another start time", ccLock(self, "Mon Jan 1 00:00:00 2001"), true},
		{"a live pid with its own start time", ccLock(self, processStarted(self)), false},
		{"a lock with no pid", "held by hand", false},
		{"a lock with no reason", "", false},
	}
}

func lockTree(t *testing.T, main, tree, reason string) {
	t.Helper()
	args := []string{"worktree", "lock"}
	if reason != "" {
		args = append(args, "--reason", reason)
	}
	gitT(t, main, append(args, tree)...)
}

func TestDecampReadsATreeLockAgainstItsHolder(t *testing.T) {
	t.Parallel()
	for _, c := range treeLockCases(t) {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			main := repo(t)
			tree := filepath.Join(t.TempDir(), "tree")
			gitT(t, main, "worktree", "add", "-q", tree, "-b", "side")
			tree, _ = filepath.EvalSymlinks(tree)
			lockTree(t, main, tree, c.reason)

			got := xIn(t, main, nil, "lane", "decamp", tree, "--apply")

			said := envelopeOf(got).Error
			if got.code != 1 || !exists(tree) {
				t.Fatalf("exit %d, tree there %v: a locked tree stays:\n%s", got.code, exists(tree), got.stdout)
			}
			if stale := strings.Contains(said, "stale") && strings.Contains(said, "git worktree unlock "+tree); stale != c.stale {
				t.Errorf("stale and naming the unlock: %v, want %v: %s", stale, c.stale, said)
			}
			if held := strings.Contains(said, "a live session holds it"); held == c.stale {
				t.Errorf("reads as held: %v, want %v: %s", held, !c.stale, said)
			}
		})
	}
}

func TestLandedReadsATreeLockAgainstItsHolder(t *testing.T) {
	t.Parallel()
	for _, c := range treeLockCases(t) {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			w.done(t)
			tree := w.laneTree(t, "locked")
			lockTree(t, w.repo, tree, c.reason)

			envelope, _ := runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)}, "lane", "landed", "FRM-1", "--repo", w.repo, "--apply")

			said := linesOf(envelope)
			if !exists(tree) {
				t.Fatalf("a locked tree was taken:\n%s", said)
			}
			if stale := strings.Contains(said, "stale") && strings.Contains(said, "git worktree unlock"); stale != c.stale {
				t.Errorf("stale and naming the unlock: %v, want %v:\n%s", stale, c.stale, said)
			}
			if held := strings.Contains(said, "a live session holds it"); held == c.stale {
				t.Errorf("reads as held: %v, want %v:\n%s", held, !c.stale, said)
			}
		})
	}
}
