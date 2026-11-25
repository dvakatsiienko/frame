package main

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// only git's own lines: curl's over https, github's over ssh («remote: Internal Server Error», «[remote rejected] … (Internal Server
// Error)»); a pre-push hook's words never match, and a 4xx is a refusal that a retry only repeats
var serverError = regexp.MustCompile(`(?im)requested URL returned error: 5\d\d\b|RPC failed; HTTP 5\d\d\b|^remote: (internal server error|bad gateway|service unavailable|gateway time-?out)\s*$|\[remote rejected\].*\((internal server error|bad gateway|service unavailable|gateway time-?out)\)`)

const (
	pushTries = 3
	pushPause = 2 * time.Second
)

type pushTarget struct {
	branch, sha, from, reason string
	// a codie/* branch pushed from the linked tree that has it checked out
	own bool
}

func pushPlan(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	tree, err := top()
	if err != nil {
		return nil, err
	}
	_, linked, err := worktreeOf(tree)
	if err != nil {
		return nil, err
	}
	if linked && strings.HasPrefix(name, "worktree-fork-") {
		return nil, &Fail{Refused: true, Msg: name + " is a fork's branch: it lands through the wing's door, never as a branch on origin", Next: "tree-sync.sh land"}
	}
	r.Open(name)
	target := pushTarget{own: linked && strings.HasPrefix(name, "codie/")}
	if err := r.Step("tree", "checking the tree", func() (string, error) { return home(tree), nil }); err != nil {
		return nil, err
	}
	if err := r.Step("plan", "reading HEAD and the push home", func() (string, error) {
		sha, err := head()
		if err != nil {
			return "", err
		}
		from, reason, err := pushHome()
		target.branch, target.sha, target.from, target.reason = name, sha, from, reason
		// counted from the remote's own sha: a local origin/<branch> ref can be stale
		detail := fmt.Sprintf("%s to origin/%s", short(sha), name)
		if remote, _ := remoteBranch(".", name); remote != "" {
			if ahead, _ := git("rev-list", "--count", remote+"..HEAD"); ahead.ok {
				n, _ := strconv.Atoi(ahead.out)
				detail = fmt.Sprintf("%s to origin/%s", plural(n, "commit"), name)
			}
		}
		if from != tree {
			detail += ", from " + home(from)
		}
		return detail, err
	}); err != nil {
		return nil, err
	}
	return planOf(target), nil
}

func planOf(t pushTarget) ordered {
	return ordered{{"branch", t.branch}, {"sha", t.sha}, {"from", t.from}, {"reason", t.reason}, {"own", t.own}}
}

// the lane's own branch from its own tree: the push sends that tree's HEAD to that branch only, never forced, and the
// pr's gates sit between it and main, so the plan stop guards nothing there
func ownBranchPush(plan any) bool {
	own, _ := plan.(ordered)[4].value.(bool)
	return own
}

func askPush(plan any) string {
	fields := plan.(ordered)
	return fmt.Sprintf("push %s to origin/%s?", short(fields[1].value.(string)), fields[0].value)
}

func push(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	name, sha, from := fields[0].value.(string), fields[1].value.(string), fields[2].value.(string)
	if err := r.Step("push", "git push", func() (_ string, err error) {
		leave, err := takeGateTurn("x lane push "+name, "x lane push --apply")
		if err != nil {
			return "", err
		}
		defer func() { leave(err) }()
		pushed, tries := pushRetrying(from, sha+":refs/heads/"+name)
		if !pushed.ok {
			return "", &Fail{Msg: fmt.Sprintf("push failed after %s — the git and hook output is above", plural(tries, "try")),
				Next: "fix what the pre-push hooks name, then x lane push --apply", Log: nonBlank(pushed.log)}
		}
		if tries > 1 {
			return fmt.Sprintf("origin/%s, on try %d of %d", name, tries, pushTries), nil
		}
		return "origin/" + name, nil
	}); err != nil {
		return nil, err
	}
	var remote string
	if err := r.Step("verify", "reading the remote back", func() (string, error) {
		var err error
		if remote, err = remoteBranch(".", name); err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Msg: fmt.Sprintf("remote is %s, HEAD is %s", or(remote, "empty"), sha), Next: "x lane push --apply"}
		}
		return "the remote holds " + short(remote), nil
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%s on origin/%s", short(sha), name), "x lane pr-open <title> <body-file>")
	return ordered{{"branch", name}, {"from", from}, {"remote", remote}, {"sha", sha}}, nil
}

func pushRetrying(from string, args ...string) (result, int) {
	var pushed result
	tries := 1
	for ; ; tries++ {
		pushed, _ = gitIn(from, append([]string{"push", "-q", "origin"}, args...)...)
		if pushed.ok || tries == pushTries || !serverError.MatchString(pushed.log) {
			return pushed, tries
		}
		time.Sleep(time.Duration(tries) * pushPause)
	}
}

// frame's pre-push mirror gate reads ~ symlinks that point at the main checkout, so a
// frame worktree's own push always fails; the main checkout pushes the same sha (shared objects)
func pushHome() (string, string, error) {
	tree, err := top()
	if err != nil {
		return "", "", err
	}
	common, linked, err := worktreeOf(tree)
	if err != nil {
		return "", "", err
	}
	if !linked {
		return tree, "main checkout", nil
	}
	frameCommon, _ := gitIn(sourceDir(), "rev-parse", "--path-format=absolute", "--git-common-dir")
	if frameCommon.out != common {
		return tree, "worktree", nil
	}
	return filepath.Dir(common), "frame worktree: the mirror gate passes only in the main checkout", nil
}
