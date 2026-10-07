package main

import (
	"os"
	"path/filepath"
	"regexp"
	"runtime/debug"
	"slices"
	"strings"
	"time"

	"github.com/charmbracelet/x/term"
)

// span is the one trace line a call leaves; the keys follow OpenTelemetry's span and attribute names
type span struct {
	Start    time.Time `json:"start_time"`
	Name     string    `json:"name"`
	Duration int64     `json:"duration_ms"`
	Flags    []string  `json:"x.flags"`
	Caller   string    `json:"x.caller"`
	Ids      []string  `json:"x.ids,omitempty"`
	Steps    []step    `json:"x.steps,omitempty"`
	Session  string    `json:"session.id,omitempty"`
	Repo     string    `json:"vcs.repository.name,omitempty"`
	Version  string    `json:"service.version"`
	Exit     int       `json:"process.exit.code"`
	Kind     string    `json:"error.type"`
}

type step struct {
	Name     string `json:"name"`
	Duration int64  `json:"duration_ms"`
}

// the call's span; the endings fill its error kind, the steps their times
var traced = &span{}

// the verb, or its family, or bare x — an unknown word is free text and stays out
func traceName(words []string) string {
	if verb, _, ok := findVerb(words); ok {
		return verb.Name
	}
	if len(words) > 0 && slices.Contains(families(), words[0]) {
		return words[0]
	}
	return "x"
}

// who ran x, from the env each door leaves. a hook first: git exports GIT_EXEC_PATH to every hook, cc
// exports CLAUDE_PROJECT_DIR to its hooks and never to its Bash tool. cw is Cowork's Desktop Commander,
// which passes its own env on, a plugin root under local-agent-mode-sessions (probed 2026-10-07)
func callerOf(tty bool) string {
	switch {
	case os.Getenv("GIT_EXEC_PATH") != "" || os.Getenv("CLAUDE_PROJECT_DIR") != "":
		return "hook"
	case os.Getenv("CLAUDECODE") != "":
		return "cc"
	case strings.Contains(os.Getenv("CLAUDE_PLUGIN_ROOT"), "/local-agent-mode-sessions/"):
		return "cw"
	case os.Getenv("SSH_CONNECTION") != "":
		return "ssh"
	case tty:
		return "dima"
	}
	return "other"
}

var (
	idArgs  = []string{"slug", "name", "verb", "shell"}
	idShape = regexp.MustCompile(`^[\w.:-]+$`)
)

// an arg the registry names as an id is kept whole; any other arg gives up only the ticket ids inside it
func idsOf(verb Verb, args []string) []string {
	var ids []string
	for i, arg := range args {
		// past the last arg spec the last one repeats, as a variadic does; a verb with none has no id args
		named := len(verb.Args) > 0 && slices.Contains(idArgs, verb.Args[min(i, len(verb.Args)-1)].Name)
		if named && idShape.MatchString(arg) {
			ids = append(ids, arg)
			continue
		}
		ids = append(ids, ticketID.FindAllString(arg, -1)...)
	}
	return ids
}

func newSpan(argv []string) *span {
	return &span{Start: time.Now(), Name: traceName(wordsOf(argv)), Flags: flagNames(argv),
		Caller: callerOf(term.IsTerminal(os.Stdin.Fd())), Session: os.Getenv("CLAUDE_CODE_SESSION_ID"),
		Repo: repoName(), Version: version()}
}

// the repo's name, never its path; a worktree under .claude/worktrees/ is named by its main checkout
func repoName() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	dir, _, _ = strings.Cut(dir, "/.claude/worktrees/")
	for ; dir != filepath.Dir(dir); dir = filepath.Dir(dir) {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return filepath.Base(dir)
		}
	}
	return ""
}

// the commit the binary was built from, so a trace line says which x ran
func version() string {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "v1-go"
	}
	settings := map[string]string{}
	for _, s := range info.Settings {
		settings[s.Key] = s.Value
	}
	revision := settings["vcs.revision"]
	if revision == "" {
		return "v1-go"
	}
	if settings["vcs.modified"] == "true" {
		return "v1-go+" + revision[:7] + "-dirty"
	}
	return "v1-go+" + revision[:7]
}

func traceOff() bool { return os.Getenv("X_TRACE") == "0" }

// a flag's name only, and only a name the registry knows: a value, or a mistyped dash word, can be free text
func flagNames(argv []string) []string {
	known := globalFlags
	if verb, _, ok := findVerb(wordsOf(argv)); ok {
		known = verb.Flags
	}
	names := []string{}
	for _, arg := range optionsOf(argv) {
		name, _, _ := strings.Cut(strings.TrimLeft(arg, "-"), "=")
		if name == "h" {
			name = "help"
		}
		if _, ok := known[name]; ok && strings.HasPrefix(arg, "-") {
			names = append(names, name)
		}
	}
	return names
}

// write appends the line to the local day's file; a trace that cannot be written never fails the call
func (s *span) write() {
	if traceOff() {
		return
	}
	s.Duration = time.Since(s.Start).Milliseconds()
	dir := filepath.Join(stateDir(), "traces")
	if os.MkdirAll(dir, 0o755) != nil {
		return
	}
	file, err := os.OpenFile(filepath.Join(dir, s.Start.Format(time.DateOnly)+".jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer file.Close()
	_, _ = file.WriteString(marshal(s) + "\n")
}
