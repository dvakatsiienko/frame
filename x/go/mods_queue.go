package main

import (
	"bytes"
	"io"
	"os"
	"os/exec"
	"strings"
)

// `claude plugin test` on a mod's overlay. a whole suite is a long round: it takes the machine-wide long turn of gate-queue.sh, so two
// heavy suites never run at once, and a wait prints the queue's own line, who holds the turn, to stderr as it comes. a run narrowed to some
// files is a short one and goes straight through
func runSuite(overlay string, whole bool) (result, error) {
	if !whole {
		return run("", nil, "", "claude", "plugin", "test", overlay)
	}
	argv := inLongSlot([]string{"claude", "plugin", "test", overlay})
	c := exec.Command(argv[0], argv[1:]...)
	c.Env = os.Environ()
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, io.MultiWriter(&stderr, queueSaid{})
	err := c.Run()
	out := strings.TrimSpace(stdout.String())
	errText := withoutQueueLines(stderr.String())
	if err != nil && strings.TrimSpace(errText) == "" {
		errText = err.Error()
	}
	return result{ok: err == nil, out: out, log: strings.TrimSpace(out + "\n" + errText)}, err
}

// the queue's wait lines, passed on to stderr as they are written
type queueSaid struct{}

func (queueSaid) Write(p []byte) (int, error) {
	for line := range strings.SplitSeq(string(p), "\n") {
		if strings.HasPrefix(line, "gate-queue: ") {
			_, _ = os.Stderr.WriteString(line + "\n")
		}
	}
	return len(p), nil
}
