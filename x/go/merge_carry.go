package main

import (
	"fmt"
	"slices"
	"strings"
)

// the whole branch change is compared, merges included: per-commit patch-ids let an edit inside a merge slip
// (sixth sense round 1); they only name the commit to blame
func carried(verified, by, head, base, ref string) (bool, string) {
	moved := "the clean by " + by + " is on " + short(verified) + ", the head is " + short(head)
	if got, _ := gitIn("", "fetch", "-q", "origin", base, ref); !got.ok {
		return false, moved + "; git could not fetch them to compare: " + logLine(got.log)
	}
	if got, _ := gitIn("", "cat-file", "-e", verified+"^{commit}"); !got.ok {
		if got, _ := gitIn("", "fetch", "-q", "origin", verified); !got.ok {
			return false, moved + "; " + short(verified) + " is gone from origin, nothing to compare"
		}
	}
	wasChange, err := branchPatch(verified, base)
	if err != nil {
		return false, moved + "; " + err.Error()
	}
	nowChange, err := branchPatch(head, base)
	if err != nil {
		return false, moved + "; " + err.Error()
	}
	if wasChange == nowChange {
		return true, "clean on " + short(verified) + " by " + by + ", carried to " + short(head) + ": the branch's patch-id is unchanged"
	}
	was, errWas := patchIDs(verified, base)
	now, errNow := patchIDs(head, base)
	if errWas == nil && errNow == nil {
		for _, c := range now {
			if !slices.ContainsFunc(was, func(v patchCommit) bool { return v.id == c.id }) {
				return false, short(c.sha) + " " + c.subject + " is past the clean by " + by + " on " + short(verified)
			}
		}
	}
	return false, moved + "; the branch's change differs from the verified one (a merge that edits, or a dropped commit)"
}

// the patch-id of everything a branch changes over origin's base, from their merge base
func branchPatch(tip, base string) (string, error) {
	from, err := mustGit("compare", "merge-base", "origin/"+base, tip)
	if err != nil {
		return "", err
	}
	diff, err := mustGit("compare", "diff", "--no-ext-diff", from, tip)
	if err != nil {
		return "", err
	}
	return patchID(diff)
}

func patchID(patch string) (string, error) {
	// --verbatim: --stable drops whitespace, and yaml, python and makefiles read it (dima, 2026-10-22)
	got, _ := run("", nil, patch+"\n", "git", "patch-id", "--verbatim")
	if !got.ok {
		return "", fmt.Errorf("git patch-id failed: %s", logLine(got.log))
	}
	id, _, _ := strings.Cut(got.out, " ")
	return id, nil
}

type patchCommit struct{ sha, subject, id string }

// merges skipped: a plain merge of main carries no patch of its own
func patchIDs(tip, base string) ([]patchCommit, error) {
	listed, err := mustGit("compare", "log", "--reverse", "--no-merges", "--format=%H %s", "origin/"+base+".."+tip)
	if err != nil {
		return nil, err
	}
	var out []patchCommit
	for line := range strings.Lines(listed) {
		sha, subject, _ := strings.Cut(strings.TrimSpace(line), " ")
		shown, err := mustGit("compare", "show", "--format=", sha)
		if err != nil {
			return nil, err
		}
		id, err := patchID(shown)
		if err != nil {
			return nil, err
		}
		out = append(out, patchCommit{sha, subject, id})
	}
	return out, nil
}
