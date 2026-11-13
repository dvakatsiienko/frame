package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// subRepo is a fixture with the same names at the root and in sub/, all committed
func subRepo(t *testing.T) string {
	t.Helper()
	dir := repo(t)
	for _, name := range []string{"sub/a.txt", "sub/old.txt", "old.txt", "AGENTS.md", "sub/AGENTS.md", "_clio/script/wish-cover.ts"} {
		write(t, filepath.Join(dir, name), "one\n")
	}
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "plant")
	return dir
}

func committedFiles(t *testing.T, dir string) string {
	t.Helper()
	return gitT(t, dir, "show", "--name-status", "--format=", "HEAD")
}

// FRM-606 exit 1: a path resolves from the cwd, as git resolves a pathspec; a deletion is a change
func TestCommitResolvesItsPathsFromTheCwd(t *testing.T) {
	t.Parallel()
	dir := subRepo(t)
	write(t, filepath.Join(dir, "sub/a.txt"), "two\n")
	if err := os.Remove(filepath.Join(dir, "sub/old.txt")); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, filepath.Join(dir, "sub"), nil, "lane", "commit", message(t), "--", "a.txt", "old.txt")

	if want := "M\tsub/a.txt\nD\tsub/old.txt"; got.code != 0 || committedFiles(t, dir) != want {
		t.Fatalf("exit %d, the commit holds %q, want %q:\n%s", got.code, committedFiles(t, dir), want, got.stdout)
	}
	if _, err := os.Stat(filepath.Join(dir, "old.txt")); err != nil {
		t.Errorf("the root old.txt is gone: %v", err)
	}
}

// FRM-606 exit 2: a root path run from a subfolder is refused naming both readings, never read silently as either
func TestCommitRefusesARootPathRunFromASubfolder(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, path string
		prepare    func(t *testing.T, dir string)
		want       []string
	}{
		{"a same-named file in the subfolder is unchanged", "AGENTS.md", func(t *testing.T, dir string) { write(t, filepath.Join(dir, "AGENTS.md"), "two\n") }, []string{"sub/AGENTS.md", "AGENTS.md"}},
		{"the subfolder has no such file at all", "b.txt", func(t *testing.T, dir string) { write(t, filepath.Join(dir, "b.txt"), "new\n") }, []string{"sub/b.txt", "b.txt"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir := subRepo(t)
			c.prepare(t, dir)
			before := gitT(t, dir, "rev-parse", "HEAD")

			got := xIn(t, filepath.Join(dir, "sub"), nil, "lane", "commit", message(t), "--", c.path)

			if got.code == 0 || gitT(t, dir, "rev-parse", "HEAD") != before {
				t.Fatalf("exit %d, want a refusal and no commit:\n%s", got.code, got.stdout)
			}
			for _, name := range c.want {
				if !strings.Contains(got.stdout, name) {
					t.Errorf("the refusal does not name %q:\n%s", name, got.stdout)
				}
			}
		})
	}
}

// FRM-606 exit 3: a fixture entered through a symlinked path commits a relative and an absolute path; a refusal names
// each repo-root path it looked at
func TestCommitFromASymlinkedCwdTakesRelativeAndAbsolutePaths(t *testing.T) {
	t.Parallel()
	dir := subRepo(t)
	link := filepath.Join(t.TempDir(), "link")
	if err := os.Symlink(dir, link); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "sub/a.txt"), "two\n")
	write(t, filepath.Join(dir, "sub/AGENTS.md"), "two\n")

	got := xIn(t, filepath.Join(link, "sub"), nil, "lane", "commit", message(t), "--", "a.txt", filepath.Join(dir, "sub/AGENTS.md"))

	if want := "M\tsub/AGENTS.md\nM\tsub/a.txt"; got.code != 0 || committedFiles(t, dir) != want {
		t.Fatalf("exit %d, the commit holds %q, want %q:\n%s", got.code, committedFiles(t, dir), want, got.stdout)
	}
	nothing := xIn(t, filepath.Join(link, "sub"), nil, "lane", "commit", message(t), "--", "a.txt", "old.txt")
	if nothing.code == 0 || !strings.Contains(nothing.stdout, "sub/a.txt, sub/old.txt") {
		t.Errorf("exit %d, want a «nothing staged» naming sub/a.txt, sub/old.txt:\n%s", nothing.code, nothing.stdout)
	}
}

// FRM-606 exit 5, the want line: main's 15:16 replay — _clio/script/wish-cover.ts changed, run from _clio/
func TestCommitFromClioTakesItsScriptPath(t *testing.T) {
	t.Parallel()
	dir := subRepo(t)
	write(t, filepath.Join(dir, "_clio/script/wish-cover.ts"), "two\n")

	got := xIn(t, filepath.Join(dir, "_clio"), nil, "lane", "commit", message(t), "--", "script/wish-cover.ts")

	if got.code != 0 || committedFiles(t, dir) != "M\t_clio/script/wish-cover.ts" || strings.Contains(got.stdout, "nothing staged") {
		t.Errorf("exit %d, the commit holds %q:\n%s", got.code, committedFiles(t, dir), got.stdout)
	}
}

// a retry hint reruns from the same cwd, so it names the paths as typed: the held one leaves, the free one stays
func TestCommitFromASubfolderNamesTheTypedPathInAHeldRetry(t *testing.T) {
	t.Parallel()
	dir := subRepo(t)
	write(t, filepath.Join(dir, "sub/a.txt"), "two\n")
	write(t, filepath.Join(dir, "sub/old.txt"), "two\n")
	store := holdsStoreOf(t, filepath.Join(dir, "sub/a.txt"), false, map[string]any{"idleSince": nil})

	got := xIn(t, filepath.Join(dir, "sub"), []string{"X_HOLDS=" + store, "CLAUDE_CODE_SESSION_ID=mine"}, "lane", "commit", message(t), "--", "a.txt", "old.txt")

	if got.code != 1 || !strings.Contains(got.stdout, "sub/a.txt is held by session other-se") || !strings.Contains(got.stdout, `-- old.txt"`) {
		t.Errorf("exit %d, want the hold on sub/a.txt and a retry naming only old.txt:\n%s", got.code, got.stdout)
	}
}

// --repo with a cwd inside that repo resolves a typed path from the cwd; from outside it, from the repo's root
func TestCommitWithRepoResolvesPathsFromTheCwdOnlyInsideThatRepo(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, path string
		isInside   bool
	}{
		{"the cwd sits inside the repo", "a.txt", true},
		{"the cwd sits outside the repo", "sub/a.txt", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir := subRepo(t)
			write(t, filepath.Join(dir, "sub/a.txt"), "two\n")
			cwd := t.TempDir()
			if c.isInside {
				cwd = filepath.Join(dir, "sub")
			}

			got := xIn(t, cwd, nil, "lane", "commit", "--repo", dir, message(t), "--", c.path)

			if got.code != 0 || committedFiles(t, dir) != "M\tsub/a.txt" {
				t.Errorf("exit %d, the commit holds %q, want M sub/a.txt:\n%s", got.code, committedFiles(t, dir), got.stdout)
			}
		})
	}
}
