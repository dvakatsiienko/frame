package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"
)

func eventsAt(hour, minute int) time.Time {
	return time.Date(2026, 11, 16, hour, minute, 0, 0, time.Local)
}

// one x call against a planted events folder, the clock set
func eventsRun(t *testing.T, dir string, at time.Time, args ...string) ran {
	t.Helper()
	return xIn(t, t.TempDir(), []string{"X_EVENTS=" + dir, "X_NOW=" + at.Format(time.RFC3339)}, append([]string{"events"}, args...)...)
}

func eventsLines(t *testing.T, dir string, at time.Time) []string {
	t.Helper()
	raw, err := os.ReadFile(eventsDayFile(dir, at.Format(eventsDay)))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		t.Fatal(err)
	}
	return strings.Split(strings.TrimSuffix(string(raw), "\n"), "\n")
}

func eventsSnapshotOf(t *testing.T, dir string) eventsSnapshot {
	t.Helper()
	raw, err := os.ReadFile(eventsSnapshotFile(dir))
	if err != nil {
		t.Fatal(err)
	}
	var snapshot eventsSnapshot
	if err := json.Unmarshal(raw, &snapshot); err != nil {
		t.Fatal(err)
	}
	return snapshot
}

func kindCount(t *testing.T, got ran, kind string) float64 {
	t.Helper()
	kinds, _ := got.data["kinds"].(map[string]any)
	count, _ := kinds[kind].(map[string]any)
	n, _ := count["n"].(float64)
	return n
}

func TestEventsLogWritesOneLineAndTodayCountsItOnce(t *testing.T) {
	t.Parallel()
	dir, at := filepath.Join(t.TempDir(), "events"), eventsAt(12, 0)
	if got := eventsRun(t, dir, at, "log", "wind.taken", "sid=abc-123", "id=wind:1", "by=mod", "pct=58"); got.code != 0 {
		t.Fatalf("log exit %d: %s", got.code, got.stdout)
	}
	lines := eventsLines(t, dir, at)
	if len(lines) != 1 {
		t.Fatalf("the day file holds %d lines, want 1", len(lines))
	}
	var line map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &line); err != nil {
		t.Fatalf("the line does not parse alone: %v", err)
	}
	want := map[string]any{"v": 1.0, "at": at.Format(eventsAtLayout), "kind": "wind.taken", "sid": "abc-123", "id": "wind:1", "by": "mod", "pct": 58.0}
	for key, value := range want {
		if line[key] != value {
			t.Errorf("line[%q] = %v, want %v", key, line[key], value)
		}
	}
	if len(line) != len(want) {
		t.Errorf("the line holds %d keys, want %d: %s", len(line), len(want), lines[0])
	}

	eventsRun(t, dir, at, "log", "wind.taken", "sid=abc-123", "id=wind:1", "by=mod", "pct=58")
	if lines := eventsLines(t, dir, at); len(lines) != 2 {
		t.Fatalf("after a second log of the same id the day file holds %d lines, want 2", len(lines))
	}
	today := eventsRun(t, dir, at, "today")
	if n := kindCount(t, today, "wind.taken"); n != 1 {
		t.Errorf("today counts wind.taken %v times, want 1", n)
	}
	if by := eventsSnapshotOf(t, dir).Kinds["wind.taken"].By["by"]["mod"]; by != 1 {
		t.Errorf("the snapshot splits by=mod as %d, want 1", by)
	}
	threads, _ := today.data["threads"].(map[string]any)
	if thread, _ := threads["abc-123"].(map[string]any); thread["n"] != 1.0 {
		t.Errorf("thread abc-123 counts %v, want 1", thread["n"])
	}
}

func TestEventsFoldCountsOneIDOncePerKind(t *testing.T) {
	t.Parallel()
	line := func(kind string) string {
		return fmt.Sprintf(`{"v":1,"at":"2026-11-16T10:00:00.000+02:00","kind":%q,"sid":"a","id":"turn-7"}`, kind) + "\n"
	}
	got := eventsFold([]byte(line("park.end")+line("wake.turn")+line("park.end")), "2026-11-16", nil, nil)
	if got.Events != 2 || got.Kinds["park.end"].N != 1 || got.Kinds["wake.turn"].N != 1 {
		t.Errorf("one turn id under two kinds counts %d events, want one a kind", got.Events)
	}
}

func TestEventsLogRefusesWhatTheKindsListDoesNotAllow(t *testing.T) {
	t.Parallel()
	ids := []string{"sid=abc", "id=one"}
	cases := []struct {
		name  string
		args  []string
		names string
	}{
		{"a kind outside the registry", append([]string{"wind.blown"}, ids...), "no event kind"},
		{"a kind that is his words", append([]string{"please fix it"}, ids...), "no event kind"},
		{"a bare word that is his words", append([]string{"hot.ping", "please fix it"}, ids...), "word 2 is no key=value"},
		{"a key that is his words", append([]string{"hot.ping", "please fix it=1"}, ids...), "key=value"},
		{"an enum value over several lines", append([]string{"wind.taken", "by=please\nfix it\nnow"}, ids...), "dima, mod"},
		{"a number that is his words", append([]string{"wind.taken", "pct=please fix it"}, ids...), "0 to 100"},
		{"a field outside the kind's list", append([]string{"hot.ping", "pct=5"}, ids...), "pct"},
		{"a value outside its enum", append([]string{"wind.taken", "by=clio"}, ids...), "dima, mod"},
		{"a slug over its cap", append([]string{"guard.refusal", "rule=" + strings.Repeat("a", 49)}, ids...), "rule"},
		{"a slug holding a command", append([]string{"guard.refusal", "rule=rm -rf ~/frame"}, ids...), "rule"},
		{"a number over its range", append([]string{"wind.taken", "pct=101"}, ids...), "0 to 100"},
		{"a number that is a word", append([]string{"wind.taken", "pct=half"}, ids...), "pct"},
		{"no sid", []string{"hot.ping", "id=one"}, "sid"},
		{"no id", []string{"hot.ping", "sid=abc"}, "id"},
		{"an id over its cap", []string{"hot.ping", "sid=abc", "id=" + strings.Repeat("a", 97)}, "id"},
		{"an id holding his words", []string{"hot.ping", "sid=abc", "id=please fix it"}, "id"},
		{"a key given twice", append([]string{"wind.taken", "pct=1", "pct=2"}, ids...), "twice"},
		{"a word with no =", append([]string{"hot.ping", "loose"}, ids...), "key=value"},
		{"an unknown flag", append([]string{"hot.ping", "-word"}, ids...), ""},
		{"words after a dash", append([]string{"hot.ping", "--", "free text"}, ids...), "key=value"},
		{"no kind", nil, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, at := filepath.Join(t.TempDir(), "events"), eventsAt(12, 0)
			got := eventsRun(t, dir, at, append([]string{"log"}, c.args...)...)
			if got.code != 2 {
				t.Fatalf("exit %d, want 2: %s", got.code, got.stdout)
			}
			if !strings.Contains(got.stdout, c.names) {
				t.Errorf("the refusal does not name %q: %s", c.names, got.stdout)
			}
			if strings.Contains(got.stdout, "rm -rf") || strings.Contains(got.stdout, "fix it") || strings.Contains(got.stdout, "wind.blown") {
				t.Errorf("the refusal echoes the refused text: %s", got.stdout)
			}
			if lines := eventsLines(t, dir, at); lines != nil {
				t.Errorf("a refused log wrote %d lines", len(lines))
			}
		})
	}
}

// the fold a reader would write by hand: unique ids per kind
func foldByHand(t *testing.T, lines []string) map[string]int {
	t.Helper()
	counts, seen := map[string]int{}, map[string]bool{}
	for at, text := range lines {
		var line struct{ Kind, ID string }
		if err := json.Unmarshal([]byte(text), &line); err != nil {
			t.Fatalf("line %d does not parse alone: %v: %q", at+1, err, text)
		}
		if !seen[line.ID] {
			seen[line.ID] = true
			counts[line.Kind]++
		}
	}
	return counts
}

// the exit line asks ten rounds; one runs in the suite, X_EVENTS_ROUNDS=10 runs them all by hand (2,000 process starts)
func TestEventsSnapshotEqualsAFoldUnderParallelWriters(t *testing.T) {
	t.Parallel()
	rounds, _ := strconv.Atoi(os.Getenv("X_EVENTS_ROUNDS"))
	kinds := []string{"hot.ping", "ask.open", "park.start", "orbit.slipstream"}
	for round := range max(rounds, 1) {
		dir, at := filepath.Join(t.TempDir(), "events"), eventsAt(12, 0)
		var shells sync.WaitGroup
		for shell := range 4 {
			shells.Go(func() {
				for call := range 50 {
					// every fifth call repeats an id another shell also writes
					id := fmt.Sprintf("s%d-c%d", shell, call)
					if call%5 == 0 {
						id = fmt.Sprintf("shared-c%d", call)
					}
					if got := eventsRun(t, dir, at, "log", kinds[call%len(kinds)], "sid=shell-"+strconv.Itoa(shell), "id="+id); got.code != 0 {
						t.Errorf("round %d: log exit %d: %s", round, got.code, got.stdout)
					}
				}
			})
		}
		shells.Wait()
		lines := eventsLines(t, dir, at)
		if len(lines) != 200 {
			t.Fatalf("round %d: the day file holds %d lines, want 200", round, len(lines))
		}
		want, snapshot := foldByHand(t, lines), eventsSnapshotOf(t, dir)
		for kind, n := range want {
			if got := snapshot.Kinds[kind]; got == nil || got.N != n {
				t.Errorf("round %d: today.json counts %s as %+v, a fold of the lines gives %d", round, kind, got, n)
			}
		}
		if len(snapshot.Kinds) != len(want) || snapshot.Lines != 200 || snapshot.Skipped != 0 {
			t.Errorf("round %d: today.json holds %d kinds, %d lines, %d skipped; want %d, 200, 0", round, len(snapshot.Kinds), snapshot.Lines, snapshot.Skipped, len(want))
		}
	}
}

func TestEventsRebuildFromFewerBytesKeepsTheNewerSnapshot(t *testing.T) {
	t.Parallel()
	dir, day := t.TempDir(), "2026-11-16"
	line := `{"v":1,"at":"2026-11-16T12:00:00.000+02:00","kind":"hot.ping","sid":"a","id":"1"}` + "\n"
	if err := os.WriteFile(eventsDayFile(dir, day), []byte(line), 0o644); err != nil {
		t.Fatal(err)
	}
	newer, _ := json.Marshal(eventsSnapshot{V: eventsVersion, Day: day, Bytes: int64(len(line)) + 100, Events: 7})
	if err := os.WriteFile(eventsSnapshotFile(dir), newer, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := eventsRebuild(dir, day); err != nil {
		t.Fatal(err)
	}
	if got := eventsSnapshotOf(t, dir); got.Events != 7 {
		t.Errorf("a rebuild from fewer bytes replaced the newer snapshot: events %d, want 7", got.Events)
	}

	grown := strings.Repeat(line, 3) + `{"v":1,"at":"2026-11-16T12:00:01.000+02:00","kind":"hot.ping","sid":"a","id":"2"}` + "\n" + strings.Repeat(" ", 200) + "\n"
	if err := os.WriteFile(eventsDayFile(dir, day), []byte(grown), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := eventsRebuild(dir, day); err != nil {
		t.Fatal(err)
	}
	if got := eventsSnapshotOf(t, dir); got.Events != 2 || got.Bytes != int64(len(grown)) {
		t.Errorf("a day file grown past the recorded size was not refolded: events %d bytes %d", got.Events, got.Bytes)
	}
}

// a rebuild's read, compare and rename sit under the folder's lock: while another holder has it, nothing is written
func TestEventsRebuildWaitsForTheFoldersLock(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	holder, err := os.OpenFile(filepath.Join(dir, ".lock"), os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		t.Fatal(err)
	}
	defer holder.Close()
	if err := syscall.Flock(int(holder.Fd()), syscall.LOCK_EX); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		_, err := eventsRebuild(dir, "2026-11-16")
		done <- err
	}()
	select {
	case err := <-done:
		t.Fatalf("the rebuild ran through a held lock (err %v)", err)
	case <-time.After(150 * time.Millisecond):
	}
	if _, err := os.Stat(eventsSnapshotFile(dir)); !os.IsNotExist(err) {
		t.Fatalf("the snapshot was written under a held lock")
	}
	if err := syscall.Flock(int(holder.Fd()), syscall.LOCK_UN); err != nil {
		t.Fatal(err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if got := eventsSnapshotOf(t, dir); got.Day != "2026-11-16" {
		t.Errorf("after the lock is free the snapshot says %q", got.Day)
	}
}

func TestEventsFoldSkipsAndCountsALineThatDoesNotParseAlone(t *testing.T) {
	t.Parallel()
	good := `{"v":1,"at":"2026-11-16T12:00:00.000+02:00","kind":"hot.ping","sid":"a","id":"1"}`
	cases := []struct{ name, line string }{
		{"a torn line", good[:40]},
		{"not json", "wind taken"},
		{"no id", `{"v":1,"at":"2026-11-16T12:00:00.000+02:00","kind":"hot.ping","sid":"a"}`},
		{"no version", `{"at":"2026-11-16T12:00:00.000+02:00","kind":"hot.ping","sid":"a","id":"2"}`},
		{"a stamp that is no time", `{"v":1,"at":"noon","kind":"hot.ping","sid":"a","id":"2"}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			got := eventsFold([]byte(good+"\n"+c.line+"\n"), "2026-11-16", nil, nil)
			if got.Events != 1 || got.Skipped != 1 || got.Lines != 2 {
				t.Errorf("events %d skipped %d lines %d, want 1 1 2", got.Events, got.Skipped, got.Lines)
			}
		})
	}
}

func parkedOf(t *testing.T, got ran, sid string) float64 {
	t.Helper()
	threads, _ := got.data["threads"].(map[string]any)
	thread, _ := threads[sid].(map[string]any)
	parked, _ := thread["parked_s"].(float64)
	return parked
}

func TestEventsTodaySumsParkedTimeFromTheParkLines(t *testing.T) {
	t.Parallel()
	dir := filepath.Join(t.TempDir(), "events")
	steps := []struct {
		kind   string
		minute int
	}{{"park.start", 0}, {"park.end", 5}, {"park.start", 20}, {"park.end", 22}}
	for at, step := range steps {
		eventsRun(t, dir, eventsAt(10, step.minute), "log", step.kind, "sid=thread-a", "id=turn-"+strconv.Itoa(at))
	}
	if parked := parkedOf(t, eventsRun(t, dir, eventsAt(11, 0), "today"), "thread-a"); parked != 7*60 {
		t.Errorf("a 5 minute and a 2 minute park total %v s, want 420", parked)
	}
	eventsRun(t, dir, eventsAt(11, 0), "log", "park.start", "sid=thread-a", "id=turn-9")
	if parked := parkedOf(t, eventsRun(t, dir, eventsAt(11, 10), "today"), "thread-a"); parked != 17*60 {
		t.Errorf("an open park of 10 minutes on top of 7 totals %v s, want 1020", parked)
	}
}

func TestEventsFoldAddsNoTimeForAParkLineOutOfOrder(t *testing.T) {
	t.Parallel()
	line := func(kind, id string, minute int) string {
		return fmt.Sprintf(`{"v":1,"at":"2026-11-16T10:%02d:00.000+02:00","kind":%q,"sid":"a","id":%q}`, minute, kind, id) + "\n"
	}
	cases := []struct {
		name  string
		lines string
		want  int64
		open  bool
	}{
		{"an end with no start", line("park.end", "1", 5), 0, false},
		{"a second start before an end keeps the first", line("park.start", "1", 0) + line("park.start", "2", 3) + line("park.end", "3", 5), 300, false},
		{"an end resent under its id counts once", line("park.start", "1", 0) + line("park.end", "2", 5) + line("park.end", "2", 9), 300, false},
		{"a start with no end stays open", line("park.start", "1", 0), 0, true},
		{"an end appended before its start pairs by stamp", line("park.start", "1", 0) + line("park.start", "3", 9) + line("park.end", "2", 5), 300, true},
		{"a turn id ends one park and starts the next", line("park.start", "t1", 0) + line("park.end", "t2", 5) + line("park.start", "t2", 6) + line("park.end", "t3", 8), 420, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			thread := eventsFold([]byte(c.lines), "2026-11-16", nil, nil).Threads["a"]
			if thread.ParkedS != c.want || (thread.ParkOpenAt != "") != c.open {
				t.Errorf("parked %d s, open %q; want %d s, open %v", thread.ParkedS, thread.ParkOpenAt, c.want, c.open)
			}
		})
	}
}

func TestEventsDayIsTheRotation(t *testing.T) {
	t.Parallel()
	dir := filepath.Join(t.TempDir(), "events")
	late, early := eventsAt(23, 59), eventsAt(23, 59).Add(2*time.Minute)
	yesterday, today := late.Format(eventsDay), early.Format(eventsDay)
	eventsRun(t, dir, late, "log", "hot.ping", "sid=a", "id=late")
	if got := eventsRun(t, dir, early, "today"); got.data["events"] != 0.0 {
		t.Errorf("today, before its first event, counts %v from yesterday's snapshot", got.data["events"])
	}
	if snapshot := eventsSnapshotOf(t, dir); snapshot.Day != today {
		t.Errorf("today.json built yesterday still says %s, want %s", snapshot.Day, today)
	}
	eventsRun(t, dir, early, "log", "ask.open", "sid=a", "id=early")
	if len(eventsLines(t, dir, late)) != 1 || len(eventsLines(t, dir, early)) != 1 {
		t.Fatalf("the two events did not land one a day file")
	}
	if got := eventsRun(t, dir, early, "day", yesterday); kindCount(t, got, "hot.ping") != 1 || got.data["events"] != 1.0 {
		t.Errorf("events day %s shows %s", yesterday, got.stdout)
	}
	if got := eventsRun(t, dir, early, "today"); kindCount(t, got, "ask.open") != 1 || got.data["events"] != 1.0 {
		t.Errorf("events today shows %s", got.stdout)
	}
}

func TestEventsDayOfTodayWritesNothing(t *testing.T) {
	t.Parallel()
	dir, at := filepath.Join(t.TempDir(), "events"), eventsAt(12, 0)
	eventsRun(t, dir, at, "log", "hot.ping", "sid=a", "id=1")
	planted := []byte(`{"v":1,"day":"planted"}`)
	if err := os.WriteFile(eventsSnapshotFile(dir), planted, 0o644); err != nil {
		t.Fatal(err)
	}
	if got := eventsRun(t, dir, at, "day", at.Format(eventsDay)); got.data["events"] != 1.0 {
		t.Fatalf("events day of today shows %s", got.stdout)
	}
	if now, _ := os.ReadFile(eventsSnapshotFile(dir)); !bytes.Equal(now, planted) {
		t.Errorf("events day rewrote the snapshot: %s", now)
	}
}

func TestEventsRebuildOfAnEarlierDayKeepsTodaysSnapshot(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	line := `{"v":1,"at":"2026-11-16T23:59:59.900+02:00","kind":"hot.ping","sid":"a","id":"1"}` + "\n"
	if err := os.WriteFile(eventsDayFile(dir, "2026-11-16"), []byte(line), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := eventsRebuild(dir, "2026-11-17"); err != nil {
		t.Fatal(err)
	}
	if _, err := eventsRebuild(dir, "2026-11-16"); err != nil {
		t.Fatal(err)
	}
	if got := eventsSnapshotOf(t, dir); got.Day != "2026-11-17" {
		t.Errorf("a writer that took its clock before midnight put %s back over the next day's snapshot", got.Day)
	}
	if info, err := os.Stat(eventsSnapshotFile(dir)); err != nil || info.Mode().Perm() != 0o644 {
		t.Errorf("the snapshot's mode is %v, want 0644 so every reader of the shelf reads it", info.Mode().Perm())
	}
}

func TestEventsDayTakesOnlyADay(t *testing.T) {
	t.Parallel()
	dir := filepath.Join(t.TempDir(), "events")
	if got := eventsRun(t, dir, eventsAt(12, 0), "day", "yesterday"); got.code != 2 {
		t.Errorf("a date that is no yyyy-mm-dd exits %d, want 2", got.code)
	}
	if got := eventsRun(t, dir, eventsAt(12, 0), "day", "2026-01-01"); got.code != 0 || got.data["events"] != 0.0 {
		t.Errorf("a day with no file exits %d with %v events, want 0 and 0", got.code, got.data["events"])
	}
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("a read made the events folder")
	}
}

func TestSchemaOfEventsLogListsTheKinds(t *testing.T) {
	t.Parallel()
	got := xIn(t, t.TempDir(), nil, "schema", "events", "log")
	var envelope struct {
		Data struct {
			Verbs []struct {
				Kinds []eventKind `json:"kinds"`
			} `json:"verbs"`
		} `json:"data"`
	}
	if err := json.NewDecoder(bytes.NewReader([]byte(got.stdout))).Decode(&envelope); err != nil {
		t.Fatal(err)
	}
	if len(envelope.Data.Verbs) != 1 || len(envelope.Data.Verbs[0].Kinds) != len(eventKinds) {
		t.Fatalf("the schema lists %+v, want the %d kinds", envelope.Data.Verbs, len(eventKinds))
	}
	for _, kind := range envelope.Data.Verbs[0].Kinds {
		if kind.Gist == "" || kind.ID == "" {
			t.Errorf("%s has no gist or no id origin", kind.Name)
		}
	}
}

func TestEventsTodayAndDayReadOnlyTheThreadsAsked(t *testing.T) {
	t.Parallel()
	dir, at := filepath.Join(t.TempDir(), "events"), eventsAt(12, 0)
	for n, sid := range []string{"main", "wing-1", "wing-2", "codie"} {
		eventsRun(t, dir, at, "log", "ping.sent", "sid="+sid, "id=msg-"+strconv.Itoa(n), "via=held")
	}
	cases := []struct {
		name string
		args []string
		want float64
	}{
		{"today, one thread", []string{"today", "--sid", "codie"}, 1},
		{"today, the wings", []string{"today", "--sid", "wing-1,wing-2"}, 2},
		{"today, a flag a wing", []string{"today", "--sid", "wing-1", "--sid", "wing-2"}, 2},
		{"a day, one thread", []string{"day", at.Format(eventsDay), "--sid", "main"}, 1},
		{"a thread with no event", []string{"today", "--sid", "nobody"}, 0},
		{"everyone", []string{"today"}, 4},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			got := eventsRun(t, dir, at, c.args...)
			threads, _ := got.data["threads"].(map[string]any)
			if n := kindCount(t, got, "ping.sent"); n != c.want || float64(len(threads)) != c.want {
				t.Errorf("ping.sent counts %v over %d threads, want %v: %s", n, len(threads), c.want, got.stdout)
			}
		})
	}
}

func TestEventsParkAcrossMidnightCountsOnBothDays(t *testing.T) {
	t.Parallel()
	late := eventsAt(23, 50)
	yesterday := late.Format(eventsDay)
	cases := []struct {
		name      string
		end       time.Duration
		read      time.Duration
		wantFirst float64
		wantToday float64
	}{
		{"ended ten minutes into the next day", 20 * time.Minute, 40 * time.Minute, 600, 600},
		{"still open an hour into the next day", 0, 70 * time.Minute, 600, 3600},
		{"still open two days on, a day with no file between", 0, 48*time.Hour + 40*time.Minute, 600, 1800},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir := filepath.Join(t.TempDir(), "events")
			eventsRun(t, dir, late, "log", "park.start", "sid=night", "id=turn-1")
			if c.end > 0 {
				eventsRun(t, dir, late.Add(c.end), "log", "park.end", "sid=night", "id=turn-2")
			}
			now := late.Add(c.read)
			if parked := parkedOf(t, eventsRun(t, dir, now, "day", yesterday), "night"); parked != c.wantFirst {
				t.Errorf("the day the park opened counts %v s, want %v: to its last second", parked, c.wantFirst)
			}
			if parked := parkedOf(t, eventsRun(t, dir, now, "today"), "night"); parked != c.wantToday {
				t.Errorf("today counts %v s, want %v: from midnight", parked, c.wantToday)
			}
			eventsRun(t, dir, now, "log", "hot.ping", "sid=other", "id=ping-1")
			if parked := parkedOf(t, eventsRun(t, dir, now, "today"), "night"); parked != c.wantToday {
				t.Errorf("after a later event grew the day file, today counts %v s, want %v", parked, c.wantToday)
			}
			if parked := parkedOf(t, eventsRun(t, dir, now, "day", now.Format(eventsDay)), "night"); parked != c.wantToday {
				t.Errorf("events day of today counts %v s, want %v", parked, c.wantToday)
			}
		})
	}
}

func TestEventsTodaySumsTheFailedLogsModsReport(t *testing.T) {
	t.Parallel()
	dir, at := filepath.Join(t.TempDir(), "events"), eventsAt(12, 0)
	eventsRun(t, dir, at, "log", "log.failed", "sid=a", "id=stash:1", "n=3")
	eventsRun(t, dir, at, "log", "log.failed", "sid=b", "id=guard:1", "n=2")
	if got := eventsRun(t, dir, at, "today"); got.data["failed"] != 5.0 {
		t.Errorf("two reports of 3 and 2 failed logs read %v, want 5", got.data["failed"])
	}
}

func TestEventsCarryTakesEachThreadsLastParkLine(t *testing.T) {
	t.Parallel()
	line := func(day int, kind, id string) string {
		return fmt.Sprintf(`{"v":1,"at":"2026-11-%02dT10:00:00.000+02:00","kind":%q,"sid":"a","id":%q}`, day, kind, id) + "\n"
	}
	cases := []struct {
		name string
		days map[int]string
		open bool
	}{
		{"a park closed on a later earlier day carries nothing", map[int]string{13: line(13, "park.start", "1"), 15: line(15, "park.end", "2")}, false},
		{"a day with no park line passes to the day before it", map[int]string{14: line(14, "park.start", "1"), 15: line(15, "hot.ping", "2")}, true},
		{"a park opened the day before carries", map[int]string{15: line(15, "park.start", "1")}, true},
		{"a park opened over a week back carries nothing", map[int]string{8: line(8, "park.start", "1")}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir := t.TempDir()
			for day, lines := range c.days {
				if err := os.WriteFile(eventsDayFile(dir, fmt.Sprintf("2026-11-%02d", day)), []byte(lines), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			if carry := eventsCarry(dir, "2026-11-16"); (carry["a"] != "") != c.open {
				t.Errorf("the 16th opens with the carry %v, want an open park: %v", carry, c.open)
			}
		})
	}
}
