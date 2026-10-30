package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// the parser table the guard's brief rule reads too (parked for the mods lane): each token and whether
// brief check may call it a missing path
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
		if reported := strings.Contains(got.stdout, "path "+c.token+" "); reported != c.missingPath {
			t.Errorf("%s: reported as a missing path %v, want %v", c.token, reported, c.missingPath)
		}
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
