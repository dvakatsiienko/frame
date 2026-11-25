package main

import (
	"cmp"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

func landedLines(repo string, plan *landedPlan, issue landedRead, issueErr error) (lines []landedLine, err error) {
	id := plan.id
	main := mainCheckout(repo)
	plan.main = main
	// the spec and the review log live in frame; the pr and the trees in the lane's repo (bytes, say)
	frame := mainCheckout(frameRoot())

	merged, err := mergedLine(repo, plan, issue)
	if err != nil {
		return nil, err
	}
	spec, paths := specLine(frame, plan)
	lines = append(lines, merged.line, spec)
	if closing, open, has := closingLine(frame, id); has {
		lines = append(lines, closing)
		plan.openClosing = open
	}
	lines = append(lines, roundsLine(frame, id))
	lines = append(lines, treesLine(repo, plan, merged.laneRefs))
	lines = append(lines, mergedBranchesLine(main, id, merged.headRef, plan))
	if branch, stands := branchLine(plan, merged); stands {
		lines = append(lines, branch)
	}
	look, wish := lookAndWishLines(id, issue, issueErr, merged.line.ok)
	lines = append(lines, look, wish)
	if line := wishCoverLine(frame, paths, id, issue, issueErr); line != nil {
		lines = append(lines, *line)
	}
	if line := habitsLine(issue.Description, id); issueErr == nil && line != nil {
		lines = append(lines, *line)
	}
	if merged.line.ok {
		if freed := freedTickets(issue, id); len(freed) > 0 {
			lines = append(lines, landedLine{name: "freed", ok: true, detail: strings.Join(freed, ", ")})
		}
	}
	if plan.pr != "" {
		if line := warnOnlyLine(repo, merged.headSha, merged.mergedHead != ""); line != nil {
			lines = append(lines, *line)
		}
	} else if merged.line.ok {
		if line := quickWarnOnlyLine(repo, merged.commits); line != nil {
			lines = append(lines, *line)
		}
	}
	verbs, nameless := newVerbsOf(issue.Description)
	for _, verb := range verbs {
		lines = append(lines, wiredLine(verb, issue))
	}
	for _, name := range nameless {
		lines = append(lines, landedLine{name: "wired", detail: name + " names no x verb", fix: "fix that new verb: line in " + id + "'s ⚖️ worth it"})
	}
	return lines, nil
}

// the merged line and what it read on the way
type mergedRead struct {
	laneRefs
	line   landedLine
	ghRepo string
}

func mergedLine(repo string, plan *landedPlan, issue landedRead) (mergedRead, error) {
	id, pr := plan.id, plan.pr
	merged := mergedRead{pr: pr, line: landedLine{name: "merged"}}
	line := &merged.line
	if pr != "" {
		// --repo here is the checkout's path, so the github slug comes from its origin
		merged.ghRepo = originSlugIn(repo)
		if merged.ghRepo == "" {
			return merged, usageFail(home(repo)+" has no github origin to read #"+pr+" from", "git -C "+home(repo)+" remote -v")
		}
		var read struct {
			Merged bool   `json:"merged"`
			Body   string `json:"body"`
			Head   struct {
				Ref string `json:"ref"`
				Sha string `json:"sha"`
			} `json:"head"`
		}
		if _, ferr := ghFetch(asCodie, githubBase()+"/repos/"+merged.ghRepo+"/pulls/"+pr, &read); ferr != nil {
			return merged, ferr
		}
		// another lane's pr would green «merged» and hand its trees to this ticket
		if !slices.Contains(ticketsOfPr(read.Head.Ref, read.Body), id) {
			return merged, &Fail{Refused: true, Msg: "#" + pr + " is not " + id + "'s pr: its head is " + read.Head.Ref + " and its body holds no «- ticket: " + id + "» line", Next: "x lane landed " + id + " --pr <" + id + "'s pr>"}
		}
		merged.headRef, merged.headSha = read.Head.Ref, read.Head.Sha
		if read.Merged {
			merged.mergedHead = read.Head.Sha
		}
		line.ok, line.detail, line.fix = read.Merged, "#"+pr+" merged", "x lane merge-auto "+pr+" --apply"
		if !read.Merged {
			line.detail = "#" + pr + " is not merged"
		}
	} else if base := dispatchOf(issue.Description).base; base != "" {
		merged.commits, *line = quickMerged(repo, id, base, issue)
		if !line.ok && dispatchOf(issue.Description).hasSixthSense {
			// a verify tree sits at a commit of the open range: named, so it never reads as forgotten
			merged.underReview = true
			if ranged, _ := gitIn(repo, "log", "--format=%h %s", base+"..origin/main"); ranged.ok && ranged.out != "" {
				merged.commits = strings.Split(ranged.out, "\n")
			}
		}
	} else {
		merged.commits = ticketCommits(repo, id)
		line.ok, line.detail, line.fix = len(merged.commits) > 0, plural(len(merged.commits), "commit")+" for "+id+" on origin/main", "land "+id+"'s commits on main, or pass --pr <n>"
	}
	return merged, nil
}

// the line and the spec files it read
func specLine(frame string, plan *landedPlan) (landedLine, []string) {
	id, main := plan.id, plan.main
	spec := landedLine{name: "spec", fix: "x lane landed " + id + " --apply"}
	// the main checkout's spec: a lane tree's own .scratch copy would archive inside a tree about to go
	// a lane in another repo keeps its spec in that repo's .scratch (bytes): read after frame's
	paths, _ := laneSpecSection(frame, id)
	if len(paths) == 0 && main != frame {
		paths, _ = laneSpecSection(main, id)
	}
	if len(paths) > 0 {
		dir := filepath.Dir(paths[0])
		if waiting := unmergedChunks(main, paths[0], id); len(waiting) > 0 {
			spec.detail = home(dir) + " waits on " + strings.Join(waiting, ", ") + ", no commit on " + home(main) + "'s origin/main: a spec moves when its every chunk merged"
			spec.fix = "git -C " + home(main) + " fetch origin main, or land " + strings.Join(waiting, ", ") + "; then x lane landed " + id + " --apply"
		} else {
			plan.specDir, plan.archive = dir, filepath.Join(filepath.Dir(dir), archived, filepath.Base(dir))
			spec.detail = home(dir) + " is not archived"
		}
	} else if found := cmp.Or(archivedSpec(frame, id), archivedSpec(main, id)); found != "" {
		spec.ok, spec.detail = true, home(filepath.Dir(found))
	} else {
		spec.detail, spec.fix = "no lane spec holds § "+id, "find the lane's .scratch/<feature>/spec.md"
	}
	return spec, paths
}

func roundsLine(frame, id string) landedLine {
	rounds := landedLine{name: "review-rounds", detail: "no line names " + id + " in docs/test-drive/review-rounds.md",
		fix: "add the lane's graded lines to docs/test-drive/review-rounds.md"}
	if raw, rerr := os.ReadFile(filepath.Join(frame, "docs/test-drive/review-rounds.md")); rerr == nil && regexp.MustCompile(`\b`+regexp.QuoteMeta(id)+`\b`).Match(raw) {
		rounds.ok, rounds.detail = true, "a line names "+id
	}
	return rounds
}

// sets plan.clean, which mergedBranchesLine reads, and plan.unlocks
func treesLine(repo string, plan *landedPlan, refs laneRefs) landedLine {
	id, main := plan.id, plan.main
	trees := landedLine{name: "trees", ok: true, detail: "no lane tree under .claude/worktrees/"}
	plan.clean, plan.unlocks = nil, nil
	var notes, infos []string
	found, terr := laneTrees(main, repo, id, refs)
	for _, tree := range found {
		switch {
		case tree.reason == "" && tree.staleLock != "":
			plan.clean, plan.unlocks = append(plan.clean, tree.path), append(plan.unlocks, tree.path)
			notes = append(notes, home(tree.path)+" is clean, its stale lock ("+tree.staleLock+") unlocked and the tree decamped on --apply")
			continue
		case tree.reason == "":
			plan.clean = append(plan.clean, tree.path)
			notes = append(notes, home(tree.path)+" is clean, decamped on --apply")
			continue
		}
		if tree.other {
			infos = append(infos, home(tree.path)+" stays: "+tree.reason)
			continue
		}
		notes = append(notes, home(tree.path)+" stays: "+tree.reason)
		if trees.fix == "" {
			trees.fix = "settle " + home(tree.path) + " (" + tree.reason + "), then x lane decamp " + home(tree.path) + " --apply"
		}
	}
	switch {
	case terr != nil:
		trees.ok, trees.detail, trees.fix = false, "the worktree list did not read: "+terr.Error(), "git -C "+home(main)+" worktree list"
	case len(plan.clean) > 0:
		trees.ok, trees.detail, trees.fix = false, strings.Join(notes, "; "), "x lane landed "+id+" --apply"
	case len(notes) > 0:
		trees.ok, trees.detail = false, strings.Join(notes, "; ")
	}
	if len(infos) > 0 {
		if trees.ok {
			trees.detail = strings.Join(infos, "; ")
		} else {
			trees.detail += "; " + strings.Join(infos, "; ")
		}
	}
	return trees
}

func branchLine(plan *landedPlan, merged mergedRead) (line landedLine, stands bool) {
	plan.mergedRef = ""
	if merged.mergedHead == "" || !isLaneBranch(merged.headRef) || !branchStands(plan.main, merged.headRef) {
		return landedLine{}, false
	}
	plan.mergedRef, plan.mergedHead, plan.ghRepo = merged.headRef, merged.mergedHead, merged.ghRepo
	branch := landedLine{name: "branch", detail: merged.headRef + " stands", fix: "x lane landed " + plan.id + " --pr " + plan.pr + " --apply"}
	if why, _ := laneBranchWhy(asCodie, plan.main, merged.ghRepo, merged.headRef, merged.mergedHead); why != "" {
		branch.detail += ": " + why
		branch.fix = "settle " + merged.headRef + " (" + why + "), then " + branch.fix
	}
	return branch, true
}

func lookAndWishLines(id string, issue landedRead, issueErr error, isMerged bool) (look, wish landedLine) {
	look = landedLine{name: "look", detail: "no comment on " + id + " carries a look card", fix: "post the done report, its look card first: x linear comment " + id + " --body-file <file>"}
	wish = landedLine{name: "wish", ok: true, detail: "no W-lines in the body"}
	switch {
	case issueErr != nil:
		look.detail, look.fix = "linear did not read: "+issueErr.Error(), "x linear read "+id
		wish.ok, wish.detail, wish.fix = false, look.detail, look.fix
	default:
		hasCard := issue.hasLookCard()
		look.ok = lookSentOf.MatchString(issue.Description)
		switch {
		case look.ok:
			look.detail = "the body holds a " + lookSentLine + "line"
		case hasCard:
			look.detail = "a comment carries the look card, dima has not had it"
			look.fix = "send the card with SendUserFile, then append «" + lookSentLine + "<date>» to " + id + "'s body"
		}
		if n := len(wishItem.FindAllString(issue.Description, -1)); n > 0 {
			wish.detail = fmt.Sprintf("%s, its done test not read yet: x linear read %s", plural(n, "W-line"), id)
			// a look card's «proven» line is the done test's run; a chunk with it merged closes now
			if hasCard && isMerged {
				wish.detail = fmt.Sprintf("%s, close in this turn: x linear read %s", plural(n, "W-line"), id)
			}
		}
	}
	return look, wish
}
