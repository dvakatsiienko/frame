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
		reason, judged := whyMergedTreeStays(d, e, main, selves, landed)
		if !judged {
			continue
		}
		if reason != "" {
			notes = append(notes, home(e.path)+" stays: "+reason+"; x lane landed <ticket> --pr "+d.PR+" --apply takes it once clean")
			continue
		}
		notes = append(notes, decampTree(main, e.path))
	}
	if d.Merged != "" {
		if note := laneBranchNote(asDima, main, d.Repo, d.headRef, d.Head); note != "" {
			notes = append(notes, note)
		}
	}
	return notes
}

// not judged: the tree is none of the merge's own. a judged tree with no reason goes
func whyMergedTreeStays(d *mergeDecision, e worktreeEntry, main string, selves, landed []string) (reason string, judged bool) {
	atLanded := slices.Contains(landed, e.sha)
	switch {
	case d.Merged == "" && (atLanded || e.branch == d.headRef):
		return "the merge is still enqueued", true
	// a branch still at the head that lands is a layer just cut above it, never the merged one
	case e.branch != "" && e.branch != d.headRef && (!atLanded || e.sha == d.Head):
		return "it sits on an upper layer of the stack", gitAncestorOfAny(e.path, landed)
	case e.branch != d.headRef && !atLanded:
		return "", false
	}
	if !atLanded {
		return strings.TrimSuffix("it is not at the landed head, "+treeStay(e, main, selves, ""), ", "), true
	}
	return treeStay(e, main, selves, e.sha), true
}

func decampTree(main, path string) string {
	if err := removeTree(main, path); err != nil {
		return "⚠ " + home(path) + " stays: " + err.Error()
	}
	if _, err := hooksHome(main, path); err != nil {
		return "⚠ " + home(path) + " decamped, then " + err.Error()
	}
	return home(path) + " decamped"
}

func gitAncestorOfAny(tree string, shas []string) bool {
	return slices.ContainsFunc(shas, func(sha string) bool {
		return ok(gitIn(tree, "merge-base", "--is-ancestor", sha, "HEAD"))
	})
}
