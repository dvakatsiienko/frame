package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"sync"
	"testing"
	"time"
)

// the turn log's fold (FRM-639 exit 4): a fixture of rows as turn-log.ts writes them, folded at a fixed clock

var statsNow = time.Date(2026, 11, 27, 12, 0, 0, 0, time.UTC)

const statsDead = 99_999_901

type statsWorld struct {
	t        *testing.T
	dir      string
	sessions string
}

func newStatsWorld(t *testing.T) statsWorld {
	return statsWorld{t: t, dir: t.TempDir(), sessions: t.TempDir()}
}

// the session registry's entry for a pid, naming the thread it runs, with the start time ps reads for that pid now
func (w statsWorld) live(pid int, sid string) {
	w.t.Helper()
	start := procStarts([]thread{{Pid: pid}}, []string{"x"})[pid]
	w.entry(pid, sid, start)
}

// an entry with a start time of its own: one a kill -9 left behind reads the old process's
func (w statsWorld) entry(pid int, sid, start string) {
	w.t.Helper()
	raw, _ := json.Marshal(map[string]any{"pid": pid, "procStart": start, "sessionId": sid})
	if err := os.WriteFile(filepath.Join(w.sessions, strconv.Itoa(pid)+".json"), raw, 0o644); err != nil {
		w.t.Fatal(err)
	}
}

// a row from `startMin` to `endMin`, minutes before the clock
func (w statsWorld) row(sid string, pid int, startMin, endMin float64, starter string, edit func(r map[string]any)) {
	w.t.Helper()
	start := statsNow.Add(-time.Duration(startMin * float64(time.Minute))).UnixMilli()
	end := statsNow.Add(-time.Duration(endMin * float64(time.Minute))).UnixMilli()
	r := map[string]any{
		"answerLen": 500, "asksOpened": 0, "cards": map[string]int{}, "ctx": 30, "end": end, "ended": "answer",
		"herdrJoins": 0, "isQueued": false, "pid": pid, "pingsJoined": 0, "prevEnd": nil, "reason": nil, "sid": sid,
		"start": start, "starter": starter, "ticks": []any{}, "tools": 3, "turnId": "t", "typedJoined": 0, "wind": nil,
		"windAsked": 0,
	}
	if edit != nil {
		edit(r)
	}
	w.write(time.UnixMilli(end).UTC().Format("2006-01-02"), sid, start, r)
}

func (w statsWorld) write(day, sid string, start int64, r any) {
	w.t.Helper()
	raw, _ := json.Marshal(r)
	path := filepath.Join(w.dir, day, sid+"."+itoa64(start)+".json")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		w.t.Fatal(err)
	}
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		w.t.Fatal(err)
	}
}

func itoa64(n int64) string { b, _ := json.Marshal(n); return string(b) }

// a thread busy the whole window, so no fleet-wide idle stretch cuts the others' parked time
func (w statsWorld) busy() { w.row("busy", statsDead, 24*60, 0, "typed", nil) }

func (w statsWorld) fold(hours int, only ...string) *statsAnswer {
	var o []string
	if len(only) > 0 {
		o = only
	}
	return statsFoldAt(w.dir, w.sessions, statsNow, hours, o)
}

func TestFleetStatsParked(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		plant func(w statsWorld)
		sid   string
		want  int64
	}{
		{"idle 5 minutes, worked, idle 2: 7 minutes", func(w statsWorld) {
			w.busy()
			w.row("x", statsDead, 30, 29, "typed", nil)
			w.row("x", statsDead, 24, 20, "typed", nil)
			w.row("x", statsDead, 18, 17, "typed", nil)
		}, "x", 7 * 60},
		{"a fleet-wide wait of 29 minutes counts 29, of 31 counts 30", func(w statsWorld) {
			w.row("x", statsDead, 100, 99, "typed", nil)
			w.row("x", statsDead, 70, 69, "typed", nil)
			w.row("x", statsDead, 38, 37, "typed", nil)
		}, "x", 59 * 60},
		{"a night of keep-hot pings counts only its first 30 minutes", func(w statsWorld) {
			hot := func(r map[string]any) { r["starter"], r["reason"] = "mod", "keep-hot" }
			w.row("x", statsDead, 400, 399, "typed", nil)
			w.row("x", statsDead, 349, 348, "mod", hot)
			w.row("x", statsDead, 293, 292, "mod", hot)
			w.row("x", statsDead, 241, 240, "mod", hot)
			w.row("x", statsDead, 100, 99, "typed", nil)
		}, "x", 30 * 60},
		{"a park of 30 hours counts from the window's start", func(w statsWorld) {
			w.busy()
			w.row("x", statsDead, 60, 59, "typed", func(r map[string]any) {
				r["prevEnd"] = statsNow.Add(-30 * time.Hour).UnixMilli()
			})
		}, "x", 23 * 3600},
		{"a killed thread resumed under a new pid parks nothing", func(w statsWorld) {
			w.busy()
			// a kill -9 leaves its registry entry behind
			w.live(statsDead+1, "x")
			w.row("x", statsDead, 400, 399, "typed", nil)
			w.row("x", statsDead+1, 99, 98, "typed", nil)
		}, "x", 0},
		{"a live idle thread parks its open gap", func(w statsWorld) {
			w.busy()
			w.live(os.Getpid(), "x")
			w.row("x", os.Getpid(), 10, 4, "typed", nil)
		}, "x", 4 * 60},
		{"a kill -9's entry left under a pid a new process took parks nothing", func(w statsWorld) {
			w.busy()
			w.entry(os.Getpid(), "x", "Thu Nov 26 00:00:00 2026")
			w.row("x", os.Getpid(), 10, 4, "typed", nil)
		}, "x", 0},
		{"a dead thread whose pid another session took parks nothing past its last row", func(w statsWorld) {
			w.busy()
			w.live(os.Getpid(), "someone-else")
			w.row("x", os.Getpid(), 10, 4, "typed", nil)
		}, "x", 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newStatsWorld(t)
			c.plant(w)
			if got := w.fold(24).Threads[c.sid].ParkedS; got != c.want {
				t.Fatalf("parked %d s, want %d", got, c.want)
			}
		})
	}
}

func TestFleetStatsRowsReadOnce(t *testing.T) {
	t.Parallel()
	w := newStatsWorld(t)
	w.row("x", statsDead, 60, 59, "typed", nil)
	start := statsNow.Add(-60 * time.Minute).UnixMilli()
	w.write("2026-11-26", "x", start, map[string]any{"sid": "x", "start": start, "end": start + 60_000, "starter": "typed"})
	if err := os.WriteFile(filepath.Join(w.dir, "2026-11-27", "torn.1.json"), nil, 0o644); err != nil {
		t.Fatal(err)
	}
	w.row("old", statsDead, 5*24*60, 5*24*60-1, "member", nil)
	for _, name := range []string{"2026-11-16.jsonl", "today.json", ".lock"} {
		if err := os.WriteFile(filepath.Join(w.dir, name), []byte("{}"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	day, week := w.fold(24), w.fold(168)
	got := []int{day.Fleet.Turns, day.Torn, week.Fleet.Turns, len(day.Skipped)}
	if !slices.Equal(got, []int{1, 1, 2, 3}) {
		t.Fatalf("turns, torn, a week's turns, skipped: %v, want [1 1 2 3]", got)
	}
}

func TestFleetStatsLostAndWakes(t *testing.T) {
	t.Parallel()
	w := newStatsWorld(t)
	w.busy()
	stamp, _ := json.Marshal(map[string]any{"pid": statsDead, "start": statsNow.Add(-time.Hour).UnixMilli(), "turnId": "gone"})
	if err := os.MkdirAll(filepath.Join(w.dir, "open"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(w.dir, "open", "k.json"), stamp, 0o644); err != nil {
		t.Fatal(err)
	}
	// a stamp whose pid another session took now: its thread is dead, its turn lost
	reused, _ := json.Marshal(map[string]any{"pid": os.Getpid(), "start": statsNow.Add(-2 * time.Hour).UnixMilli(), "turnId": "r"})
	if err := os.WriteFile(filepath.Join(w.dir, "open", "r.json"), reused, 0o644); err != nil {
		t.Fatal(err)
	}
	w.live(os.Getpid(), "someone-else")
	// a live thread's turn still running is no lost one
	running, _ := json.Marshal(map[string]any{"pid": os.Getpid(), "start": statsNow.Add(-time.Minute).UnixMilli(), "turnId": "now"})
	if err := os.WriteFile(filepath.Join(w.dir, "open", "someone-else.json"), running, 0o644); err != nil {
		t.Fatal(err)
	}
	// a dead thread's stamp its own row explains is no lost turn
	written, _ := json.Marshal(map[string]any{"pid": statsDead, "start": statsNow.Add(-20 * time.Minute).UnixMilli(), "turnId": "t"})
	if err := os.WriteFile(filepath.Join(w.dir, "open", "m.json"), written, 0o644); err != nil {
		t.Fatal(err)
	}
	quiet := func(n int) func(map[string]any) {
		return func(r map[string]any) { r["tools"], r["answerLen"] = 0, n }
	}
	w.row("m", statsDead, 50, 49, "member", quiet(10))
	w.row("m", statsDead, 40, 39, "member", quiet(statsEmptyLen))
	w.row("m", statsDead, 30, 29, "mod", func(r map[string]any) { quiet(1)(r); r["reason"] = "keep-hot" })
	w.row("m", statsDead, 20, 19, "member", func(r map[string]any) { quiet(1)(r); r["ended"] = "aborted" })
	f := w.fold(24)
	got := []int{f.Lost, f.Fleet.EmptyWakes, f.Fleet.WakesNotHis, f.Fleet.KeepHot}
	if !slices.Equal(got, []int{2, 1, 3, 1}) {
		t.Fatalf("lost, empty wakes, wakes not his, keep-hot: %v, want [2 1 3 1]", got)
	}
}

func TestFleetStatsBuckets(t *testing.T) {
	t.Parallel()
	w := newStatsWorld(t)
	w.row("x", statsDead, 60, 59, "typed", func(r map[string]any) { r["typedJoined"] = 2 })
	w.row("x", statsDead, 50, 49, "typed", func(r map[string]any) { r["isQueued"] = true })
	w.row("x", statsDead, 40, 39, "mod", func(r map[string]any) {
		r["reason"] = "wind"
		r["wind"] = map[string]any{"by": "mod", "ctx": 66}
		r["cards"] = map[string]int{"helper": 2, "other": 1}
		r["ticks"] = []any{map[string]any{"pick": "tick", "isSteer": false, "waitS": 90}, map[string]any{"pick": "replay", "isSteer": true, "waitS": nil}}
	})
	w.row("y", statsDead, 30, 29, "typed", nil)
	f := w.fold(24).Fleet
	got := []int{f.Pushed, f.Slipstreams, len(f.Winds.ByMod), f.Cards["helper"], f.Ticks, f.Replays, len(f.AskWaitS)}
	if !slices.Equal(got, []int{2, 3, 1, 2, 1, 1, 1}) {
		t.Fatalf("pushed, slipstreams, mod winds, helpers, ticks, replays, waits: %v, want [2 3 1 2 1 1 1]", got)
	}
	narrowed := w.fold(24, "y")
	if _, ok := narrowed.Threads["x"]; ok || narrowed.Fleet.Turns != 1 {
		t.Fatalf("--thread y kept x or counted %d turns, want 1", narrowed.Fleet.Turns)
	}
}

func TestFleetStatsSameBytesTwice(t *testing.T) {
	t.Parallel()
	w := newStatsWorld(t)
	w.row("x", statsDead, 60, 59, "typed", func(r map[string]any) { r["cards"] = map[string]int{"scout": 1, "helper": 1} })
	w.row("y", statsDead, 30, 29, "member", nil)
	a, _ := json.Marshal(w.fold(24))
	b, _ := json.Marshal(w.fold(24))
	if string(a) != string(b) {
		t.Fatalf("two folds differ:\n%s\n%s", a, b)
	}
}

// the binary: a default run writes the cache and 40 reads at once on an expired one rebuild it once; a filtered run
// neither reads nor writes it
func TestFleetStatsCache(t *testing.T) {
	t.Parallel()
	w := newStatsWorld(t)
	w.row("x", statsDead, 60, 59, "typed", nil)
	cache := filepath.Join(t.TempDir(), "fleet-stats.json")
	env := []string{"X_EVENTS=" + w.dir, "X_FLEET_STATS=" + cache, "X_NOW=" + statsNow.Format(time.RFC3339)}
	if err := os.WriteFile(cache, []byte(`{"v":1,"builtAt":"2026-11-27T11:00:00Z"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	cached := make([]bool, 40)
	var wg sync.WaitGroup
	for i := range cached {
		wg.Go(func() {
			got := xIn(t, t.TempDir(), env, "fleet", "stats")
			cached[i], _ = got.data["isCached"].(bool)
		})
	}
	wg.Wait()
	if built := slices.Index(cached, false); built == -1 || slices.Contains(cached[built+1:], false) {
		t.Fatalf("40 reads at once on an expired file: cached %v, want exactly one rebuild", cached)
	}
	// a fresh cache that lies: a filtered run neither reads it nor writes it
	fake := `{"v":1,"builtAt":"` + statsNow.Format(time.RFC3339Nano) + `","lost":99}`
	if err := os.WriteFile(cache, []byte(fake), 0o644); err != nil {
		t.Fatal(err)
	}
	got := xIn(t, t.TempDir(), env, "fleet", "stats", "--thread", "x")
	if after, _ := os.ReadFile(cache); string(after) != fake || got.data["lost"] == float64(99) {
		t.Fatalf("a filtered run read or wrote the cache: lost %v", got.data["lost"])
	}
}
