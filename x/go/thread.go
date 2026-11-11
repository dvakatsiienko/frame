package main

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
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
	ProcStart string `json:"procStart,omitempty"`
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

// each pid's start time as one ps reads it, in the registry's own form (utc, the c locale, spaces folded); nil when
// ps does not answer, so a row stands on its live pid alone
func procStarts(threads []thread, starts []string) map[int]string {
	pids := []string{}
	for i, t := range threads {
		if starts[i] != "" {
			pids = append(pids, strconv.Itoa(t.Pid))
		}
	}
	if len(pids) == 0 {
		return map[int]string{}
	}
	c := exec.Command("ps", "-o", "pid=,lstart=", "-p", strings.Join(pids, ","))
	c.Env = append(os.Environ(), "LC_ALL=C", "TZ=UTC")
	out, err := c.Output()
	if err != nil && len(out) == 0 {
		return nil
	}
	running := map[int]string{}
	for line := range strings.Lines(string(out)) {
		if fields := strings.Fields(line); len(fields) > 1 {
			if pid, err := strconv.Atoi(fields[0]); err == nil {
				running[pid] = strings.Join(fields[1:], " ")
			}
		}
	}
	return running
}

// a store that is there and does not parse refuses: a rewrite from it would drop every role
func readThreadStore(path string) (threadStore, error) {
	var store threadStore
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return store, err
	}
	if err := json.Unmarshal(raw, &store); err != nil {
		return store, fmt.Errorf("%s does not parse (%w), so x leaves it as it is", path, err)
	}
	return store, nil
}

// a summon's record and a refresh each read, change and rewrite the whole store, so one runs at a time
func lockThreadStore(path string) (unlock func(), err error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	lock, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		lock.Close()
		return nil, err
	}
	return func() { lock.Close() }, nil
}

func refreshThreads(now time.Time) ([]thread, error) {
	path := threadStorePath()
	if path == "" {
		return joinThreads(now, nil), nil
	}
	unlock, err := lockThreadStore(path)
	if err != nil {
		return nil, err
	}
	defer unlock()
	store, err := readThreadStore(path)
	if err != nil {
		return nil, err
	}
	threads := joinThreads(now, store.Threads)
	return threads, writeThreadStore(path, now, threads)
}

// the live registry, each entry joined to its record by session id, or by its pid and start when /clear or /resume
// minted a new id for the same process; a joined record's time moves to now, a dead pid or a gone file drops out, and
// a record not seen stays only through its launch wait
func joinThreads(now time.Time, stored []thread) []thread {
	records, byProcess := map[string]thread{}, map[string]string{}
	for _, t := range stored {
		if t.Role != "" {
			records[t.SessionID] = t
			if t.Pid > 0 && t.ProcStart != "" {
				byProcess[strconv.Itoa(t.Pid)+" "+t.ProcStart] = t.SessionID
			}
		}
	}
	threads, starts, from := []thread{}, []string{}, []string{}
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
				ProcStart string `json:"procStart"`
			}
			if json.Unmarshal(raw, &entry) != nil || entry.SessionID == "" || !pidAlive(entry.Pid) {
				continue
			}
			start := strings.Join(strings.Fields(entry.ProcStart), " ")
			key := entry.SessionID
			if _, ok := records[key]; !ok && start != "" {
				if old, ok := byProcess[strconv.Itoa(entry.Pid)+" "+start]; ok {
					key = old
				}
			}
			t := records[key]
			t.SessionID, t.Pid, t.Name, t.Cwd, t.ProcStart = entry.SessionID, entry.Pid, entry.Name, entry.Cwd, start
			if t.Role != "" {
				t.At = now.UnixMilli()
			}
			threads, starts, from = append(threads, t), append(starts, start), append(from, key)
		}
	}
	// a row outlives a crash and its pid comes back as another process, so a row's start time must be its pid's
	running := procStarts(threads, starts)
	kept, seen := threads[:0], map[string]bool{}
	for i, t := range threads {
		if starts[i] == "" || running == nil || running[t.Pid] == starts[i] {
			kept = append(kept, t)
			seen[t.SessionID], seen[from[i]] = true, true
		}
	}
	threads = kept
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
	return threads
}

func writeThreadStore(path string, now time.Time, threads []thread) error {
	body, err := json.Marshal(threadStore{V: 1, At: now.UnixMilli(), Threads: threads})
	if err != nil {
		return err
	}
	return atomicWrite(path, append(body, '\n'))
}

// a v4 uuid, the shape claude's --session-id takes
func newSessionID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// brief summon and lane dispatch write a thread's role, lane and ticket under its session id, before it runs
func writeThreadRecord(record thread, now time.Time) error {
	path := threadStorePath()
	if path == "" {
		return nil
	}
	unlock, err := lockThreadStore(path)
	if err != nil {
		return err
	}
	defer unlock()
	store, err := readThreadStore(path)
	if err != nil {
		return err
	}
	// a record for a live thread keeps what the registry gave it, and a dispatch naming no lane keeps the summon's
	if i := slices.IndexFunc(store.Threads, func(t thread) bool { return t.SessionID == record.SessionID }); i >= 0 {
		live := store.Threads[i]
		record.Pid, record.ProcStart, record.Name, record.Cwd = live.Pid, live.ProcStart, live.Name, live.Cwd
		if record.Lane == "" {
			record.Lane, record.LaneKind = live.Lane, live.LaneKind
		}
		store.Threads = slices.Delete(store.Threads, i, i+1)
	}
	record.At = now.UnixMilli()
	record.Display = threadDisplay(record)
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
