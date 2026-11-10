package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

var gateRunLog = regexp.MustCompile(`(?m)^log (.+)$`)

// a command printing n numbered lines, half of them on stderr, then leaving with the code
func numberedLines(n, code int) []string {
	return []string{"sh", "-c", fmt.Sprintf("i=1; while [ $i -le %d ]; do if [ $((i %% 2)) -eq 0 ]; then echo line $i; else echo line $i >&2; fi; i=$((i+1)); done; exit %d", n, code)}
}

func gateRunLogOf(t *testing.T, stdout string) string {
	t.Helper()
	found := gateRunLog.FindStringSubmatch(stdout)
	if found == nil {
		t.Fatalf("no log line in:\n%s", stdout)
	}
	raw, err := os.ReadFile(found[1])
	if err != nil {
		t.Fatalf("the log path does not hold a file: %v", err)
	}
	return string(raw)
}

func TestGateRunPrintsTheStatusTheLogAndTheLastLines(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		lines int
		code  int
	}{
		{"a red command", 40, 3},
		{"a green command", 40, 0},
		{"a command shorter than the tail", 4, 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			state, env := turnOn(t)

			got := xIn(t, t.TempDir(), env, append([]string{"gate", "run", "--"}, numberedLines(c.lines, c.code)...)...)

			if got.code != c.code {
				t.Fatalf("exit %d, want the command's %d:\n%s", got.code, c.code, got.stdout)
			}
			if !strings.HasPrefix(got.stdout, fmt.Sprintf("exit %d\n", c.code)) {
				t.Errorf("stdout does not open with the exit status:\n%s", got.stdout)
			}
			log := gateRunLogOf(t, got.stdout)
			if !strings.HasPrefix(gateRunLog.FindStringSubmatch(got.stdout)[1], filepath.Join(state, "gate-runs")+string(filepath.Separator)) {
				t.Errorf("the log sits outside the state dir's gate-runs:\n%s", got.stdout)
			}
			for i := 1; i <= c.lines; i++ {
				line := fmt.Sprintf("line %d\n", i)
				if !strings.Contains(log, line) {
					t.Errorf("the log lacks %q", line)
				}
				if printed, want := strings.Contains(got.stdout, line), i > c.lines-30; printed != want {
					t.Errorf("%q printed: %v, want %v", strings.TrimSpace(line), printed, want)
				}
			}
			if rows := rowsOfSlot(queueRows(t, state), "long"); len(rows) != 1 || rows[0][5] != fmt.Sprint(c.code) {
				t.Errorf("queue rows %v, want one long row at exit %d", queueRows(t, state), c.code)
			}
		})
	}
}

func TestGateRunWaitsBehindALongRound(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	turn := filepath.Join(state, "gate-queue.long.turn")
	if err := os.Rename(plantLiveHolder(t, state), turn); err != nil {
		t.Fatal(err)
	}
	ran := filepath.Join(t.TempDir(), "ran")

	runner := xStart(t, t.TempDir(), append(env, "GATE_QUEUE_POLL=0.1"), "gate", "run", "--", "touch", ran)
	ended := make(chan error, 1)
	go func() { ended <- runner.Wait() }()

	until(t, "the runner's ticket", func() bool {
		tickets, _ := os.ReadDir(turn + ".tickets")
		return len(tickets) == 1
	})
	time.Sleep(300 * time.Millisecond)
	if exists(ran) {
		t.Fatal("the command ran while a long round held the turn")
	}
	if err := os.RemoveAll(turn); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-ended:
		if err != nil || !exists(ran) {
			t.Errorf("after the turn was free: %v, ran %v", err, exists(ran))
		}
	case <-time.After(turnWait):
		_ = runner.Process.Kill()
		t.Errorf("still waiting %s after the turn was free", turnWait)
	}
}

func TestGateRunNeverMakesItsCommandWaitBehindIt(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	script, err := filepath.Abs("../../" + gateQueueScript)
	if err != nil {
		t.Fatal(err)
	}

	got := xIn(t, t.TempDir(), append(env, "GATE_QUEUE_WAIT=5"), "gate", "run", "--", script, "--long", "echo", "inner ran")

	if got.code != 0 || !strings.Contains(got.stdout, "inner ran") {
		t.Fatalf("exit %d, want 0 with the inner line:\n%s", got.code, got.stdout)
	}
	if rows := queueRows(t, state); len(rows) != 1 {
		t.Errorf("queue rows %v, want the runner's one turn", rows)
	}
}

func TestGateRunTakesNoTurnUnderXTest(t *testing.T) {
	t.Parallel()
	state := t.TempDir()

	got := xIn(t, t.TempDir(), []string{"X_STATE=" + state, "GATE_QUEUE_HELD="}, "gate", "run", "--", "echo", "plain")

	if got.code != 0 || !strings.Contains(got.stdout, "plain") {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	if rows := queueRows(t, state); rows != nil {
		t.Errorf("a runner under X_TEST logged a turn: %v", rows)
	}
}

func TestGateRunRefusesWithNothingToRun(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		args []string
	}{
		{"no command", []string{"gate", "run"}},
		{"an empty dash", []string{"gate", "run", "--"}},
		{"a command that is not there", []string{"gate", "run", "--", "no-such-command-anywhere"}},
		// a dash further in is the command's own: cobra would drop it and run another command than the guard read
		{"a command with no dash", []string{"gate", "run", "echo", "ran"}},
		{"words ahead of the dash", []string{"gate", "run", "echo", "--", "ran"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			state := t.TempDir()
			if got := xIn(t, t.TempDir(), []string{"X_STATE=" + state}, c.args...); got.code != 2 {
				t.Errorf("exit %d, want 2:\n%s", got.code, got.stdout)
			}
			if logs, _ := os.ReadDir(filepath.Join(state, "gate-runs")); len(logs) != 0 {
				t.Errorf("a refused run left %d logs", len(logs))
			}
		})
	}
}

func TestGateRunKeepsItsNewestLogs(t *testing.T) {
	t.Parallel()
	state := t.TempDir()
	dir := filepath.Join(state, "gate-runs")
	for i := range gateRunsKept + 5 {
		write(t, filepath.Join(dir, fmt.Sprintf("20261101T0000%02dZ-1.log", i)), "old\n")
	}
	// older than every log, and not one: a file x did not write is never x's to remove
	foreign := filepath.Join(dir, "00-notes.txt")
	write(t, foreign, "someone's\n")
	long := time.Now().Add(-48 * time.Hour)
	if err := os.Chtimes(foreign, long, long); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, t.TempDir(), []string{"X_STATE=" + state}, "gate", "run", "--", "echo", "new")

	if !exists(foreign) {
		t.Fatalf("the run removed %s, a file it never wrote", foreign)
	}
	logs, _ := filepath.Glob(filepath.Join(dir, "*.log"))
	if got.code != 0 || len(logs) != gateRunsKept {
		t.Fatalf("exit %d, %d logs, want %d", got.code, len(logs), gateRunsKept)
	}
	if filepath.Base(logs[0]) != "20261101T000006Z-1.log" || !strings.Contains(gateRunLogOf(t, got.stdout), "new") {
		t.Errorf("the oldest kept is %s, want the six oldest gone and the new log kept", logs[0])
	}
}
