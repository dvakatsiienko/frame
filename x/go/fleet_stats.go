package main

import (
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// x fleet stats folds the turn log x-mod-stash writes (FRM-639): one row a main-loop turn, under
// ~/.claude/shelf/events/<UTC day>/<sid>.<start>.json, an open stamp a thread under events/open/. no transcript is read

const (
	statsHours     = 24
	statsMaxHours  = 30 * 24
	statsCacheFor  = 30 * time.Second
	statsParkCap   = 30 * time.Minute
	statsEmptyLen  = 200
	statsCacheName = "fleet-stats.json"
	statsVersion   = 1
)

// the turn log's row, as turn-log.ts writes it
type turnRow struct {
	Sid         string         `json:"sid"`
	Pid         int            `json:"pid"`
	TurnID      string         `json:"turnId"`
	Start       int64          `json:"start"`
	End         int64          `json:"end"`
	PrevEnd     *int64         `json:"prevEnd"`
	Starter     string         `json:"starter"`
	Reason      *string        `json:"reason"`
	IsQueued    bool           `json:"isQueued"`
	TypedJoined int            `json:"typedJoined"`
	PingsJoined int            `json:"pingsJoined"`
	HerdrJoins  int            `json:"herdrJoins"`
	Ticks       []turnTick     `json:"ticks"`
	Tools       int            `json:"tools"`
	Cards       map[string]int `json:"cards"`
	AnswerLen   int            `json:"answerLen"`
	Ended       string         `json:"ended"`
	AsksOpened  int            `json:"asksOpened"`
	Wind        *struct {
		By  string `json:"by"`
		Ctx *int   `json:"ctx"`
	} `json:"wind"`
	WindAsked int `json:"windAsked"`
}

type turnTick struct {
	Pick  string `json:"pick"`
	WaitS *int   `json:"waitS"`
}

type openStamp struct {
	Pid    int    `json:"pid"`
	Start  int64  `json:"start"`
	TurnID string `json:"turnId"`
}

// one fold, the fleet's or one thread's; json field names are the contract herdr's stats block reads (FRM-705)
type statsFold struct {
	Turns       int            `json:"turns"`
	Starters    map[string]int `json:"starters"`
	Winds       statsWinds     `json:"winds"`
	KeepHot     int            `json:"keepHot"`
	Pushed      int            `json:"pushed"`
	Slipstreams int            `json:"slipstreams"`
	Ticks       int            `json:"ticks"`
	Replays     int            `json:"replays"`
	AskWaitS    []int          `json:"askWaitS"`
	AsksOpened  int            `json:"asksOpened"`
	Cards       map[string]int `json:"cards"`
	EmptyWakes  int            `json:"emptyWakes"`
	WakesNotHis int            `json:"wakesNotHis"`
	ParkedS     int64          `json:"parkedS"`
	ParkedNowS  int64          `json:"parkedNowS"`
	Clamped     int            `json:"clamped"`
}

type statsWinds struct {
	ByDima  []*int `json:"byDima"`
	ByMod   []*int `json:"byMod"`
	BySelf  []*int `json:"bySelf"`
	AskedAt int    `json:"askedAt65"`
}

type statsAnswer struct {
	V        int                   `json:"v"`
	BuiltAt  string                `json:"builtAt"`
	From     string                `json:"from"`
	To       string                `json:"to"`
	Hours    int                   `json:"hours"`
	Fleet    statsFold             `json:"fleet"`
	Threads  map[string]*statsFold `json:"threads"`
	Lost     int                   `json:"lost"`
	Torn     int                   `json:"torn"`
	Unknown  int                   `json:"unknown"`
	Skipped  []string              `json:"skipped"`
	IsCached bool                  `json:"isCached"`
}

func statsDir() string { return storePath("X_EVENTS", ".claude/shelf/events") }

func statsCacheFile() string {
	return storePath("X_FLEET_STATS", filepath.Join(".claude/shelf", statsCacheName))
}

func fleetStats(r *Run, _ []string, flags Flags) (any, error) {
	dir := statsDir()
	if dir == "" {
		return nil, &Fail{Msg: "no turn log folder to read", Next: "set X_EVENTS under X_TEST"}
	}
	hours := statsHours
	if raw, _ := flags["hours"].(string); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > statsMaxHours {
			return nil, usageFail(fmt.Sprintf("--hours reads a whole number from 1 to %d (30 days, what the log keeps)", statsMaxHours), "x fleet stats --hours 168")
		}
		hours = n
	}
	var only []string
	if raw, _ := flags["thread"].(string); raw != "" {
		only = strings.Split(raw, ",")
	}
	now := clock()
	if hours != statsHours || only != nil {
		return statsFoldAt(dir, sessionsDir(), now, hours, only), nil
	}
	return statsCached(dir, now)
}

// a default run serves the file a run of the last 30 s wrote; past that, one rebuild at a time, under the lock
func statsCached(dir string, now time.Time) (any, error) {
	file := statsCacheFile()
	if file == "" {
		return statsFoldAt(dir, sessionsDir(), now, statsHours, nil), nil
	}
	if a, ok := statsFresh(file, now); ok {
		return a, nil
	}
	lock, err := os.OpenFile(file+".lock", os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return nil, err
	}
	// a waiter behind the lock reads the rebuild the holder just wrote
	if a, ok := statsFresh(file, clock()); ok {
		return a, nil
	}
	a := statsFoldAt(dir, sessionsDir(), now, statsHours, nil)
	raw, err := json.Marshal(a)
	if err != nil {
		return nil, err
	}
	tmp := file + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o644); err != nil {
		return nil, err
	}
	return a, os.Rename(tmp, file)
}

func statsFresh(file string, now time.Time) (*statsAnswer, bool) {
	raw, err := os.ReadFile(file)
	if err != nil {
		return nil, false
	}
	var a statsAnswer
	if json.Unmarshal(raw, &a) != nil || a.V != statsVersion {
		return nil, false
	}
	built, err := time.Parse(time.RFC3339Nano, a.BuiltAt)
	if err != nil || now.Sub(built) >= statsCacheFor || now.Before(built) {
		return nil, false
	}
	a.IsCached = true
	return &a, true
}

func statsFoldAt(dir, sessions string, now time.Time, hours int, only []string) *statsAnswer {
	from := now.Add(-time.Duration(hours) * time.Hour)
	rows, torn, skipped := statsRows(dir, from, now)
	a := &statsAnswer{
		BuiltAt: now.UTC().Format(time.RFC3339Nano),
		From:    from.UTC().Format(time.RFC3339),
		Hours:   hours,
		Skipped: skipped,
		Threads: map[string]*statsFold{},
		To:      now.UTC().Format(time.RFC3339),
		Torn:    torn,
		V:       statsVersion,
	}
	idle := statsIdleStretches(rows, from, now)
	a.Lost = statsLost(dir, sessions, rows, from)
	bySid := map[string][]turnRow{}
	for _, row := range rows {
		bySid[row.Sid] = append(bySid[row.Sid], row)
	}
	fleet := newStatsFold()
	for _, sid := range slices.Sorted(maps.Keys(bySid)) {
		if only != nil && !slices.Contains(only, sid) {
			continue
		}
		f := newStatsFold()
		for _, row := range bySid[sid] {
			f.add(row)
			fleet.add(row)
			if row.Starter == "unknown" {
				a.Unknown++
			}
		}
		f.park(bySid[sid], idle, from, now, statsLiveGap(dir, sessions, bySid[sid], now))
		fleet.ParkedS += f.ParkedS
		fleet.ParkedNowS += f.ParkedNowS
		fleet.Clamped += f.Clamped
		a.Threads[sid] = f
	}
	slices.Sort(fleet.AskWaitS)
	a.Fleet = *fleet
	return a
}

func newStatsFold() *statsFold {
	return &statsFold{AskWaitS: []int{}, Cards: map[string]int{}, Starters: map[string]int{}, Winds: statsWinds{ByDima: []*int{}, ByMod: []*int{}, BySelf: []*int{}}}
}

func (f *statsFold) add(row turnRow) {
	f.Turns++
	f.Starters[row.Starter]++
	reason := ""
	if row.Reason != nil {
		reason = *row.Reason
	}
	if row.Starter == "mod" && reason == "keep-hot" {
		f.KeepHot++
	}
	if w := row.Wind; w != nil {
		switch w.By {
		case "mod":
			f.Winds.ByMod = append(f.Winds.ByMod, w.Ctx)
		case "self":
			f.Winds.BySelf = append(f.Winds.BySelf, w.Ctx)
		default:
			f.Winds.ByDima = append(f.Winds.ByDima, w.Ctx)
		}
	}
	f.Winds.AskedAt += row.WindAsked
	// one act, one bucket: his prompt into an idle thread is a push, one typed into a running turn a slipstream,
	// counted on the turn that took it, even when it started the next one
	if row.Starter == "typed" {
		if row.IsQueued {
			f.Slipstreams++
		} else {
			f.Pushed++
		}
	}
	f.Slipstreams += row.TypedJoined + row.HerdrJoins
	for _, t := range row.Ticks {
		if t.Pick == "replay" {
			f.Replays++
		} else {
			f.Ticks++
		}
		if t.WaitS != nil {
			f.AskWaitS = append(f.AskWaitS, *t.WaitS)
		}
	}
	f.AsksOpened += row.AsksOpened
	for card, n := range row.Cards {
		f.Cards[card] += n
	}
	if isWakeNotHis(row.Starter, reason) {
		f.WakesNotHis++
		if row.Ended == "answer" && row.Tools == 0 && row.AnswerLen < statsEmptyLen && row.TypedJoined == 0 && row.PingsJoined == 0 && row.HerdrJoins == 0 && len(row.Ticks) == 0 {
			f.EmptyWakes++
		}
	}
}

// a wake not his: a member, a task or the mod, keep-hot and a second wind's ingest counted on their own
func isWakeNotHis(starter, reason string) bool {
	switch starter {
	case "member", "task":
		return true
	case "mod":
		return reason != "keep-hot" && reason != "wind"
	}
	return false
}

// a fleet-wide idle stretch: no thread ran a turn other than a keep-hot ping; its first 30 minutes count as parked
type statsSpan struct{ from, to int64 }

func statsIdleStretches(rows []turnRow, from, now time.Time) []statsSpan {
	busy := []statsSpan{}
	for _, row := range rows {
		if row.Starter == "mod" && row.Reason != nil && *row.Reason == "keep-hot" {
			continue
		}
		busy = append(busy, statsSpan{row.Start, row.End})
	}
	slices.SortFunc(busy, func(a, b statsSpan) int { return int(a.from - b.from) })
	idle := []statsSpan{}
	at := from.UnixMilli()
	for _, b := range busy {
		if b.from > at {
			idle = append(idle, statsSpan{at, b.from})
		}
		at = max(at, b.to)
	}
	if end := now.UnixMilli(); end > at {
		idle = append(idle, statsSpan{at, end})
	}
	return idle
}

// a thread's parked time: the gaps between its rows of one pid, and a live idle thread's open gap, each inside the
// window, less what falls past the first 30 minutes of a fleet-wide idle stretch
func (f *statsFold) park(rows []turnRow, idle []statsSpan, from, now time.Time, liveFrom int64) {
	slices.SortFunc(rows, func(a, b turnRow) int { return int(a.Start - b.Start) })
	gaps := []statsSpan{}
	// the thread's last row before the window ends where its first gap in it starts
	if first := rows[0]; first.PrevEnd != nil && *first.PrevEnd < first.Start {
		gaps = append(gaps, statsSpan{*first.PrevEnd, first.Start})
	}
	for i := 1; i < len(rows); i++ {
		prev, next := rows[i-1], rows[i]
		if prev.Pid != next.Pid {
			continue
		}
		if next.Start < prev.End {
			f.Clamped++
			continue
		}
		gaps = append(gaps, statsSpan{prev.End, next.Start})
	}
	if liveFrom > 0 {
		gaps = append(gaps, statsSpan{liveFrom, now.UnixMilli()})
	}
	lo := from.UnixMilli()
	for i, g := range gaps {
		g.from = max(g.from, lo)
		if g.to <= g.from {
			continue
		}
		ms := g.to - g.from
		for _, s := range idle {
			ms -= overlap(g, statsSpan{s.from + statsParkCap.Milliseconds(), s.to})
		}
		f.ParkedS += ms / 1000
		if liveFrom > 0 && i == len(gaps)-1 {
			f.ParkedNowS = ms / 1000
		}
	}
}

func overlap(a, b statsSpan) int64 { return max(0, min(a.to, b.to)-max(a.from, b.from)) }

// a live thread with no turn running parks from its last row's end
func statsLiveGap(dir, sessions string, rows []turnRow, now time.Time) int64 {
	last := slices.MaxFunc(rows, func(a, b turnRow) int { return int(a.End - b.End) })
	if !threadAlive(sessions, last.Pid, last.Sid) {
		return 0
	}
	if stamp, ok := readOpenStamp(dir, last.Sid); ok && stamp.Start > last.Start && stamp.Pid == last.Pid {
		return 0
	}
	if last.End > now.UnixMilli() {
		return 0
	}
	return last.End
}

// a thread lives while its pid does and the session registry still names it under that pid: this mac reuses a pid within
// minutes, so a live pid alone would park a dead thread's every hour since its last row
func threadAlive(sessions string, pid int, sid string) bool {
	if sessions == "" || !pidAlive(pid) {
		return false
	}
	var entry struct {
		SessionID string `json:"sessionId"`
	}
	raw, err := os.ReadFile(filepath.Join(sessions, strconv.Itoa(pid)+".json"))
	return err == nil && json.Unmarshal(raw, &entry) == nil && entry.SessionID == sid
}

func readOpenStamp(dir, sid string) (openStamp, bool) {
	var s openStamp
	raw, err := os.ReadFile(filepath.Join(dir, "open", sid+".json"))
	return s, err == nil && json.Unmarshal(raw, &s) == nil
}

// a lost turn: an open stamp whose pid is dead and that no row of its start explains
func statsLost(dir, sessions string, rows []turnRow, from time.Time) int {
	entries, _ := os.ReadDir(filepath.Join(dir, "open"))
	lost := 0
	for _, e := range entries {
		sid, ok := strings.CutSuffix(e.Name(), ".json")
		if !ok {
			continue
		}
		s, ok := readOpenStamp(dir, sid)
		if !ok || s.Start < from.UnixMilli() || threadAlive(sessions, s.Pid, sid) {
			continue
		}
		if !slices.ContainsFunc(rows, func(r turnRow) bool { return r.Sid == sid && r.Start == s.Start }) {
			lost++
		}
	}
	return lost
}

// every row the window touches, read from each UTC day dir it spans; a row read twice counts once, an empty or broken
// file is torn, and what the old event log left at the top (`<day>.jsonl`, today.json, .lock) is named, never read
func statsRows(dir string, from, now time.Time) ([]turnRow, int, []string) {
	skipped := []string{}
	top, _ := os.ReadDir(dir)
	for _, e := range top {
		if !e.IsDir() {
			skipped = append(skipped, e.Name())
		}
	}
	seen := map[string]bool{}
	rows := []turnRow{}
	torn := 0
	for day := from.UTC().Truncate(24 * time.Hour); !day.After(now.UTC()); day = day.Add(24 * time.Hour) {
		files, _ := os.ReadDir(filepath.Join(dir, day.Format("2006-01-02")))
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".json") {
				continue
			}
			raw, err := os.ReadFile(filepath.Join(dir, day.Format("2006-01-02"), f.Name()))
			var row turnRow
			if err != nil || json.Unmarshal(raw, &row) != nil || row.Sid == "" {
				torn++
				continue
			}
			key := row.Sid + "." + strconv.FormatInt(row.Start, 10)
			if seen[key] || row.End < from.UnixMilli() || row.Start > now.UnixMilli() {
				continue
			}
			seen[key] = true
			rows = append(rows, row)
		}
	}
	return rows, torn, skipped
}
