package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// a sixth sense named for its chunk: its title only spells the role name for FRM-1, the way a summon's -n or an earlier
// rename leaves it
const namedSixthSense = `{"sessionId":"s1","role":"sixth-sense","lane":"drag","laneKind":"quick","ticket":"FRM-1","area":"herdr","title":"⚡ 🔎 herdr | FRM-1"}`

func setEnvs(t *testing.T, env []string) {
	t.Helper()
	for _, pair := range env {
		key, value, _ := strings.Cut(pair, "=")
		t.Setenv(key, value)
	}
}

func TestLandingDropsTheTicketFromEveryPlaceAndFollowsABusyThread(t *testing.T) {
	// serial: clearThreadTicket reads its stores and clis from the env
	w := renameFixture(t, `{"v":1,"threads":[`+namedSixthSense+`]}`, false, false, 1000)
	follow := filepath.Join(t.TempDir(), "follow.log")
	setEnvs(t, append(w.env, "X_TEST=1", "X_RENAME_FOLLOW="+follow))

	detail, err := clearThreadTicket("FRM-1")

	written, _ := readThreadStore(w.store)
	tabs, _ := os.ReadFile(w.tabs)
	followed, _ := os.ReadFile(follow)
	if err != nil || len(written.Threads) != 1 || written.Threads[0].Title != "" || written.Threads[0].Display != "⚡ 🔎 herdr" {
		t.Fatalf("detail %q, err %v, records %+v: want the role-name title gone with the ticket, the display the scope's own", detail, err, written.Threads)
	}
	if !strings.Contains(string(tabs), `"name":"⚡ 🔎 herdr"`) {
		t.Errorf("herdr-app was told %q, want the tab renamed at once", tabs)
	}
	if string(followed) != "thread sync s1\n" || !strings.Contains(detail, "x thread sync s1") {
		t.Errorf("followed %q, detail %q: want the busy thread's cc name followed in the background", followed, detail)
	}
}

func TestLandingKeepsATitleDimaTyped(t *testing.T) {
	for _, title := range []string{"the drag reviewer", "⚡ 🔎 herdr | drag"} {
		t.Run(title, func(t *testing.T) {
			// serial: clearThreadTicket reads its stores and clis from the env
			typed := strings.Replace(namedSixthSense, `"⚡ 🔎 herdr | FRM-1"`, `"`+title+`"`, 1)
			w := renameFixture(t, `{"v":1,"threads":[`+typed+`]}`, false, false, 0)
			setEnvs(t, append(w.env, "X_TEST=1"))

			if _, err := clearThreadTicket("FRM-1"); err != nil {
				t.Fatal(err)
			}

			written, _ := readThreadStore(w.store)
			if len(written.Threads) != 1 || written.Threads[0].Title != title {
				t.Errorf("records %+v, want his own title kept", written.Threads)
			}
		})
	}
}

func TestAFollowStartsOnlyForAPlaceThatDidNotTakeTheName(t *testing.T) {
	// serial: followRename logs to the env's X_RENAME_FOLLOW
	follow := filepath.Join(t.TempDir(), "follow.log")
	t.Setenv("X_TEST", "1")
	t.Setenv("X_RENAME_FOLLOW", follow)
	taken := ordered{{"place", "herdr tab"}, {"renamed", true}}
	absent := ordered{{"place", "herdr tab"}, {"renamed", false}, {"isAbsent", true}}
	pending := ordered{{"session", "s2"}, {"renamed", false}, {"pending", true}}

	if behind := followUntaken("s1", []ordered{taken, absent}); behind != 0 {
		t.Errorf("%d behind, want none for a taken and an absent place", behind)
	}
	if behind := followUntaken("s2", []ordered{taken, pending}); behind != 1 {
		t.Errorf("%d behind, want the pending cc name", behind)
	}

	if followed, _ := os.ReadFile(follow); string(followed) != "thread sync s2\n" {
		t.Errorf("followed %q, want only s2", followed)
	}
}

func TestThreadSyncGivesTheLivePlacesTheRecordsName(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 2)

	got := xIn(t, t.TempDir(), asCaller(t, w.env, "coordinator"), "thread", "sync", "s1")

	sent, _ := os.ReadFile(w.hcLog)
	tabs, _ := os.ReadFile(w.tabs)
	if got.code != 0 || string(sent) != "send t9 /rename ⚡ 🐕 stray | chores\n" {
		t.Errorf("exit %d, hc was told %q: want the record's name sent once the thread idled:\n%s", got.code, sent, got.stdout)
	}
	if !strings.Contains(string(tabs), `"name":"⚡ 🐕 stray | chores"`) {
		t.Errorf("herdr-app was told %q, want the tab on the record's name", tabs)
	}
}

func TestThreadSyncNeverAsksABusyThreadToEndItsTurn(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 1000)

	got := xIn(t, t.TempDir(), append(asCaller(t, w.env, "codie"), "X_SYNC_WAIT=0.3"), "thread", "sync", "s1")

	if sent, _ := os.ReadFile(w.hcLog); got.code != 1 || len(sent) > 0 {
		t.Errorf("exit %d, hc was told %q: want a quiet wait that fails once past it, no nudge and no send", got.code, sent)
	}
}

func TestThreadSyncRefusesASessionWithNoRecord(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 0)

	got := xIn(t, t.TempDir(), w.env, "thread", "sync", "s9")

	if sent, _ := os.ReadFile(w.hcLog); got.code != 1 || len(sent) > 0 {
		t.Errorf("exit %d, hc was told %q: want a refusal before any send", got.code, sent)
	}
}

func TestARenameWaitReadsTheNameAgainBeforeEachTry(t *testing.T) {
	// serial: renameThread reads its clis from the env
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 1)
	setEnvs(t, append(w.env, "X_TEST=1"))
	names := []string{"⚡ 🐕 stray | FRM-1", "⚡ 🐕 stray | FRM-2"}

	row := renameThread("s1", func() string {
		name := names[0]
		if len(names) > 1 {
			names = names[1:]
		}
		return name
	}, time.Second, time.Minute, renamePoll())

	if sent, _ := os.ReadFile(w.hcLog); !placeTook(row) || string(sent) != "send t9 /rename ⚡ 🐕 stray | FRM-2\n" {
		t.Errorf("row %v, hc was told %q: want the name read again after the busy try", row, sent)
	}
}

func TestARenameToTheRecordsOwnNamePinsNoTitle(t *testing.T) {
	t.Parallel()
	w := renameFixture(t, `{"v":1,"threads":[`+quickCodie+`]}`, false, false, 0)

	got := xIn(t, t.TempDir(), asCaller(t, w.env, "coordinator"), "thread", "rename", "s1", "⚡ 🐕 stray | chores")

	written, _ := readThreadStore(w.store)
	if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Title != "" {
		t.Errorf("exit %d, records %+v: want no title pinned, so a later chunk redraws the name:\n%s", got.code, written.Threads, got.stdout)
	}
}
