package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDecampPointsTheHookShimsBackAtTheMainCheckout(t *testing.T) {
	t.Parallel()
	main := repo(t)
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, main, "worktree", "add", "-q", tree, "-b", "side")
	tree, _ = filepath.EvalSymlinks(tree)
	shim := filepath.Join(main, ".git/hooks/pre-commit")
	// what a pnpm run in the worktree leaves behind
	write(t, shim, "#!/bin/sh\n"+tree+"/node_modules/.bin/lefthook run pre-commit\n")
	// lefthook install writes the shim against the dir it runs in
	bin := t.TempDir()
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\nprintf '#!/bin/sh\\n%s/node_modules/.bin/lefthook run pre-commit\\n' \"$PWD\" > \"$PWD/.git/hooks/pre-commit\"\n")
	if err := os.Chmod(filepath.Join(bin, "pnpm"), 0o755); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, main, []string{"PATH=" + bin + ":" + os.Getenv("PATH")}, "lane", "decamp", tree, "--apply")

	body, _ := os.ReadFile(shim)
	if got.code != 0 || exists(tree) {
		t.Fatalf("exit %d, tree still there: %v\n%s", got.code, exists(tree), got.stdout)
	}
	if strings.Contains(string(body), tree) || !strings.Contains(string(body), main+"/node_modules") {
		t.Errorf("the shim does not point at the main checkout:\n%s", body)
	}
}

func TestDecampFailsWhenTheShimStillPointsElsewhere(t *testing.T) {
	t.Parallel()
	main := repo(t)
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, main, "worktree", "add", "-q", tree, "-b", "side")
	write(t, filepath.Join(main, ".git/hooks/pre-commit"), "#!/bin/sh\n/elsewhere/node_modules/.bin/lefthook run pre-commit\n")
	// a pnpm that succeeds and writes nothing
	bin := t.TempDir()
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\nexit 0\n")
	if err := os.Chmod(filepath.Join(bin, "pnpm"), 0o755); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, main, []string{"PATH=" + bin + ":" + os.Getenv("PATH")}, "lane", "decamp", tree, "--apply")

	if got.code != 1 {
		t.Fatalf("a shim naming another tree must fail decamp, exit %d\n%s", got.code, got.stdout)
	}
}

func TestSeedRefusesTheMainCheckout(t *testing.T) {
	t.Parallel()
	if got := xIn(t, t.TempDir(), nil, "lane", "seed", repo(t)); got.code != 2 {
		t.Fatalf("seeding the main checkout must be a usage error, exit %d\n%s", got.code, got.stdout)
	}
}

// a squash merge leaves a tree's commits on no remote; main still holds their work (PK-404: verify-pr-153, 7 commits)
func TestDecampTakesADetachedTreeWhoseCommitsMainHoldsByASquash(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		extra bool
		gone  bool
	}{
		{"every commit is in the squash", false, true},
		{"one commit is in no squash", true, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			main := repo(t)
			tree := filepath.Join(t.TempDir(), "tree")
			gitT(t, main, "worktree", "add", "-q", "--detach", tree)
			files := []string{"a.txt", "b.txt"}
			if c.extra {
				files = append(files, "c.txt")
			}
			for _, name := range files {
				write(t, filepath.Join(tree, name), name+"\n")
				gitT(t, tree, "add", name)
				gitT(t, tree, "commit", "-q", "-m", name)
			}
			// the squash on origin/main: the first two files in one commit
			for _, name := range files[:2] {
				write(t, filepath.Join(main, name), name+"\n")
				gitT(t, main, "add", name)
			}
			gitT(t, main, "commit", "-q", "-m", "the squash")
			gitT(t, main, "update-ref", "refs/remotes/origin/main", "HEAD")

			got := xIn(t, main, []string{stubPnpm(t)}, "lane", "decamp", tree, "--apply")

			if exists(tree) == c.gone {
				t.Fatalf("tree gone: %v, want %v, exit %d\n%s", !exists(tree), c.gone, got.code, got.stdout)
			}
			if !c.gone && !strings.Contains(got.stdout, "3 commits on no remote") {
				t.Errorf("a kept tree names its commits off every remote:\n%s", got.stdout)
			}
		})
	}
}
