package main

import (
	"os"
	"time"
)

// under X_TEST, X_FAKE_SLEEP counts the waits instead of sleeping them; core, so a build without the stacks add-on has it
type waitClock struct {
	start   time.Time
	skipped time.Duration
	fake    bool
}

func newWaitClock() *waitClock {
	return &waitClock{start: time.Now(), fake: os.Getenv("X_TEST") != "" && os.Getenv("X_FAKE_SLEEP") != ""}
}

func (c *waitClock) elapsed() time.Duration { return time.Since(c.start) + c.skipped }

func (c *waitClock) sleep(d time.Duration) {
	if c.fake {
		c.skipped += d
		return
	}
	time.Sleep(d)
}
