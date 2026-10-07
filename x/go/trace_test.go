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
