package main

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

// each token and whether brief check may call it a missing path; the guard's brief rule is meant to read it next
var pathTable = []struct {
	token       string
	missingPath bool
}{
	{"Explore.md", false},
	{"/clear", false},
	{"/x:crew-codie", false},
	{"scratch/foo", false},
	{"codie/FRM-458-cli-lane-3", false},
	{"claude/fix-the-thing", false},
	{"main", false},
	{"https://example.com/a/b.md", false},
	{"<path>", false},
	{"[FRM-12](https://linear.app/x-com/issue/FRM-12/s)", false},
	{"~/frame/x", false},
	{"$HOME/frame", false},
	{"${HOME}/frame/x", false},
	{"docs/here.md", false},
	{"docs/nope.md", true},
	{"~/frame/nope", true},
	{"scratch/foo.md", true},
}

// a url beside a command never hides the command: only a span that is a link or a url skips the checks
func TestBriefCheckStillChecksACommandNextToAURL(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "package.json"), `{"scripts":{}}`)
	write(t, filepath.Join(dir, "brief.md"), "wish: none\n\n- `x lane opn --url https://a.b`\n- `pnpm no-such --base-url http://localhost:3000`\n")

	got := xIn(t, dir, nil, "brief", "check", "brief.md")

	for _, want := range []string{"verb x lane opn", "script pnpm no-such"} {
		if got.code == 0 || !strings.Contains(got.stdout, want) {
			t.Errorf("exit %d, want %q:\n%s", got.code, want, got.stdout)
		}
	}
}

func TestBriefCheckReportsOnlyARealMissingPath(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	home := t.TempDir()
	write(t, filepath.Join(home, "frame/x/AGENTS.md"), "x\n")
	write(t, filepath.Join(dir, "docs/here.md"), "here\n")
	var brief strings.Builder
	brief.WriteString("wish: none\n\n")
	for _, c := range pathTable {
		brief.WriteString("- names `" + c.token + "`\n")
	}
	write(t, filepath.Join(dir, "brief.md"), brief.String())

	got := xIn(t, dir, []string{"HOME=" + home}, "brief", "check", "brief.md")

	for _, c := range pathTable {
		t.Run(c.token, func(t *testing.T) {
			if reported := strings.Contains(got.stdout, "path "+c.token+" "); reported != c.missingPath {
				t.Errorf("reported as a missing path %v, want %v", reported, c.missingPath)
			}
		})
	}
	if got.code == 0 {
		t.Errorf("exit 0, want the real missing paths to red:\n%s", got.stdout)
	}
}

func TestIsPathLike(t *testing.T) {
	t.Parallel()
	cases := []struct {
		token string
		want  bool
	}{
		{"@excalidraw/utils", false},
		{"@excalidraw/mermaid-to-excalidraw", false},
		{"@types/react@19.1.0", false},
		{"x/go/brief.go", true},
		{"brief.go:37", true},
		{"FTR.md#brief", true},
		{"packages/kit/src", true},
		{"pnpm typecheck", false},
	}
	for _, c := range cases {
		if got := isPathLike(c.token); got != c.want {
			t.Errorf("isPathLike(%q) = %v, want %v", c.token, got, c.want)
		}
	}
}

// --stamped answers from the brief's hash and its stamp alone: a dead linear and no repo still answer, a changed byte refuses
func TestBriefCheckStampedReadsOnlyTheStamp(t *testing.T) {
	t.Parallel()
	dir, state := t.TempDir(), t.TempDir()
	brief := filepath.Join(dir, "brief.md")
	body := "wish: none\n\n- ticket FRM-12, `docs/nope.md`\n"
	write(t, brief, body)
	sum := fmt.Sprintf("%x", sha256.Sum256([]byte(body)))
	write(t, filepath.Join(state, "briefs", sum+".json"), "{}\n")
	env := []string{"X_STATE=" + state, "X_LINEAR_URL=http://127.0.0.1:1"}

	stamped := xIn(t, dir, env, "brief", "check", brief, "--stamped")
	write(t, brief, body+"one more line\n")
	stale := xIn(t, dir, env, "brief", "check", brief, "--stamped")

	if stamped.code != 0 || stamped.data["sha256"] != sum {
		t.Errorf("stamped: exit %d, want 0 with no network and no repo:\n%s", stamped.code, stamped.stdout)
	}
	if stale.code != 1 || !strings.Contains(stale.next, "x brief check "+brief) {
		t.Errorf("changed: exit %d next %q, want 1 naming the full check:\n%s", stale.code, stale.next, stale.stdout)
	}
}
