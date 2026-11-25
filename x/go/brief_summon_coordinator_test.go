package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// the caller gate: only dima's terminal or a coordinator's record gives a standing role; a record-less session (a fork)
// or a member gets none, by either form
func TestBriefSummonGivesAStandingRoleOnlyFromTheCoordinator(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, caller string }{{"a session with no record", ""}, {"a codie", "codie"}, {"a sixth sense", "sixth-sense"}} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))
			// the real clio's record sits in the store: another session's role is never the caller's
			write(t, store, `{"v":1,"threads":[{"sessionId":"sid-real-clio","role":"coordinator"}]}`)
			env := []string{"X_THREADS=" + store, "X_SESSIONS=" + sessions}

			pane := w.summonStanding(t, c.caller, env, "--role", "coordinator", paneArgv(w, "any name"))
			record := w.summonStanding(t, c.caller, env, "--role", "wing:1", "--session", "sid-fork")

			written, _ := readThreadStore(store)
			for _, got := range []ran{pane, record} {
				if got.code != 1 || !strings.Contains(got.stdout, "only the coordinator or dima") {
					t.Errorf("exit %d, want the coordinator's refusal:\n%s", got.code, got.stdout)
				}
			}
			if len(written.Threads) != 1 {
				t.Errorf("records %+v, want only the real clio's", written.Threads)
			}
		})
	}
}

// a /clear mints a new id in the same process: the coordinator's record still names her by her pid and start
func TestBriefSummonReadsTheCoordinatorAcrossAClear(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions, callers := t.TempDir(), filepath.Join(t.TempDir(), "caller-threads.json")
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-after-clear"}`)
	write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))
	write(t, callers, fmt.Sprintf(`{"v":1,"threads":[{"sessionId":"sid-before-clear","pid":%d,"procStart":%q,"role":"coordinator"}]}`, os.Getpid(), ownProcStart(t)))
	env := []string{"HOME=" + w.home, "X_SESSIONS=" + sessions, "X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_CALLER_THREADS=" + callers}

	got := xIn(t, w.repo, env, "brief", "summon", "--apply", "--role", "wing:1", "--session", "sid-fork")

	if got.code != 0 {
		t.Fatalf("exit %d, want the coordinator found by her pid and start:\n%s", got.code, got.stdout)
	}
}

// a torn registry file on x's nearest claude stands as a session with no record: the walk never reaches clio above it
func TestBriefSummonReadsATornRegistryFileAsNoCoordinator(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions, callers := t.TempDir(), filepath.Join(t.TempDir(), "caller-threads.json")
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-mem`)
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getppid())+".json"), `{"sessionId":"sid-clio"}`)
	write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))
	write(t, callers, `{"v":1,"threads":[{"sessionId":"sid-clio","role":"coordinator"}]}`)
	env := []string{"HOME=" + w.home, "X_SESSIONS=" + sessions, "X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_CALLER_THREADS=" + callers}

	got := xIn(t, w.repo, env, "brief", "summon", "--apply", "--role", "wing:1", "--session", "sid-fork")

	if got.code != 1 || !strings.Contains(got.stdout, "only the coordinator or dima") {
		t.Fatalf("exit %d, want the coordinator's refusal:\n%s", got.code, got.stdout)
	}
}

// the backfill: dima's own terminal, no claude above x, records a live thread by the session id he read
func TestBriefSummonFromDimasTerminalRecordsALiveSession(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	write(t, filepath.Join(sessions, "other.json"), fmt.Sprintf(`{"sessionId":"sid-other","pid":%d}`, os.Getpid()))
	env := []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}

	got := scriptX(t, env, "brief", "summon", "--apply", "--role", "coordinator", "--session", "sid-other")

	written, _ := readThreadStore(store)
	if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Role != "coordinator" {
		t.Fatalf("exit %d, records %+v, want sid-other recorded as the coordinator:\n%s", got.code, written.Threads, got.out)
	}
}

// exit 4's tty row: a member that strips its agent env and wraps x in a pty still runs under its own registered thread
func TestBriefSummonUnderScriptReadsTheMemberAboveIt(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	write(t, filepath.Join(sessions, "other.json"), fmt.Sprintf(`{"sessionId":"sid-other","pid":%d}`, os.Getpid()))
	env := asCaller(t, []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}, "codie")

	got := scriptX(t, env, "brief", "summon", "--apply", "--role", "coordinator", "--session", "sid-other")

	written, _ := readThreadStore(store)
	if got.code != 1 || !strings.Contains(got.out, "only the coordinator or dima") || len(written.Threads) != 0 {
		t.Fatalf("exit %d, records %+v, want the coordinator's refusal and no record:\n%s", got.code, written.Threads, got.out)
	}
}

// exit 7, the cutover: a clio started before the merge has no record, so her coordinator-only call refuses until dima's
// terminal backfills her by the session id he read; then it passes
func TestTheBackfillLetsAClioStartedBeforeTheMergeSummonAgain(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	brief := w.brief(t, goodBrief, true)
	// her registry as her own process sees it (x's parent is her), and as dima's terminal sees it (no claude above x)
	hers, dimas, store := t.TempDir(), t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	live := fmt.Sprintf(`{"sessionId":"sid-clio","pid":%d}`, os.Getpid())
	write(t, filepath.Join(hers, strconv.Itoa(os.Getpid())+".json"), live)
	write(t, filepath.Join(dimas, "clio.json"), live)
	server := newFakeLinear(t, func(gqlCall) string { return `{"data":{"issue":{"id":"uuid-1","description":""}}}` })
	env := []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID=", "X_THREADS=" + store, "X_KEYS=" + linearKeys(t), "X_LINEAR_URL=" + server.URL}
	asClio := func() ran {
		return xIn(t, w.repo, append(env, "X_SESSIONS="+hers), "brief", "summon", "--apply", "--area", "cli", codieArgv(w.repo, brief))
	}

	before := asClio()
	backfill := scriptX(t, append(env, "X_SESSIONS="+dimas), "brief", "summon", "--apply", "--role", "coordinator", "--session", "sid-clio")
	after := asClio()

	if before.code != 1 || backfill.code != 0 || after.code != 0 {
		t.Fatalf("before %d, backfill %d, after %d: want 1, 0, 0:\n%s\n%s", before.code, backfill.code, after.code, backfill.out, after.stdout)
	}
}

// round 2: a herdr terminal with no claude above x looks like dima's own, a member's `hc run` pane too; it gets no
// coordinator or wing record, while a sidecar's still lands
func TestBriefSummonGivesNoCoordinatorRecordToABareHerdrPane(t *testing.T) {
	t.Parallel()
	// dima, 15:47: the pane fallback lets his layout start clio only while no coordinator record is live; a name-seated
	// clio is no record, and a wing's record is no coordinator's, so main's start still passes beside a live wing; a dead
	// clio's record left by a halt is none
	const (
		clio     = `{"sessionId":"sid-clio","role":"coordinator"}`
		fallback = `{"sessionId":"sid-clio","role":"coordinator","fallback":true}`
		wing     = `{"sessionId":"sid-wing","role":"wing","wing":1}`
		dead     = `{"sessionId":"sid-gone","pid":1,"procStart":"Mon Jan 1 00:00:00 2024","role":"coordinator"}`
	)
	for _, c := range []struct {
		role, record string
		code         int
	}{{"coordinator", clio, 1}, {"wing:2", clio, 1}, {"adviser", clio, 0}, {"coordinator", fallback, 0}, {"coordinator", wing, 0}, {"coordinator", dead, 0}} {
		t.Run(fmt.Sprint(c.role, c.record), func(t *testing.T) {
			t.Parallel()
			sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "other.json"), fmt.Sprintf(`{"sessionId":"sid-other","pid":%d}`, os.Getpid()))
			write(t, filepath.Join(sessions, "clio.json"), fmt.Sprintf(`{"sessionId":"sid-clio","pid":%d}`, os.Getpid()))
			write(t, store, `{"v":1,"threads":[`+c.record+`]}`)

			got := scriptX(t, []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store, "HC_TERMINAL_ID=t9"}, "brief", "summon", "--apply", "--role", c.role, "--session", "sid-other")

			if got.code != c.code {
				t.Fatalf("exit %d, want %d:\n%s", got.code, c.code, got.out)
			}
		})
	}
}
