package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

// a registry with a live entry (this test's own pid) and a dead one, and a store holding records beside it
func threadWorld(t *testing.T) (env []string, store string, live, dead int) {
	t.Helper()
	sessions := t.TempDir()
	store = filepath.Join(t.TempDir(), "threads.json")
	live = os.Getpid()
	gone := exec.Command("true")
	if err := gone.Run(); err != nil {
		t.Fatal(err)
	}
	dead = gone.Process.Pid
	for sid, pid := range map[string]int{"sid-codie": live, "sid-plain": live, "sid-killed": dead} {
		write(t, filepath.Join(sessions, sid+".json"), fmt.Sprintf(`{"sessionId":%q,"pid":%d,"name":"old name %s","cwd":"/w","status":"busy"}`, sid, pid, sid))
	}
	now := time.Now().UnixMilli()
	records, _ := json.Marshal(threadStore{V: 1, Threads: []thread{
		{SessionID: "sid-codie", Role: "codie", Lane: "cli lane 8", LaneKind: "side", Ticket: "FRM-570", At: now - 3_600_000},
		{SessionID: "sid-killed", Role: "sixth-sense", Lane: "cli lane 8", Ticket: "FRM-570", At: now - 3_600_000},
		{SessionID: "sid-launching", Role: "sixth-sense", Lane: "mods 6", LaneKind: "quick", Ticket: "FRM-574", At: now},
		{SessionID: "sid-never-launched", Role: "codie", Lane: "mods 6", At: now - 3_600_000},
	}})
	write(t, store, string(records))
	return []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}, store, live, dead
}

func TestThreadListJoinsTheRegistryToItsRecords(t *testing.T) {
	t.Parallel()
	env, store, live, _ := threadWorld(t)

	got := xIn(t, t.TempDir(), env, "thread", "list")

	want := map[string]string{
		"sid-codie":     "🌗 🔧 cli lane 8 | FRM-570",
		"sid-plain":     "unknown",
		"sid-launching": "⚡ 🔎 mods 6 | FRM-574",
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
		ats = append(ats, readThreadStore(store).At)
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
		{key: "sid-codie", want: "🌗 🔧 cli lane 8 | FRM-570"},
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
