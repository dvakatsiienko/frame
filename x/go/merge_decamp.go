package main

import (
	"path/filepath"
	"slices"
	"strings"
)

// a merged lane's worktrees go with it, or stay with a named reason; nothing here can fail a done merge. a tree that
// stays is x lane landed's. only a tree at a head the merge landed is judged: any other holds what the merge did not carry
func decampMerged(d *mergeDecision) []string {
	repo, err := top()
	if err != nil {
		return []string{"⚠ no tree decamped: " + err.Error()}
	}
	main := mainCheckout(repo)
	listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return []string{"⚠ no tree decamped: " + err.Error()}
	}
	landed := []string{d.Head}
	for _, sha := range d.heads {
		landed = append(landed, sha)
	}
	under := resolved(filepath.Join(main, ".claude", "worktrees")) + string(filepath.Separator)
	selves := []string{resolved(repo), resolved(frameRoot())}
	var notes []string
	for _, e := range worktreesOf(listed) {
		if !strings.HasPrefix(resolved(e.path), under) {
			continue
		}
		atLanded := slices.Contains(landed, e.sha)
		reason := ""
		switch {
		case d.Merged == "" && (atLanded || e.branch == d.headRef):
			reason = "the merge is still enqueued"
		// a branch still at the head that lands is a layer just cut above it, never the merged one
		case e.branch != "" && e.branch != d.headRef && (!atLanded || e.sha == d.Head):
			if !gitAncestorOfAny(e.path, landed) {
				continue
			}
			reason = "it sits on an upper layer of the stack"
		case e.branch != d.headRef && !atLanded:
			continue
		default:
			merged := ""
			if atLanded {
				merged = e.sha
			}
			reason = treeStay(e, main, selves, merged)
			if !atLanded {
				reason = strings.TrimSuffix("it is not at the landed head, "+reason, ", ")
			}
		}
		if reason != "" {
			notes = append(notes, home(e.path)+" stays: "+reason+"; x lane landed <ticket> --pr "+d.PR+" --apply takes it once clean")
			continue
		}
		if err := removeTree(main, e.path); err != nil {
			notes = append(notes, "⚠ "+home(e.path)+" stays: "+err.Error())
			continue
		}
		if _, err := hooksHome(main, e.path); err != nil {
			notes = append(notes, "⚠ "+home(e.path)+" decamped, then "+err.Error())
			continue
		}
		notes = append(notes, home(e.path)+" decamped")
	}
	if d.Merged != "" {
		if note := laneBranchNote(asDima, main, d.Repo, d.headRef, d.Head); note != "" {
			notes = append(notes, note)
		}
	}
	return notes
}

func gitAncestorOfAny(tree string, shas []string) bool {
	return slices.ContainsFunc(shas, func(sha string) bool {
		return ok(gitIn(tree, "merge-base", "--is-ancestor", sha, "HEAD"))
	})
}
