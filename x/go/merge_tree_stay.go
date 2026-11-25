package main

import (
	"slices"
	"strings"
)

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

func gitAncestorOfAny(tree string, shas []string) bool {
	return slices.ContainsFunc(shas, func(sha string) bool {
		return ok(gitIn(tree, "merge-base", "--is-ancestor", sha, "HEAD"))
	})
}
