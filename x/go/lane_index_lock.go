package main

import (
	"fmt"
	"os"
	"strings"
	"time"
)

const (
	// a peer session's git holds the shared index lock for a moment; commit waits it out before add and commit
	lockWait  = 30 * time.Second
	lockPause = 200 * time.Millisecond
)

// lockedGit runs a git that takes the index lock: it waits out a lock a peer holds, and once more when the lock
// was taken again in the gap between the wait and the run
func lockedGit(args ...string) (result, time.Duration, error) {
	return lockedGitAfter(func() {}, args...)
}

// lockedGit with a step that runs after each wait, right before its git
func lockedGitAfter(ready func(), args ...string) (result, time.Duration, error) {
	took, err := waitIndexLock()
	if err != nil {
		return result{}, took, err
	}
	ready()
	got, _ := git(args...)
	if got.ok || !strings.Contains(got.log, "index.lock': File exists") {
		return got, took, nil
	}
	again, err := waitIndexLock()
	if err != nil {
		return result{}, took + again, err
	}
	ready()
	got, _ = git(args...)
	return got, took + again, nil
}

// a wait or a poll an env var shortens, under X_TEST only
func durationEnv(name string, fallback time.Duration) time.Duration {
	if os.Getenv("X_TEST") != "" {
		if d, err := time.ParseDuration(os.Getenv(name)); err == nil {
			return d
		}
	}
	return fallback
}

// waitIndexLock waits while the repo's index lock exists, up to lockWait; it never removes a lock itself
func waitIndexLock() (time.Duration, error) {
	// a dry run's git reads its own temp index, and --git-path index.lock names the real one all the same
	if os.Getenv("GIT_INDEX_FILE") != "" {
		return 0, nil
	}
	lock, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-path", "index.lock")
	if err != nil {
		return 0, err
	}
	deadline := durationEnv("X_LOCK_WAIT", lockWait)
	started := time.Now()
	for {
		info, err := os.Stat(lock)
		if err != nil {
			return time.Since(started), nil
		}
		if time.Since(started) >= deadline {
			return time.Since(started), &Fail{
				Msg:  fmt.Sprintf("index lock still held after %s: %s, %s old", deadline, lock, time.Since(info.ModTime()).Round(time.Second)),
				Next: "ps -A | grep '[g]it ' — a live git: wait and rerun; none: a crash left the lock, check it, then remove it by hand",
			}
		}
		time.Sleep(lockPause)
	}
}

// withWait leads a step's line with the wait, when there was one
func withWait(waited time.Duration, line string) string {
	if waited < lockPause {
		return line
	}
	said := fmt.Sprintf("index lock held, waited %s", waited.Round(time.Second))
	if line == "" {
		return said
	}
	return said + "; " + line
}
