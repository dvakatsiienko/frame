package main

import (
	"path/filepath"
	"regexp"
)

var (
	prURL   = regexp.MustCompile(`^https://github\.com/([\w.-]+/[\w.-]+)/pull/(\d+)/?$`)
	mainSha = regexp.MustCompile(`^main:([0-9a-f]{7,40})$`)
)

func verifyTree(r *Run, args []string, flags Flags) (any, error) {
	target, help := args[0], "x lane verify-tree --help"
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
	if exists(path) {
		return nil, &Fail{Refused: true, Msg: path + " exists already", Next: "x lane decamp --apply " + path}
	}
	if err := r.Step("worktree", "git worktree add --detach", func() (string, error) {
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
	r.Done("seeded "+path+" at "+short(sha), "cd "+path)
	return ordered{{"tree", path}, {"sha", sha}}, nil
}
