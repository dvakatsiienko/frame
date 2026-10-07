package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// traces reads every line x left under a state dir's traces/
func traces(t *testing.T, state string) []map[string]any {
	t.Helper()
	files, _ := filepath.Glob(filepath.Join(state, "traces", "*.jsonl"))
	var lines []map[string]any
	for _, file := range files {
		for line := range strings.Lines(read(t, file)) {
			var trace map[string]any
			if err := json.Unmarshal([]byte(line), &trace); err != nil {
				t.Fatalf("%s: not a json line: %q", file, line)
			}
			lines = append(lines, trace)
		}
	}
	return lines
}

func tracing(state string, env ...string) []string {
	return append([]string{"X_TRACE=1", "X_STATE=" + state}, env...)
}

func TestACallLeavesOneTraceLine(t *testing.T) {
	failingHook := func(t *testing.T, dir string) {
		write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n")
		write(t, filepath.Join(dir, "readme.txt"), "changed\n")
	}
	commit := func(t *testing.T) []string { return []string{"lane", "commit", message(t), "--", "readme.txt"} }
	cases := []struct {
		name, verb, kind string
		exit             int
		flags            []string
		prep             func(t *testing.T, dir string)
		argv             func(t *testing.T) []string
	}{
		{"ok", "schema", "", 0, []string{"level"}, nil,
			func(*testing.T) []string { return []string{"schema", "lane", "--level", "short"} }},
		{"usage", "schema", "usage", 2, []string{"level"}, nil,
			func(*testing.T) []string { return []string{"schema", "lane", "--level", "huge"} }},
		{"external", "lane commit", "external", 1, []string{}, failingHook, commit},
		{"refused", "lane commit", "refused", 1, []string{}, nil, commit},
		{"bug", "knowledge list", "bug", 1, []string{}, nil,
			func(t *testing.T) []string { t.Setenv("X_PANIC", "1"); return []string{"knowledge", "list"} }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			state, dir := t.TempDir(), repo(t)
			if c.prep != nil {
				c.prep(t, dir)
			}
			got := xIn(t, dir, tracing(state), c.argv(t)...)
			if got.code != c.exit {
				t.Fatalf("exit %d, want %d: %s", got.code, c.exit, got.stdout)
			}
			lines := traces(t, state)
			if len(lines) != 1 {
				t.Fatalf("%d trace lines, want 1", len(lines))
			}
			trace := lines[0]
			if trace["name"] != c.verb || trace["process.exit.code"] != float64(c.exit) || trace["error.type"] != c.kind {
				t.Errorf("trace %v", trace)
			}
			if got, want := marshal(trace["x.flags"]), marshal(c.flags); got != want {
				t.Errorf("flags %s, want %s — names, never values", got, want)
			}
		})
	}
}

func TestTheTraceNamesItsCaller(t *testing.T) {
	cowork := "CLAUDE_PLUGIN_ROOT=/Users/dima/Library/Application Support/Claude/local-agent-mode-sessions/9db8/479a/rpm/plugin_01"
	cases := []struct {
		caller string
		env    []string
	}{
		{"cc", []string{"CLAUDECODE=1"}},
		{"ssh", []string{"SSH_CONNECTION=10.0.0.2 52000 10.0.0.1 22"}},
		{"hook", []string{"GIT_EXEC_PATH=/opt/homebrew/opt/git/libexec/git-core"}},
		{"hook", []string{"CLAUDECODE=1", "CLAUDE_PROJECT_DIR=/Users/dima/frame"}},
		{"cw", []string{cowork}},
		{"other", nil},
	}
	for _, c := range cases {
		t.Run(c.caller+" "+strings.Join(c.env, " "), func(t *testing.T) {
			state := t.TempDir()
			xIn(t, repo(t), tracing(state, c.env...), "schema", "lane")
			if lines := traces(t, state); len(lines) != 1 || lines[0]["x.caller"] != c.caller {
				t.Errorf("traces %v, want caller %s", lines, c.caller)
			}
		})
	}
	t.Run("dima on a terminal", func(t *testing.T) {
		state, dir := t.TempDir(), t.TempDir()
		write(t, filepath.Join(dir, "repo", ".keep"), "")
		runTTY(t, xbin, dir, call{ID: "dima", Argv: []string{}, Env: map[string]string{"X_TRACE": "1", "X_STATE": state}})
		if lines := traces(t, state); len(lines) != 1 || lines[0]["x.caller"] != "dima" {
			t.Errorf("traces %v, want caller dima", lines)
		}
	})
}

func TestTheTraceKeepsIdsAndDropsText(t *testing.T) {
	cases := []struct {
		name string
		argv []string
		ids  []string
	}{
		{"an id-shaped arg", []string{"knowledge", "read", "spawn-mechanics"}, []string{"spawn-mechanics"}},
		{"a ticket inside free text", []string{"probe", "bare", "why does FRM-12 hang on BYT-3?"}, []string{"FRM-12", "BYT-3"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			state := t.TempDir()
			xIn(t, repo(t), tracing(state, "PATH=/nonexistent"), c.argv...)
			lines := traces(t, state)
			if len(lines) != 1 {
				t.Fatalf("%d trace lines", len(lines))
			}
			if got, want := marshal(lines[0]["x.ids"]), marshal(c.ids); got != want {
				t.Errorf("ids %s, want %s", got, want)
			}
			if line := marshal(lines[0]); strings.Contains(line, "hang") {
				t.Errorf("free text reached the trace: %s", line)
			}
		})
	}
}

func TestAVerbWithStepsTracesEachStepTime(t *testing.T) {
	state, dir := t.TempDir(), repo(t)
	write(t, filepath.Join(dir, "readme.txt"), "changed\n")
	xIn(t, dir, tracing(state), "lane", "commit", message(t), "--", "readme.txt")
	lines := traces(t, state)
	if len(lines) != 1 {
		t.Fatalf("%d trace lines", len(lines))
	}
	steps, _ := lines[0]["x.steps"].([]any)
	var names []string
	for _, step := range steps {
		step, _ := step.(map[string]any)
		if _, timed := step["duration_ms"].(float64); !timed {
			t.Errorf("step %v has no duration_ms", step)
		}
		names = append(names, step["name"].(string))
	}
	if strings.Join(names, ",") != "tree,format,mods,stage,commit" {
		t.Errorf("steps %v", names)
	}
}

func TestTheTraceCarriesTheAgentSession(t *testing.T) {
	state := t.TempDir()
	xIn(t, repo(t), tracing(state, "CLAUDECODE=1", "CLAUDE_CODE_SESSION_ID=5f1c-test"), "schema", "lane")
	if lines := traces(t, state); len(lines) != 1 || lines[0]["session.id"] != "5f1c-test" {
		t.Errorf("traces %v", lines)
	}
}

func TestTheTraceNamesTheRepoOfAWorktreeByItsMainCheckout(t *testing.T) {
	state, dir := t.TempDir(), repo(t)
	tree := filepath.Join(dir, ".claude/worktrees/FRM-1-x")
	gitT(t, dir, "worktree", "add", "-q", "-b", "coder/x", tree)
	xIn(t, tree, tracing(state), "schema", "lane")
	if lines := traces(t, state); len(lines) != 1 || lines[0]["vcs.repository.name"] != filepath.Base(dir) {
		t.Errorf("traces %v, want repo %s", lines, filepath.Base(dir))
	}
}

func TestTraceOffWritesNothing(t *testing.T) {
	state := t.TempDir()
	xIn(t, repo(t), tracing(state, "X_TRACE=0"), "schema", "lane")
	if entries, _ := filepath.Glob(filepath.Join(state, "*")); len(entries) != 0 {
		t.Errorf("X_TRACE=0 left %v", entries)
	}
}

func TestAnUnwritableTraceDirLeavesTheCallAlone(t *testing.T) {
	state := t.TempDir()
	write(t, filepath.Join(state, "traces"), "a file where the dir should be\n")
	if got := xIn(t, repo(t), tracing(state), "schema", "lane"); got.code != 0 || !strings.Contains(got.stdout, `"ok":true`) {
		t.Errorf("exit %d: %s", got.code, got.stdout)
	}
}
