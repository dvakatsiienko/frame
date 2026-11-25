package main

import (
	"errors"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var lockHolder = regexp.MustCompile(`\(pid (\d+) start ([^)]+)\)`)

// a lock outlives a session that was stopped; its pid and start time, read together, say whether the holder is still that
// process. a lock that names no pid cannot be read, so it holds
func lockSays(e worktreeEntry) string {
	if why, _ := staleLock(e); why != "" {
		return "its lock is stale, " + why + ": git worktree unlock " + e.path
	}
	return "a live session holds it"
}

// why a tree's lock no longer holds, "" while its holder lives or the lock names none; isGone only when no process holds the
// pid, the one case landed unlocks by itself
func staleLock(e worktreeEntry) (why string, isGone bool) {
	return staleLockBy(e, processStarted)
}

// gone is the kernel's word alone (kill 0 answers no such process); a ps that did not run, or printed nothing for a
// live pid, holds, since a spawn failure under this mac's process limit must never read as a dead holder
func staleLockBy(e worktreeEntry, startOf func(int) string) (why string, isGone bool) {
	holder := lockHolder.FindStringSubmatch(e.lockReason)
	if !e.locked || holder == nil {
		return "", false
	}
	pid, _ := strconv.Atoi(holder[1])
	if err := syscall.Kill(pid, 0); errors.Is(err, syscall.ESRCH) {
		return "pid " + holder[1] + " is gone", true
	}
	if sameStart(holder[2], startOf(pid), time.Local) {
		return "", false
	}
	return "pid " + holder[1] + " is another process now", false
}

// cc stamps a lock's start in UTC and ps prints it in local time: the two are one instant or not; a stamp or a ps answer
// that does not parse (an empty one included) reads as the same start, so what cannot be read holds
func sameStart(lock, ps string, local *time.Location) bool {
	const layout = "Mon Jan 2 15:04:05 2006"
	lock = strings.Join(strings.Fields(lock), " ")
	at, err := time.ParseInLocation(layout, ps, local)
	if err != nil || lock == ps {
		return true
	}
	asUTC, utcErr := time.ParseInLocation(layout, lock, time.UTC)
	asLocal, localErr := time.ParseInLocation(layout, lock, local)
	return (utcErr != nil && localErr != nil) || asUTC.Equal(at) || asLocal.Equal(at)
}
