package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// a thread: claude code's registry entry, plus the role, lane and ticket x wrote when it summoned or dispatched it
type thread struct {
	SessionID string `json:"sessionId"`
	Pid       int    `json:"pid,omitempty"`
	Name      string `json:"name,omitempty"`
	Cwd       string `json:"cwd,omitempty"`
	Role      string `json:"role,omitempty"`
	Lane      string `json:"lane,omitempty"`
	LaneKind  string `json:"laneKind,omitempty"`
	Ticket    string `json:"ticket,omitempty"`
	Display   string `json:"display"`
	At        int64  `json:"at,omitempty"`
}

type threadStore struct {
	V       int      `json:"v"`
	At      int64    `json:"at"`
	Threads []thread `json:"threads"`
}

// a record written for a summon waits this long for its session to start before a refresh drops it
const threadLaunchWait = 10 * time.Minute

var (
	laneKindMark = map[string]string{"side": "🌗", "quick": "⚡", "shift": "🌘"}
	roleMark     = map[string]string{"codie": "🔧", "sixth-sense": "🔎", "designer": "🎨"}
)

// the store x-mod-stash's hooks refresh and a live display reads with no spawn; X_THREADS points a test at a fixture,
// and under X_TEST without it there is no store
func threadStorePath() string {
	if path := os.Getenv("X_THREADS"); path != "" {
		return path
	}
	if os.Getenv("X_TEST") != "" {
		return ""
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude/shelf/threads.json")
}

// the display name is drawn from the record, never parsed back out of a name; no record reads as unknown
func threadDisplay(t thread) string {
	if t.Role == "" {
		return "unknown"
	}
	words := []string{}
	for _, w := range []string{laneKindMark[t.LaneKind], roleMark[t.Role], t.Lane} {
		if w != "" {
			words = append(words, w)
		}
	}
	if t.Ticket != "" {
		words = append(words, "|", t.Ticket)
	}
	return strings.Join(words, " ")
}

func pidAlive(pid int) bool {
	if pid <= 0 {
		return false
	}
	err := syscall.Kill(pid, 0)
	return err == nil || errors.Is(err, syscall.EPERM)
}

func readThreadStore(path string) threadStore {
	var store threadStore
	if raw, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(raw, &store)
	}
	return store
}

// the live registry, each entry joined to its record by session id; a dead pid or a gone file drops out, and a record
// with no session yet stays only through its launch wait
func refreshThreads(now time.Time) ([]thread, error) {
	path := threadStorePath()
	records := map[string]thread{}
	if path != "" {
		for _, t := range readThreadStore(path).Threads {
			if t.Role != "" {
				records[t.SessionID] = t
			}
		}
	}
	threads := []thread{}
	seen := map[string]bool{}
	if dir := sessionsDir(); dir != "" {
		files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil {
				continue
			}
			var entry struct {
				SessionID string `json:"sessionId"`
				Pid       int    `json:"pid"`
				Name      string `json:"name"`
				Cwd       string `json:"cwd"`
			}
			if json.Unmarshal(raw, &entry) != nil || entry.SessionID == "" || !pidAlive(entry.Pid) {
				continue
			}
			t := records[entry.SessionID]
			t.SessionID, t.Pid, t.Name, t.Cwd = entry.SessionID, entry.Pid, entry.Name, entry.Cwd
			threads = append(threads, t)
			seen[entry.SessionID] = true
		}
	}
	for sid, t := range records {
		if !seen[sid] && now.Sub(time.UnixMilli(t.At)) < threadLaunchWait {
			t.Pid = 0
			threads = append(threads, t)
		}
	}
	for i := range threads {
		threads[i].Display = threadDisplay(threads[i])
	}
	slices.SortFunc(threads, func(a, b thread) int { return strings.Compare(a.SessionID, b.SessionID) })
	if path == "" {
		return threads, nil
	}
	return threads, writeThreadStore(path, now, threads)
}

func writeThreadStore(path string, now time.Time, threads []thread) error {
	body, err := json.Marshal(threadStore{V: 1, At: now.UnixMilli(), Threads: threads})
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return atomicWrite(path, append(body, '\n'))
}

// brief summon and lane dispatch write a thread's role, lane and ticket under its session id, before it runs
func writeThreadRecord(record thread, now time.Time) error {
	path := threadStorePath()
	if path == "" {
		return nil
	}
	store := readThreadStore(path)
	record.At = now.UnixMilli()
	record.Display = threadDisplay(record)
	store.Threads = slices.DeleteFunc(store.Threads, func(t thread) bool { return t.SessionID == record.SessionID })
	store.Threads = append(store.Threads, record)
	return writeThreadStore(path, now, store.Threads)
}

// the stash hooks run this at session start, turn end and exit: it rewrites the store, so a display reads it with no spawn
func threadList(r *Run, _ []string, _ Flags) (any, error) {
	r.Open("the session registry")
	threads, err := refreshThreads(time.Now())
	if err != nil {
		return nil, &Fail{Msg: "the thread store was not written: " + err.Error(), Next: "ls -la " + quote(filepath.Dir(threadStorePath()))}
	}
	r.Done(plural(len(threads), "thread"), "")
	return map[string]any{"store": threadStorePath(), "threads": threads}, nil
}

// one thread by session id or pid: what a reader asks instead of parsing a name
func threadShow(r *Run, args []string, _ Flags) (any, error) {
	key := args[0]
	threads, err := refreshThreads(time.Now())
	if err != nil {
		return nil, &Fail{Msg: "the thread store was not written: " + err.Error(), Next: "x thread list"}
	}
	for _, t := range threads {
		if t.SessionID == key || (t.Pid != 0 && strconv.Itoa(t.Pid) == key) {
			r.Done(t.Display, "")
			return t, nil
		}
	}
	return nil, &Fail{Msg: "no live thread " + key, Next: "x thread list"}
}
