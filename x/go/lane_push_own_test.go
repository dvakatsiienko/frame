package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

// a main checkout with a bare origin, and when linked a worktree of it on the branch; the cwd to push from
func pushTree(t *testing.T, branch string, linked bool) (cwd, origin string) {
	t.Helper()
	main := repo(t)
	origin = filepath.Join(t.TempDir(), "origin.git")
	gitT(t, filepath.Dir(origin), "init", "-q", "--bare", origin)
	gitT(t, main, "remote", "add", "origin", origin)
	cwd = main
	if linked {
		cwd = filepath.Join(t.TempDir(), "tree")
		gitT(t, main, "worktree", "add", "-q", cwd, "-b", branch)
	} else {
		gitT(t, main, "checkout", "-q", "-b", branch)
	}
	write(t, filepath.Join(cwd, "readme.txt"), "an edit on "+branch+"\n")
	gitT(t, cwd, "commit", "-q", "-am", "edit")
	return cwd, origin
}

func originHolds(t *testing.T, origin, branch string) string {
	t.Helper()
	sha, _, _ := strings.Cut(gitT(t, origin, "for-each-ref", "--format=%(objectname)", "refs/heads/"+branch), "\n")
	return sha
}

func TestPushRunsUnaskedOnlyFromACodieBranchsOwnTree(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, branch string
		linked       bool
		code         int
	}{
		{"a codie branch in its own tree", "codie/FRM-1-own", true, 0},
		{"another branch in a linked tree", "side", true, 4},
		{"a branch that only starts like one", "codies/FRM-1", true, 4},
		{"a codie branch in the main checkout", "codie/FRM-1-own", false, 4},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			cwd, origin := pushTree(t, c.branch, c.linked)

			got := xIn(t, cwd, nil, "lane", "push")

			if got.code != c.code {
				t.Fatalf("exit %d, want %d:\n%s", got.code, c.code, got.stdout)
			}
			head, remote := gitT(t, cwd, "rev-parse", "HEAD"), originHolds(t, origin, c.branch)
			if c.code == 0 && (remote != head || got.data["remote"] != head) {
				t.Errorf("origin holds %q, the envelope read back %v, want %s", remote, got.data["remote"], head)
			}
			if c.code == 4 && (remote != "" || got.next != "x lane push --apply") {
				t.Errorf("origin holds %q after a plan stop, next %q", remote, got.next)
			}
		})
	}
}

func TestPushRefusesAForkBranchFromATree(t *testing.T) {
	t.Parallel()
	for _, apply := range []bool{false, true} {
		t.Run(fmt.Sprintf("apply %v", apply), func(t *testing.T) {
			t.Parallel()
			cwd, origin := pushTree(t, "worktree-fork-0a1b2c", true)
			args := []string{"lane", "push"}
			if apply {
				args = append(args, "--apply")
			}

			got := xIn(t, cwd, nil, args...)

			if got.code != 1 || !strings.Contains(got.next, "tree-sync.sh land") {
				t.Fatalf("exit %d next %q, want 1 naming the landing door:\n%s", got.code, got.next, got.stdout)
			}
			if remote := originHolds(t, origin, "worktree-fork-0a1b2c"); remote != "" {
				t.Errorf("origin holds the fork branch at %s", remote)
			}
		})
	}
}

func TestPushOfAForkBranchInTheMainCheckoutStillStopsForApply(t *testing.T) {
	t.Parallel()
	cwd, _ := pushTree(t, "worktree-fork-0a1b2c", false)
	if got := xIn(t, cwd, nil, "lane", "push"); got.code != 4 {
		t.Errorf("exit %d, want the plan stop:\n%s", got.code, got.stdout)
	}
}
