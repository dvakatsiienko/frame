package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

const turnWait = 30 * time.Second

// a state dir of its own and the one switch that lets x take a turn under X_TEST; a run inside a real hook must not leak its hold
func turnOn(t *testing.T) (string, []string) {
	t.Helper()
	state := t.TempDir()
	return state, []string{"X_STATE=" + state, "X_GATE_TURN=1", "GATE_QUEUE_HELD="}
}

func plantLiveHolder(t *testing.T, state string) string {
	t.Helper()
	turn := filepath.Join(state, "gate-queue.turn")
	since, err := exec.Command("ps", "-o", "lstart=", "-p", strconv.Itoa(os.Getpid())).Output()
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(turn, "holder"), strconv.Itoa(os.Getpid())+"\n"+strings.TrimSpace(string(since))+"\nold run\n")
	return turn
}

func queueRows(t *testing.T, state string) [][]string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(state, "gate-queue.log"))
	if err != nil {
		return nil
	}
	var rows [][]string
	for _, line := range nonBlank(string(raw)) {
		rows = append(rows, strings.Split(line, "\t"))
	}
	return rows
}

func rowsOfSlot(rows [][]string, slot string) [][]string {
	var kept [][]string
	for _, row := range rows {
		if row[2] == slot {
			kept = append(kept, row)
		}
	}
	return kept
}

func until(t *testing.T, what string, done func() bool) {
	t.Helper()
	deadline := time.Now().Add(turnWait)
	for !done() {
		if time.Now().After(deadline) {
			t.Fatalf("%s: still not after %s", what, turnWait)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

// a repo on a branch holding one edit and a pre-commit hook
func turnRepo(t *testing.T, hook string) string {
	t.Helper()
	dir := repo(t)
	gitT(t, dir, "checkout", "-q", "-b", "codie/turn")
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\n"+hook+"\n")
	write(t, filepath.Join(dir, "readme.txt"), "edit\n")
	return dir
}

func xStart(t *testing.T, dir string, env []string, args ...string) *exec.Cmd {
	t.Helper()
	c := exec.Command(xbin, args...)
	c.Dir = dir
	c.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	if err := c.Start(); err != nil {
		t.Fatal(err)
	}
	return c
}

func TestGateTurnIsNotTakenUnderXTest(t *testing.T) {
	t.Parallel()
	state := t.TempDir()
	plantLiveHolder(t, state)
	dir := turnRepo(t, "true")

	got := xIn(t, dir, []string{"X_STATE=" + state, "GATE_QUEUE_WAIT=1", "GATE_QUEUE_HELD="}, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 {
		t.Fatalf("a commit under X_TEST waited on a turn: exit %d\n%s", got.code, got.stdout)
	}
	if rows := queueRows(t, state); rows != nil {
		t.Errorf("a commit under X_TEST logged a turn: %v", rows)
	}
}

func TestGateTurnWaitsBehindALiveHolder(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		label   string
		fixture func(t *testing.T) (string, []string)
	}{
		{"a commit", "x lane commit readme.txt", func(t *testing.T) (string, []string) {
			return turnRepo(t, "true"), []string{"lane", "commit", message(t), "--", "readme.txt"}
		}},
		{"a held commit", "x lane commit --hold-unstaged readme.txt", func(t *testing.T) (string, []string) {
			return turnRepo(t, "true"), []string{"lane", "commit", "--hold-unstaged", message(t), "--", "readme.txt"}
		}},
		{"a dry commit", "x lane commit --dry", func(t *testing.T) (string, []string) {
			dir, _, msg := dryFixture(t, "pre-commit:\n  commands:\n    fine:\n      run: exit 0\n")
			return dir, []string{"lane", "commit", "--dry", msg, "--", dryNamed}
		}},
		{"a push", "x lane push codie/turn", func(t *testing.T) (string, []string) {
			dir := turnRepo(t, "true")
			origin := t.TempDir()
			gitT(t, origin, "init", "-q", "--bare")
			gitT(t, dir, "remote", "add", "origin", origin)
			return dir, []string{"lane", "push", "--apply"}
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			state, env := turnOn(t)
			turn := plantLiveHolder(t, state)
			dir, args := c.fixture(t)
			head := gitT(t, dir, "rev-parse", "HEAD")

			got := xIn(t, dir, append(env, "GATE_QUEUE_WAIT=1"), args...)

			if got.code != 1 || !strings.Contains(got.stdout, "deadline") {
				t.Fatalf("exit %d, want 1 naming the deadline:\n%s", got.code, got.stdout)
			}
			if gitT(t, dir, "rev-parse", "HEAD") != head {
				t.Error("HEAD moved with no turn")
			}
			if !exists(filepath.Join(turn, "holder")) {
				t.Error("the waiter took the holder's turn")
			}
			rows := queueRows(t, state)
			if len(rows) != 1 || rows[0][2] != "gate" || rows[0][4] != "-" || rows[0][5] != "75" || rows[0][7] != c.label {
				t.Errorf("rows %v, want one gate row at exit 75 labelled %q", rows, c.label)
			}
		})
	}
}

func TestHeldCommitLeavesOtherFilesInTheTreeWhileItWaits(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	plantLiveHolder(t, state)
	dir := turnRepo(t, "true")
	write(t, filepath.Join(dir, "peer.txt"), "a peer's\n")

	got := xIn(t, dir, append(env, "GATE_QUEUE_WAIT=1"), "lane", "commit", "--hold-unstaged", message(t), "--", "readme.txt")

	if got.code != 1 {
		t.Fatalf("exit %d, want 1:\n%s", got.code, got.stdout)
	}
	if !exists(filepath.Join(dir, "peer.txt")) {
		t.Error("a peer's file sat aside through the wait")
	}
	if !strings.Contains(queueRows(t, state)[0][7], "--hold-unstaged") {
		t.Errorf("rows %v", queueRows(t, state))
	}
}

func TestGateTurnRunsEachHookAlone(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	log := filepath.Join(t.TempDir(), "log")
	hook := "echo in >>" + log + "; sleep 1; echo out >>" + log
	first := xStart(t, turnRepo(t, hook), env, "lane", "commit", message(t), "--", "readme.txt")
	second := xStart(t, turnRepo(t, hook), env, "lane", "commit", message(t), "--", "readme.txt")

	if err := first.Wait(); err != nil {
		t.Errorf("first: %v", err)
	}
	if err := second.Wait(); err != nil {
		t.Errorf("second: %v", err)
	}

	if ran := readFile(t, log); ran != "in\nout\nin\nout\n" {
		t.Errorf("the hooks overlapped: %q", ran)
	}
	rows := queueRows(t, state)
	if len(rows) != 2 {
		t.Fatalf("rows %v, want 2", rows)
	}
	waits, runs := 0, 0
	for _, row := range rows {
		wait, _ := strconv.Atoi(row[3])
		run, _ := strconv.Atoi(row[4])
		waits, runs = max(waits, wait), max(runs, run)
		if row[2] != "gate" || row[5] != "0" {
			t.Errorf("row %v, want the gate slot at exit 0", row)
		}
	}
	if waits < 1 || runs < 1 {
		t.Errorf("the rows show wait %d, run %d; both ran a second of hook", waits, runs)
	}
}

func TestGateTurnWrappedTakesOneAndNeverWaitsOnItself(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	dir := turnRepo(t, "true")
	script, err := filepath.Abs("../../" + gateQueueScript)
	if err != nil {
		t.Fatal(err)
	}
	c := exec.Command(script, xbin, "lane", "commit", message(t), "--", "readme.txt")
	c.Dir = dir
	c.Env = append(append(append(cleanEnv(), "X_TEST=1"), env...), "GATE_QUEUE_WAIT=5")
	out, err := c.CombinedOutput()
	if err != nil {
		t.Fatalf("%v\n%s", err, out)
	}
	if !strings.Contains(string(out), "no turn") {
		t.Errorf("the wrapper did not say it takes no turn:\n%s", out)
	}
	rows := queueRows(t, state)
	if len(rowsOfSlot(rows, "gate")) != 1 || len(rowsOfSlot(rows, "none")) != 1 {
		t.Errorf("rows %v, want one gate and one none", rows)
	}
}

func TestGateTurnInsideAHeldTurnNeverWaitsOnIt(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	plantLiveHolder(t, state)
	dir := turnRepo(t, "true")

	got := xIn(t, dir, append(env, "GATE_QUEUE_WAIT=1", "GATE_QUEUE_HELD=gate"), "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 {
		t.Fatalf("exit %d, a commit waited on the turn it sits in:\n%s", got.code, got.stdout)
	}
	if rows := queueRows(t, state); rows != nil {
		t.Errorf("a nested hold logged a row: %v", rows)
	}
}

func TestAHookCallingXNeverWaitsOnItsOwnCommitsTurn(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	inner := turnRepo(t, "true")
	hook := "cd " + inner + " && env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_PREFIX -u GIT_WORK_TREE " + xbin + " lane commit " + message(t) + " -- readme.txt"
	dir := turnRepo(t, hook)

	got := xIn(t, dir, append(env, "GATE_QUEUE_WAIT=2"), "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 {
		t.Fatalf("exit %d, the hook's x waited on the commit that runs it:\n%s", got.code, got.stdout)
	}
	if rows := rowsOfSlot(queueRows(t, state), "gate"); len(rows) != 1 {
		t.Errorf("gate rows %v, want one", rows)
	}
}

func TestARedCommitLogsItsExit(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	got := xIn(t, turnRepo(t, "exit 1"), env, "lane", "commit", message(t), "--", "readme.txt")
	if got.code != 1 {
		t.Fatalf("exit %d, want the hook's red:\n%s", got.code, got.stdout)
	}
	if rows := queueRows(t, state); len(rows) != 1 || rows[0][5] != "1" {
		t.Errorf("rows %v, want one at exit 1", rows)
	}
}

func TestGateTurnIsFreedWhenXDies(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	turn := filepath.Join(state, "gate-queue.turn")
	release := filepath.Join(t.TempDir(), "release")
	t.Cleanup(func() { write(t, release, "") })
	hook := "until [ -e " + release + " ]; do sleep 0.1; done"
	dying := xStart(t, turnRepo(t, hook), env, "lane", "commit", message(t), "--", "readme.txt")
	until(t, "the holder wrote its file", func() bool { return exists(filepath.Join(turn, "holder")) })

	if err := dying.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = dying.Wait()
	until(t, "the turn freed", func() bool { return !exists(turn) })

	got := xIn(t, turnRepo(t, "true"), append(env, "GATE_QUEUE_WAIT=5"), "lane", "commit", message(t), "--", "readme.txt")
	if got.code != 0 {
		t.Fatalf("the next commit: exit %d\n%s", got.code, got.stdout)
	}
	rows := queueRows(t, state)
	if len(rows) != 2 || rows[0][5] != "1" {
		t.Errorf("rows %v, want the dead run's row at exit 1, then the next", rows)
	}
}

func TestABrokenQueueNeverBlocksACommit(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	write(t, filepath.Join(root, gateQueueScript), "#!/bin/sh\necho broken >&2\nexit 3\n")
	_, env := turnOn(t)
	dir := turnRepo(t, "true")

	got := xIn(t, dir, append(env, "X_FRAME_ROOT="+root), "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	if gitT(t, dir, "status", "--porcelain") != "" {
		t.Error("the commit did not land")
	}
}

func TestCommitReadsItsProofAfterTheWait(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name      string
		peerMoves bool
		wantSuite int
	}{
		{"a still HEAD keeps the dry run's proof", false, 1},
		{"a peer's commit in the wait voids it", true, 2},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env, msg, ran := realLefthookWith(t, "")
			state, on := turnOn(t)
			env = append(env, on...)
			if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
				t.Fatalf("dry: exit %d\n%s", got.code, got.stdout)
			}
			turn := plantLiveHolder(t, state)
			waiting := exec.Command(xbin, "lane", "commit", msg, "--", dryNamed)
			waiting.Dir = dir
			waiting.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
			var out bytes.Buffer
			waiting.Stdout, waiting.Stderr = &out, &out
			if err := waiting.Start(); err != nil {
				t.Fatal(err)
			}
			until(t, "the commit took its ticket", func() bool {
				tickets, _ := os.ReadDir(turn + ".tickets")
				for _, ticket := range tickets {
					if !strings.HasPrefix(ticket.Name(), ".") {
						return true
					}
				}
				return false
			})
			if c.peerMoves {
				write(t, filepath.Join(dir, "peer.txt"), "a peer's\n")
				gitT(t, dir, "add", "peer.txt")
				gitT(t, dir, "commit", "-q", "--no-verify", "-m", "peer", "--", "peer.txt")
			}
			if err := os.RemoveAll(turn); err != nil {
				t.Fatal(err)
			}
			if err := waiting.Wait(); err != nil {
				t.Fatalf("the commit: %v\n%s", err, out.String())
			}
			if n := ran("suite"); n != c.wantSuite {
				t.Errorf("the suite ran %d times, want %d:\n%s", n, c.wantSuite, out.String())
			}
		})
	}
}

// a landing script holds no turn: a peer's commit runs beside it, waiting only for the script's own commit
func TestAPeerNeverWaitsBehindALandingScript(t *testing.T) {
	t.Parallel()
	state, env := turnOn(t)
	done := filepath.Join(t.TempDir(), "committed")
	release := filepath.Join(t.TempDir(), "release")
	script, err := filepath.Abs("../../" + gateQueueScript)
	if err != nil {
		t.Fatal(err)
	}
	landing := exec.Command(script, "sh", "-c", xbin+` lane commit "$1" -- readme.txt && touch "$2"; until [ -e "$3" ]; do sleep 0.1; done`, "landing", message(t), done, release)
	landing.Dir = turnRepo(t, "true")
	landing.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	if err := landing.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { write(t, release, ""); _ = landing.Wait() })
	until(t, "the script's own commit landed", func() bool { return exists(done) })

	got := xIn(t, turnRepo(t, "true"), append(env, "GATE_QUEUE_WAIT=5"), "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 {
		t.Fatalf("the peer: exit %d\n%s", got.code, got.stdout)
	}
	if exists(release) {
		t.Fatal("the landing script ended early")
	}
	gate := rowsOfSlot(queueRows(t, state), "gate")
	if len(gate) != 2 {
		t.Fatalf("gate rows %v, want the script's commit and the peer's", gate)
	}
	if wait, _ := strconv.Atoi(gate[1][3]); wait > 1 {
		t.Errorf("the peer waited %d s behind a script that holds no turn", wait)
	}
}
