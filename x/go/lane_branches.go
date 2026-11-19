package main

import (
	"fmt"
	"net/url"
	"slices"
	"strings"
)

// the branch families a lane leaves behind; a squash merge leaves each with no ancestor on main (FRM-660)
var laneBranchRefs = []string{"refs/heads/worktree-*", "refs/heads/codie/", "refs/heads/strays-*", "refs/heads/keep/"}

// the shas a branch was judged at: its delete leases on them, so a push since the read survives
type branchTips struct{ local, remote string }

// branchStay's rule with the trees freed names (nil: none) read as gone: a tree landed decamps before the drop
func branchStayUnless(main, ref, uncarried string, carried func(sha string) bool, freed func(tree string) bool) (string, branchTips) {
	var tips branchTips
	listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return "the worktree list did not read", tips
	}
	for _, e := range worktreesOf(listed) {
		if (e.branch == ref || (e.detached && stoppedOn(e.path) == ref)) && (freed == nil || !freed(e.path)) {
			return "a tree holds it, " + home(e.path), tips
		}
	}
	if local, _ := gitIn(main, "rev-parse", "--verify", "-q", "refs/heads/"+ref); local.ok {
		if !carried(local.out) {
			return "the local branch holds a commit " + uncarried, tips
		}
		tips.local = local.out
	}
	sha, err := remoteBranch(main, ref)
	if err != nil {
		return "origin did not read", tips
	}
	if sha != "" {
		_, _ = gitIn(main, "fetch", "-q", "origin", ref)
		if !carried(sha) {
			return "origin holds a commit " + uncarried, tips
		}
		tips.remote = sha
	}
	return "", tips
}

// an open pr based on the branch would close with it; a read that fails keeps the branch too
func openPrOnBase(as, slug, ref string) string {
	var open []struct {
		Number int `json:"number"`
	}
	if _, err := ghFetch(as, githubBase()+"/repos/"+slug+"/pulls?state=open&base="+url.QueryEscape(ref), &open); err != nil {
		return "the open prs based on it did not read"
	}
	if len(open) > 0 {
		return fmt.Sprintf("#%d is based on it", open[0].Number)
	}
	return ""
}

// main carries a commit when git cherry finds its patch there, or merging it would change nothing (onMain)
func mainCarries(main string) func(sha string) bool {
	return func(sha string) bool {
		// git cherry skips merge commits, so a branch holding one is read by onMain alone
		merges, _ := gitIn(main, "rev-list", "--merges", "origin/main.."+sha)
		cherry, _ := gitIn(main, "cherry", "origin/main", sha)
		if merges.ok && merges.out == "" && cherry.ok && !strings.Contains("\n"+cherry.out, "\n+") {
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

// why a lane-family branch stays, "" when it may go: main carries every commit, or its merged pr does and no open pr
// is based on it; a tree freed names does not hold it
func mergedBranchStay(as, main, ref string, freed func(tree string) bool) (string, branchTips) {
	why, tips := branchStayUnless(main, ref, "main lacks", mainCarries(main), freed)
	if !strings.HasSuffix(why, "a commit main lacks") {
		return why, tips
	}
	tip, prWhy := mergedPrTip(as, main, ref)
	if tip == "" {
		return why + ", and " + prWhy, tips
	}
	if open := openPrOnBase(as, originSlugIn(main), ref); open != "" {
		return open, tips
	}
	return branchStayUnless(main, ref, "its merged pr lacks", func(sha string) bool {
		return sha == tip || ok(gitIn(main, "merge-base", "--is-ancestor", sha, tip))
	}, freed)
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
	freed := func(tree string) bool { return slices.Contains(plan.clean, tree) }
	var going, staying []string
	for _, ref := range refs {
		if ref == headRef {
			continue
		}
		why, tips := mergedBranchStay(asCodie, main, ref, freed)
		if why != "" {
			staying = append(staying, ref+" stays: "+why)
			continue
		}
		plan.worktreeDrops = append(plan.worktreeDrops, worktreeDrop{ref, tips})
		going = append(going, ref)
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
