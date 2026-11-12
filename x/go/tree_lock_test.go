package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// a ps that does not run (a spawn refused under the process limit, no ps on PATH) holds a live pid's lock; only the
// kernel's «no such process» reads gone (sixth sense round 2 on #172)
func TestALockWhosePsDidNotRunHolds(t *testing.T) {
	t.Parallel()
	noPs := func(int) string { return "" }
	live := worktreeEntry{locked: true, lockReason: ccLock(os.Getpid(), "Thu Nov 12 11:36:41 2026")}
	if why, isGone := staleLockBy(live, noPs); why != "" || isGone {
		t.Errorf("a live pid with no ps answer reads %q, gone %v; want it held", why, isGone)
	}
	dead := worktreeEntry{locked: true, lockReason: ccLock(deadPid(t), "Thu Nov 12 11:36:41 2026")}
	if _, isGone := staleLockBy(dead, noPs); !isGone {
		t.Errorf("a dead pid must read gone whatever ps says")
	}
	zero := worktreeEntry{locked: true, lockReason: ccLock(0, "Thu Nov 12 11:36:41 2026")}
	if why, _ := staleLockBy(zero, noPs); why != "" {
		t.Errorf("pid 0 reads %q; want it held", why)
	}
}

// cc stamps a lock's start in UTC, ps prints local time: at UTC+2, 11:36 in the lock is 13:36 in ps (clio's measure, 19:32)
func TestALockStampedInUTCMatchesALocalPsStart(t *testing.T) {
	t.Parallel()
	kyiv := time.FixedZone("UTC+2", 2*60*60)
	const ps = "Thu Nov 12 13:36:41 2026"
	for _, c := range []struct {
		name, lock string
		isSame     bool
	}{
		{"the same instant in UTC", "Thu Nov 12 11:36:41 2026", true},
		{"the same instant in local time", "Thu Nov 12 13:36:41 2026", true},
		{"an hour off", "Thu Nov 12 12:36:41 2026", false},
		{"a padded day in UTC", "Thu Nov  2 11:36:41 2026", false},
	} {
		if got := sameStart(c.lock, ps, kyiv); got != c.isSame {
			t.Errorf("%s: same %v, want %v", c.name, got, c.isSame)
		}
	}
}

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
	// cc stamps the lock in UTC, ps prints local time: the same instant either way holds
	own, _ := time.ParseInLocation("Mon Jan 2 15:04:05 2006", processStarted(self), time.Local)
	return []struct {
		name, reason string
		stale        bool
	}{
		{"a dead pid", ccLock(deadPid(t), "Tue Nov 10 17:25:12 2026"), true},
		{"a live pid with another start time", ccLock(self, "Mon Jan 1 00:00:00 2001"), true},
		{"a live pid with its own start time", ccLock(self, processStarted(self)), false},
		{"a live pid with its own start stamped in UTC", ccLock(self, own.UTC().Format("Mon Jan _2 15:04:05 2006")), false},
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

			env := []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)}
			planned, _ := runLinear(t, w.server, env, "lane", "landed", "FRM-1", "--repo", w.repo)
			_, got := runLinear(t, w.server, env, "lane", "landed", "FRM-1", "--repo", w.repo, "--apply")

			said := linesOf(planned)
			// FRM-572 exit 6: a lock whose pid is gone holds no clean tree, landed unlocks it, named; a reused pid only names
			// the unlock, and a live holder keeps it
			isGone := c.name == "a dead pid"
			if exists(tree) == isGone {
				t.Fatalf("tree there %v, want %v:\n%s\n%s%s", exists(tree), !isGone, said, got.stdout, got.stderr)
			}
			if unlocks := strings.Contains(said, "its stale lock (pid"); unlocks != isGone {
				t.Errorf("unlocks the stale lock: %v, want %v:\n%s", unlocks, isGone, said)
			}
			if named := strings.Contains(said, "stale") && strings.Contains(said, "unlock"); named != c.stale {
				t.Errorf("names the stale lock: %v, want %v:\n%s", named, c.stale, said)
			}
			if held := strings.Contains(said, "a live session holds it"); held == c.stale {
				t.Errorf("reads as held: %v, want %v:\n%s", held, !c.stale, said)
			}
		})
	}
}
