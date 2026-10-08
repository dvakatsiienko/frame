package main

import (
	"os"
	"path/filepath"
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

func decampPlan(r *Run, args []string, _ Flags) (any, error) {
	r.Open(args[0])
	var tree, main string
	if err := r.Step("tree", "finding it among the worktrees", func() (string, error) {
		var err error
		tree, main, err = linkedWorktree(args[0])
		return "a worktree of " + home(main), err
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
	if err := r.Step("hooks", "pnpm exec lefthook install in the main checkout", func() (string, error) { return hooksHome(main, tree) }); err != nil {
		return nil, err
	}
	r.Done(home(tree)+" removed, hooks home", "")
	return ordered{{"tree", tree}, {"main", main}}, nil
}
