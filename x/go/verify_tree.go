package main

import (
	"path/filepath"
	"regexp"
	"strings"
)

var (
	prURL   = regexp.MustCompile(`^https://github\.com/([\w.-]+/[\w.-]+)/pull/(\d+)/?$`)
	mainSha = regexp.MustCompile(`^main:([0-9a-f]{7,40})$`)
)

func samePath(a, b string) bool {
	ra, _ := filepath.EvalSymlinks(a)
	rb, _ := filepath.EvalSymlinks(b)
	return a == b || (ra != "" && ra == rb)
}

func verifyTree(r *Run, args []string, flags Flags) (any, error) {
	target, help := args[0], "x lane verify-tree --help"
	stacked, _ := flags["stack"].(bool)
	if stacked && prURL.FindStringSubmatch(target) == nil {
		return nil, usageFail("--stack reads a stack from its top pr's url, not "+target, "x lane verify-tree --stack <top pr url>")
	}
	tree, err := top()
	if err != nil {
		return nil, err
	}
	common, _, err := worktreeOf(tree)
	if err != nil {
		return nil, err
	}
	main := filepath.Dir(common)

	// each form answers its tree name and how its head is read once fetched
	var name string
	var resolve func() (string, error)
	if match := prURL.FindStringSubmatch(target); match != nil {
		repo, err := repoOf(flags)
		if err != nil {
			return nil, err
		}
		if match[1] != repo {
			return nil, usageFail(target+" is a pr of "+match[1]+", this repo is "+repo, help)
		}
		name = "verify-pr-" + match[2]
		resolve = func() (string, error) {
			if _, err := mustGitIn(main, "fetch", "fetch", "-q", "origin", "refs/pull/"+match[2]+"/head"); err != nil {
				return "", err
			}
			return mustGitIn(main, "rev-parse", "rev-parse", "--verify", "FETCH_HEAD^{commit}")
		}
	} else if match := mainSha.FindStringSubmatch(target); match != nil {
		name = "verify-" + short(match[1])
		resolve = func() (string, error) {
			if _, err := mustGitIn(main, "fetch", "fetch", "-q", "origin", "main"); err != nil {
				return "", err
			}
			sha, err := mustGitIn(main, "rev-parse", "rev-parse", "--verify", match[1]+"^{commit}")
			if err != nil {
				return "", usageFail(match[1]+" is no commit in this repo", help)
			}
			if !ok(gitIn(main, "merge-base", "--is-ancestor", sha, "origin/main")) {
				return "", usageFail(short(sha)+" is not on origin/main", help)
			}
			return sha, nil
		}
	} else {
		return nil, usageFail(target+" is neither a pr url nor main:<sha>", help)
	}
	path := filepath.Join(main, ".claude/worktrees", name)
	r.Open(name)

	var sha string
	if err := r.Step("fetch", "fetching the head", func() (string, error) {
		var err error
		sha, err = resolve()
		return short(sha), err
	}); err != nil {
		return nil, err
	}
	if err := r.Step("worktree", "git worktree add --detach", func() (string, error) {
		if exists(path) {
			// a plain dir at the path is no worktree: git there would walk up to the main checkout
			if root, _ := gitIn(path, "rev-parse", "--show-toplevel"); !root.ok || !samePath(root.out, path) {
				return "", &Fail{Refused: true, Msg: path + " is a plain dir, not a worktree", Next: "trash " + path}
			}
			// the next round on the same pr: the tree moves, unless a probe changed a tracked file (the seed's copies are untracked)
			if dirty, _ := gitIn(path, "status", "--porcelain", "--untracked-files=no"); dirty.out != "" || !dirty.ok {
				return "", &Fail{Refused: true, Msg: path + " holds changes a probe left; it stays as it is", Next: "git -C " + path + " status"}
			}
			_, err := mustGitIn(path, "checkout", "checkout", "-q", "--detach", sha)
			return home(path) + " moved to " + short(sha), err
		}
		// the key lives in the main .git: the tree holds ciphertext until the seed unlocks it
		_, err := mustGitIn(main, "worktree", "-c", "filter.git-crypt.smudge=cat", "-c", "filter.git-crypt.required=false",
			"worktree", "add", "-q", "--detach", path, sha)
		return home(path), err
	}); err != nil {
		return nil, err
	}
	if err := seedTree(r, path, main); err != nil {
		return nil, err
	}
	var layers []string
	if stacked && laneAddOn.stackShown != nil {
		match := prURL.FindStringSubmatch(target)
		if layers, err = laneAddOn.stackShown(match[1], match[2]); err != nil {
			return nil, err
		}
	}
	r.Done(strings.Join(append([]string{"seeded " + path + " at " + short(sha)}, layers...), "\n"), "cd "+path)
	if stacked {
		return ordered{{"tree", path}, {"sha", sha}, {"layers", layers}}, nil
	}
	return ordered{{"tree", path}, {"sha", sha}}, nil
}
