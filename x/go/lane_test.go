package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// a repo outside any frame tree: the lane verbs must work in any git repo
func repo(t *testing.T) string {
	t.Helper()
	dir, _ := filepath.EvalSymlinks(t.TempDir())
	gitT(t, dir, "init", "-q", "-b", "main")
	write(t, filepath.Join(dir, "readme.txt"), "one\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "seed")
	return dir
}

func gitT(t *testing.T, dir string, args ...string) string {
	t.Helper()
	c := exec.Command("git", append([]string{"-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false"}, args...)...)
	c.Dir = dir
	c.Env = cleanEnv()
	out, err := c.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

// a commit hook exports GIT_DIR and friends; a fixture repo must not inherit them
func cleanEnv() []string {
	var kept []string
	for _, pair := range filterEnv(os.Environ()) {
		if !strings.HasPrefix(pair, "GIT_") {
			kept = append(kept, pair)
		}
	}
	return append(kept, "GIT_AUTHOR_NAME=fixture", "GIT_AUTHOR_EMAIL=fixture@example.com",
		"GIT_COMMITTER_NAME=fixture", "GIT_COMMITTER_EMAIL=fixture@example.com", "GIT_CONFIG_COUNT=1",
		"GIT_CONFIG_KEY_0=commit.gpgsign", "GIT_CONFIG_VALUE_0=false")
}

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
}

func message(t *testing.T) string {
	path := filepath.Join(t.TempDir(), "msg.txt")
	write(t, path, "fixture commit\n")
	return path
}

type ran struct {
	code   int
	stdout string
	data   map[string]any
	next   string
}

func xIn(t *testing.T, dir string, env []string, args ...string) ran {
	t.Helper()
	c := exec.Command(xbin, args...)
	c.Dir = dir
	c.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	var stdout bytes.Buffer
	c.Stdout = &stdout
	code := exitOf(c.Run())
	var envelope struct {
		Data map[string]any `json:"data"`
		Next string         `json:"next"`
	}
	_ = json.Unmarshal(stdout.Bytes(), &envelope)
	return ran{code, stdout.String(), envelope.Data, envelope.Next}
}

func TestCommitReadsPathsFromTheRootInASubdir(t *testing.T) {
	dir := repo(t)
	write(t, filepath.Join(dir, "sub/keep.txt"), "")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "sub")
	write(t, filepath.Join(dir, "readme.txt"), "from a subdir\n")

	got := xIn(t, filepath.Join(dir, "sub"), nil, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 || gitT(t, dir, "status", "--porcelain") != "" {
		t.Fatalf("exit %d, status %q", got.code, gitT(t, dir, "status", "--porcelain"))
	}
}

func TestCommitOnRepoMainTakesOnlyTheNamedPaths(t *testing.T) {
	target := repo(t)
	write(t, filepath.Join(target, "readme.txt"), "two\n")
	write(t, filepath.Join(target, "other.txt"), "untouched\n")

	got := xIn(t, repo(t), nil, "lane", "commit", "--repo", target, message(t), "--", "readme.txt")

	if got.code != 0 || got.data["sha"] != gitT(t, target, "rev-parse", "HEAD") {
		t.Fatalf("exit %d, data %v", got.code, got.data)
	}
	if status := gitT(t, target, "status", "--porcelain"); status != "?? other.txt" {
		t.Errorf("status %q, want only other.txt left", status)
	}
}

func TestCommitRefusesARepoItMustNotTouch(t *testing.T) {
	cases := []struct {
		name  string
		setup func(t *testing.T, dir string)
		exit  int
	}{
		{"not a git repo", nil, 2},
		{"a branch other than main", func(t *testing.T, dir string) { gitT(t, dir, "switch", "-q", "-c", "side") }, 1},
		{"mid-merge", func(t *testing.T, dir string) {
			write(t, filepath.Join(dir, ".git/MERGE_HEAD"), gitT(t, dir, "rev-parse", "HEAD")+"\n")
		}, 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			target, _ := filepath.EvalSymlinks(t.TempDir())
			before := ""
			if tc.setup != nil {
				target = repo(t)
				tc.setup(t, target)
				before = gitT(t, target, "rev-parse", "HEAD")
			}
			write(t, filepath.Join(target, "readme.txt"), "two\n")

			got := xIn(t, repo(t), nil, "lane", "commit", "--repo", target, message(t), "--", "readme.txt")

			if got.code != tc.exit {
				t.Errorf("exit %d, want %d", got.code, tc.exit)
			}
			if before != "" && gitT(t, target, "rev-parse", "HEAD") != before {
				t.Error("HEAD moved")
			}
		})
	}
}

func TestCommitFormatsTheNamedPathsWithTheRepoBiome(t *testing.T) {
	biome, _ := filepath.Abs("../../node_modules/.bin/biome")
	if _, err := os.Stat(biome); err != nil {
		t.Skip("no biome in this tree: pnpm install")
	}
	dir := repo(t)
	write(t, filepath.Join(dir, "biome.json"), "{}\n")
	if err := os.MkdirAll(filepath.Join(dir, "node_modules/.bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(biome, filepath.Join(dir, "node_modules/.bin/biome")); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "a.ts"), "const  a = {b:1}\n")

	got := xIn(t, dir, nil, "lane", "commit", message(t), "--", "a.ts")

	if body := gitT(t, dir, "show", "HEAD:a.ts"); got.code != 0 || body != "const a = { b: 1 };" {
		t.Fatalf("exit %d, committed %q", got.code, body)
	}
}

// a `claude` on PATH that logs its arguments and passes or fails its validate as told
func fakeClaude(t *testing.T, valid bool) (env []string, log string) {
	bin := t.TempDir()
	log = filepath.Join(bin, "calls.log")
	verdict := "exit 0"
	if !valid {
		verdict = "echo 'Validation failed'; exit 1"
	}
	write(t, filepath.Join(bin, "claude"), "#!/bin/sh\necho \"$@\" >> \""+log+"\"\n"+verdict+"\n")
	return []string{"PATH=" + bin + ":" + os.Getenv("PATH")}, log
}

func TestCommitValidatesTheModANamedPathSitsIn(t *testing.T) {
	const path = "home/.claude/plugin-x/mods/m/hooks.ts"
	for _, valid := range []bool{true, false} {
		dir := repo(t)
		write(t, filepath.Join(dir, "home/.claude/plugin-x/mods/m/.claude-plugin/plugin.json"), `{ "name": "m" }`+"\n")
		write(t, filepath.Join(dir, path), "export {};\n")
		before := gitT(t, dir, "rev-parse", "HEAD")
		env, log := fakeClaude(t, valid)

		got := xIn(t, dir, env, "lane", "commit", message(t), "--", path)

		calls, _ := os.ReadFile(log)
		if strings.TrimSpace(string(calls)) != "plugin validate home/.claude/plugin-x/mods/m" {
			t.Errorf("valid=%v: claude called with %q", valid, calls)
		}
		if valid && got.code != 0 {
			t.Errorf("a valid mod was refused: exit %d", got.code)
		}
		if !valid && (got.code != 1 || gitT(t, dir, "rev-parse", "HEAD") != before || gitT(t, dir, "diff", "--cached", "--name-only") != "") {
			t.Errorf("an invalid mod got through: exit %d", got.code)
		}
	}
}

// a hand-made worktree of a git-crypt repo with the smudge filter off, so the secret stays ciphertext
func lockedWorktree(t *testing.T) string {
	if _, err := exec.LookPath("git-crypt"); err != nil {
		t.Skip("git-crypt is not installed")
	}
	dir := repo(t)
	c := exec.Command("git-crypt", "init")
	c.Dir, c.Env = dir, cleanEnv()
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("git-crypt init: %v\n%s", err, out)
	}
	write(t, filepath.Join(dir, ".gitattributes"), "secret.txt filter=git-crypt diff=git-crypt\n")
	write(t, filepath.Join(dir, "secret.txt"), "plaintext\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "secret")
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, dir, "-c", "filter.git-crypt.smudge=cat", "-c", "filter.git-crypt.required=false", "worktree", "add", "-q", tree, "-b", "side")
	tree, _ = filepath.EvalSymlinks(tree)
	return tree
}

func TestCommitRefusesCiphertextAndNamesUnlock(t *testing.T) {
	tree := lockedWorktree(t)
	write(t, filepath.Join(tree, "readme.txt"), "two\n")

	got := xIn(t, tree, nil, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 1 || got.next != "x lane unlock" {
		t.Fatalf("exit %d, next %q", got.code, got.next)
	}
}

func TestUnlockTurnsCiphertextBackIntoPlaintext(t *testing.T) {
	tree := lockedWorktree(t)

	got := xIn(t, tree, nil, "lane", "unlock")

	if body, _ := os.ReadFile(filepath.Join(tree, "secret.txt")); got.code != 0 || string(body) != "plaintext\n" {
		t.Fatalf("exit %d, secret.txt %q", got.code, body)
	}
}

func TestAGlobalFlagBeforeTheVerbStillFindsIt(t *testing.T) {
	if got := xIn(t, repo(t), nil, "--json", "lane", "push"); got.code != 4 || got.next != "x lane push --apply" {
		t.Fatalf("exit %d, next %q", got.code, got.next)
	}
}

// a fake frame tree whose binary only prints a marker: the shim must pick it from a subdir
func fakeTree(t *testing.T, marker string) string {
	tree, _ := filepath.EvalSymlinks(t.TempDir())
	shim, _ := os.ReadFile("../bin/x")
	write(t, filepath.Join(tree, "x/bin/x"), string(shim))
	write(t, filepath.Join(tree, "x/go/go.mod"), "module x\n")
	write(t, filepath.Join(tree, "x/go/bin/x"), "#!/bin/sh\necho "+marker+"\n")
	// the source older than the binary, both in the past: a later write is newer to the second
	now := time.Now()
	_ = os.Chtimes(filepath.Join(tree, "x/go/go.mod"), now.Add(-2*time.Minute), now.Add(-2*time.Minute))
	_ = os.Chtimes(filepath.Join(tree, "x/go/bin/x"), now.Add(-time.Minute), now.Add(-time.Minute))
	if err := os.MkdirAll(filepath.Join(tree, "deep/er"), 0o755); err != nil {
		t.Fatal(err)
	}
	return tree
}

func TestShimRunsTheNearestTreesBinary(t *testing.T) {
	tree := fakeTree(t, "tree-local")
	shim, _ := filepath.Abs("../bin/x")

	c := exec.Command(shim)
	c.Dir = filepath.Join(tree, "deep/er")
	out, _ := c.Output()

	if strings.TrimSpace(string(out)) != "tree-local" {
		t.Fatalf("got %.80q", out)
	}
}

func TestShimRebuildsABinaryOlderThanItsSource(t *testing.T) {
	tree := fakeTree(t, "stale")
	write(t, filepath.Join(tree, "x/go/main.go"), "package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Println(\"rebuilt\") }\n")

	c := exec.Command(filepath.Join(tree, "x/bin/x"))
	c.Dir = tree
	out, _ := c.Output()

	if strings.TrimSpace(string(out)) != "rebuilt" {
		t.Fatalf("got %q — the stale binary ran", out)
	}
}
