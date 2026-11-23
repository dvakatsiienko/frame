package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

// three live clio threads on three herdr terminals: a is main, b is wing 1, c is wing 2; d is a wing that is gone and e a crow;
// fake hc and herdr-app log what they are told
type seatWorld struct {
	env                         []string
	store, mainFile, tabs, sent string
	log                         string
	pids                        map[string]int
}

func newSeatWorld(t *testing.T) seatWorld {
	t.Helper()
	const rule = "────────────────────────────────────────"
	sessions, bin := t.TempDir(), t.TempDir()
	w := seatWorld{store: filepath.Join(t.TempDir(), "threads.json"), mainFile: filepath.Join(t.TempDir(), "main-session"), tabs: filepath.Join(bin, "tabs.log"), sent: filepath.Join(bin, "hc.log"), pids: map[string]int{}, log: filepath.Join(bin, "seat.log")}
	for _, name := range []string{"a", "b", "c", "e"} {
		sleeper := exec.Command(os.Args[0])
		sleeper.Env = append(os.Environ(), "X_TEST_LIVE_PID=1")
		if err := sleeper.Start(); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = sleeper.Process.Kill(); _ = sleeper.Wait() })
		w.pids[name] = sleeper.Process.Pid
		write(t, filepath.Join(sessions, name+".json"), fmt.Sprintf(`{"sessionId":"sid-%s","pid":%d}`, name, sleeper.Process.Pid))
	}
	write(t, w.store, fmt.Sprintf(`{"v":1,"threads":[{"sessionId":"sid-a","pid":%d,"role":"coordinator","display":"🦉 clio"},{"sessionId":"sid-b","pid":%d,"role":"wing","wing":1,"display":"🦉🪽 clio: wing 1"},{"sessionId":"sid-c","pid":%d,"role":"wing","wing":2,"display":"🦉🪽 clio: wing 2"},{"sessionId":"sid-d","role":"wing","wing":3,"display":"🦉🪽 clio: wing 3"},{"sessionId":"sid-e","pid":%d,"role":"adviser","display":"🐦‍⬛ crow"}]}`, w.pids["a"], w.pids["b"], w.pids["c"], w.pids["e"]))
	write(t, w.mainFile, fmt.Sprintf("pid=%d\nsession=sid-a\n", w.pids["a"]))
	write(t, filepath.Join(bin, "screen.txt"), "❯ an old prompt\n\n"+rule+"\n❯ \n"+rule+"\n  the status line\n")
	write(t, filepath.Join(bin, "hc"), fmt.Sprintf(`#!/bin/sh
case "$1" in
ls) echo '{"terminals":[{"address":"tA","agent":"claude-code"},{"address":"tB","agent":"claude-code"},{"address":"tC","agent":"claude-code"}]}' ;;
get) case "$2" in tA) pid=%d ;; tB) pid=%d ;; tC) pid=%d ;; esac; echo '{"pid":'$pid',"status":{"state":"done"}}' ;;
read) cat %s ;;
send) echo "send $2 $3" >> %s ;;
esac
`, w.pids["a"], w.pids["b"], w.pids["c"], filepath.Join(bin, "screen.txt"), w.sent))
	write(t, filepath.Join(bin, "herdr-app"), fmt.Sprintf(`#!/bin/sh
case "$1 $2" in
"ls ") echo '{"spaces":[{"tabs":[{"id":"tbA","terminals":[{"terminal":"tA"}]},{"id":"tbB","terminals":[{"terminal":"tB"}]},{"id":"tbC","terminals":[{"terminal":"tC"}]}]}]}' ;;
"do tab.rename") echo "rename $3" >> %s; echo '{}' ;;
esac
`, w.tabs))
	for _, name := range []string{"hc", "herdr-app"} {
		if err := os.Chmod(filepath.Join(bin, name), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	// a frame root that is no repo: without it x waits on the real checkout's index.lock, which a peer's commit holds
	w.env = []string{"X_FRAME_ROOT=" + t.TempDir(), "X_SESSIONS=" + sessions, "X_THREADS=" + w.store, "X_MAIN_SESSION=" + w.mainFile, "X_HC=" + filepath.Join(bin, "hc"), "X_HERDR_APP=" + filepath.Join(bin, "herdr-app"), "X_RENAME_WAIT=0", "X_RENAME_NUDGE=0", "X_SEAT_LOG=" + w.log}
	return w
}

// a switch waits for the store's lock before it reads or writes: while the test holds the lock the child says it waits and the seat
// stays where it was; it moves once the lock is let go
func TestThreadRenameRoleWaitsForTheStoreLock(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	unlock, err := lockThreadStore(w.store)
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan scripted)
	go func() { done <- scriptX(t, w.env, "thread", "rename", "sid-b", "--role", "main") }()

	waitForLine(t, w.log, "waiting on the thread store lock")
	if _, _, main := w.seats(t); main != "sid-a" {
		t.Errorf("main-session names %q while the lock was held, want it unmoved", main)
	}
	unlock()
	if got := <-done; got.code != 0 {
		t.Errorf("exit %d after the lock was let go\n%s", got.code, got.out)
	}
	if roles, _, main := w.seats(t); roles["sid-b"] != "coordinator" || main != "sid-b" {
		t.Errorf("roles %v, main-session %q, want b main once the lock was let go", roles, main)
	}
}

// a line a child logged under X_TEST, waited for by its content; the deadline only guards a hang
func waitForLine(t *testing.T, path, want string) {
	t.Helper()
	for deadline := time.Now().Add(30 * time.Second); !strings.Contains(readFile0(path), want); time.Sleep(20 * time.Millisecond) {
		if time.Now().After(deadline) {
			t.Fatalf("%s never held %q:\n%s", path, want, readFile0(path))
		}
	}
}

// the old main's `x lane commit` holds the main checkout's index lock: the switch waits for it to clear before it writes the seat,
// and never breaks it; a lock that does not clear in time refuses the switch with nothing written
func TestThreadRenameRoleWaitsOutTheMainCheckoutsIndexLock(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		release bool
		code    int
		main    string
	}{
		{"a lock that clears", true, 0, "sid-b"},
		{"a lock that never clears", false, 1, "sid-a"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSeatWorld(t)
			root := repo(t)
			lock := filepath.Join(root, ".git", "index.lock")
			write(t, lock, "")
			env := append(w.env, "X_FRAME_ROOT="+root, "X_LOCK_WAIT=0.6s")
			done := make(chan scripted)
			go func() { done <- scriptX(t, env, "thread", "rename", "sid-b", "--role", "main") }()

			waitForLine(t, w.log, "waiting on the main checkout's index lock")
			if _, _, main := w.seats(t); main != "sid-a" {
				t.Errorf("main-session names %q while the index lock was held, want it unmoved", main)
			}
			if c.release {
				if err := os.Remove(lock); err != nil {
					t.Fatal(err)
				}
			}
			var got scripted
			select {
			case got = <-done:
			case <-time.After(20 * time.Second):
				t.Fatal("the switch did not return: a lock that stays must refuse it once the wait is up")
			}

			if _, _, main := w.seats(t); got.code != c.code || main != c.main {
				t.Errorf("exit %d, main-session %q, want exit %d and %s main:\n%s", got.code, main, c.code, c.main, got.out)
			}
			if !c.release && !exists(lock) {
				t.Error("the verb removed the index lock; it must leave it where it is")
			}
		})
	}
}

// a second write that fails leaves no half-moved seat: the store is put back as it was, and the failure says so
func TestThreadRenameRoleRestoresTheStoreWhenTheSeatFileCannotBeWritten(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	blocker := filepath.Join(t.TempDir(), "file")
	write(t, blocker, "not a dir")
	env := append(w.env, "X_MAIN_SESSION="+filepath.Join(blocker, "main-session"))
	before, _ := os.ReadFile(w.store)

	got := scriptX(t, env, "thread", "rename", "sid-b", "--role", "main")

	after, _ := os.ReadFile(w.store)
	if got.code != 1 || string(after) != string(before) || !strings.Contains(got.out, "the store is as it was") {
		t.Errorf("exit %d, store changed %v, want exit 1, the store as it was and said so:\n%s", got.code, string(after) != string(before), got.out)
	}
}

// each thread's role and wing number as the store holds them now, and the session main-session names
func (w seatWorld) seats(t *testing.T) (roles map[string]string, wings map[string]int, main string) {
	t.Helper()
	store, err := readThreadStore(w.store)
	if err != nil {
		t.Fatal(err)
	}
	roles, wings = map[string]string{}, map[string]int{}
	for _, th := range store.Threads {
		roles[th.SessionID], wings[th.SessionID] = th.Role, th.Wing
	}
	raw, _ := os.ReadFile(w.mainFile)
	for line := range strings.SplitSeq(string(raw), "\n") {
		if sid, ok := strings.CutPrefix(line, "session="); ok {
			main = sid
		}
	}
	return roles, wings, main
}

func coordinators(roles map[string]string) int {
	n := 0
	for _, role := range roles {
		if role == "coordinator" {
			n++
		}
	}
	return n
}

// exit 1: from dima's own terminal the main seat moves from a to wing 1 (b): the records swap, main-session names b, both tabs
// and both cc names follow, and neither process restarted
func TestThreadRenameRoleMovesTheMainSeatBetweenTwoLiveThreads(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)

	got := scriptX(t, w.env, "thread", "rename", "wing1", "--role", "main")

	roles, wings, main := w.seats(t)
	if got.code != 0 || roles["sid-b"] != "coordinator" || roles["sid-a"] != "wing" || wings["sid-a"] != 1 || roles["sid-c"] != "wing" || wings["sid-c"] != 2 || main != "sid-b" {
		t.Fatalf("exit %d, roles %v wings %v main-session %q, want b main, a wing 1, c untouched:\n%s", got.code, roles, wings, main, got.out)
	}
	tabs, _ := os.ReadFile(w.tabs)
	sent, _ := os.ReadFile(w.sent)
	for _, want := range []string{`"id":"tbB","name":"🦉 clio"`, `"id":"tbA","name":"🦉🪽 clio: wing 1"`} {
		if !strings.Contains(string(tabs), want) {
			t.Errorf("herdr-app was told %q, want %s", tabs, want)
		}
	}
	for _, want := range []string{"send tB /rename 🦉 clio\n", "send tA /rename 🦉🪽 clio: wing 1\n"} {
		if !strings.Contains(string(sent), want) {
			t.Errorf("hc was told %q, want %q", sent, want)
		}
	}
	for name, pid := range w.pids {
		if syscall.Kill(pid, 0) != nil {
			t.Errorf("thread %s (pid %d) is gone, want no process restarted", name, pid)
		}
	}
}

// FRM-596 exits 5, 5b: the new main's record names whose seat it took and when, the one before it names nobody any more
func TestThreadRenameRoleRecordsWhoseSeatWasTaken(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	took := func() map[string]thread {
		store, err := readThreadStore(w.store)
		if err != nil {
			t.Fatal(err)
		}
		by := map[string]thread{}
		for _, th := range store.Threads {
			by[th.SessionID] = th
		}
		return by
	}
	start := time.Now().UnixMilli()

	scriptX(t, w.env, "thread", "rename", "wing1", "--role", "main")
	first := took()
	if b := first["sid-b"]; b.SeatTakenFrom != "sid-a" || b.SeatTakenAt < start || b.SeatTakenAt > time.Now().UnixMilli() {
		t.Errorf("b's record %+v, want the seat taken from sid-a at the switch, in ms", b)
	}
	scriptX(t, w.env, "thread", "rename", "wing2", "--role", "main")
	second := took()
	if c := second["sid-c"]; c.SeatTakenFrom != "sid-b" || c.SeatTakenAt < first["sid-b"].SeatTakenAt {
		t.Errorf("c's record %+v, want the seat taken from sid-b", c)
	}
	if b := second["sid-b"]; b.SeatTakenFrom != "" || b.SeatTakenAt != 0 {
		t.Errorf("b's record %+v, want no seat on a wing's record", b)
	}
}

// a record written again for the same role keeps whose seat it took; another role drops it
func TestThreadRecordKeepsWhoseSeatWasTakenWithItsRole(t *testing.T) {
	// serial: X_THREADS is what writeThreadRecord reads
	store := filepath.Join(t.TempDir(), "threads.json")
	t.Setenv("X_THREADS", store)
	for _, c := range []struct{ role, want string }{{"coordinator", "sid-a"}, {"wing", ""}} {
		write(t, store, `{"v":1,"threads":[{"sessionId":"sid-b","role":"coordinator","seatTakenFrom":"sid-a","seatTakenAt":5}]}`)
		if err := writeThreadRecord(thread{SessionID: "sid-b", Role: c.role, Wing: 1}, time.UnixMilli(1_000_000), true); err != nil {
			t.Fatal(err)
		}
		written, _ := readThreadStore(store)
		if got := written.Threads[0]; got.SeatTakenFrom != c.want || (got.SeatTakenAt == 5) != (c.want != "") {
			t.Errorf("written as %s: %+v, want the seat taken from %q", c.role, got, c.want)
		}
	}
}

// the same switch read from the main's side, and the refusals that keep one main: the main again, a thread that is no wing, a wing
// that is not there, a word that is no role
func TestThreadRenameRoleKeepsExactlyOneMain(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		args []string
		code int
		main string
	}{
		{"the main hands the seat to wing 2", []string{"main", "--role", "wing:2"}, 0, "sid-c"},
		{"the main again", []string{"sid-a", "--role", "main"}, 1, "sid-a"},
		{"a wing that is not there", []string{"main", "--role", "wing:9"}, 1, "sid-a"},
		{"a wing takes a wing number", []string{"sid-b", "--role", "wing:2"}, 1, "sid-a"},
		{"a wing that is not live", []string{"sid-d", "--role", "main"}, 1, "sid-a"},
		{"a thread that is no wing", []string{"sid-e", "--role", "main"}, 1, "sid-a"},
		{"a word that is no role", []string{"sid-b", "--role", "king"}, 2, "sid-a"},
		{"a name with it", []string{"sid-b", "nova", "--role", "main"}, 2, "sid-a"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSeatWorld(t)

			got := scriptX(t, w.env, append([]string{"thread", "rename"}, c.args...)...)

			roles, _, main := w.seats(t)
			if got.code != c.code || coordinators(roles) != 1 || main != c.main || roles[c.main] != "coordinator" {
				t.Errorf("exit %d, roles %v, main-session %q, want exit %d and %s the only main:\n%s", got.code, roles, main, c.code, c.main, got.out)
			}
		})
	}
}

// exit 5b: two switches started at once, each naming a different wing, end with exactly one coordinator and main-session agreeing
func TestThreadRenameRoleTwoAtOnceLeaveOneMain(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	var wg sync.WaitGroup
	for _, sid := range []string{"sid-b", "sid-c"} {
		wg.Go(func() { scriptX(t, w.env, "thread", "rename", sid, "--role", "main") })
	}
	wg.Wait()

	roles, wings, main := w.seats(t)
	if coordinators(roles) != 1 || roles[main] != "coordinator" {
		t.Errorf("roles %v, main-session %q, want exactly one coordinator and main-session naming it", roles, main)
	}
	seen := map[int]bool{}
	for sid, n := range wings {
		if roles[sid] == "wing" && seen[n] {
			t.Errorf("two wings are number %d: %v", n, wings)
		}
		seen[n] = true
	}
	var parsed threadStore
	raw, _ := os.ReadFile(w.store)
	if json.Unmarshal(raw, &parsed) != nil || len(parsed.Threads) != 5 {
		t.Errorf("the store holds %s, want 5 records", raw)
	}
}

// the process that typed `operator-override all`, as the guard writes it beside the pid
func startHere(t *testing.T) string {
	t.Helper()
	out, err := exec.Command("ps", "-o", "lstart=", "-p", strconv.Itoa(os.Getpid())).Output()
	if err != nil {
		t.Fatal(err)
	}
	return strings.TrimSpace(string(out))
}

// FRM-596 exit 1: from a thread the switch runs while dima's operator override is on
func TestThreadRenameRoleFromAThreadRunsWhileTheOverrideIsOn(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, store string }{
		{"a live all", fmt.Sprintf(`{"all":{"by":"word","at":"%s","pid":%d,"start":"%s"}}`, overrideAt, os.Getpid(), startHere(t))},
		{"prs by his band press", `{"prs":{"by":"band","at":"` + overrideAt + `"}}`},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSeatWorld(t)
			store := filepath.Join(t.TempDir(), "operator-override.json")
			write(t, store, c.store)
			env := append(w.env, "X_OVERRIDE_STORE="+store)

			got := xIn(t, t.TempDir(), asCaller(t, env, "wing"), "thread", "rename", "wing1", "--role", "main")

			if _, _, main := w.seats(t); got.code != 0 || main != "sid-b" {
				t.Errorf("exit %d, main-session %q, want exit 0 and sid-b main:\n%s", got.code, main, got.stdout)
			}
			if log := readFile0(overrideLog(store)); strings.Count(log, "wing1 to main") != 1 {
				t.Errorf("the log holds %q, want one line for the move", log)
			}
		})
	}
}

// FRM-596 exit 1: every other override state refuses with nothing written. a refusal leaves the world as it was, so the rows share one
func TestThreadRenameRoleFromAThreadIsRefused(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	before := readFile0(w.store)
	for _, c := range []struct {
		name, caller, store string
		grant               string
		flags               []string
		code                int
	}{
		{"no override", "coordinator", "", "", nil, 1},
		{"prs by a shift", "coordinator", `{"prs":{"by":"shift","at":"` + overrideAt + `"}}`, "", nil, 1},
		{"prs by a typed word", "coordinator", prsOn(), "", nil, 1},
		{"a store that does not parse", "coordinator", `{"prs":{"by":"band"`, "", nil, 1},
		{"the old word flag, which is gone", "coordinator", "", "", []string{"--dima-ok", "wing1"}, 2},
		{"a codie, the override on", "codie", `{"prs":{"by":"band","at":"` + overrideAt + `"}}`, "", nil, 1},
		{"a codie, a grant of its own", "codie", "", seatGrantOf("wing1", "main", "tick o7", 0), nil, 1},
		{"a grant for another thread", "coordinator", "", seatGrantOf("wing2", "main", "tick o7", 0), nil, 1},
		{"a grant for another role", "coordinator", "", seatGrantOf("wing1", "wing:1", "tick o7", 0), nil, 1},
		{"a grant older than 60 s", "coordinator", "", seatGrantOf("wing1", "main", "tick o7", 61*time.Second), nil, 1},
		{"a grant from the future", "coordinator", "", seatGrantOf("wing1", "main", "tick o7", -time.Hour), nil, 1},
		{"a grant for another session", "coordinator", "sid-b", seatGrantOf("wing1", "main", "tick o7", 0), nil, 1},
		{"a grant with no tick id", "coordinator", "", seatGrantOf("wing1", "main", "tick ", 0), nil, 1},
		{"a grant by a word", "coordinator", "", seatGrantOf("wing1", "main", "word", 0), nil, 1},
		{"a grant of another shape", "coordinator", "", `["tick o7"]`, nil, 1},
		{"a grant already taken", "coordinator", "taken", seatGrantOf("wing1", "main", "tick o7", 0), nil, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			store := filepath.Join(t.TempDir(), "operator-override.json")
			grant := seatGrantPath(store, "sid-caller")
			switch c.store {
			case "":
			case "sid-b":
				grant = seatGrantPath(store, "sid-b")
			case "taken":
				grant += ".taken"
			default:
				write(t, store, c.store)
			}
			if c.grant != "" {
				write(t, grant, c.grant)
			}
			env := append(slices.Clone(w.env), "X_OVERRIDE_STORE="+store)

			got := xIn(t, t.TempDir(), asCaller(t, env, c.caller), append([]string{"thread", "rename", "wing1", "--role", "main"}, c.flags...)...)

			if _, _, main := w.seats(t); got.code != c.code || main != "sid-a" || readFile0(w.store) != before {
				t.Errorf("exit %d, main-session %q, want exit %d and the seat and the store as they were:\n%s", got.code, main, c.code, got.stdout)
			}
			if c.code == 1 && c.caller == "coordinator" && (!strings.Contains(got.next, "override on") || !strings.Contains(got.next, "his tick") || !strings.Contains(got.next, "own terminal")) {
				t.Errorf("next %q, want every way on: the override, his tick and dima's own terminal", got.next)
			}
			if c.grant != readFile0(grant) {
				t.Errorf("the grant reads %q, want it untouched: %q", readFile0(grant), c.grant)
			}
		})
	}
}

// what x-mod-guard writes from his tick, and where
func seatGrantOf(thread, role, by string, age time.Duration) string {
	return fmt.Sprintf(`{"at":"%s","by":"%s","role":"%s","thread":"%s","spends":["o7@1:x"]}`, time.Now().Add(-age).UTC().Format(time.RFC3339Nano), by, role, thread)
}

func seatGrantPath(store, session string) string {
	return filepath.Join(filepath.Dir(store), "seat-grants", session+".o7-1.json")
}

// FRM-596 exit 2: his tick, carried as a grant, moves the seat once; the override store is never written
func TestThreadRenameRoleFromAThreadRunsOnceOnHisTick(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	store := filepath.Join(t.TempDir(), "operator-override.json")
	grant := seatGrantPath(store, "sid-caller")
	write(t, store, prsOn())
	write(t, grant, seatGrantOf("wing1", "main", "tick o7", 0))
	env := asCaller(t, append(w.env, "X_OVERRIDE_STORE="+store), "coordinator")

	first := xIn(t, t.TempDir(), env, "thread", "rename", "wing1", "--role", "main")
	_, _, main := w.seats(t)
	if first.code != 0 || main != "sid-b" {
		t.Fatalf("exit %d, main-session %q, want the seat with sid-b:\n%s", first.code, main, first.stdout)
	}
	if readFile0(grant) != "" || readFile0(grant+".taken") == "" || readFile0(store) != prsOn() {
		t.Errorf("the grant reads %q, want it taken and the override store as it was: %s", readFile0(grant), readFile0(store))
	}
	if log := readFile0(overrideLog(store)); !strings.Contains(log, `"by":"tick o7"`) || !strings.Contains(log, "wing1 to main") {
		t.Errorf("the log holds %q, want one line naming the tick and the move", log)
	}
	second := xIn(t, t.TempDir(), env, "thread", "rename", "wing1", "--role", "main")
	if _, _, after := w.seats(t); second.code != 1 || after != "sid-b" {
		t.Errorf("exit %d, main-session %q, want the second run refused and the seat where it was", second.code, after)
	}
}

// FRM-596 exit 4: a switch that fails leaves the grant to x-mod-guard, which hands the tick back and removes it: one that failed
// before it took the grant, and one whose seat file could not be written after
func TestThreadRenameRoleThatFailsLeavesTheGrant(t *testing.T) {
	t.Parallel()
	blocker := filepath.Join(t.TempDir(), "file")
	write(t, blocker, "not a dir")
	for _, c := range []struct{ name, thread, env string }{
		{"the thread is gone", "wing3", ""},
		{"the seat file cannot be written", "wing1", "X_MAIN_SESSION=" + filepath.Join(blocker, "main-session")},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSeatWorld(t)
			store := filepath.Join(t.TempDir(), "operator-override.json")
			grant, body := seatGrantPath(store, "sid-caller"), seatGrantOf(c.thread, "main", "tick o7", 0)
			write(t, grant, body)
			before := readFile0(w.store)
			env := append(w.env, "X_OVERRIDE_STORE="+store)
			if c.env != "" {
				env = append(env, c.env)
			}

			got := xIn(t, t.TempDir(), asCaller(t, env, "coordinator"), "thread", "rename", c.thread, "--role", "main")

			if got.code != 1 || readFile0(w.store) != before || readFile0(grant) != body {
				t.Errorf("exit %d, grant %q, want a refusal that left the seat and the grant:\n%s", got.code, readFile0(grant), got.stdout)
			}
			if log := readFile0(overrideLog(store)); log != "" {
				t.Errorf("the log holds %q, want no line for a seat that did not move", log)
			}
		})
	}
}

// what let the switch start is read again under the store's lock: a grant gone or past its 60 s, or an override he pressed off,
// while the switch waited moves nothing
func TestThreadRenameRoleReadsItsPassAgainUnderTheLock(t *testing.T) {
	t.Parallel()
	band := `{"prs":{"by":"band","at":"` + overrideAt + `"}}`
	for _, c := range []struct {
		name, store string
		meanwhile   func(t *testing.T, store, grant string)
	}{
		{"the grant is gone", "", func(_ *testing.T, _, grant string) { _ = os.Remove(grant) }},
		{"the grant is past its 60 s", "", func(t *testing.T, _, grant string) {
			write(t, grant, seatGrantOf("wing1", "main", "tick o7", 61*time.Second))
		}},
		{"he pressed the override off", band, func(t *testing.T, store, _ string) { write(t, store, `{}`) }},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSeatWorld(t)
			store := filepath.Join(t.TempDir(), "operator-override.json")
			grant := seatGrantPath(store, "sid-caller")
			if c.store != "" {
				write(t, store, c.store)
			} else {
				// its 60 s start here: a parallel row can queue past them after the table is built
				write(t, grant, seatGrantOf("wing1", "main", "tick o7", 0))
			}
			env := asCaller(t, append(w.env, "X_OVERRIDE_STORE="+store), "coordinator")
			unlock, err := lockThreadStore(w.store)
			if err != nil {
				t.Fatal(err)
			}
			done := make(chan int)
			go func() { done <- xIn(t, t.TempDir(), env, "thread", "rename", "wing1", "--role", "main").code }()
			waitForLine(t, w.log, "waiting on the thread store lock")
			c.meanwhile(t, store, grant)
			unlock()

			code := <-done
			if _, _, main := w.seats(t); code != 1 || main != "sid-a" {
				t.Errorf("exit %d, main-session %q, want a refusal and sid-a still main", code, main)
			}
		})
	}
}

// a thread that switches its own seat is busy with the call itself: the switch moves the seat and leaves the names to the
// background follow, and never waits for it or types at it
func TestThreadRenameRoleNeverWaitsForABusyThread(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	hc := envOf(w.env, "X_HC")
	write(t, hc, strings.Replace(readFile0(hc), `"state":"done"`, `"state":"working"`, 1))
	if err := os.Chmod(hc, 0o755); err != nil {
		t.Fatal(err)
	}
	follow := filepath.Join(t.TempDir(), "follow.log")
	store := filepath.Join(t.TempDir(), "operator-override.json")
	write(t, store, `{"prs":{"by":"band","at":"`+overrideAt+`"}}`)
	env := asCaller(t, append(w.env, "X_OVERRIDE_STORE="+store, "X_RENAME_WAIT=20", "X_RENAME_NUDGE=0.1", "X_RENAME_FOLLOW="+follow), "wing")
	start := time.Now()

	got := xIn(t, t.TempDir(), env, "thread", "rename", "wing1", "--role", "main")

	if _, _, main := w.seats(t); got.code != 0 || main != "sid-b" || time.Since(start) > 10*time.Second {
		t.Errorf("exit %d, main-session %q after %s, want the seat moved at once:\n%s", got.code, main, time.Since(start), got.stdout)
	}
	if sent := readFile0(w.sent); sent != "" {
		t.Errorf("hc was told %q, want nothing typed at a busy thread", sent)
	}
	if log := readFile0(follow); !strings.Contains(log, "thread sync sid-a") || !strings.Contains(log, "thread sync sid-b") {
		t.Errorf("the follow log holds %q, want both threads followed", log)
	}
}

// the reader of «override on», row by row, as x-mod-guard's masterOverride reads the same store
func TestSeatOverrideOn(t *testing.T) {
	t.Parallel()
	here, pid := startHere(t), os.Getpid()
	ago := func(d time.Duration) string { return time.Now().Add(-d).UTC().Format(time.RFC3339Nano) }
	for _, c := range []struct {
		name, body string
		want       bool
	}{
		{"all by its live process", fmt.Sprintf(`{"all":{"by":"word","at":"%s","pid":%d,"start":"%s"}}`, ago(48*time.Hour), pid, here), true},
		{"all whose pid now starts at another time", fmt.Sprintf(`{"all":{"by":"word","at":"%s","pid":%d,"start":"Mon Jan  1 00:00:00 2024"}}`, ago(0), pid), false},
		{"all with no process and no until", fmt.Sprintf(`{"all":{"by":"word","at":"%s"}}`, ago(0)), false},
		{"all before its until", fmt.Sprintf(`{"all":{"by":"word","at":"%s","until":"%s"}}`, ago(0), ago(-time.Hour)), true},
		{"all past its until, its process alive", fmt.Sprintf(`{"all":{"by":"word","at":"%s","until":"%s","pid":%d,"start":"%s"}}`, ago(time.Hour), ago(time.Minute), pid, here), false},
		{"all with no one named", fmt.Sprintf(`{"all":{"at":"%s","pid":%d,"start":"%s"}}`, ago(0), pid, here), false},
		{"a dead all beside a band press", fmt.Sprintf(`{"all":{"by":"word","at":"%s"},"prs":{"by":"band","at":"%s"}}`, ago(0), ago(0)), true},
		{"a band press 13 h old", fmt.Sprintf(`{"prs":{"by":"band","at":"%s"}}`, ago(13*time.Hour)), true},
		{"a band press before its until", fmt.Sprintf(`{"prs":{"by":"band","at":"%s","until":"%s"}}`, ago(time.Hour), ago(-time.Hour)), true},
		{"a band press past its until", fmt.Sprintf(`{"prs":{"by":"band","at":"%s","until":"%s"}}`, ago(time.Hour), ago(time.Minute)), false},
		{"prs by a shift", fmt.Sprintf(`{"prs":{"by":"shift","at":"%s"}}`, ago(0)), false},
		{"prs by a typed word", fmt.Sprintf(`{"prs":{"by":"word","at":"%s"}}`, ago(0)), false},
		{"one scope of a wrong shape", fmt.Sprintf(`{"prs":{"by":"band","at":"%s"},"all":[]}`, ago(0)), false},
		{"an empty store", `{}`, false},
		{"a store that does not parse", `{"prs"`, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			store := filepath.Join(t.TempDir(), "operator-override.json")
			write(t, store, c.body)
			if _, _, got := seatOverride(store); got != c.want {
				t.Errorf("seatOverride(%s) = %v, want %v", c.body, got, c.want)
			}
		})
	}
	if _, _, on := seatOverride(filepath.Join(t.TempDir(), "none.json")); on {
		t.Error("a store that is not there reads on")
	}
}

// a process table that cannot be read fails the seat gate closed, so a failing ps never opens it; a readable table with no session
// above x leaves the gate open for dima's own terminal
func TestSeatGateFailsClosedWhenPsFails(t *testing.T) {
	t.Parallel()
	sessions := t.TempDir()
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getppid())+".json"), `{"sessionId":"sid-caller"}`)
	for _, c := range []struct {
		name string
		err  error
		dir  string
		want bool
	}{
		{"ps failed", errors.New("ps did not list the processes"), t.TempDir(), true},
		{"ps read and no session above x", nil, t.TempDir(), false},
		{"ps read and a session above x", nil, sessions, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := threadFromTable(processTable{}, c.err, c.dir); got != c.want {
				t.Errorf("threadFromTable = %v, want %v", got, c.want)
			}
		})
	}
}
