package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type bashCall struct {
	id, command string
	ago         int
}

// transcript writes cc session lines holding one Bash tool_use each, plus a Read call that must not count
func transcript(t *testing.T, home, name string, calls ...bashCall) {
	t.Helper()
	var body strings.Builder
	for _, c := range calls {
		at := time.Now().AddDate(0, 0, -c.ago).UTC().Format(time.RFC3339Nano)
		fmt.Fprintf(&body, `{"type":"assistant","timestamp":%q,"message":{"content":[{"type":"tool_use","id":%q,"name":"Bash","input":{"command":%q}}]}}`+"\n", at, c.id, c.command)
	}
	fmt.Fprintf(&body, `{"type":"assistant","timestamp":%q,"message":{"content":[{"type":"tool_use","id":"read","name":"Read","input":{"file_path":"/a"}}]}}`+"\n", time.Now().UTC().Format(time.RFC3339Nano))
	write(t, filepath.Join(home, ".claude/projects", name), body.String())
}

func TestStatsOutsideRanksTheBashHeadsOfTheWindow(t *testing.T) {
	home := t.TempDir()
	transcript(t, home, "-Users-dima-frame/s1.jsonl",
		bashCall{"a", "ls -la", 0}, bashCall{"b", "ls", 1}, bashCall{"c", "git log --oneline", 0},
		bashCall{"d", "x lane push --apply", 0}, bashCall{"e", "rg foo", 9})
	transcript(t, home, "-Users-dima-frame/s1/subagents/agent-1.jsonl",
		bashCall{"f", "git status", 0}, bashCall{"a", "ls -la", 0})

	got := xIn(t, repo(t), []string{"HOME=" + home}, "stats", "--outside", "--days", "7")

	want := `[{"calls":2,"name":"ls"},{"calls":1,"name":"git log"},{"calls":1,"name":"git status"}]`
	if got.code != 0 || marshal(got.data["heads"]) != want {
		t.Errorf("exit %d, heads %s\nwant  %s", got.code, marshal(got.data["heads"]), want)
	}
}

func TestStatsOutsideKeepsTheTop25Heads(t *testing.T) {
	home := t.TempDir()
	var calls []bashCall
	for n := range 26 {
		for range 26 - n {
			calls = append(calls, bashCall{fmt.Sprintf("%d-%d", n, len(calls)), fmt.Sprintf("tool%02d", n), 0})
		}
	}
	transcript(t, home, "p/s.jsonl", calls...)

	got := xIn(t, repo(t), []string{"HOME=" + home}, "stats", "--outside")

	heads := marshal(got.data["heads"])
	if strings.Count(heads, `"name"`) != 25 || strings.Contains(heads, "tool25") {
		t.Errorf("heads %s, want tool00..tool24", heads)
	}
}

func TestStatsOutsideHeadsSkipTheSetup(t *testing.T) {
	cases := []struct{ command, head string }{
		{"cd /a && rg foo", "rg"},
		{"cd '/a b'; cd c && git -C /d log", "git log"},
		{"J=/tmp/j; cat $J/f", "cat"},
		{`S="/a b"; T=1 && pnpm --silent test`, "pnpm test"},
		{"FOO=1 /Users/a/bin/red-proof f a b", "red-proof"},
		{"export S=/a; gh pr view 1", "gh pr"},
		{"claude plugin list", "claude plugin"},
		{"/usr/local/bin/x stats", ""},
		{"cd /a && x lane push", ""},
		{"cd /a", "cd"},
		{"cd /a 2>/dev/null && rg y", "rg"},
		{"cd && ls", "ls"},
		{"(cd a && ls)", "ls"},
		{"claude -p --model haiku 'say hi'", "claude"},
		{"/Users/a/plugin-x/bin/lane push", ""},
	}
	for _, c := range cases {
		t.Run(c.command, func(t *testing.T) {
			home := t.TempDir()
			transcript(t, home, "p/s.jsonl", bashCall{"a", c.command, 0})

			got := xIn(t, repo(t), []string{"HOME=" + home}, "stats", "--outside")

			want := `[]`
			if c.head != "" {
				want = fmt.Sprintf(`[{"calls":1,"name":%q}]`, c.head)
			}
			if marshal(got.data["heads"]) != want {
				t.Errorf("heads %s, want %s", marshal(got.data["heads"]), want)
			}
		})
	}
}
