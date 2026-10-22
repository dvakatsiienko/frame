package main

import (
	"fmt"
	"strings"
)

// the one force-push door in the fleet: coder/* branches only, leased on the sha read before the rebase
// (dima, 2026-10-12, o87)
const rebasePrefix = "coder/"

type rebaseTarget struct {
	Branch string `json:"branch"`
	Lease  string `json:"lease"`
	Main   string `json:"main"`
	From   string `json:"from"`
}

func rebasePlan(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(name, rebasePrefix) {
		return nil, usageFail(name+" is not a coder/* branch: rebase-main force-pushes only those", "x lane merge-main")
	}
	r.Open(name)
	t := &rebaseTarget{Branch: name}
	if err := r.Step("plan", "reading the remote branch and origin/main", func() (string, error) {
		var err error
		if t.Lease, err = remoteSha(name); err != nil {
			return "", err
		}
		if _, err := mustGit("fetch", "fetch", "-q", "origin", "main"); err != nil {
			return "", err
		}
		if t.Main, err = mustGit("rev-parse", "rev-parse", "origin/main"); err != nil {
			return "", err
		}
		if t.From, _, err = pushHome(); err != nil {
			return "", err
		}
		behind, _ := git("rev-list", "--count", "HEAD..origin/main")
		return fmt.Sprintf("%s behind origin/main %s, lease on %s", behind.out, short(t.Main), or(short(t.Lease), "a new branch")), nil
	}); err != nil {
		return nil, err
	}
	return t, nil
}

func askRebase(plan any) string {
	t := plan.(*rebaseTarget)
	return fmt.Sprintf("rebase %s onto origin/main %s and force-push it with a lease?", t.Branch, short(t.Main))
}

func rebaseMain(r *Run, _ []string, _ Flags, plan any) (any, error) {
	t := plan.(*rebaseTarget)
	var sha string
	if err := r.Step("rebase", "git rebase origin/main", func() (string, error) {
		rebased, _ := git("rebase", "-q", t.Main)
		if !rebased.ok {
			return "", rebaseFail(rebased)
		}
		var err error
		sha, err = head()
		return "HEAD is " + short(sha), err
	}); err != nil {
		return nil, err
	}
	if err := r.Step("push", "git push --force-with-lease", func() (string, error) {
		// an empty lease means the branch must not exist on the remote yet
		pushed, _ := pushRetrying(t.From, "--force-with-lease=refs/heads/"+t.Branch+":"+t.Lease, sha+":refs/heads/"+t.Branch)
		if pushed.ok {
			return "origin/" + t.Branch, nil
		}
		remote, _ := remoteSha(t.Branch)
		if remote != t.Lease {
			return "", &Fail{Msg: fmt.Sprintf("origin/%s moved to %s since the read at %s: someone pushed, and the lease kept their push",
				t.Branch, short(remote), or(short(t.Lease), "nothing")), Next: "git log " + remote + " — fold that push in, then x lane rebase-main --apply", Log: nonBlank(pushed.log)}
		}
		return "", &Fail{Msg: "push failed — the git and hook output is above", Next: "x lane rebase-main --apply", Log: nonBlank(pushed.log)}
	}); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the remote back", func() (string, error) {
		remote, err := remoteSha(t.Branch)
		if err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Msg: fmt.Sprintf("remote is %s, HEAD is %s", or(remote, "empty"), sha), Next: "x lane push --apply"}
		}
		return "the remote holds " + short(remote), nil
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%s on origin/%s, rebased onto main %s", short(sha), t.Branch, short(t.Main)), "")
	return ordered{{"branch", t.Branch}, {"main", t.Main}, {"sha", sha}}, nil
}

// the tree stays mid-rebase on a conflict: the coder resolves in place
func rebaseFail(rebased result) *Fail {
	conflicts, _ := git("diff", "--name-only", "--diff-filter=U")
	if conflicts.out == "" {
		_, _ = git("rebase", "--abort")
		return &Fail{Msg: "rebase failed without conflicts, aborted: " + gitReason(rebased.log), Next: "git status", Log: nonBlank(rebased.log)}
	}
	files := strings.Split(conflicts.out, "\n")
	return &Fail{Msg: "conflicts: " + strings.Join(files, ", ") + "\nresolve them, then git rebase --continue — or git rebase --abort",
		Next: "git rebase --continue", Log: append(files, "git rebase --continue", "git rebase --abort")}
}
