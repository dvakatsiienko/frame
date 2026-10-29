package main

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

type rebaseTarget struct {
	Branch string `json:"branch"`
	Lease  string `json:"lease"`
	Main   string `json:"main"`
	From   string `json:"from"`
}

// the branch a stopped rebase rewrites; any stopped rebase or am is codie's to finish, never the verb's
func pausedRebase() (name string, paused bool) {
	for _, state := range []string{"rebase-merge", "rebase-apply"} {
		dir, _ := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-path", state)
		if dir != "" && exists(dir) {
			head := strings.TrimSpace(firstLine(filepath.Join(dir, "head-name")))
			return or(strings.TrimPrefix(head, "refs/heads/"), "a detached HEAD"), true
		}
	}
	return "", false
}

// the fleet's one force-push door: codie/* (and the older coder/*) only, leased on the sha read before the rebase (dima, o87)
func rebasePlan(r *Run, _ []string, _ Flags) (any, error) {
	if name, paused := pausedRebase(); paused {
		return nil, &Fail{Refused: true, Msg: "a rebase of " + name + " is stopped here; nothing was touched — resolve, git add, then git rebase --continue, or git rebase --abort",
			Next: "git rebase --continue"}
	}
	name, err := branch()
	if err != nil {
		return nil, err
	}
	if !strings.HasPrefix(name, "codie/") && !strings.HasPrefix(name, "coder/") { // read-both: branches cut before the 10-29 rename keep coder/
		return nil, usageFail(name+" is not a codie/* branch: rebase-main force-pushes only those", "git switch -c codie/<ticket>-<slug>")
	}
	r.Open(name)
	t := &rebaseTarget{Branch: name}
	if err := r.Step("plan", "reading the remote branch and origin/main", func() (string, error) {
		var err error
		if t.Lease, err = remoteSha(name); err != nil {
			return "", err
		}
		if t.Lease != "" {
			if _, err := mustGit("fetch", "fetch", "-q", "origin", name); err != nil {
				return "", err
			}
			// a matching lease alone would still overwrite a teammate's push from before this run
			if !ok(git("merge-base", "--is-ancestor", t.Lease, "HEAD")) {
				return "", &Fail{Refused: true, Msg: "origin/" + name + " holds " + short(t.Lease) + ", a commit HEAD lacks: a push this branch has not taken in",
					Next: "git log HEAD.." + t.Lease}
			}
		}
		if t.From, _, err = pushHome(); err != nil {
			return "", err
		}
		if _, err := mustGit("fetch", "fetch", "-q", "origin", "main"); err != nil {
			return "", err
		}
		if t.Main, err = mustGit("rev-parse", "rev-parse", "origin/main"); err != nil {
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
		remote, err := remoteSha(t.Branch)
		if err != nil {
			return "", err
		}
		if remote != t.Lease {
			return "", &Fail{Msg: fmt.Sprintf("origin/%s moved to %s since the read at %s, and the lease kept that push",
				t.Branch, short(remote), or(short(t.Lease), "nothing")), Next: "git log HEAD.." + remote, Log: nonBlank(pushed.log)}
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
			return "", &Fail{Msg: fmt.Sprintf("remote is %s, HEAD is %s", or(remote, "empty"), sha), Next: "x lane rebase-main --apply"}
		}
		return "the remote holds " + short(remote), nil
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%s on origin/%s, rebased onto main %s", short(sha), t.Branch, short(t.Main)), "")
	return ordered{{"branch", t.Branch}, {"main", t.Main}, {"sha", sha}}, nil
}

// a conflict leaves the tree mid-rebase for codie; a stop with no conflict is undone only when this
// run's rebase is the one paused, and the message says what really happened
func rebaseFail(rebased result) error {
	conflicts, _ := git("diff", "--name-only", "--diff-filter=U")
	if conflicts.out != "" {
		files := strings.Split(conflicts.out, "\n")
		return &Fail{Msg: "conflicts in " + strings.Join(files, ", ") + " — resolve them, git add, then git rebase --continue, or git rebase --abort",
			Next: "git rebase --continue", Log: files}
	}
	if _, paused := pausedRebase(); !paused {
		return &Fail{Msg: "the rebase did not start: " + gitReason(rebased.log), Next: "git status", Log: nonBlank(rebased.log)}
	}
	aborted, _ := git("rebase", "--abort")
	if !aborted.ok {
		return errors.Join(&Fail{Msg: "the rebase stopped without conflicts and is still paused: " + gitReason(rebased.log), Next: "git status", Log: nonBlank(rebased.log)},
			fmt.Errorf("git rebase --abort failed: %s", logLine(aborted.log)))
	}
	return &Fail{Msg: "the rebase stopped without conflicts, so it was aborted: " + gitReason(rebased.log), Next: "git status", Log: nonBlank(rebased.log)}
}
