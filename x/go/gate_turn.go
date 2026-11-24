package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// takeGateTurn waits for the machine-wide gate turn through frame's script, so one script keeps the queue's rules; the
// returned func leaves it with the run's exit code, and a dead x's closed pipe frees it. a go test takes no turn unless it
// asks: the suite must not serialize, and a test inside a commit's own hook must not wait on that commit
func takeGateTurn(label, again string) (func(error), error) {
	if os.Getenv("X_TEST") != "" && os.Getenv("X_GATE_TURN") == "" {
		return func(error) {}, nil
	}
	return takeTurn("gate", "--hold", label, again)
}

// takeTurn holds one slot's turn through the script's own hold door until the returned func is called
func takeTurn(slot, door, label, again string) (func(error), error) {
	stay := func(error) {}
	script := filepath.Join(frameRoot(), gateQueueScript)
	if !exists(script) {
		return stay, nil
	}
	c := exec.Command(script, door, label)
	c.Stderr = os.Stderr
	to, err := c.StdinPipe()
	if err != nil {
		return stay, err
	}
	from, err := c.StdoutPipe()
	if err != nil {
		return stay, err
	}
	if err := c.Start(); err != nil {
		fmt.Fprintf(os.Stderr, "%s turn: %v, running with no turn\n", slot, err)
		return stay, nil
	}
	ready, _ := bufio.NewReader(from).ReadString('\n')
	if strings.TrimSpace(ready) != gateQueueReady {
		_ = c.Wait()
		code := c.ProcessState.ExitCode()
		if code == gateQueueDeadline {
			return stay, &Fail{Msg: "the " + slot + " turn's wait passed its deadline, nothing ran; the holder is named above", Next: again}
		}
		// an interrupt while it waits reaches the queue, never x: the run stops, as it would have in line
		if code == 130 || code == 143 || code < 0 {
			return stay, &Fail{Msg: "stopped while it waited for the " + slot + " turn, nothing ran", Next: again}
		}
		// a broken queue never blocks a commit
		fmt.Fprintf(os.Stderr, "%s turn: the queue exited %d, running with no turn\n", slot, code)
		return stay, nil
	}
	before, had := os.LookupEnv(gateQueueHeld)
	_ = os.Setenv(gateQueueHeld, slot)
	return func(stopped error) {
		if had {
			_ = os.Setenv(gateQueueHeld, before)
		} else {
			_ = os.Unsetenv(gateQueueHeld)
		}
		code := 0
		if stopped != nil {
			code = 1
		}
		fmt.Fprintf(to, "%d\n", code)
		_ = to.Close()
		_ = c.Wait()
	}, nil
}

// a pairs round is a batch: it holds the gate queue's long turn around a group of pairs and gives it back between groups, so a
// lane's whole suite waits for one group, never for the round (two batches held it 21 min each and four suites stood 7 to 16
// behind them, 23 and 24 nov); inside a held long turn it takes none, and a test stays off the real slot unless it plants a queue
const redGroup = 2 * time.Minute

type redTurn struct {
	again string
	group time.Duration
	leave func(error)
	took  time.Time
}

func newRedTurn() (*redTurn, error) {
	words := []string{"x"}
	for _, word := range os.Args[1:] {
		if strings.ContainsAny(word, " \t\"'$`\\;&|<>()*?") {
			word = "'" + strings.ReplaceAll(word, "'", `'\''`) + "'"
		}
		words = append(words, word)
	}
	t := &redTurn{again: strings.Join(words, " "), group: redGroup}
	if os.Getenv(gateQueueHeld) == "long" || os.Getenv("X_TEST") != "" && os.Getenv("X_FRAME_ROOT") == "" {
		return t, nil
	}
	if short, err := time.ParseDuration(os.Getenv("X_RED_GROUP")); err == nil {
		t.group = short
	}
	return t, t.take()
}

func (t *redTurn) take() error {
	leave, err := takeTurn("long", "--hold-long", t.again, t.again)
	if err != nil {
		return err
	}
	t.leave, t.took = leave, time.Now()
	return nil
}

// next gives the turn back and takes the next one once the group is spent
func (t *redTurn) next() error {
	if t.leave == nil || time.Since(t.took) < t.group {
		return nil
	}
	t.close(nil)
	err := t.take()
	if fail, ok := errors.AsType[*Fail](err); ok {
		fail.Msg += " of this group; the finished pairs are saved and the same command resumes"
	}
	return err
}

func (t *redTurn) close(stopped error) {
	if t.leave != nil {
		t.leave(stopped)
		t.leave = nil
	}
}
