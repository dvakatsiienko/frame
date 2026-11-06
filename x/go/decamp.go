package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// linkedWorktree resolves path to a linked worktree of its repo and that repo's main checkout;
// the main checkout itself, or anything git does not list, is refused
func linkedWorktree(path string) (tree, main string, err error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", "", err
	}
	common, err := mustGitIn(abs, "rev-parse", "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return "", "", &Fail{IsUsage: true, Msg: path + " is not inside a git repo", Next: "git worktree list"}
	}
	main = filepath.Dir(common)
	list, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return "", "", err
	}
	// git lists a path as it was added, which may run through a symlink (/var → /private/var)
	same := func(a, b string) bool {
		ra, _ := filepath.EvalSymlinks(a)
		rb, _ := filepath.EvalSymlinks(b)
		return a == b || (ra != "" && ra == rb)
	}
	for line := range strings.SplitSeq(list, "\n") {
		listed, ok := strings.CutPrefix(line, "worktree ")
		if ok && same(listed, abs) && !same(listed, main) {
			return listed, main, nil
		}
	}
	return "", "", &Fail{IsUsage: true, Msg: path + " is not a linked worktree of " + home(main), Next: "git worktree list"}
}

// hooksHome reinstalls the shared lefthook shims from the main checkout: worktrees share .git/hooks,
// and a pnpm run in one points every shim at it
func hooksHome(main, tree string) (string, error) {
	installed, _ := run(main, nil, "", "pnpm", "exec", "lefthook", "install")
	if !installed.ok {
		return "", &Fail{Msg: "lefthook install failed", Next: "pnpm exec lefthook install", Log: nonBlank(installed.log)}
	}
	for _, name := range []string{"pre-commit", "commit-msg", "pre-push"} {
		shim := filepath.Join(main, ".git/hooks", name)
		body, err := os.ReadFile(shim)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil || strings.Contains(string(body), tree) || !strings.Contains(string(body), main+"/node_modules") {
			return "", &Fail{Msg: name + " does not point at the main checkout", Next: "pnpm exec lefthook install", Log: []string{shim}}
		}
	}
	return "the shims point at " + home(main), nil
}

func removeTree(main, tree string) error {
	// no --force: git refuses a tree with changes, and that refusal is the answer
	removed, _ := gitIn(main, "worktree", "remove", tree)
	if !removed.ok {
		return &Fail{Msg: "git kept the worktree — its output is above", Next: "commit or stash in " + home(tree) + ", then x lane decamp " + home(tree) + " --apply", Log: nonBlank(removed.log)}
	}
	return nil
}

const forkBranch = "worktree-fork-"

func listingStale(flags Flags) bool { return flags["list-stale"] == true }

func decampPlan(r *Run, args []string, flags Flags) (any, error) {
	if listingStale(flags) {
		return listStale(r)
	}
	if len(args) == 0 {
		return nil, usageFail("x lane decamp takes a worktree to remove, or --list-stale", "x lane decamp <path> --apply")
	}
	r.Open(args[0])
	var tree, main, branch string
	if err := r.Step("tree", "finding it among the worktrees", func() (string, error) {
		var err error
		if tree, main, err = linkedWorktree(args[0]); err != nil {
			return "", err
		}
		listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
		if err != nil {
			return "", err
		}
		for _, e := range worktreesOf(listed) {
			if e.path != tree {
				continue
			}
			// worktree remove takes ignored files with it, .scratch/ among them; a branch keeps its commits, a detached tree does not
			merged := e.sha
			if e.detached {
				merged = ""
			}
			if why := treeStay(e, main, nil, merged); why != "" {
				return "", &Fail{Refused: true, Msg: home(tree) + " stays: " + why, Next: "settle it, then x lane decamp " + home(tree) + " --apply"}
			}
			if strings.HasPrefix(e.branch, forkBranch) {
				branch = e.branch
			}
		}
		return "a worktree of " + home(main), nil
	}); err != nil {
		return nil, err
	}
	return ordered{{"tree", tree}, {"main", main}, {"branch", branch}}, nil
}

// on main by ancestry, or by a squash: merging any of its commits into main would change nothing. each commit, since a
// branch that reverted its own work matches main at its tip
func onMain(main, sha string) bool {
	if ok(gitIn(main, "merge-base", "--is-ancestor", sha, "origin/main")) {
		return true
	}
	tree, _ := gitIn(main, "rev-parse", "origin/main^{tree}")
	commits, _ := gitIn(main, "rev-list", "origin/main.."+sha)
	if !tree.ok || !commits.ok {
		return false
	}
	for commit := range strings.SplitSeq(commits.out, "\n") {
		if merged, _ := gitIn(main, "merge-tree", "--write-tree", "origin/main", commit); !merged.ok || merged.out != tree.out {
			return false
		}
	}
	return true
}

type staleBranch struct {
	Name   string `json:"name"`
	Merged bool   `json:"merged"`
	Age    string `json:"age"`
}

func listStale(r *Run) (any, error) {
	r.Open("the lane branches")
	repo, err := top()
	if err != nil {
		return nil, err
	}
	main := mainCheckout(repo)
	branches := []staleBranch{}
	if err := r.Step("read", "the lane branches against origin/main", func() (string, error) {
		_, _ = gitIn(main, "fetch", "-q", "origin", "main")
		refs, err := mustGitIn(main, "for-each-ref", "for-each-ref", "--format=%(refname:short) %(committerdate:unix)", "refs/heads/worktree-*", "refs/heads/codie/", "refs/heads/coder/")
		if err != nil {
			return "", err
		}
		for line := range strings.SplitSeq(refs, "\n") {
			name, at, found := strings.Cut(line, " ")
			if !found {
				continue
			}
			seconds, _ := strconv.ParseInt(at, 10, 64)
			branches = append(branches, staleBranch{name, onMain(main, name), fmt.Sprintf("%dd", (clock().Unix()-seconds)/86400)})
		}
		return plural(len(branches), "branch"), nil
	}); err != nil {
		return nil, err
	}
	lines := make([]string, 0, len(branches))
	for _, b := range branches {
		state := "not merged"
		if b.Merged {
			state = "merged"
		}
		lines = append(lines, b.Name+" "+state+" "+b.Age)
	}
	r.Done(strings.Join(lines, "\n"), "")
	return ordered{{"count", len(branches)}, {"branches", branches}}, nil
}

func askDecamp(plan any) string {
	return "remove the worktree " + home(plan.(ordered)[0].value.(string)) + "?"
}

func decamp(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	tree, main := fields[0].value.(string), fields[1].value.(string)
	if err := r.Step("remove", "git worktree remove", func() (string, error) { return "removed", removeTree(main, tree) }); err != nil {
		return nil, err
	}
	if err := r.Step("hooks", "pnpm exec lefthook install in the main checkout", func() (string, error) { return hooksHome(main, tree) }); err != nil {
		return nil, err
	}
	said := home(tree) + " removed, hooks home"
	result := ordered{{"tree", tree}, {"main", main}}
	if branch := fields[2].value.(string); branch != "" {
		if err := r.Step("branch", branch, func() (string, error) {
			_, _ = gitIn(main, "fetch", "-q", "origin", "main")
			why, tips := branchStay(main, branch, "main does not hold", func(sha string) bool { return onMain(main, sha) })
			note := branch + " stays: " + why
			if why == "" {
				note = branchDrop(main, branch, tips)
			}
			if strings.HasPrefix(note, "⚠") {
				return "", &Fail{Msg: note, Next: "git branch --list " + branch}
			}
			said += "\n" + note
			result = append(result, kv{"branch", note})
			return note, nil
		}); err != nil {
			return nil, err
		}
	}
	r.Done(said, "")
	return result, nil
}
