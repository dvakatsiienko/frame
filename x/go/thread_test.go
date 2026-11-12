package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// a registry with a live entry (this test's own pid) and a dead one, and a store holding records beside it
func threadWorld(t *testing.T) (env []string, store string, live, dead int) {
	t.Helper()
	sessions := t.TempDir()
	store = filepath.Join(t.TempDir(), "threads.json")
	live = os.Getpid()
	// x's own help: a pid that exits at once, with no binary ci must install (a test binary's rerun would rebuild x)
	gone := exec.Command(xbin, "--help")
	gone.Env = append(os.Environ(), "X_TEST=1")
	if err := gone.Run(); err != nil {
		t.Fatal(err)
	}
	dead = gone.Process.Pid
	for sid, pid := range map[string]int{"sid-codie": live, "sid-plain": live, "sid-killed": dead} {
		write(t, filepath.Join(sessions, sid+".json"), fmt.Sprintf(`{"sessionId":%q,"pid":%d,"name":"old name %s","cwd":"/w","status":"busy"}`, sid, pid, sid))
	}
	// a crashed session's row whose pid another process took: its start time is not that process's
	write(t, filepath.Join(sessions, "sid-reused.json"), fmt.Sprintf(`{"sessionId":"sid-reused","pid":%d,"procStart":"Thu Jan  1 00:00:01 1970","cwd":"/w"}`, live))
	now := time.Now().UnixMilli()
	records, _ := json.Marshal(threadStore{V: 1, Threads: []thread{
		{SessionID: "sid-codie", Role: "codie", Lane: "cli lane 8", LaneKind: "side", Ticket: "FRM-570", Area: "cli", At: now - 3_600_000},
		{SessionID: "sid-killed", Role: "sixth-sense", Lane: "cli lane 8", Ticket: "FRM-570", At: now - 3_600_000},
		{SessionID: "sid-launching", Role: "sixth-sense", Lane: "mods 6", LaneKind: "quick", Ticket: "FRM-574", Area: "mods", At: now},
		{SessionID: "sid-never-launched", Role: "codie", Lane: "mods 6", At: now - 3_600_000},
		{SessionID: "sid-reused", Role: "sixth-sense", Lane: "cli lane 8", At: now - 3_600_000},
		// an archived session: its registry file is gone while its old pid still runs something
		{SessionID: "sid-archived", Pid: live, Role: "codie", Lane: "cli lane 8", At: now - 3_600_000},
	}})
	write(t, store, string(records))
	return []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}, store, live, dead
}

// FRM-572 rider (dima 19:02): the human view draws a row a thread, not only the count
func TestThreadListDrawsARowAThread(t *testing.T) {
	t.Parallel()
	env, _, _, _ := threadWorld(t)

	got := xIn(t, t.TempDir(), env, "thread", "list", "--board")

	for _, want := range []string{"🌗 🔧 cli | FRM-570", "codie", "/w", "alive", "⚡ 🔎 mods | FRM-574", "starting", "old name sid-plain", "no role", "3 threads"} {
		if !strings.Contains(got.stdout, want) {
			t.Errorf("want %q on the board:\n%s", want, got.stdout)
		}
	}
}

func TestThreadListJoinsTheRegistryToItsRecords(t *testing.T) {
	t.Parallel()
	env, store, live, _ := threadWorld(t)

	got := xIn(t, t.TempDir(), env, "thread", "list")

	want := map[string]string{
		"sid-codie":     "🌗 🔧 cli | FRM-570",
		"sid-plain":     "unknown",
		"sid-launching": "⚡ 🔎 mods | FRM-574",
	}
	var written threadStore
	raw, _ := os.ReadFile(store)
	if err := json.Unmarshal(raw, &written); err != nil || got.code != 0 {
		t.Fatalf("exit %d, store %s:\n%s", got.code, raw, got.stdout)
	}
	shown := map[string]string{}
	for _, th := range written.Threads {
		shown[th.SessionID] = th.Display
		if th.SessionID == "sid-codie" && th.Pid != live {
			t.Errorf("sid-codie pid %d, want %d", th.Pid, live)
		}
	}
	if fmt.Sprint(shown) != fmt.Sprint(want) {
		t.Errorf("store threads %v, want %v (a killed pid and a record past its launch wait drop out)", shown, want)
	}
}

func TestThreadListRewritesTheStoreEachCall(t *testing.T) {
	t.Parallel()
	env, store, _, _ := threadWorld(t)
	var ats []int64
	for range 2 {
		if got := xIn(t, t.TempDir(), env, "thread", "list"); got.code != 0 {
			t.Fatalf("exit %d:\n%s", got.code, got.stdout)
		}
		written, _ := readThreadStore(store)
		ats = append(ats, written.At)
		time.Sleep(5 * time.Millisecond)
	}
	if ats[1] <= ats[0] {
		t.Fatalf("store at %v, want it to move on each call", ats)
	}
}

func TestThreadShowFindsASessionByIdOrPid(t *testing.T) {
	t.Parallel()
	env, _, live, dead := threadWorld(t)
	for _, c := range []struct {
		key, want string
		code      int
	}{
		{key: "sid-codie", want: "🌗 🔧 cli | FRM-570"},
		{key: "sid-plain", want: "unknown"},
		{key: strconv.Itoa(dead), code: 1},
		{key: "sid-nobody", code: 1},
	} {
		got := xIn(t, t.TempDir(), env, "thread", "show", c.key)
		if got.code != c.code || (c.code == 0 && got.data["display"] != c.want) {
			t.Errorf("%s: exit %d, display %v, want %d %q:\n%s", c.key, got.code, got.data["display"], c.code, c.want, got.stdout)
		}
	}
	if got := xIn(t, t.TempDir(), env, "thread", "show", strconv.Itoa(live)); got.code != 0 {
		t.Errorf("by pid %d: exit %d:\n%s", live, got.code, got.stdout)
	}
}

// this test's own start, the way the registry writes procStart and procStarts reads it back
func ownProcStart(t *testing.T) string {
	t.Helper()
	c := exec.Command("ps", "-o", "lstart=", "-p", strconv.Itoa(os.Getpid()))
	c.Env = append(os.Environ(), "LC_ALL=C", "TZ=UTC")
	out, err := c.Output()
	if err != nil {
		t.Fatal(err)
	}
	return strings.Join(strings.Fields(string(out)), " ")
}

func TestThreadListKeepsARecordAcrossAClear(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	start := ownProcStart(t)
	// /clear mints a new session id for the same process: the registry row moves on, the record still names the old id
	write(t, filepath.Join(sessions, "row.json"), fmt.Sprintf(`{"sessionId":"sid-after-clear","pid":%d,"procStart":%q,"name":"n"}`, os.Getpid(), start))
	records, _ := json.Marshal(threadStore{V: 1, Threads: []thread{
		{SessionID: "sid-before-clear", Pid: os.Getpid(), ProcStart: start, Role: "sixth-sense", Lane: "cli lane 8", Ticket: "FRM-570", At: time.Now().UnixMilli() - 3_600_000},
	}})
	write(t, store, string(records))

	if got := xIn(t, t.TempDir(), []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}, "thread", "list"); got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	written, err := readThreadStore(store)
	if err != nil || len(written.Threads) != 1 || written.Threads[0].SessionID != "sid-after-clear" || written.Threads[0].Role != "sixth-sense" {
		t.Fatalf("store %+v (%v), want the one record under sid-after-clear, its role kept", written.Threads, err)
	}
}

func TestThreadListRefreshesALiveRecordsTime(t *testing.T) {
	t.Parallel()
	env, store, _, _ := threadWorld(t)
	before := time.Now().UnixMilli()
	if got := xIn(t, t.TempDir(), env, "thread", "list"); got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	written, _ := readThreadStore(store)
	for _, th := range written.Threads {
		if th.SessionID == "sid-codie" && th.At < before {
			t.Fatalf("sid-codie at %d, want it moved to the join (>= %d), so one torn registry read cannot age it out", th.At, before)
		}
	}
}

func TestThreadListRefusesAStoreThatDoesNotParse(t *testing.T) {
	t.Parallel()
	env, store, _, _ := threadWorld(t)
	write(t, store, `{"threads":[{"sessionId":"sid-codie","role":"codie"`)

	got := xIn(t, t.TempDir(), env, "thread", "list")

	raw, _ := os.ReadFile(store)
	if got.code != 1 || !strings.Contains(got.stdout, "does not parse") || string(raw) != `{"threads":[{"sessionId":"sid-codie","role":"codie"` {
		t.Fatalf("exit %d, store now %q, want exit 1 naming the parse and the file untouched:\n%s", got.code, raw, got.stdout)
	}
}

func TestThreadRecordKeepsTheLiveFields(t *testing.T) {
	// serial: X_THREADS is the store writeThreadRecord reads
	store := filepath.Join(t.TempDir(), "threads.json")
	t.Setenv("X_THREADS", store)
	records, _ := json.Marshal(threadStore{V: 1, Threads: []thread{
		{SessionID: "sid-1", Pid: 42, ProcStart: "Wed Nov 11 11:30:49 2026", Name: "live name", Cwd: "/w", Role: "codie", Lane: "cli lane 8", LaneKind: "side"},
	}})
	write(t, store, string(records))

	if err := writeThreadRecord(thread{SessionID: "sid-1", Role: "codie", LaneKind: "quick", Ticket: "FRM-570"}, time.Now(), false); err != nil {
		t.Fatal(err)
	}
	written, _ := readThreadStore(store)
	got := written.Threads[0]
	if got.Pid != 42 || got.ProcStart == "" || got.Name != "live name" || got.Cwd != "/w" || got.Lane != "cli lane 8" || got.LaneKind != "side" || got.Ticket != "FRM-570" {
		t.Fatalf("record %+v, want the live pid, start, name, cwd and the lane kept beside the new ticket", got)
	}
}

func TestThreadRecordsWrittenAtOnceAllLand(t *testing.T) {
	// serial: X_THREADS is the store writeThreadRecord reads
	store := filepath.Join(t.TempDir(), "threads.json")
	t.Setenv("X_THREADS", store)
	var wg sync.WaitGroup
	for i := range 24 {
		wg.Go(func() {
			if err := writeThreadRecord(thread{SessionID: fmt.Sprintf("sid-%02d", i), Role: "codie"}, time.Now(), true); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	written, err := readThreadStore(store)
	if err != nil || len(written.Threads) != 24 {
		t.Fatalf("%d records (%v), want all 24: each writer reads and rewrites the whole store", len(written.Threads), err)
	}
}

// exit 11b, sixth sense round 1: a thread once seen live drops at the next call when its pid dies (kill -9) or its
// registry file goes (archived); only a torn read of its own file keeps it through the launch wait
func TestThreadListDropsASeenThreadOnceItsPidOrFileGoes(t *testing.T) {
	t.Parallel()
	_, _, live, dead := threadWorld(t)
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	start, now := ownProcStart(t), time.Now().UnixMilli()
	write(t, filepath.Join(sessions, strconv.Itoa(dead)+".json"), fmt.Sprintf(`{"sessionId":"sid-killed","pid":%d,"procStart":%q}`, dead, start))
	write(t, filepath.Join(sessions, strconv.Itoa(live)+".json"), `{"sessionId":"sid-torn","pi`)
	records, _ := json.Marshal(threadStore{V: 1, Threads: []thread{
		{SessionID: "sid-killed", Pid: dead, ProcStart: start, Role: "codie", At: now},
		{SessionID: "sid-archived", Pid: os.Getppid(), ProcStart: start, Role: "sixth-sense", At: now},
		{SessionID: "sid-torn", Pid: live, ProcStart: start, Role: "sixth-sense", At: now},
	}})
	write(t, store, string(records))

	if got := xIn(t, t.TempDir(), []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}, "thread", "list"); got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	written, _ := readThreadStore(store)
	kept := []string{}
	for _, th := range written.Threads {
		kept = append(kept, th.SessionID)
	}
	if fmt.Sprint(kept) != "[sid-torn]" {
		t.Fatalf("store keeps %v, want only sid-torn: a dead pid and a gone file drop a thread seen live", kept)
	}
}

// the registry file of the test process, x's parent, the session x's role gate finds above it (callerIsCoordinator); no
// pid, so no thread list counts it live. it lands in the env's X_SESSIONS dir, or a new one; a role lands as its record
// in a caller store of its own (X_CALLER_THREADS), so the store a test inspects holds only what x wrote
func asCaller(t *testing.T, env []string, role string) []string {
	t.Helper()
	dir := envOf(env, "X_SESSIONS")
	env = slices.Clone(env)
	if dir == "" {
		dir = t.TempDir()
		env = append(env, "X_SESSIONS="+dir)
	}
	write(t, filepath.Join(dir, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-caller","name":"any name"}`)
	if role == "" {
		return env
	}
	store := filepath.Join(t.TempDir(), "caller-threads.json")
	write(t, store, `{"v":1,"threads":[{"sessionId":"sid-caller","role":"`+role+`","wing":1}]}`)
	return append(env, "X_CALLER_THREADS="+store)
}

func envOf(env []string, name string) string {
	value := ""
	for _, kv := range env {
		if v, ok := strings.CutPrefix(kv, name+"="); ok {
			value = v
		}
	}
	return value
}

// FRM-570 round 3, exit 17: a codie's own summon is refused before any record, so it never mints itself a sixth sense
func TestBriefSummonFromACodieIsRefused(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")
	env := asCaller(t, []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID=", "X_THREADS=" + store}, "")

	got := xIn(t, w.repo, env, "brief", "summon", sixthArgv(w, " spec: .scratch/cli-lane-8/spec.md"))

	written, _ := readThreadStore(store)
	if got.code != 1 || !strings.Contains(got.stdout, "only the coordinator or dima") || len(written.Threads) != 0 {
		t.Fatalf("exit %d, records %+v, want a refusal naming the coordinator and no record:\n%s", got.code, written.Threads, got.stdout)
	}
}

// FRM-579 round 4, the P0: a session seated coordinator only by the name fallback never writes a record, so a fork
// named «🦉 clio» cannot record itself and turn the fallback off for the real clio
func TestAFallbackSeatWritesNoRecord(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")
	env := asCaller(t, []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID=", "X_THREADS=" + store}, "")
	seat := filepath.Join(t.TempDir(), "caller-threads.json")
	write(t, seat, `{"v":1,"threads":[{"sessionId":"sid-caller","role":"coordinator","fallback":true}]}`)
	env = append(env, "X_CALLER_THREADS="+seat)

	got := xIn(t, w.repo, env, "brief", "summon", "--role", "coordinator", "--session", "sid-caller")

	written, _ := readThreadStore(store)
	if got.code != 1 || !strings.Contains(got.stdout, "only the coordinator or dima") || len(written.Threads) != 0 {
		t.Fatalf("exit %d, records %+v, want a refusal and no record:\n%s", got.code, written.Threads, got.stdout)
	}
}
