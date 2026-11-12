package main

import (
	"cmp"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
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
	Wing      int    `json:"wing,omitempty"`
	Area      string `json:"area,omitempty"`
	Title     string `json:"title,omitempty"`
	Fallback  bool   `json:"fallback,omitempty"`
	Display   string `json:"display"`
	RoleName  string `json:"roleName,omitempty"`
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
)

// the store x-mod-stash's hooks refresh and a live display reads with no spawn; X_THREADS points a test at a fixture,
// and under X_TEST without it there is no store
func threadStorePath() string { return storePath("X_THREADS", ".claude/shelf/threads.json") }

// a store a refresh rewrites, or the registry it reads: a fixture env only in a test build, so a line's
// `X_SESSIONS=<dir> x thread list` can never rewrite the real store from a forged registry; under X_TEST in a real build
// there is none at all, so a ts test meets no live session
func storePath(fixture, real string) string {
	return storePathOf(mergeTestEnvOn() || isInProcessTest, os.Getenv(fixture), os.Getenv("X_TEST") != "", real)
}

// go test's own process: its in-process tests write fixture stores; the x binary any session runs never sets it
var isInProcessTest = false

func storePathOf(isFixtureOn bool, fixture string, isXTest bool, real string) string {
	switch {
	case isFixtureOn:
		return fixture
	case isXTest:
		return ""
	}
	if home := systemHome(); home != "" {
		return filepath.Join(home, real)
	}
	return ""
}

// the display name is drawn from the record, never parsed back out of a name: <mode> <role> <area> | <ticket>, the area
// the ticket's linear project (dima, FRM-579's rider: never the lane name's first word); a standing role draws its whole
// display from roles.json; no record reads as unknown
func threadDisplay(t thread) string { return displayFrom(roles, t) }

// a renamed thread keeps its role's own display beside the title dima gave, so a reader that owns by name (a wing's
// lane) still finds it after the rename
func drawNames(t *thread) {
	t.Display, t.RoleName = threadDisplay(*t), ""
	if t.Title != "" {
		untitled := *t
		untitled.Title = ""
		t.RoleName = threadDisplay(untitled)
	}
}

// the display under a role table: a rename dima gave (x thread rename) wins, then the table's own
func displayFrom(table []role, t thread) string {
	r := roleIn(table, t.Role)
	switch {
	case t.Role == "":
		return "unknown"
	case t.Title != "":
		return t.Title
	case r.Display != "":
		return strings.ReplaceAll(r.Display, "{n}", strconv.Itoa(t.Wing))
	}
	words := []string{}
	for _, w := range []string{laneKindMark[t.LaneKind], r.Mark, t.Area} {
		if w != "" {
			words = append(words, w)
		}
	}
	if t.Ticket != "" {
		words = append(words, "|", t.Ticket)
	}
	return strings.Join(words, " ")
}

// a ticket's area word: its linear project's first word, lowercased; "" when linear does not answer, so a summon still
// runs, after linear's own timeout at worst
func ticketArea(actor, id string) string {
	if id == "" {
		return ""
	}
	data, _, err := gql(actor, `query($id: String!) { issue(id: $id) { project { name } } }`, map[string]any{"id": id})
	if err != nil {
		return ""
	}
	var found struct {
		Issue struct {
			Project *named `json:"project"`
		} `json:"issue"`
	}
	raw, _ := json.Marshal(data)
	_ = json.Unmarshal(raw, &found)
	if found.Issue.Project == nil {
		return ""
	}
	return projectArea(found.Issue.Project.Name)
}

// a project name is linear's data, typed into a printed argv and a display: only a plain word passes
var areaWord = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*$`)

func projectArea(project string) string {
	if words := strings.Fields(strings.ToLower(project)); len(words) > 0 && areaWord.MatchString(words[0]) {
		return words[0]
	}
	return ""
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
// a record not seen stays only through its launch wait, once seen live only while its registry file reads torn
func joinThreads(now time.Time, stored []thread) []thread {
	records, byProcess := map[string]thread{}, map[string]string{}
	for _, t := range stored {
		if t.Role != "" && !t.Fallback {
			records[t.SessionID] = t
			if t.Pid > 0 && t.ProcStart != "" {
				byProcess[strconv.Itoa(t.Pid)+" "+t.ProcStart] = t.SessionID
			}
		}
	}
	threads, starts, from := []thread{}, []string{}, []string{}
	// a registry file named by its pid that did not read whole: a torn write, never a gone session
	torn := map[int]bool{}
	if dir := sessionsDir(); dir != "" {
		files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
		for _, file := range files {
			raw, err := os.ReadFile(file)
			if err != nil || !json.Valid(raw) {
				if pid, err := strconv.Atoi(strings.TrimSuffix(filepath.Base(file), ".json")); err == nil {
					torn[pid] = true
				}
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
	// a record never seen live waits out its launch; one seen live (its start known) stays only through a torn read
	for sid, t := range records {
		isWaiting := now.Sub(time.UnixMilli(t.At)) < threadLaunchWait
		if !seen[sid] && isWaiting && (t.ProcStart == "" || torn[t.Pid]) {
			threads = append(threads, t)
		}
	}
	nameFallback(threads)
	for i := range threads {
		drawNames(&threads[i])
	}
	slices.SortFunc(threads, func(a, b thread) int { return strings.Compare(a.SessionID, b.SessionID) })
	return threads
}

var wingName = regexp.MustCompile(`^🦉🪽c?clio:wing(\d+)$`)

// dima, 15:47 («stop locking yourself out»): while no live thread holds a coordinator record — a missed backfill, a
// restart — today's name check still seats clio and her wings, the row marked fallback so every reader can say so, and
// a refresh never keeps it as a record
func nameFallback(threads []thread) {
	if slices.ContainsFunc(threads, func(t thread) bool { return roleOf(t.Role).IsCoordinator }) {
		return
	}
	for i, t := range threads {
		if t.Role != "" {
			continue
		}
		bare := strings.NewReplacer(" ", "", "\u200d", "").Replace(t.Name)
		if bare == "🦉clio" || bare == "🦉cclio" {
			threads[i].Role, threads[i].Fallback = "coordinator", true
		} else if m := wingName.FindStringSubmatch(bare); m != nil {
			n, _ := strconv.Atoi(m[1])
			threads[i].Role, threads[i].Wing, threads[i].Fallback = "wing", n, true
		}
		if threads[i].Fallback {
			fmt.Fprintf(os.Stderr, "x: %s holds no coordinator record, so its name %q seats it (the name fallback); run the backfill\n", t.SessionID, t.Name)
		}
	}
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

// who may give a role: dima at his own terminal, or a coordinator by its record's role, the session found by the
// registry file of the nearest claude x runs under (an ancestor pid), never by a name or an id the line could pass
func callerIsCoordinator() bool {
	table, err := readProcessTable()
	if err != nil {
		return false
	}
	chain := callerChain(table, powerSessionsDir())
	if len(chain) == 0 {
		return isOwnTerminal(chain)
	}
	return callerRole(chain[0], false).IsCoordinator
}

var roleRefusalNext = "ask the coordinator: x lane dispatch --apply gives a role, x brief summon starts a thread with one"

func coordinatorOnly(verb string) error {
	if callerIsCoordinator() {
		return nil
	}
	return &Fail{Refused: true, Msg: verb + " gives a thread its role, so only the coordinator or dima runs it", Next: roleRefusalNext}
}

// the thread a dispatch names: one whose record holds that role, or a live session with no role yet (a reused thread,
// one started before x wrote records); never another role, and never an id no thread holds, so a dispatch cannot mint one
func threadRoleRefusal(stored []thread, sid, role string) error {
	for _, t := range stored {
		if t.SessionID == sid && t.Role != "" && !t.Fallback {
			if t.Role == role {
				return nil
			}
			return &Fail{Refused: true, Msg: sid + " is already a " + t.Role + ": x keeps a thread's role once it is given", Next: "x thread show " + sid}
		}
	}
	if !sessionLive(sid) {
		return &Fail{Refused: true, Msg: sid + " names no thread: a role goes to a thread x brief summon started or one already running", Next: "x thread list"}
	}
	return nil
}

func sessionLive(sid string) bool {
	dir := sessionsDir()
	if dir == "" {
		return false
	}
	files, _ := filepath.Glob(filepath.Join(dir, "*.json"))
	for _, file := range files {
		var entry struct {
			SessionID string `json:"sessionId"`
			Pid       int    `json:"pid"`
		}
		if raw, err := os.ReadFile(file); err == nil && json.Unmarshal(raw, &entry) == nil && entry.SessionID == sid && pidAlive(entry.Pid) {
			return true
		}
	}
	return false
}

// brief summon and lane dispatch write a thread's role, lane and ticket under its session id, before it runs; a summon's id
// is minted fresh, a dispatch's names a thread and meets threadRoleRefusal under the lock
func writeThreadRecord(record thread, now time.Time, isMinted bool) error {
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
	if !isMinted {
		if err := threadRoleRefusal(store.Threads, record.SessionID, record.Role); err != nil {
			return err
		}
	}
	// a record for a live thread keeps what the registry gave it, and a dispatch naming no lane keeps the summon's
	if i := slices.IndexFunc(store.Threads, func(t thread) bool { return t.SessionID == record.SessionID }); i >= 0 {
		live := store.Threads[i]
		record.Pid, record.ProcStart, record.Name, record.Cwd = live.Pid, live.ProcStart, live.Name, live.Cwd
		if record.Lane == "" {
			record.Lane, record.LaneKind = live.Lane, live.LaneKind
		}
		record.Area, record.Title = cmp.Or(record.Area, live.Area), cmp.Or(record.Title, live.Title)
		store.Threads = slices.Delete(store.Threads, i, i+1)
	}
	record.At = now.UnixMilli()
	drawNames(&record)
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
