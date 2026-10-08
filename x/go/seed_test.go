package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func goBuild(tree string) ([]byte, error) {
	c := exec.Command("go", "build", "./...")
	c.Dir, c.Env = tree, cleanEnv()
	return c.CombinedOutput()
}

func TestSeedCopiesAModsIgnoredTsconfigFromTheMainCheckout(t *testing.T) {
	dir := repo(t)
	write(t, filepath.Join(dir, ".gitignore"), "mods/*/tsconfig.json\nmods/*/.claude-plugin/types/\n")
	gitT(t, dir, "add", ".gitignore")
	gitT(t, dir, "commit", "-q", "-m", "ignore")
	write(t, filepath.Join(dir, "mods/m/.claude-plugin/types/tsconfig.json"), "{}\n")
	write(t, filepath.Join(dir, "mods/m/tsconfig.json"), `{"extends": "./.claude-plugin/types/tsconfig.json"}`+"\n")
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, dir, "worktree", "add", "-q", tree, "-b", "side")

	got := xIn(t, t.TempDir(), nil, "lane", "seed", tree)

	if _, err := os.Stat(filepath.Join(tree, "mods/m/tsconfig.json")); got.code != 0 || err != nil {
		t.Fatalf("exit %d, tsconfig: %v", got.code, err)
	}
}

// unlock is the door out of a locked tree, so the shim that builds x there must not need git status
func TestTheShimBuildsXInsideALockedWorktree(t *testing.T) {
	tree := lockedWorktree(t)
	shim, _ := os.ReadFile("../bin/x")
	write(t, filepath.Join(tree, "x/bin/x"), string(shim))
	if err := os.Chmod(filepath.Join(tree, "x/bin/x"), 0o755); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(tree, "x/go/go.mod"), "module x\n\ngo 1.24\n")
	write(t, filepath.Join(tree, "x/go/main.go"), "package main\n\nfunc main() { println(\"built\") }\n")

	c := exec.Command(filepath.Join(tree, "x/bin/x"))
	c.Dir, c.Env = tree, cleanEnv()
	out, err := c.CombinedOutput()

	if err != nil || !strings.Contains(string(out), "built") {
		t.Fatalf("the shim could not build x in a locked tree: %v\n%s", err, out)
	}
}

// go stamps vcs info through git status, which dies on the clean filter in a locked tree (exit 128)
func TestGoBuildsInAHandMadeLockedWorktreeOnceUnlocked(t *testing.T) {
	cases := []struct {
		name string
		run  func(t *testing.T, tree string) ran
	}{
		{"x lane seed <path>", func(t *testing.T, tree string) ran { return xIn(t, t.TempDir(), nil, "lane", "seed", tree) }},
		{"x lane unlock", func(t *testing.T, tree string) ran { return xIn(t, tree, nil, "lane", "unlock") }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			tree := lockedWorktree(t)
			write(t, filepath.Join(tree, "go.mod"), "module fixture\n\ngo 1.24\n")
			write(t, filepath.Join(tree, "main.go"), "package main\n\nfunc main() {}\n")
			if out, err := goBuild(tree); err == nil {
				t.Fatalf("control: go build passed in a locked tree, so the fixture proves nothing:\n%s", out)
			}

			got := c.run(t, tree)

			if body, _ := os.ReadFile(filepath.Join(tree, "secret.txt")); got.code != 0 || string(body) != "plaintext\n" {
				t.Fatalf("exit %d, secret.txt %q", got.code, body)
			}
			if out, err := goBuild(tree); err != nil {
				t.Errorf("go build after %s: %v\n%s", c.name, err, out)
			}
		})
	}
}
