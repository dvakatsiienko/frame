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
	id, pr := plan.id, plan.pr
	main := mainCheckout(repo)
	plan.main = main
	// the spec and the review log live in frame; the pr and the trees in the lane's repo (bytes, say)
	frame := mainCheckout(frameRoot())

	merged := landedLine{name: "merged"}
	var headRef, headSha, mergedHead, ghRepo string
	var commits []string
	underReview := false
	if pr != "" {
		// --repo here is the checkout's path, so the github slug comes from its origin
		ghRepo = originSlugIn(repo)
		if ghRepo == "" {
			return nil, usageFail(home(repo)+" has no github origin to read #"+pr+" from", "git -C "+home(repo)+" remote -v")
		}
		var read struct {
			Merged bool   `json:"merged"`
			Body   string `json:"body"`
			Head   struct {
				Ref string `json:"ref"`
				Sha string `json:"sha"`
			} `json:"head"`
		}
		if _, ferr := ghFetch(asCodie, githubBase()+"/repos/"+ghRepo+"/pulls/"+pr, &read); ferr != nil {
			return nil, ferr
		}
		// another lane's pr would green «merged» and hand its trees to this ticket
		if !slices.Contains(ticketsOfPr(read.Head.Ref, read.Body), id) {
			return nil, &Fail{Refused: true, Msg: "#" + pr + " is not " + id + "'s pr: its head is " + read.Head.Ref + " and its body holds no «- ticket: " + id + "» line", Next: "x lane landed " + id + " --pr <" + id + "'s pr>"}
		}
		headRef, headSha = read.Head.Ref, read.Head.Sha
		if read.Merged {
			mergedHead = read.Head.Sha
		}
		merged.ok, merged.detail, merged.fix = read.Merged, "#"+pr+" merged", "x lane merge-auto "+pr+" --apply"
		if !read.Merged {
			merged.detail = "#" + pr + " is not merged"
		}
	} else if base := dispatchOf(issue.Description).base; base != "" {
		commits, merged = quickMerged(repo, id, base, issue)
		if !merged.ok && dispatchOf(issue.Description).hasSixthSense {
			// a verify tree sits at a commit of the open range: named, so it never reads as forgotten
			underReview = true
			if ranged, _ := gitIn(repo, "log", "--format=%h %s", base+"..origin/main"); ranged.ok && ranged.out != "" {
				commits = strings.Split(ranged.out, "\n")
			}
		}
	} else {
		commits = ticketCommits(repo, id)
		merged.ok, merged.detail, merged.fix = len(commits) > 0, plural(len(commits), "commit")+" for "+id+" on origin/main", "land "+id+"'s commits on main, or pass --pr <n>"
	}
	lines = append(lines, merged)

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
	lines = append(lines, spec)
	if closing, open, has := closingLine(frame, id); has {
		lines = append(lines, closing)
		plan.openClosing = open
	}

	rounds := landedLine{name: "review-rounds", detail: "no line names " + id + " in docs/test-drive/review-rounds.md",
		fix: "add the lane's graded lines to docs/test-drive/review-rounds.md"}
	if raw, rerr := os.ReadFile(filepath.Join(frame, "docs/test-drive/review-rounds.md")); rerr == nil && regexp.MustCompile(`\b`+regexp.QuoteMeta(id)+`\b`).Match(raw) {
		rounds.ok, rounds.detail = true, "a line names "+id
	}
	lines = append(lines, rounds)

	trees := landedLine{name: "trees", ok: true, detail: "no lane tree under .claude/worktrees/"}
	plan.clean, plan.unlocks = nil, nil
	var notes, infos []string
	found, terr := laneTrees(main, repo, id, laneRefs{pr, headRef, headSha, mergedHead, commits, underReview})
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
	lines = append(lines, trees)
	lines = append(lines, mergedBranchesLine(main, id, headRef, plan))

	plan.mergedRef = ""
	if mergedHead != "" && isLaneBranch(headRef) && branchStands(main, headRef) {
		plan.mergedRef, plan.mergedHead, plan.ghRepo = headRef, mergedHead, ghRepo
		branch := landedLine{name: "branch", detail: headRef + " stands", fix: "x lane landed " + id + " --pr " + pr + " --apply"}
		if why, _ := laneBranchWhy(asCodie, main, ghRepo, headRef, mergedHead); why != "" {
			branch.detail += ": " + why
			branch.fix = "settle " + headRef + " (" + why + "), then " + branch.fix
		}
		lines = append(lines, branch)
	}

	look := landedLine{name: "look", detail: "no comment on " + id + " carries a look card", fix: "post the done report, its look card first: x linear comment " + id + " --body-file <file>"}
	wish := landedLine{name: "wish", ok: true, detail: "no W-lines in the body"}
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
			if hasCard && merged.ok {
				wish.detail = fmt.Sprintf("%s, close in this turn: x linear read %s", plural(n, "W-line"), id)
			}
		}
	}
	lines = append(lines, look, wish)
	if line := wishCoverLine(frame, paths, id, issue, issueErr); line != nil {
		lines = append(lines, *line)
	}
	if line := habitsLine(issue.Description, id); issueErr == nil && line != nil {
		lines = append(lines, *line)
	}
	if merged.ok {
		if freed := freedTickets(issue, id); len(freed) > 0 {
			lines = append(lines, landedLine{name: "freed", ok: true, detail: strings.Join(freed, ", ")})
		}
	}
	if pr != "" {
		if line := warnOnlyLine(repo, headSha, mergedHead != ""); line != nil {
			lines = append(lines, *line)
		}
	} else if merged.ok {
		if line := quickWarnOnlyLine(repo, commits); line != nil {
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
