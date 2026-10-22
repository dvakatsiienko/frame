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

// the verifier's tree: a detached worktree of the pr's head under the main checkout, seeded like EnterWorktree
func verifyTree(r *Run, args []string, flags Flags) (any, error) {
	target := args[0]
	usage := "x lane verify-tree <https://github.com/<owner>/<repo>/pull/<n> | main:<sha>>"
	var ref, name string
	switch {
	case prURL.MatchString(target):
		match := prURL.FindStringSubmatch(target)
		repo, err := repoOf(flags)
		if err != nil {
			return nil, err
		}
		if match[1] != repo {
			return nil, usageFail(target+" is a pr of "+match[1]+", this repo is "+repo, usage)
		}
		ref, name = "refs/pull/"+match[2]+"/head", "verify-pr-"+match[2]
	case mainSha.MatchString(target):
		sha := mainSha.FindStringSubmatch(target)[1]
		ref, name = sha, "verify-"+short(sha)
	default:
		return nil, usageFail(target+" is neither a pr url nor main:<sha>", usage)
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
	path := filepath.Join(main, ".claude/worktrees", name)
	r.Open(name)

	var sha string
	if err := r.Step("fetch", "fetching the head", func() (string, error) {
		fetch := ref
		if strings.HasPrefix(ref, "refs/") {
			if _, err := mustGitIn(main, "fetch", "fetch", "-q", "origin", ref); err != nil {
				return "", err
			}
			fetch = "FETCH_HEAD"
		} else if _, err := mustGitIn(main, "fetch", "fetch", "-q", "origin", "main"); err != nil {
			return "", err
		}
		var err error
		sha, err = mustGitIn(main, "rev-parse", "rev-parse", "--verify", fetch+"^{commit}")
		return short(sha), err
	}); err != nil {
		return nil, err
	}
	if exists(path) {
		return nil, &Fail{Refused: true, Msg: path + " exists already", Next: "x lane decamp --apply " + path}
	}
	if err := r.Step("worktree", "git worktree add --detach", func() (string, error) {
		// the key lives in the main .git: the new tree checks out ciphertext until the seed unlocks it
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
