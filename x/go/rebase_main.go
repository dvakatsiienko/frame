package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type rebaseTarget struct {
	Branch string `json:"branch"`
	Lease  string `json:"lease"`
	Main   string `json:"main"`
	From   string `json:"from"`
	Onto   string `json:"onto,omitempty"`
	// a low sha reads like a true old base, and no shape tells them apart: the plan shows what stays
	Replays string `json:"replays,omitempty"`
	// a rerun after a conflict and git rebase --continue: the rewrite is done, only the push is left
	finished bool
	record   string
}

// beside the tree's own git state, so a rerun can tell the head this verb rewrote from a rival's commit on the remote
const ontoRecordName = "x-rebase-onto.json"

type ontoRecord struct {
	Branch string `json:"branch"`
	Head   string `json:"head"`
}

func readOntoRecord(path, branch string) (ontoRecord, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return ontoRecord{}, false
	}
	var note ontoRecord
	if json.Unmarshal(raw, &note) != nil || note.Branch != branch {
		return ontoRecord{}, false
	}
	return note, true
}

// the branch a stopped rebase rewrites; any stopped rebase or am is codie's to finish, never the verb's
func pausedRebase() (name string, paused bool) {
	for _, dir := range gitPaths("", "rebase-merge", "rebase-apply") {
		if exists(dir) {
			head := strings.TrimSpace(firstLine(filepath.Join(dir, "head-name")))
			return or(strings.TrimPrefix(head, "refs/heads/"), "a detached HEAD"), true
		}
	}
	return "", false
}

// the fleet's one force-push door: codie/* only, leased on the sha read before the rebase (dima, o87)
func rebasePlan(r *Run, _ []string, flags Flags) (any, error) {
	if name, paused := pausedRebase(); paused {
		return nil, &Fail{Refused: true, Msg: "a rebase of " + name + " is stopped here; nothing was touched — resolve, git add, then git rebase --continue, or git rebase --abort",
			Next: "git rebase --continue"}
	}
	name, err := branch()
	if err != nil {
		return nil, err
	}
	if !isLaneBranch(name) {
		return nil, usageFail(name+" is not a codie/* branch: rebase-main force-pushes only those", "git switch -c codie/<ticket>-<slug>")
	}
	r.Open(name)
	t := &rebaseTarget{Branch: name}
	if onto, _ := flags["onto"].(string); onto != "" {
		sha, err := mustGit("rev-parse", "rev-parse", "--verify", "--quiet", onto+"^{commit}")
		if err != nil || sha == "" {
			return nil, usageFail(onto+" is no commit here", "x lane rebase-main --onto <the old base's sha> --apply")
		}
		t.Onto = sha
		if t.record, err = mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-path", ontoRecordName); err != nil {
			return nil, err
		}
	}
	if err := r.Step("plan", "reading the remote branch and origin/main", func() (string, error) {
		current, err := head()
		if err != nil {
			return "", err
		}
		note, recorded := readOntoRecord(t.record, name)
		// a finished rewrite leaves the recorded head and the old base off HEAD's history; a later commit or an amend after an abort does not
		t.finished = recorded && t.Onto != "" && !ok(git("merge-base", "--is-ancestor", note.Head, "HEAD")) && !ok(git("merge-base", "--is-ancestor", t.Onto, "HEAD"))
		if t.Lease, err = remoteBranch(".", name); err != nil {
			return "", err
		}
		if t.Lease != "" {
			if _, err := mustGit("fetch", "fetch", "-q", "origin", name); err != nil {
				return "", err
			}
			// a matching lease alone would still overwrite a teammate's push from before this run; the head this
			// verb recorded before it rewrote is its own, so it is no such push
			if t.finished {
				if t.Lease != current && !ok(git("merge-base", "--is-ancestor", t.Lease, note.Head)) {
					return "", &Fail{Refused: true, Msg: "origin/" + name + " holds " + short(t.Lease) + ", past the " + short(note.Head) + " this verb rewrote: a push this branch has not taken in",
						Next: "git log " + note.Head + ".." + t.Lease}
				}
			} else if !(recorded && t.Lease == note.Head) && !ok(git("merge-base", "--is-ancestor", t.Lease, "HEAD")) {
				return "", &Fail{Refused: true, Msg: "origin/" + name + " holds " + short(t.Lease) + ", a commit HEAD lacks: a push this branch has not taken in",
					Next: "git log HEAD.." + t.Lease}
			}
		}
		if t.Onto != "" && !t.finished && t.Onto == current {
			return "", &Fail{Refused: true, Msg: short(t.Onto) + " is HEAD itself: nothing would replay, and the layer's commits would leave the remote", Next: "git log --oneline origin/main..HEAD"}
		}
		if t.Onto != "" && !t.finished && !ok(git("merge-base", "--is-ancestor", t.Onto, "HEAD")) {
			return "", &Fail{Refused: true, Msg: short(t.Onto) + " is not an ancestor of HEAD, so it is not this layer's old base", Next: "git log --oneline origin/main..HEAD"}
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
		if t.Onto != "" && !t.finished {
			kept, _ := git("rev-list", "--count", "--no-merges", t.Onto+"..HEAD", "^origin/main")
			total, _ := git("rev-list", "--count", "--no-merges", "origin/main..HEAD")
			t.Replays = "replays " + kept.out + " of " + total.out + " commits past origin/main, the rest leave the branch"
		}
		behind, _ := git("rev-list", "--count", "HEAD..origin/main")
		return fmt.Sprintf("%s behind origin/main %s, lease on %s", behind.out, short(t.Main), or(short(t.Lease), "a new branch")), nil
	}); err != nil {
		return nil, err
	}
	return t, nil
}

func (t *rebaseTarget) rerun() string {
	if t.Onto != "" {
		return "x lane rebase-main --onto " + t.Onto + " --apply"
	}
	return "x lane rebase-main --apply"
}

func askRebase(plan any) string {
	t := plan.(*rebaseTarget)
	if t.Onto != "" {
		return fmt.Sprintf("move %s off %s onto origin/main %s, %s, and force-push it with a lease?", t.Branch, short(t.Onto), short(t.Main), or(t.Replays, "finishing the push"))
	}
	return fmt.Sprintf("rebase %s onto origin/main %s and force-push it with a lease?", t.Branch, short(t.Main))
}

func rebaseMain(r *Run, _ []string, _ Flags, plan any) (any, error) {
	t := plan.(*rebaseTarget)
	var sha string
	if err := r.Step("rebase", "git rebase origin/main", func() (string, error) {
		if t.finished {
			var err error
			sha, err = head()
			return "finished by git rebase --continue, HEAD is " + short(sha), err
		}
		args := []string{"rebase", "-q", t.Main}
		if t.Onto != "" {
			was, err := head()
			if err != nil {
				return "", err
			}
			raw, err := json.Marshal(ontoRecord{Branch: t.Branch, Head: was})
			if err != nil {
				return "", err
			}
			if err := os.WriteFile(t.record, raw, 0o644); err != nil {
				return "", err
			}
			args = []string{"rebase", "-q", "--onto", t.Main, t.Onto}
		}
		rebased, _ := git(args...)
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
		remote, err := remoteBranch(".", t.Branch)
		if err != nil {
			return "", err
		}
		if remote != t.Lease {
			return "", &Fail{Msg: fmt.Sprintf("origin/%s moved to %s since the read at %s, and the lease kept that push",
				t.Branch, short(remote), or(short(t.Lease), "nothing")), Next: "git log HEAD.." + remote, Log: nonBlank(pushed.log)}
		}
		return "", &Fail{Msg: "push failed — the git and hook output is above", Next: t.rerun(), Log: nonBlank(pushed.log)}
	}); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the remote back", func() (string, error) {
		remote, err := remoteBranch(".", t.Branch)
		if err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Msg: fmt.Sprintf("remote is %s, HEAD is %s", or(remote, "empty"), sha), Next: t.rerun()}
		}
		return "the remote holds " + short(remote), nil
	}); err != nil {
		return nil, err
	}
	if t.record != "" {
		if err := os.Remove(t.record); err != nil && !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
	}
	said := fmt.Sprintf("%s on origin/%s, rebased onto main %s", short(sha), t.Branch, short(t.Main))
	if t.finished {
		said = fmt.Sprintf("%s on origin/%s, the rewrite git rebase --continue finished", short(sha), t.Branch)
	}
	r.Done(said, "")
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
