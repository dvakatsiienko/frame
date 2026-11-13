package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/charmbracelet/x/term"
)

// every role a record holds, by id: a standing role's whole display ({n}, a wing's number), a lane role's mark, and
// whether it coordinates; a rename of clio is one line here, and no reader's power moves with it
//
//go:embed roles.json
var rolesJSON []byte

type role struct {
	ID            string `json:"id"`
	Display       string `json:"display,omitempty"`
	Mark          string `json:"mark,omitempty"`
	IsCoordinator bool   `json:"isCoordinator,omitempty"`
}

var roles = func() []role {
	var rows []role
	if err := json.Unmarshal(rolesJSON, &rows); err != nil {
		panic("roles.json does not parse: " + err.Error())
	}
	return rows
}()

// every scope a lane member's thread names, by its word: an emoji that replaces its role's mark, and a unit that replaces
// its ticket; a new scope is one line here. strays draws «⚡ 🐕 strays | chores»
//
//go:embed scopes.json
var scopesJSON []byte

type scope struct {
	Word  string `json:"word"`
	Emoji string `json:"emoji,omitempty"`
	Unit  string `json:"unit,omitempty"`
}

var scopes = func() []scope {
	var rows []scope
	if err := json.Unmarshal(scopesJSON, &rows); err != nil {
		panic("scopes.json does not parse: " + err.Error())
	}
	return rows
}()

func scopeOf(word string) scope {
	for _, s := range scopes {
		if s.Word == word {
			return s
		}
	}
	return scope{}
}

func scopeWords() string {
	words := []string{}
	for _, s := range scopes {
		words = append(words, s.Word)
	}
	return strings.Join(words, ", ")
}

func roleOf(id string) role { return roleIn(roles, id) }

func roleIn(table []role, id string) role {
	for _, r := range table {
		if r.ID == id {
			return r
		}
	}
	return role{}
}

// a session's Bash can set any X_ variable, so a power read takes a fixture only in a test build under X_TEST, and the
// real files from the system's user record otherwise
func powerPath(fixture, real string) string {
	if mergeTestEnvOn() {
		return os.Getenv(fixture)
	}
	if home := systemHome(); home != "" {
		return filepath.Join(home, real)
	}
	return ""
}

func powerSessionsDir() string { return powerPath("X_SESSIONS", ".claude/sessions") }

// a test plants its caller's record apart from the store it inspects, in X_CALLER_THREADS
func powerThreadStorePath() string {
	if path := os.Getenv("X_CALLER_THREADS"); path != "" && mergeTestEnvOn() {
		return path
	}
	return powerPath("X_THREADS", ".claude/shelf/threads.json")
}

// every process with its parent and start, from one ps; the start in the registry's own form (utc, the c locale)
type processTable struct {
	parent map[int]int
	start  map[int]string
}

func readProcessTable() (processTable, error) {
	c := exec.Command("ps", "-A", "-o", "pid=,ppid=,lstart=")
	c.Env = append(os.Environ(), "LC_ALL=C", "TZ=UTC")
	out, err := c.Output()
	if err != nil {
		return processTable{}, fmt.Errorf("ps did not list the processes: %w", err)
	}
	table := processTable{parent: map[int]int{}, start: map[int]string{}}
	for line := range strings.Lines(string(out)) {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		pid, err1 := strconv.Atoi(fields[0])
		ppid, err2 := strconv.Atoi(fields[1])
		if err1 == nil && err2 == nil {
			table.parent[pid], table.start[pid] = ppid, strings.Join(fields[2:], " ")
		}
	}
	return table, nil
}

// a registered claude session x runs under
type callerSession struct {
	SessionID string
	Pid       int
	ProcStart string
}

// the registered sessions among x's ancestors, nearest first: each ancestor pid the registry holds a file for, never a
// name or an id the line could pass; a file that exists but does not read whole stands as a session with no id, so a
// torn file never lets the walk reach a coordinator farther up
func callerChain(table processTable, dir string) []callerSession {
	chain := []callerSession{}
	if dir == "" {
		return chain
	}
	for pid, hops := os.Getppid(), 0; pid > 1 && hops < 64; pid, hops = table.parent[pid], hops+1 {
		raw, err := os.ReadFile(filepath.Join(dir, strconv.Itoa(pid)+".json"))
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		var entry struct {
			SessionID string `json:"sessionId"`
		}
		if err != nil || json.Unmarshal(raw, &entry) != nil {
			entry.SessionID = ""
		}
		chain = append(chain, callerSession{SessionID: entry.SessionID, Pid: pid, ProcStart: table.start[pid]})
	}
	return chain
}

// dima at his own terminal: no agent env, a tty, and no registered claude among x's ancestors, so a member's
// `env -u CLAUDECODE script -q /dev/null x …` still reads as that member
func isOwnTerminal(chain []callerSession) bool {
	return len(chain) == 0 && os.Getenv("CLAUDECODE") == "" && os.Getenv("AI_AGENT") == "" && term.IsTerminal(os.Stdin.Fd())
}

// the role the store's record gives the caller's session: by its session id, or by its pid and start once /clear
// minted a new id for the same process; a session with no record holds none, whatever its name. a name-fallback owner
// counts only for a reader (withFallback): a name alone never writes a record
func callerRole(s callerSession, withFallback bool) role {
	return roleOf(callerThread(s, withFallback).Role)
}

func callerThread(s callerSession, withFallback bool) thread {
	store, err := readThreadStore(powerThreadStorePath())
	if err != nil {
		return thread{}
	}
	for _, t := range store.Threads {
		isSame := (s.SessionID != "" && t.SessionID == s.SessionID) || (t.Pid == s.Pid && t.ProcStart != "" && t.ProcStart == s.ProcStart)
		if isSame && t.Role != "" && (withFallback || !t.Fallback) {
			return t
		}
	}
	return thread{}
}

// the clio owner label the caller's record names, "" for a session that is no clio thread; a label is a write, so a seat the
// name fallback found sets none
func callerOwnerLabel() string {
	table, err := readProcessTable()
	if err != nil {
		return ""
	}
	chain := callerChain(table, powerSessionsDir())
	if len(chain) == 0 {
		return ""
	}
	return ownerLabel(callerThread(chain[0], false))
}
