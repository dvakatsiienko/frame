package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// a git-crypt repo standing in for frame, its origin a bare repo answering for github.com/o/r, and a pr
// head on refs/pull/7/head that only origin holds
func verifyWorld(t *testing.T) (main, prHead string) {
	t.Helper()
	if _, err := exec.LookPath("git-crypt"); err != nil {
		t.Skip("git-crypt is not installed")
	}
	main = repo(t)
	c := exec.Command("git-crypt", "init")
	c.Dir, c.Env = main, cleanEnv()
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("git-crypt init: %v\n%s", err, out)
	}
	write(t, filepath.Join(main, ".gitattributes"), "secret.txt filter=git-crypt diff=git-crypt\n")
	write(t, filepath.Join(main, "secret.txt"), "plaintext\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "secret")
	origin := filepath.Join(t.TempDir(), "origin.git")
	gitT(t, filepath.Dir(origin), "init", "-q", "--bare", "-b", "main", origin)
	gitT(t, main, "remote", "add", "origin", "https://github.com/o/r.git")
	gitT(t, main, "config", "url."+origin+".insteadOf", "https://github.com/o/r.git")
	// a global pushInsteadOf (https → ssh) outranks insteadOf on a push
	gitT(t, main, "config", "url."+origin+".pushInsteadOf", "https://github.com/o/r.git")
	gitT(t, main, "push", "-q", "origin", "main")

	gitT(t, main, "switch", "-q", "-c", "coder/x")
	write(t, filepath.Join(main, "change.txt"), "the pr's change\n")
	gitT(t, main, "add", "change.txt")
	gitT(t, main, "commit", "-q", "-m", "the pr's change")
	prHead = gitT(t, main, "rev-parse", "HEAD")
	gitT(t, main, "push", "-q", "origin", "HEAD:refs/pull/7/head")
	gitT(t, main, "switch", "-q", "main")
	gitT(t, main, "branch", "-q", "-D", "coder/x")
	return main, prHead
}

func TestVerifyTreeSeedsAWorktreeOfTheHead(t *testing.T) {
	main, prHead := verifyWorld(t)
	mainHead := gitT(t, main, "rev-parse", "HEAD")
	cases := []struct{ name, arg, want, tree string }{
		{"a pr url", "https://github.com/o/r/pull/7", prHead, "verify-pr-7"},
		{"main:<sha>", "main:" + short(mainHead), mainHead, "verify-" + short(mainHead)},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			state := t.TempDir()

			got := xIn(t, main, tracing(state), "lane", "verify-tree", c.arg)

			tree := filepath.Join(main, ".claude/worktrees", c.tree)
			secret, _ := os.ReadFile(filepath.Join(tree, "secret.txt"))
			if got.code != 0 || got.data["tree"] != tree || string(secret) != "plaintext\n" {
				t.Fatalf("exit %d, tree %v, secret.txt %q, want %s seeded:\n%s", got.code, got.data["tree"], secret, tree, got.stdout)
			}
			if head := gitT(t, tree, "rev-parse", "HEAD"); head != c.want {
				t.Errorf("the tree sits on %s, want %s", short(head), short(c.want))
			}
			var steps []string
			for _, line := range traces(t, state) {
				for _, s := range line["x.steps"].([]any) {
					steps = append(steps, s.(map[string]any)["name"].(string))
				}
			}
			if !slices.Contains(steps, "seed") {
				t.Errorf("the trace shows steps %v, want the seed step's code path", steps)
			}
		})
	}
}

func TestVerifyTreeRefusesAnythingButAPrUrlOrMainSha(t *testing.T) {
	main, _ := verifyWorld(t)
	for _, arg := range []string{"7", "#7", "main", "main:zz", "https://github.com/o/r/issues/7", "https://github.com/other/r/pull/7"} {
		t.Run(arg, func(t *testing.T) {
			got := xIn(t, main, nil, "lane", "verify-tree", arg)

			if worktrees := gitT(t, main, "worktree", "list"); got.code != 2 || strings.Count(worktrees, "\n") != 0 {
				t.Fatalf("exit %d, worktrees:\n%s\nwant exit 2 and no new tree:\n%s", got.code, worktrees, got.stdout)
			}
		})
	}
}
