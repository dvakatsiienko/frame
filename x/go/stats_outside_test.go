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
		bashCall{"d", "x lane push --apply", 0}, bashCall{"e", "rg foo", 9}, bashCall{"g", "S=1", 0})
	transcript(t, home, "-Users-dima-frame/s1/subagents/agent-1.jsonl",
		bashCall{"f", "git status", 0}, bashCall{"a", "ls -la", 0})

	got := xIn(t, repo(t), []string{"HOME=" + home}, "stats", "--outside", "--days", "7")

	want := `[{"calls":2,"name":"ls"},{"calls":1,"name":"git log"},{"calls":1,"name":"git status"}]`
	if got.code != 0 || marshal(got.data["heads"]) != want {
		t.Errorf("exit %d, heads %s\nwant  %s", got.code, marshal(got.data["heads"]), want)
	}
	if marshal(got.data["x_calls"]) != `1` {
		t.Errorf("x_calls %s, want 1", marshal(got.data["x_calls"]))
	}
}

func TestStatsOutsideKeepsTheTopHeads(t *testing.T) {
	home := t.TempDir()
	var calls []bashCall
	for n := range 27 {
		for range 27 - n {
			calls = append(calls, bashCall{fmt.Sprintf("%d-%d", n, len(calls)), fmt.Sprintf("tool%02d", n), 0})
		}
	}
	transcript(t, home, "p/s.jsonl", calls...)
	cases := []struct {
		args []string
		want int
	}{{nil, 25}, {[]string{"--top", "26"}, 26}, {[]string{"--top", "99"}, 27}}
	for _, c := range cases {
		t.Run(fmt.Sprint(c.args), func(t *testing.T) {
			got := xIn(t, repo(t), []string{"HOME=" + home}, append([]string{"stats", "--outside"}, c.args...)...)

			heads := marshal(got.data["heads"])
			if strings.Count(heads, `"name"`) != c.want || strings.Contains(heads, fmt.Sprintf("tool%02d", c.want)) {
				t.Errorf("heads %s, want tool00..tool%02d", heads, c.want-1)
			}
		})
	}
}

func TestStatsOutsideTopIsAWholeNumber(t *testing.T) {
	for _, value := range []string{"0", "-3", "ten"} {
		t.Run(value, func(t *testing.T) {
			got := xIn(t, repo(t), []string{"HOME=" + t.TempDir()}, "stats", "--outside", "--top", value)

			if got.code != 2 {
				t.Errorf("exit %d, want 2", got.code)
			}
		})
	}
}

// a head an x verb covers names that verb, so a census can tell a missing verb from an unused one
func TestStatsOutsideNamesTheVerbThatCoversAHead(t *testing.T) {
	// the dead doors come from the registry: a literal here would be a caller the dead-door test finds
	read, _, _ := findVerb([]string{"linear", "read"})
	script, name := read.Replaces[0], read.Replaces[len(read.Replaces)-1]
	cases := []struct{ command, head, cover string }{
		{"linear api '{ viewer { id } }'", "linear api", "x linear api"},
		{"pnpm --silent " + name + " FRM-1", "pnpm " + name, "x linear read"},
		{"node ~/frame/" + script + " FRM-1", "node " + filepath.Base(script), "x linear read"},
		{"gh pr view 12", "gh pr", ""},
	}
	for _, c := range cases {
		t.Run(c.command, func(t *testing.T) {
			home := t.TempDir()
			transcript(t, home, "p/s.jsonl", bashCall{"a", c.command, 0})

			got := xIn(t, repo(t), []string{"HOME=" + home}, "stats", "--outside")

			want := fmt.Sprintf(`[{"calls":1,"name":%q}]`, c.head)
			if c.cover != "" {
				want = fmt.Sprintf(`[{"calls":1,"cover":%q,"name":%q}]`, c.cover, c.head)
			}
			if marshal(got.data["heads"]) != want {
				t.Errorf("heads %s, want %s", marshal(got.data["heads"]), want)
			}
		})
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
		{"S=$(cat f); git push", "git push"},
		{"J=$(jq -r '.a' \"$(dirname f)\") && gh pr view $J", "gh pr"},
		{"T=`date`; ls", "ls"},
		{`S=$(echo ")"); git push`, "git push"},
		{`S=$(printf '%s' "(") && gh pr view 1`, "gh pr"},
		{"S=1", ""},
		{"timeout 30 git fetch", "git fetch"},
		{"timeout -k 5 -s KILL 2m pnpm test", "pnpm test"},
		{"cd /a && timeout 9 env -u CLAUDECODE FOO=1 claude plugin list", "claude plugin"},
		{"env -i PATH=/bin ls", "ls"},
		{"for f in *; do ls $f; done", "for"},
		{"brew upgrade staticcheck", "brew upgrade"},
		{"go -C x/go test ./...", "go test"},
		{"op read op://dev/a/credential", "op read"},
		{"npx -y vitest run", "npx vitest"},
		{"node ~/frame/script/fixture-store.ts list", "node fixture-store.ts"},
		{"node --no-warnings ./script/toolchain-sync.ts", "node toolchain-sync.ts"},
		{`python3 -c "import json"`, "python3"},
		{"bash", "bash"},
		{"# note\nls -la", "ls"},
		{"ls # a trailing note", "ls"},
		{"git log --grep '#1'", "git log"},
		{"command -v jq", "jq"},
		{"time pnpm test", "pnpm test"},
		{"source ~/.zshrc && gh pr view 1", "gh pr"},
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
