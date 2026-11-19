package main

import (
	"slices"
	"strings"
)

// the branch families a lane leaves behind; a squash merge leaves each with no ancestor on main (FRM-660)
var laneBranchRefs = []string{"refs/heads/worktree-*", "refs/heads/codie/", "refs/heads/strays-*", "refs/heads/keep/"}

// main carries a commit when git cherry finds its patch there, or merging it would change nothing (onMain)
func mainCarries(main string) func(sha string) bool {
	return func(sha string) bool {
		cherry, _ := gitIn(main, "cherry", "origin/main", sha)
		if cherry.ok && !strings.Contains("\n"+cherry.out, "\n+") {
			return true
		}
		return onMain(main, sha)
	}
}

type prOfSha struct {
	MergedAt *string `json:"merged_at"`
	Head     struct {
		Ref string `json:"ref"`
	} `json:"head"`
}

// the branch's tip when a merged pr has the branch as its head, else "" and why: github names the prs holding a sha
func mergedPrTip(as, main, ref string) (string, string) {
	tip, err := remoteBranch(main, ref)
	if err != nil {
		return "", "origin did not read"
	}
	if tip == "" {
		if local, _ := gitIn(main, "rev-parse", "--verify", "-q", "refs/heads/"+ref); local.ok {
			tip = local.out
		}
	}
	slug := originSlugIn(main)
	if tip == "" || slug == "" {
		return "", "no tip or no github origin to find its pr"
	}
	var prs []prOfSha
	if _, err := ghFetch(as, githubBase()+"/repos/"+slug+"/commits/"+tip+"/pulls", &prs); err != nil {
		return "", "its prs did not read"
	}
	if slices.ContainsFunc(prs, func(pr prOfSha) bool { return pr.MergedAt != nil && pr.Head.Ref == ref }) {
		return tip, ""
	}
	return "", "no merged pr carries " + short(tip)
}

// why a lane-family branch stays, "" when it may go: main carries every commit, or its merged pr does
func mergedBranchStay(as, main, ref string) (string, branchTips) {
	why, tips := branchStay(main, ref, "main lacks", mainCarries(main))
	if !strings.HasSuffix(why, "a commit main lacks") {
		return why, tips
	}
	tip, prWhy := mergedPrTip(as, main, ref)
	if tip == "" {
		return why + ", and " + prWhy, tips
	}
	return branchStay(main, ref, "its merged pr lacks", func(sha string) bool {
		return sha == tip || ok(gitIn(main, "merge-base", "--is-ancestor", sha, tip))
	})
}

func laneFamilyBranches(main string) ([]string, error) {
	listed, err := mustGitIn(main, "for-each-ref", append([]string{"for-each-ref", "--format=%(refname:short)"}, laneBranchRefs...)...)
	return strings.Fields(listed), err
}

// the merged lane-family branches go on --apply, by the same lease, one a clean tree holds after landed decamps it; one
// main lacks stays, named, never holding the landing: it is any session's, never this lane's (FRM-553, FRM-660)
func mergedBranchesLine(main, id, headRef string, plan *landedPlan) landedLine {
	line := landedLine{name: "merged branches", ok: true, detail: "no merged lane branch"}
	plan.worktreeDrops = nil
	refs, err := laneFamilyBranches(main)
	if err != nil {
		line.detail = "the branches did not read: " + err.Error()
		return line
	}
	var going, staying []string
	for _, ref := range refs {
		if ref == headRef {
			continue
		}
		why, tips := mergedBranchStay(asCodie, main, ref)
		named := ref
		if tree, held := strings.CutPrefix(why, "a tree holds it, "); held && slices.ContainsFunc(plan.clean, func(c string) bool { return home(c) == tree }) {
			why, tips, named = "", branchTips{}, ref+" with its tree"
		}
		if why != "" {
			staying = append(staying, ref+" stays: "+why)
			continue
		}
		plan.worktreeDrops = append(plan.worktreeDrops, worktreeDrop{ref, tips})
		going = append(going, named)
	}
	switch {
	case len(going) > 0:
		line.ok, line.fix = false, "x lane landed "+id+" --apply"
		line.detail = strings.Join(append([]string{strings.Join(going, ", ") + " merged, taken on --apply"}, staying...), "; ")
	case len(staying) > 0:
		line.detail = strings.Join(staying, "; ")
	}
	return line
}

// a drop read while its tree stood holds no tips: the tree is gone by now, so the branch is read again
func dropMergedBranch(main string, drop worktreeDrop) string {
	if drop.tips == (branchTips{}) {
		why, tips := mergedBranchStay(asCodie, main, drop.ref)
		if why != "" {
			return "⚠ " + drop.ref + " stays: " + why
		}
		drop.tips = tips
	}
	return branchDrop(main, drop.ref, drop.tips)
}
