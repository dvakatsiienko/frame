package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type rebaseTarget struct {
	Branch   string `json:"branch"`
	Lease    string `json:"lease"`
	Main     string `json:"main"`
	From     string `json:"from"`
	Continue bool   `json:"continue,omitempty"`
	tip      string
}

// a stopped rebase: the branch it rewrites, its tip before the rebase, and the main it goes onto
func pausedRebase() (name, tip, onto string, paused bool, err error) {
	path := func(state string) string {
		dir, _ := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-path", state)
		return dir
	}
	if dir := path("rebase-apply"); dir != "" && exists(dir) {
		return "", "", "", false, &Fail{Refused: true, Msg: "a git am or apply-style rebase is stopped here; rebase-main continues only its own", Next: "git status"}
	}
	dir := path("rebase-merge")
	if dir == "" || !exists(dir) {
		return "", "", "", false, nil
	}
	read := func(file string) string { return strings.TrimSpace(firstLine(filepath.Join(dir, file))) }
	return strings.TrimPrefix(read("head-name"), "refs/heads/"), read("orig-head"), read("onto"), true, nil
}

// the fleet's one force-push door: coder/* only, leased on the sha read before the rebase (dima, o87)
func rebasePlan(r *Run, _ []string, _ Flags) (any, error) {
	name, tip, onto, paused, err := pausedRebase()
	if err != nil {
		return nil, err
	}
	if !paused {
		if name, err = branch(); err != nil {
			return nil, err
		}
		tip = "HEAD"
	}
	if !strings.HasPrefix(name, "coder/") {
		next := "git switch -c coder/<ticket>-<slug>"
		if paused {
			next = "git rebase --abort"
		}
		return nil, usageFail(name+" is not a coder/* branch: rebase-main force-pushes only those", next)
	}
	r.Open(name)
	t := &rebaseTarget{Branch: name, Continue: paused, tip: tip}
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
			if !ok(git("merge-base", "--is-ancestor", t.Lease, tip)) {
				return "", &Fail{Refused: true, Msg: "origin/" + name + " holds " + short(t.Lease) + ", a commit the branch lacks: a push it has not taken in",
					Next: "git log " + tip + ".." + t.Lease}
			}
		}
		if t.From, _, err = pushHome(); err != nil {
			return "", err
		}
		if paused {
			t.Main = onto
			return "continuing the rebase onto " + short(onto) + ", lease on " + or(short(t.Lease), "a new branch"), nil
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
		var rebased result
		if t.Continue {
			var err error
			if rebased, err = continueRebase(); err != nil {
				return "", err
			}
		} else {
			rebased, _ = git("rebase", "-q", t.Main)
		}
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

// an isolated coder runs git only through x lane: the verb stages the resolved paths and continues for it
func continueRebase() (result, error) {
	root, err := top()
	if err != nil {
		return result{}, err
	}
	unmerged, err := mustGitIn(root, "diff", "diff", "--name-only", "-z", "--diff-filter=U")
	if err != nil {
		return result{}, err
	}
	files := strings.FieldsFunc(unmerged, func(c rune) bool { return c == 0 })
	var marked, unreadable []string
	for _, f := range files {
		// a delete on one side or a binary leaves no marker to read: only a text merge is staged unseen
		if !ok(gitIn(root, "cat-file", "-e", ":2:"+f)) || !ok(gitIn(root, "cat-file", "-e", ":3:"+f)) {
			unreadable = append(unreadable, f)
			continue
		}
		if numstat, _ := gitIn(root, "diff", "--numstat", ":2:"+f, ":3:"+f); strings.HasPrefix(numstat.out, "-\t-") {
			unreadable = append(unreadable, f)
			continue
		}
		body, err := os.ReadFile(filepath.Join(root, f))
		switch {
		case err != nil:
			unreadable = append(unreadable, f)
		case conflictMarker.Match(body):
			marked = append(marked, f)
		}
	}
	switch {
	case len(unreadable) > 0:
		return result{}, &Fail{Refused: true, Msg: "a delete or binary conflict in " + strings.Join(unreadable, ", ") + " has no marker to check; settle it by hand in the main checkout",
			Next: "git add <path> && git rebase --continue", Log: unreadable}
	case len(marked) > 0:
		return result{}, &Fail{Refused: true, Msg: "conflict markers left in " + strings.Join(marked, ", "), Next: "x lane rebase-main --apply", Log: marked}
	}
	if len(files) > 0 {
		if _, err := mustGitIn(root, "add", append([]string{"add", "--"}, files...)...); err != nil {
			return result{}, err
		}
	}
	got, _ := run(root, []string{"GIT_EDITOR=true"}, "", "git", "rebase", "--continue")
	return got, nil
}

// a markdown heading can be seven =; git's own markers always open and close with < and >
var conflictMarker = regexp.MustCompile(`(?m)^(<{7}|>{7})( |\r?$)`)

// a conflict leaves the tree mid-rebase, for the coder to resolve in place
func rebaseFail(rebased result) error {
	conflicts, _ := git("diff", "--name-only", "--diff-filter=U")
	if conflicts.out == "" {
		fail := &Fail{Msg: "rebase failed without conflicts, aborted: " + gitReason(rebased.log), Next: "git status", Log: nonBlank(rebased.log)}
		if aborted, _ := git("rebase", "--abort"); !aborted.ok {
			return errors.Join(fail, fmt.Errorf("git rebase --abort failed too: %s", logLine(aborted.log)))
		}
		return fail
	}
	files := strings.Split(conflicts.out, "\n")
	return &Fail{Msg: "conflicts in " + strings.Join(files, ", ") + " — resolve them, then x lane rebase-main --apply (git rebase --continue), or git rebase --abort",
		Next: "x lane rebase-main --apply", Log: files}
}
