package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// exit 5: a rename on dima's word lands in the record, x thread show draws it, and a later refresh keeps it; a member
// renames nothing
func TestThreadRenameSticksAcrossARefresh(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	write(t, filepath.Join(sessions, "w.json"), fmt.Sprintf(`{"sessionId":"sid-wing","pid":%d}`, os.Getpid()))
	write(t, store, `{"v":1,"threads":[{"sessionId":"sid-wing","role":"wing","wing":2}]}`)
	env := []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}

	byCodie := xIn(t, t.TempDir(), asCaller(t, env, "codie"), "thread", "rename", "sid-wing", "🌌 nova")
	twoLines := xIn(t, t.TempDir(), asCaller(t, env, "coordinator"), "thread", "rename", "sid-wing", "🌌 nova\nship it")
	byClio := xIn(t, t.TempDir(), asCaller(t, env, "coordinator"), "thread", "rename", "sid-wing", "🌌 nova")
	_ = xIn(t, t.TempDir(), env, "thread", "list")
	show := xIn(t, t.TempDir(), env, "thread", "show", "sid-wing")

	if twoLines.code != 2 {
		t.Errorf("a name with a newline: exit %d, want a usage refusal:\n%s", twoLines.code, twoLines.stdout)
	}
	if byCodie.code != 1 || !strings.Contains(byCodie.stdout, "only the coordinator or dima") {
		t.Errorf("a codie's rename: exit %d, want the coordinator's refusal:\n%s", byCodie.code, byCodie.stdout)
	}
	// no herdr terminal holds the fixture thread, so its cc name is the one place left: the verb fails, the record has taken it
	if byClio.code != 1 || !strings.Contains(byClio.stdout, "not yet in cc name") || show.data["display"] != "🌌 nova" || show.data["role"] != "wing" || show.data["roleName"] != "🦉🪽 clio: wing 2" {
		t.Fatalf("exit %d, after a refresh x thread show %v, want «🌌 nova», still a wing, its role's name kept:\n%s", byClio.code, show.data, byClio.stdout)
	}
}

func TestThreadRenameMovesTheRecordTheTabAndTheCcName(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, key string
		noTab     bool
	}{
		{"by display name", "⚡ 🐕 stray | chores", false},
		{"by session id", "s1", false},
		{"a terminal in no tab gets one first", "s1", true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, c.noTab, 0)

			got := xIn(t, t.TempDir(), asCaller(t, w.env, "coordinator"), "thread", "rename", c.key, "⚡ 🐕 stray | renamed")

			written, _ := readThreadStore(w.store)
			sent, _ := os.ReadFile(w.hcLog)
			tabs, _ := os.ReadFile(w.tabs)
			if card, _ := got.data["card"].(map[string]any); card["name"] != "⚡ 🐕 stray | renamed" {
				t.Errorf("the card block %v, want the full new name for the claude apps' card", got.data["card"])
			}
			if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Title != "⚡ 🐕 stray | renamed" {
				t.Fatalf("exit %d, records %+v, want the title taken:\n%s", got.code, written.Threads, got.stdout)
			}
			if string(sent) != "send t9 /rename ⚡ 🐕 stray | renamed\n" {
				t.Errorf("hc was told %q, want the cc /rename", sent)
			}
			wantTab := `rename {"id":"tbA","name":"⚡ 🐕 stray | renamed"}` + "\n"
			if c.noTab {
				wantTab = `keep {"terminal":"t9","place":"tab"}` + "\n" + `rename {"id":"tbNew","name":"⚡ 🐕 stray | renamed"}` + "\n"
			}
			if string(tabs) != wantTab {
				t.Errorf("herdr-app was told %q, want %q", tabs, wantTab)
			}
		})
	}
}

func TestThreadRenameRefusesADisplayTwoThreadsDraw(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`,`+strings.Replace(quickCodie, `"s1"`, `"s2"`, 1)+`]}`, false, false, 0)

	got := xIn(t, t.TempDir(), asCaller(t, w.env, "coordinator"), "thread", "rename", "⚡ 🐕 stray | chores", "⚡ 🐕 stray | renamed")

	written, _ := readThreadStore(w.store)
	tabs, _ := os.ReadFile(w.tabs)
	if got.code != 1 || !strings.Contains(got.stdout, "s1, s2") || written.Threads[0].Title != "" || len(tabs) != 0 {
		t.Errorf("exit %d, titles %q, herdr %q, want a refusal naming both ids and no change:\n%s", got.code, written.Threads[0].Title, tabs, got.stdout)
	}
}

func TestThreadRenameFailsNamingThePlaceThatDidNotTakeTheName(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, true, false, 0)

	got := xIn(t, t.TempDir(), asCaller(t, w.env, "coordinator"), "thread", "rename", "s1", "⚡ 🐕 stray | renamed")

	written, _ := readThreadStore(w.store)
	if got.code != 1 || !strings.Contains(got.stdout, "not yet in herdr tab") || !strings.Contains(got.next, "herdr-app do tab.rename") || written.Threads[0].Title != "⚡ 🐕 stray | renamed" {
		t.Errorf("exit %d next %q, want a failure naming the herdr tab and its command, the record renamed:\n%s", got.code, got.next, got.stdout)
	}
}

// the caller gate stands: a codie renames nothing, dima's own terminal does
func TestThreadRenameKeepsItsCallerGate(t *testing.T) {
	t.Parallel()
	// two worlds: the codie's caller file registers this test process as a claude, which dima's own terminal has none of
	codie := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 0)
	dima := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 0)

	byCodie := xIn(t, t.TempDir(), asCaller(t, codie.env, "codie"), "thread", "rename", "s1", "⚡ 🐕 stray | renamed")
	byDima := scriptX(t, dima.env, "thread", "rename", "s1", "⚡ 🐕 stray | renamed")

	refused, _ := readThreadStore(codie.store)
	renamed, _ := readThreadStore(dima.store)
	if byCodie.code != 1 || !strings.Contains(byCodie.stdout, "only the coordinator or dima") || refused.Threads[0].Title != "" || byDima.code != 0 || renamed.Threads[0].Title != "⚡ 🐕 stray | renamed" {
		t.Errorf("a codie: exit %d, title %q; dima's terminal: exit %d, title %q:\n%s\n%s", byCodie.code, refused.Threads[0].Title, byDima.code, renamed.Threads[0].Title, byCodie.stdout, byDima.out)
	}
}

// FRM-600 / dima's o15: a busy thread takes its /rename once it is idle; past the deadline the rename reads pending
func TestThreadRenameWaitsForAnIdleThread(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name     string
		busy     int
		wantCode int
	}{
		{"busy for three reads, then idle", 3, 0},
		{"busy past the deadline", 100000, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, c.busy)

			got := xIn(t, t.TempDir(), asCaller(t, append(w.env, "X_RENAME_WAIT=0.5"), "coordinator"), "thread", "rename", "s1", "⚡ 🐕 stray | renamed")

			sent, _ := os.ReadFile(w.hcLog)
			wantSent := "send t9 /rename ⚡ 🐕 stray | renamed\n"
			if c.wantCode != 0 {
				wantSent = ""
			}
			if got.code != c.wantCode || string(sent) != wantSent || (c.wantCode != 0 && !strings.Contains(got.stdout, "pending")) {
				t.Errorf("exit %d, hc was told %q, want exit %d and %q (pending when it never idled):\n%s", got.code, sent, c.wantCode, wantSent, got.stdout)
			}
		})
	}
}

// dima 15:28: a thread still busy after the nudge delay is asked once to end its turn, renamed once idle, then told to resume
func TestThreadRenameAsksABusyThreadToEndItsTurn(t *testing.T) {
	t.Parallel()
	const name = "⚡ 🐕 stray | renamed"
	for _, c := range []struct {
		name     string
		busy     int
		wantCode int
		wantSent string
	}{
		{"idle at once, nobody is asked", 0, 0, "send t9 /rename " + name + "\n"},
		{"busy past the nudge, idle after", 15, 0, "send t9 end your turn at your next step\nsend t9 /rename " + name + "\nsend t9 resume\n"},
		{"busy past the deadline: asked, then resumed", 100000, 1, "send t9 end your turn at your next step\nsend t9 resume\n"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, c.busy)

			got := xIn(t, t.TempDir(), asCaller(t, append(w.env, "X_RENAME_WAIT=1", "X_RENAME_NUDGE=0.1"), "coordinator"), "thread", "rename", "s1", name)

			sent, _ := os.ReadFile(w.hcLog)
			if got.code != c.wantCode || string(sent) != c.wantSent {
				t.Errorf("exit %d, hc was told %q, want exit %d and %q:\n%s", got.code, sent, c.wantCode, c.wantSent, got.stdout)
			}
		})
	}
}

// a nudged thread is told to resume however its rename ended: a send that failed, a draft in its box, the deadline
func TestThreadRenameResumesANudgedThreadWhateverBecameOfTheRename(t *testing.T) {
	t.Parallel()
	const name = "⚡ 🐕 stray | renamed"
	for _, c := range []struct {
		name, wantSent, wantSay string
		knobs                   []string
	}{
		{"the /rename send fails", "send t9 end your turn at your next step\nsend t9 /rename " + name + "\nsend t9 resume\n", "", []string{"FAIL_RENAME=1"}},
		{"a draft sits in its box all along: nobody is nudged", "", "", []string{"DRAFT=1"}},
		{"a draft appears after the nudge: resume is left to send", "send t9 end your turn at your next step\n", "«resume» left to send: env -u HC_TERMINAL_ID hc send t9 resume", []string{"DRAFT=1", "DRAFT_AFTER=1"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 15)

			got := xIn(t, t.TempDir(), asCaller(t, append(w.env, append([]string{"X_RENAME_WAIT=1", "X_RENAME_NUDGE=0.1"}, c.knobs...)...), "coordinator"), "thread", "rename", "s1", name)

			sent, _ := os.ReadFile(w.hcLog)
			if got.code != 1 || string(sent) != c.wantSent || !strings.Contains(got.stdout, c.wantSay) {
				t.Errorf("exit %d, hc was told %q, want exit 1, %q and %q in:\n%s", got.code, sent, c.wantSent, c.wantSay, got.stdout)
			}
		})
	}
}

// the tab terminal.keep just made may not take its first rename: it retries, never leaving the tab unnamed
func TestThreadRenameRetriesATabRenameRightAfterAKeep(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, true, 0)

	got := xIn(t, t.TempDir(), asCaller(t, append(w.env, "TAB_FAILS=2"), "coordinator"), "thread", "rename", "s1", "⚡ 🐕 stray | renamed")

	tabs, _ := os.ReadFile(w.tabs)
	renames := strings.Count(string(tabs), "rename {")
	if got.code != 0 || renames != 3 || strings.Count(string(tabs), "keep {") != 1 {
		t.Errorf("exit %d, herdr-app was told %q, want one keep and the rename on its third try:\n%s", got.code, tabs, got.stdout)
	}
}

// the rename retries only a tab terminal.keep just made; a tab that was there refuses once and the verb says so
func TestThreadRenameDoesNotRetryATabThatWasAlreadyThere(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 0)

	got := xIn(t, t.TempDir(), asCaller(t, append(w.env, "TAB_FAILS=2"), "coordinator"), "thread", "rename", "s1", "⚡ 🐕 stray | renamed")

	tabs, _ := os.ReadFile(w.tabs)
	if got.code != 1 || strings.Count(string(tabs), "rename {") != 1 {
		t.Errorf("exit %d, herdr-app was told %q, want one rename try and a failure:\n%s", got.code, tabs, got.stdout)
	}
}
