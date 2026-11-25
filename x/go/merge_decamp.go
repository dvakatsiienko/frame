package main

import (
	"path/filepath"
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

func decampTree(main, path string) string {
	if err := removeTree(main, path); err != nil {
		return "⚠ " + home(path) + " stays: " + err.Error()
	}
	if _, err := hooksHome(main, path); err != nil {
		return "⚠ " + home(path) + " decamped, then " + err.Error()
	}
	return home(path) + " decamped"
}
