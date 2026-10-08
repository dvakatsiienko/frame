package main

import (
	"os"
	"path/filepath"
	"strings"
)

// worktrees share .git/hooks, and a pnpm run in one points the lefthook shims at it; a removal
// that leaves them there runs every later hook from a tree that is gone
func decampPlan(r *Run, args []string, _ Flags) (any, error) {
	tree, err := filepath.Abs(args[0])
	if err != nil {
		return nil, err
	}
	tree, _ = filepath.EvalSymlinks(tree)
	common, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return nil, err
	}
	main := filepath.Dir(common)
	r.Open(home(tree))
	if err := r.Step("tree", "finding it among the worktrees", func() (string, error) {
		list, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
		if err != nil {
			return "", err
		}
		if tree == main || !strings.Contains(list+"\n", "worktree "+tree+"\n") {
			return "", &Fail{IsUsage: true, Msg: home(tree) + " is not a linked worktree of " + home(main), Next: "git worktree list"}
		}
		return "a worktree of " + home(main), nil
	}); err != nil {
		return nil, err
	}
	return ordered{{"tree", tree}, {"main", main}}, nil
}

func askDecamp(plan any) string {
	return "remove the worktree " + home(plan.(ordered)[0].value.(string)) + "?"
}

func decamp(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	tree, main := fields[0].value.(string), fields[1].value.(string)
	if err := r.Step("remove", "git worktree remove", func() (string, error) {
		// no --force: git refuses a tree with changes, and that refusal is the answer
		removed, _ := gitIn(main, "worktree", "remove", tree)
		if !removed.ok {
			return "", &Fail{Msg: "git kept the worktree — its output is above", Next: "commit or stash in " + home(tree) + ", then x lane decamp " + home(tree) + " --apply", Log: nonBlank(removed.log)}
		}
		return "removed", nil
	}); err != nil {
		return nil, err
	}
	shim := filepath.Join(main, ".git/hooks/pre-commit")
	if err := r.Step("hooks", "pnpm exec lefthook install in the main checkout", func() (string, error) {
		installed, _ := run(main, nil, "", "pnpm", "exec", "lefthook", "install")
		if !installed.ok {
			return "", &Fail{Msg: "lefthook install failed", Next: "pnpm exec lefthook install", Log: nonBlank(installed.log)}
		}
		body, err := os.ReadFile(shim)
		if err != nil || strings.Contains(string(body), tree) {
			return "", &Fail{Msg: "the hook shims still point at the removed tree", Next: "pnpm exec lefthook install", Log: []string{shim}}
		}
		return "the shims point at " + home(main), nil
	}); err != nil {
		return nil, err
	}
	r.Done(home(tree)+" removed, hooks home", "")
	return ordered{{"tree", tree}, {"main", main}}, nil
}
