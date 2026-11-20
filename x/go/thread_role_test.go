package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	pids                        map[string]int
}

func newSeatWorld(t *testing.T) seatWorld {
	t.Helper()
	const rule = "────────────────────────────────────────"
	sessions, bin := t.TempDir(), t.TempDir()
	w := seatWorld{store: filepath.Join(t.TempDir(), "threads.json"), mainFile: filepath.Join(t.TempDir(), "main-session"), tabs: filepath.Join(bin, "tabs.log"), sent: filepath.Join(bin, "hc.log"), pids: map[string]int{}}
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
	w.env = []string{"X_SESSIONS=" + sessions, "X_THREADS=" + w.store, "X_MAIN_SESSION=" + w.mainFile, "X_HC=" + filepath.Join(bin, "hc"), "X_HERDR_APP=" + filepath.Join(bin, "herdr-app"), "X_RENAME_WAIT=0", "X_RENAME_NUDGE=0"}
	return w
}

// a switch waits for the store's lock before it reads or writes: while the test holds the lock the seat stays where it was, and
// moves once the lock is let go
func TestThreadRenameRoleWaitsForTheStoreLock(t *testing.T) {
	t.Parallel()
	w := newSeatWorld(t)
	unlock, err := lockThreadStore(w.store)
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan scripted)
	go func() { done <- scriptX(t, w.env, "thread", "rename", "sid-b", "--role", "main") }()

	select {
	case got := <-done:
		unlock()
		t.Fatalf("the switch ran while the lock was held: exit %d\n%s", got.code, got.out)
	case <-time.After(400 * time.Millisecond):
	}
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

// exit 2: from a thread the switch runs only on dima's typed word, which x-mod-guard proves the way it proves --dima-ok on a merge:
// x asks for the flag naming the thread and says the exact command; from his own terminal it needs none
func TestThreadRenameRoleFromAThreadNeedsDimaTypedWord(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		caller string
		flags  []string
		code   int
		main   string
	}{
		{"wing 1 with no word of his", "coordinator", nil, 1, "sid-a"},
		{"wing 1 with a word naming another thread", "coordinator", []string{"--dima-ok", "wing2"}, 1, "sid-a"},
		{"wing 1 with his word naming the thread", "coordinator", []string{"--dima-ok", "wing1"}, 0, "sid-b"},
		{"a codie, even with the word", "codie", []string{"--dima-ok", "wing1"}, 1, "sid-a"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSeatWorld(t)

			got := xIn(t, t.TempDir(), asCaller(t, w.env, c.caller), append([]string{"thread", "rename", "wing1", "--role", "main"}, c.flags...)...)

			if _, _, main := w.seats(t); got.code != c.code || main != c.main {
				t.Errorf("exit %d, main-session %q, want exit %d and %s main:\n%s", got.code, main, c.code, c.main, got.stdout)
			}
			if c.code == 1 && c.caller == "coordinator" && !strings.Contains(got.next, "--dima-ok wing1") {
				t.Errorf("next %q, want the exact command with his word", got.next)
			}
		})
	}
}
