package main

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// one after-merge chore: met, or red with the command or edit that meets it
type landedLine struct {
	name, detail, fix string
	ok                bool
}

func (l landedLine) String() string {
	if l.ok {
		return "✅ " + l.name + " — " + l.detail
	}
	return "🔴 " + l.name + " — " + l.detail + " · fix: " + l.fix
}

type landedPlan struct {
	Lines   []string `json:"lines"`
	lines   []landedLine
	id, pr  string
	specDir string
	archive string
	main    string
	clean   []string
	// the clean trees a stale lock alone held, unlocked before their decamp
	unlocks []string
	// the lane plan whose closing slice for this ticket is still open, ticked on --apply
	openClosing string
	// the merged pr's branch, when one stands; --apply takes it
	mergedRef, mergedHead, ghRepo string
	// the merged lane-family branches, each with the tips its delete leases on
	worktreeDrops []worktreeDrop
}

type worktreeDrop struct {
	ref  string
	tips branchTips
}

// landedPlanOf reads every after-merge chore of a ticket's lane; nothing here writes
func landedPlanOf(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if !ticketShape.MatchString(id) {
		return nil, usageFail(id+" is not a ticket id", "x lane landed <FRM-N|BYT-N> [--pr <n>]")
	}
	r.Open(id)
	var issue landedRead
	var issueErr error
	if err := r.Step("ticket", "its body and comments, and the repo its repo: line names", func() (string, error) {
		issue, issueErr = landedIssue(flags, id)
		// --repo wins, then the ticket's repo: line, then the cwd: a bytes lane landed from frame reads bytes
		if flagString(flags, "repo") != "" || issueErr != nil {
			return "", nil
		}
		path, err := ticketRepo(id, issue.Description)
		if path != "" {
			flags["repo"] = path
		}
		return home(path), err
	}); err != nil {
		return nil, err
	}
	repo, err := repoRoot(flags, "x lane landed "+id+" --repo <path>")
	if err != nil {
		return nil, err
	}
	plan := landedPlan{id: id, pr: flagString(flags, "pr")}
	var lines []landedLine
	if err := r.Step("read", "the pr, the spec, the review line, the trees, the wish", func() (string, error) {
		lines, err = landedLines(repo, &plan, issue, issueErr)
		return plural(len(lines), "line"), err
	}); err != nil {
		return nil, err
	}
	plan.lines = lines
	for _, line := range lines {
		plan.Lines = append(plan.Lines, line.String())
	}
	return plan, nil
}

// the red lines `x lane landed id` would print, read silently; none for a ticket no lane spec holds, or a read that fails
func landedReds(r *Run, id string) []string {
	planned, err := landedPlanOf(&Run{verb: r.verb}, []string{id}, Flags{})
	if err != nil {
		return nil
	}
	var reds []string
	for _, line := range planned.(landedPlan).lines {
		if line.name == "spec" && strings.HasPrefix(line.detail, "no lane spec holds") {
			return nil
		}
		if !line.ok {
			reds = append(reds, line.String())
		}
	}
	return reds
}

func askLanded(plan any) string {
	return "archive " + plan.(landedPlan).id + "'s lane spec and decamp its clean trees?"
}

// laneLanded moves the spec dir into the archive and decamps the clean trees, then reads the list again
func laneLanded(r *Run, args []string, flags Flags, planned any) (any, error) {
	plan := planned.(landedPlan)
	if merged := plan.lines[0]; !merged.ok {
		return nil, &Fail{Refused: true, Msg: "the lane has not landed (" + merged.detail + "): --apply archives and decamps only after the merge", Next: merged.fix}
	}
	// a lost ask is the worst close: nothing below runs while a W-line sits in no slice
	for _, line := range plan.lines {
		if line.name == "wish-cover" && !line.ok {
			return nil, &Fail{Refused: true, Msg: plan.id + " holds W-lines no slice cites, so nothing was closed: " + line.detail, Next: line.fix}
		}
	}
	if plan.openClosing != "" {
		if err := r.Step("closing", plan.id+"'s closing slice in "+home(plan.openClosing), func() (string, error) {
			return "ticked", tickClosing(plan.openClosing, plan.id)
		}); err != nil {
			return nil, err
		}
	}
	// the unit follows the lane's life: a chunk that merged leaves its thread's name with no ticket until the next dispatch
	_ = r.Step("thread", "the thread record's ticket "+plan.id, func() (string, error) { return clearThreadTicket(plan.id) })
	if plan.specDir != "" {
		if err := r.Step("archive", "the spec dir into .scratch/"+archived, func() (string, error) {
			if exists(plan.archive) {
				return "", &Fail{Refused: true, Msg: home(plan.archive) + " already exists: two lanes share the feature name", Next: "mv " + home(plan.specDir) + " " + home(plan.archive) + "-" + strings.ToLower(plan.id)}
			}
			if err := os.MkdirAll(filepath.Dir(plan.archive), 0o755); err != nil {
				return "", err
			}
			return home(plan.archive), os.Rename(plan.specDir, plan.archive)
		}); err != nil {
			return nil, err
		}
	}
	for _, tree := range plan.clean {
		if slices.Contains(plan.unlocks, tree) {
			if err := r.Step("unlock", home(tree)+"'s stale lock", func() (string, error) {
				_, err := mustGitIn(plan.main, "worktree unlock", "worktree", "unlock", tree)
				return "unlocked", err
			}); err != nil {
				return nil, err
			}
		}
		if err := r.Step("decamp", home(tree), func() (string, error) {
			if err := removeTree(plan.main, tree); err != nil {
				return "", err
			}
			return hooksHome(plan.main, tree)
		}); err != nil {
			return nil, err
		}
	}
	dropped := ""
	if plan.mergedRef != "" {
		_ = r.Step("branch", plan.mergedRef, func() (string, error) {
			note := laneBranchNote(asCodie, plan.main, plan.ghRepo, plan.mergedRef, plan.mergedHead)
			if note == plan.mergedRef+" gone" {
				dropped = note
			}
			return note, nil
		})
	}
	var takenBranches []string
	for _, drop := range plan.worktreeDrops {
		_ = r.Step("branch", drop.ref, func() (string, error) {
			note := branchDrop(plan.main, drop.ref, drop.tips)
			takenBranches = append(takenBranches, note)
			return note, nil
		})
	}
	again, err := landedPlanOf(r, args, flags)
	if err != nil {
		return nil, err
	}
	after := again.(landedPlan)
	for _, note := range takenBranches {
		after.Lines = append(after.Lines, landedLine{name: "branch", ok: !strings.HasPrefix(note, "⚠"), detail: note, fix: "x lane decamp --list-stale"}.String())
	}
	// a branch that stays is the re-read's own red line; a gone one leaves no trace there, so it is named here
	if dropped != "" {
		after.Lines = append(after.Lines, landedLine{name: "branch", ok: true, detail: dropped}.String())
	}
	var red []landedLine
	for _, line := range after.lines {
		if !line.ok {
			red = append(red, line)
		}
	}
	if len(red) > 0 {
		return nil, &Fail{Msg: plural(len(red), "after-merge chore") + " left\n" + strings.Join(after.Lines, "\n"), Next: red[0].fix}
	}
	r.Done("landed: every after-merge line is met", "")
	return ordered{{"lines", after.Lines}}, nil
}
