package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// the closed kinds list: a kind names its fields, a field its type, so no free string reaches a line
//
//go:embed events_kinds.json
var eventsKindsJSON []byte

const (
	eventsVersion  = 1
	eventsLineCap  = 4096
	eventsSlugCap  = 48
	eventsAtLayout = "2006-01-02T15:04:05.000Z07:00"
	eventsDay      = "2006-01-02"
)

var (
	eventSid  = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)
	eventID   = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,96}$`)
	eventSlug = regexp.MustCompile(`^[a-z0-9._-]+$`)
	eventInt  = regexp.MustCompile(`^[0-9]{1,7}$`)
	// a key that is no field name is never echoed: a refusal names only what passed this
	eventKey = regexp.MustCompile(`^[a-z_]{1,16}$`)
	// the keys every line carries; a fold never splits a count by them
	eventCoreKeys = []string{"at", "kind", "sid", "id"}
)

type eventField struct {
	Enum []string `json:"enum,omitempty"`
	Min  *int     `json:"min,omitempty"`
	Max  *int     `json:"max,omitempty"`
	Slug bool     `json:"slug,omitempty"`
}

type eventKind struct {
	Name   string                `json:"name"`
	Gist   string                `json:"gist"`
	ID     string                `json:"id"`
	Fields map[string]eventField `json:"fields"`
}

var eventKinds = loadEventKinds(eventsKindsJSON)

func loadEventKinds(raw []byte) []eventKind {
	var source struct {
		Kinds []eventKind `json:"kinds"`
	}
	if err := json.Unmarshal(raw, &source); err != nil {
		panic(fmt.Sprintf("events_kinds.json: %v", err))
	}
	return source.Kinds
}

func eventsDir() string { return storePath("X_EVENTS", ".claude/shelf/events") }

func eventsDayFile(dir, day string) string { return filepath.Join(dir, day+".jsonl") }

func eventsSnapshotFile(dir string) string { return filepath.Join(dir, "today.json") }

/* log */

func eventsLog(r *Run, args []string, _ Flags) (any, error) {
	now := clock().Local()
	line, err := eventLine(args, now)
	if err != nil {
		return nil, usageFail(err.Error(), "x schema events log")
	}
	dir := eventsDir()
	if dir == "" {
		return nil, &Fail{Msg: "no events folder to write to", Next: "set X_EVENTS under X_TEST"}
	}
	day := now.Format(eventsDay)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, &Fail{Msg: "the events folder was not made: " + err.Error(), Next: "ls -la " + quote(filepath.Dir(dir))}
	}
	file, err := os.OpenFile(eventsDayFile(dir, day), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, &Fail{Msg: "the day file was not opened: " + err.Error(), Next: "ls -la " + quote(dir)}
	}
	// one write of the whole line, under the append flag: parallel writers never interleave inside it
	_, err = file.Write(line)
	if err = errors.Join(err, file.Close()); err != nil {
		return nil, &Fail{Msg: "the event was not written: " + err.Error(), Next: "ls -la " + quote(dir)}
	}
	snapshot, err := eventsRebuild(dir, day)
	if err != nil {
		return nil, &Fail{Msg: "the event is logged, the snapshot was not rebuilt: " + err.Error(), Next: "x events today"}
	}
	r.Done("logged, "+plural(snapshot.Events, "event")+" today", "")
	return map[string]any{"day": day, "events": snapshot.Events, "file": eventsDayFile(dir, day), "line": json.RawMessage(bytes.TrimSpace(line))}, nil
}

// one line, its keys in a fixed order: v, at, kind, sid, id, then the kind's fields by name
func eventLine(args []string, now time.Time) ([]byte, error) {
	if len(args) == 0 {
		return nil, fmt.Errorf("no kind given")
	}
	at := slices.IndexFunc(eventKinds, func(k eventKind) bool { return k.Name == args[0] })
	if at < 0 {
		return nil, fmt.Errorf("the first word is no event kind")
	}
	kind := eventKinds[at]
	given := map[string]string{}
	for n, pair := range args[1:] {
		key, value, found := strings.Cut(pair, "=")
		if !found || !eventKey.MatchString(key) {
			return nil, fmt.Errorf("word %d is no key=value", n+2)
		}
		if _, twice := given[key]; twice {
			return nil, fmt.Errorf("%s is given twice", key)
		}
		given[key] = value
	}
	if !eventSid.MatchString(given["sid"]) {
		return nil, fmt.Errorf("sid is a session id of letters, digits and dashes, up to 64")
	}
	if !eventID.MatchString(given["id"]) {
		return nil, fmt.Errorf("id is up to 96 of letters, digits and . _ : -")
	}
	var line bytes.Buffer
	fmt.Fprintf(&line, `{"v":%d,"at":%q,"kind":%q,"sid":%q,"id":%q`, eventsVersion, now.Format(eventsAtLayout), kind.Name, given["sid"], given["id"])
	for _, key := range slices.Sorted(maps.Keys(given)) {
		if key == "sid" || key == "id" {
			continue
		}
		field, known := kind.Fields[key]
		if !known {
			return nil, fmt.Errorf("%s takes no field %s", kind.Name, key)
		}
		value, err := field.encode(key, given[key])
		if err != nil {
			return nil, err
		}
		fmt.Fprintf(&line, `,%q:%s`, key, value)
	}
	line.WriteString("}\n")
	if line.Len() >= eventsLineCap {
		return nil, fmt.Errorf("the line is %d bytes, over the 4 KB cap", line.Len())
	}
	return line.Bytes(), nil
}

func (f eventField) encode(key, value string) (string, error) {
	switch {
	case f.Enum != nil:
		if !slices.Contains(f.Enum, value) {
			return "", fmt.Errorf("%s is one of %s", key, strings.Join(f.Enum, ", "))
		}
	case f.Slug:
		if len(value) > eventsSlugCap || !eventSlug.MatchString(value) {
			return "", fmt.Errorf("%s is a slug of a-z, 0-9 and . _ -, up to %d chars", key, eventsSlugCap)
		}
	default:
		n, err := strconv.Atoi(value)
		if !eventInt.MatchString(value) || err != nil || n < *f.Min || n > *f.Max {
			return "", fmt.Errorf("%s is a whole number from %d to %d", key, *f.Min, *f.Max)
		}
		return strconv.Itoa(n), nil
	}
	return strconv.Quote(value), nil
}

/* the snapshot */

type eventsKindCount struct {
	N  int                       `json:"n"`
	By map[string]map[string]int `json:"by,omitempty"`
}

type eventsThread struct {
	N          int            `json:"n"`
	Kinds      map[string]int `json:"kinds"`
	ParkedS    int64          `json:"parked_s"`
	ParkOpenAt string         `json:"park_open_at,omitempty"`
}

type eventsSnapshot struct {
	V       int                         `json:"v"`
	Day     string                      `json:"day"`
	Bytes   int64                       `json:"bytes"`
	Lines   int                         `json:"lines"`
	Events  int                         `json:"events"`
	Skipped int                         `json:"skipped"`
	Failed  int                         `json:"failed"`
	Kinds   map[string]*eventsKindCount `json:"kinds"`
	Threads map[string]*eventsThread    `json:"threads"`
}

// a pure fold of a day's lines: the first line of an id counts, a line that does not parse alone is skipped and counted;
// `only` keeps the events of those threads
func eventsFold(raw []byte, day string, only []string) *eventsSnapshot {
	snapshot := &eventsSnapshot{V: eventsVersion, Day: day, Bytes: int64(len(raw)), Kinds: map[string]*eventsKindCount{}, Threads: map[string]*eventsThread{}}
	seen, parks := map[string]bool{}, map[string][]parkLine{}
	for text := range bytes.SplitSeq(raw, []byte("\n")) {
		if len(bytes.TrimSpace(text)) == 0 {
			continue
		}
		snapshot.Lines++
		var line map[string]any
		if err := json.Unmarshal(text, &line); err != nil {
			snapshot.Skipped++
			continue
		}
		kind, _ := line["kind"].(string)
		sid, _ := line["sid"].(string)
		id, _ := line["id"].(string)
		stamp, _ := line["at"].(string)
		at, err := time.Parse(eventsAtLayout, stamp)
		if _, hasVersion := line["v"].(float64); !hasVersion || kind == "" || sid == "" || id == "" || err != nil {
			snapshot.Skipped++
			continue
		}
		// kinds share an origin (a turn id ends one park and starts the next), so an id is unique inside its kind
		if seen[kind+"\x00"+id] || len(only) > 0 && !slices.Contains(only, sid) {
			continue
		}
		seen[kind+"\x00"+id] = true
		snapshot.Events++
		count := snapshot.Kinds[kind]
		if count == nil {
			count = &eventsKindCount{}
			snapshot.Kinds[kind] = count
		}
		count.N++
		for key, value := range line {
			word, isWord := value.(string)
			if !isWord || slices.Contains(eventCoreKeys, key) {
				continue
			}
			if count.By == nil {
				count.By = map[string]map[string]int{}
			}
			if count.By[key] == nil {
				count.By[key] = map[string]int{}
			}
			count.By[key][word]++
		}
		thread := snapshot.Threads[sid]
		if thread == nil {
			thread = &eventsThread{Kinds: map[string]int{}}
			snapshot.Threads[sid] = thread
		}
		thread.N++
		thread.Kinds[kind]++
		switch kind {
		case "park.start", "park.end":
			parks[sid] = append(parks[sid], parkLine{at, stamp, kind == "park.start"})
		case "log.failed":
			if n, isNumber := line["n"].(float64); isNumber {
				snapshot.Failed += int(n)
			}
		}
	}
	// two writers can append against their stamps' order, so a thread's parks pair by stamp, never by line
	for sid, lines := range parks {
		slices.SortStableFunc(lines, func(a, b parkLine) int { return a.at.Compare(b.at) })
		thread := snapshot.Threads[sid]
		var open *parkLine
		for _, line := range lines {
			switch {
			case line.isStart && open == nil:
				open = &line
			case !line.isStart && open != nil:
				thread.ParkedS += int64(line.at.Sub(open.at).Seconds())
				open = nil
			}
		}
		if open != nil {
			thread.ParkOpenAt = open.stamp
		}
	}
	return snapshot
}

type parkLine struct {
	at      time.Time
	stamp   string
	isStart bool
}

func eventsRead(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil, nil
	}
	return raw, err
}

// today.json is rebuilt whole, never bumped: under one lock, temp then rename, and a rebuild from fewer bytes of the
// same day never replaces the snapshot a later writer built
func eventsRebuild(dir, day string) (*eventsSnapshot, error) {
	lock, err := os.OpenFile(filepath.Join(dir, ".lock"), os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return nil, err
	}
	raw, err := eventsRead(eventsDayFile(dir, day))
	if err != nil {
		return nil, err
	}
	var kept eventsSnapshot
	if old, err := os.ReadFile(eventsSnapshotFile(dir)); err == nil && json.Unmarshal(old, &kept) == nil {
		// a writer that took its clock before midnight never puts yesterday back over today's snapshot
		if kept.V == eventsVersion && (kept.Day > day || kept.Day == day && kept.Bytes >= int64(len(raw))) {
			return &kept, nil
		}
	}
	snapshot := eventsFold(raw, day, nil)
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	temp, err := os.CreateTemp(dir, "today-*.tmp")
	if err != nil {
		return nil, err
	}
	_, err = temp.Write(append(encoded, '\n'))
	// a temp file is born private; every reader of the shelf reads the snapshot
	if err = errors.Join(err, temp.Chmod(0o644), temp.Close()); err == nil {
		err = os.Rename(temp.Name(), eventsSnapshotFile(dir))
	}
	if err != nil {
		return nil, errors.Join(err, os.Remove(temp.Name()))
	}
	return snapshot, nil
}

/* the readers */

func eventsToday(r *Run, _ []string, flags Flags) (any, error) {
	now := clock().Local()
	return eventsShow(r, now.Format(eventsDay), now, flags, true)
}

func eventsDayRun(r *Run, args []string, flags Flags) (any, error) {
	if _, err := time.Parse(eventsDay, args[0]); err != nil {
		return nil, usageFail("the date is no day, a day reads yyyy-mm-dd", "x events today")
	}
	return eventsShow(r, args[0], clock().Local(), flags, false)
}

// `today` reads through the snapshot, so the file the band reads is fresh after it; `day` folds its day's lines and
// writes nothing, and so does a read of some threads (--sid). an open park counts up to now, or to the end of a day that is over
func eventsShow(r *Run, day string, now time.Time, flags Flags, isToday bool) (any, error) {
	dir := eventsDir()
	if dir == "" {
		return nil, &Fail{Msg: "no events folder to read", Next: "set X_EVENTS under X_TEST"}
	}
	var only []string
	if sids, _ := flags["sid"].(string); sids != "" {
		only = strings.Split(sids, ",")
	}
	var snapshot *eventsSnapshot
	if _, err := os.Stat(dir); err == nil && isToday && only == nil {
		if snapshot, err = eventsRebuild(dir, day); err != nil {
			return nil, &Fail{Msg: "the snapshot was not rebuilt: " + err.Error(), Next: "ls -la " + quote(dir)}
		}
	} else {
		raw, err := eventsRead(eventsDayFile(dir, day))
		if err != nil {
			return nil, &Fail{Msg: "the day file was not read: " + err.Error(), Next: "ls -la " + quote(dir)}
		}
		snapshot = eventsFold(raw, day, only)
	}
	until := now
	if start, err := time.ParseInLocation(eventsDay, day, time.Local); err == nil && start.AddDate(0, 0, 1).Before(now) {
		until = start.AddDate(0, 0, 1)
	}
	threads := map[string]any{}
	for sid, thread := range snapshot.Threads {
		parked := thread.ParkedS
		open, err := time.Parse(eventsAtLayout, thread.ParkOpenAt)
		if err == nil && until.After(open) {
			parked += int64(until.Sub(open).Seconds())
		}
		threads[sid] = map[string]any{"kinds": thread.Kinds, "n": thread.N, "park_open": err == nil, "parked_s": parked}
	}
	if r.human {
		r.Open(day)
		r.Show(eventsRows(snapshot), 0)
	}
	r.Done(plural(snapshot.Events, "event")+", "+strconv.Itoa(snapshot.Failed)+" failed", "")
	return map[string]any{
		"day": day, "events": snapshot.Events, "failed": snapshot.Failed, "file": eventsDayFile(dir, day), "kinds": snapshot.Kinds,
		"lines": snapshot.Lines, "skipped": snapshot.Skipped, "snapshot": eventsSnapshotFile(dir), "threads": threads,
	}, nil
}

func eventsRows(snapshot *eventsSnapshot) []string {
	var rows []string
	for _, kind := range slices.Sorted(maps.Keys(snapshot.Kinds)) {
		count := snapshot.Kinds[kind]
		cells := []string{fmt.Sprintf("%-18s %4d", kind, count.N)}
		for _, field := range slices.Sorted(maps.Keys(count.By)) {
			var parts []string
			for _, word := range slices.Sorted(maps.Keys(count.By[field])) {
				parts = append(parts, word+" "+strconv.Itoa(count.By[field][word]))
			}
			cells = append(cells, field+": "+strings.Join(parts, ", "))
		}
		rows = append(rows, strings.Join(cells, "  "))
	}
	return rows
}
