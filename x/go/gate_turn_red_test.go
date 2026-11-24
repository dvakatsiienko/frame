package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// a frame root holding the real queue, with a state of its own, and the env a pairs round takes turns in
func redQueue(t *testing.T, group string) (state string, env []string) {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	state = t.TempDir()
	return state, []string{"X_FRAME_ROOT=" + root, "X_STATE=" + state, "X_RED_GROUP=" + group, "GATE_QUEUE_HELD=", "GATE_QUEUE_POLL=0.1"}
}

// exit line 10: a pairs round takes the gate queue's long turn itself, one for a whole group
func TestVerifyRedPairsTakeTheLongTurnOnceAGroup(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		group string
		turns int
	}{{"1h", 1}, {"1ns", 3}} {
		t.Run(c.group, func(t *testing.T) {
			t.Parallel()
			f := goRedFixture(t)
			state, env := redQueue(t, c.group)
			pairs := pairsFile(t, "Limit = 3\tLimit = 4", "Limit = 3\tLimit = 5")

			got, _ := verifyRedIn(t, f, env, f.file, "--pairs", pairs, f.test)

			if got.code != 0 || len(pairRows(t, got)) != 2 {
				t.Fatalf("exit %d, want both pairs red inside the slot:\n%s", got.code, got.stdout)
			}
			rows := rowsOfSlot(queueRows(t, state), "long")
			if len(rows) != c.turns {
				t.Fatalf("rows %v, want %d turns on the long slot", rows, c.turns)
			}
			if exists(filepath.Join(state, "gate-queue.long.turn")) {
				t.Error("the round left the long turn taken")
			}
		})
	}
}

// the 24 nov wait: a suite that comes while a round runs takes the turn between two groups, not after the round
func TestVerifyRedPairsLetASuiteThroughBetweenGroups(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	state, env := redQueue(t, "1ns")
	pairs := pairsFile(t, "Limit = 3\tLimit = 4", "Limit = 3\tLimit = 5", "Limit = 3\tLimit = 6")
	bin := t.TempDir()
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\n")
	if err := os.Chmod(filepath.Join(bin, "pnpm"), 0o755); err != nil {
		t.Fatal(err)
	}
	suite := exec.Command(strings.TrimPrefix(env[0], "X_FRAME_ROOT=")+"/"+gateQueueScript, "--long", "pnpm", "x-go:test")
	suite.Env = append(append(cleanEnv(), env...), "PATH="+bin+string(os.PathListSeparator)+os.Getenv("PATH"))
	done := make(chan error, 1)
	turn := filepath.Join(state, "gate-queue.long.turn")
	go func() {
		for deadline := time.Now().Add(turnWait); !exists(filepath.Join(turn, "holder")) && time.Now().Before(deadline); {
			time.Sleep(20 * time.Millisecond)
		}
		done <- suite.Run()
	}()

	got, _ := verifyRedIn(t, f, env, f.file, "--pairs", pairs, f.test)

	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if got.code != 0 || len(pairRows(t, got)) != 3 {
		t.Fatalf("exit %d, want three pairs red:\n%s", got.code, got.stdout)
	}
	rows := rowsOfSlot(queueRows(t, state), "long")
	at := slices.IndexFunc(rows, func(row []string) bool { return strings.Contains(row[7], "x-go:test") })
	if at < 1 || at == len(rows)-1 {
		t.Fatalf("the suite ran %d of %d, want it between the round's groups: %v", at+1, len(rows), rows)
	}
}

// a kill of the line it stands in stops the round, it never runs beside the holder
func TestVerifyRedPairsStopWhenTheirWaitIsKilled(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	root := t.TempDir()
	write(t, filepath.Join(root, gateQueueScript), "#!/bin/sh\nexit 130\n")
	if err := os.Chmod(filepath.Join(root, gateQueueScript), 0o755); err != nil {
		t.Fatal(err)
	}

	got, _ := verifyRedIn(t, f, []string{"X_FRAME_ROOT=" + root, "GATE_QUEUE_HELD="}, f.file, "--pairs", pairsFile(t, "Limit = 3\tLimit = 4"), f.test)

	if got.code == 0 || !strings.Contains(got.stdout, "nothing ran") || !strings.Contains(got.stdout, "--pairs") {
		t.Fatalf("exit %d, want the stop and the command to run again:\n%s", got.code, got.stdout)
	}
}
