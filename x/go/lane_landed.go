package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var wishItem = regexp.MustCompile(`(?m)^\s*[*-]\s+W\d+\b`)

const archived = "_archive"

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
}

// landedPlanOf reads every after-merge chore of a ticket's lane; nothing here writes
func landedPlanOf(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if !ticketShape.MatchString(id) {
		return nil, usageFail(id+" is not a ticket id", "x lane landed <FRM-N|BYT-N> [--pr <n>]")
	}
	repo, err := repoRoot(flags, "x lane landed "+id+" --repo <path>")
	if err != nil {
		return nil, err
	}
	r.Open(id)
	plan := landedPlan{id: id, pr: flagString(flags, "pr")}
	var lines []landedLine
	if err := r.Step("read", "the pr, the spec, the review line, the retros, the trees, the wish", func() (string, error) {
		lines, plan.specDir, plan.archive, err = landedLines(repo, id, plan.pr, flags)
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

func landedLines(repo, id, pr string, flags Flags) (lines []landedLine, specDir, archive string, err error) {
	main := repo
	if common, linked, werr := worktreeOf(repo); werr == nil && linked {
		main = filepath.Dir(common)
	}

	merged := landedLine{name: "merged"}
	if pr != "" {
		ghRepo, rerr := repoOf(flags)
		if rerr != nil {
			return nil, "", "", rerr
		}
		var read struct {
			Merged bool `json:"merged"`
		}
		if _, ferr := ghFetch(asCodie, githubBase()+"/repos/"+ghRepo+"/pulls/"+pr, &read); ferr != nil {
			return nil, "", "", ferr
		}
		merged.ok, merged.detail, merged.fix = read.Merged, "#"+pr+" merged", "x lane merge-auto "+pr+" --apply"
		if !read.Merged {
			merged.detail = "#" + pr + " is not merged"
		}
	} else {
		commits := ticketCommits(repo, id)
		merged.ok, merged.detail, merged.fix = len(commits) > 0, plural(len(commits), "commit")+" for "+id+" on origin/main", "land "+id+"'s commits on main, or pass --pr <n>"
	}
	lines = append(lines, merged)

	spec := landedLine{name: "spec", fix: "x lane landed " + id + " --apply"}
	feature := ""
	if paths, _ := laneSpecSection(repo, id); len(paths) > 0 {
		specDir = filepath.Dir(paths[0])
		feature = filepath.Base(specDir)
		archive = filepath.Join(filepath.Dir(specDir), archived, feature)
		spec.detail = home(specDir) + " is not archived"
	} else if found := archivedSpec(main, id); found != "" {
		feature = filepath.Base(filepath.Dir(found))
		spec.ok, spec.detail = true, home(filepath.Dir(found))
	} else {
		spec.detail, spec.fix = "no lane spec holds § "+id, "find the lane's .scratch/<feature>/spec.md"
	}
	lines = append(lines, spec)

	rounds := landedLine{name: "review-rounds", detail: "no line names " + id + " in docs/test-drive/review-rounds.md",
		fix: "add the lane's graded lines to docs/test-drive/review-rounds.md"}
	if raw, rerr := os.ReadFile(filepath.Join(main, "docs/test-drive/review-rounds.md")); rerr == nil && regexp.MustCompile(`\b`+regexp.QuoteMeta(id)+`\b`).Match(raw) {
		rounds.ok, rounds.detail = true, "a line names "+id
	}
	lines = append(lines, rounds)

	retros := landedLine{name: "retros"}
	if feature == "" {
		retros.detail, retros.fix = "no feature to look under", "find the lane's spec first"
	} else {
		dir := filepath.Join(stateDir(), "lanes", feature)
		var missing []string
		for _, role := range []string{"codie", "sixth-sense"} {
			if found, _ := filepath.Glob(filepath.Join(dir, "*-"+role+"-retro.md")); len(found) == 0 {
				missing = append(missing, role)
			}
		}
		retros.ok, retros.detail = len(missing) == 0, "both under "+home(dir)
		if !retros.ok {
			retros.detail, retros.fix = "no "+strings.Join(missing, ", ")+" retro under "+home(dir), "ask the member for its retro at "+home(dir)+"/<date>-<ticket>-<role>-retro.md"
		}
	}
	lines = append(lines, retros)

	wish := landedLine{name: "wish", ok: true, detail: "no W-lines in the body"}
	if actor, aerr := actorOf(Flags{}); aerr == nil {
		if issue, berr := fetchBody(actor, id); berr == nil && issue.Description != nil {
			if n := len(wishItem.FindAllString(*issue.Description, -1)); n > 0 {
				wish.detail = fmt.Sprintf("%s for the close proposal: x linear read %s", plural(n, "W-line"), id)
			}
		}
	}
	lines = append(lines, wish)
	return lines, specDir, archive, nil
}

// the archived spec that holds § id, beside the main checkout's other specs
func archivedSpec(main, id string) string {
	specs, _ := filepath.Glob(filepath.Join(main, ".scratch", archived, "*", "spec.md"))
	head := regexp.MustCompile(`(?m)^## ` + regexp.QuoteMeta(id) + `\b`)
	for _, spec := range specs {
		if raw, err := os.ReadFile(spec); err == nil && head.Match(raw) {
			return spec
		}
	}
	return ""
}

func askLanded(plan any) string {
	return "archive " + plan.(landedPlan).id + "'s lane spec?"
}

// laneLanded moves the spec dir into the archive, the one write, then reads the list again
func laneLanded(r *Run, args []string, flags Flags, planned any) (any, error) {
	plan := planned.(landedPlan)
	if plan.specDir != "" {
		if err := r.Step("archive", "the spec dir into .scratch/"+archived, func() (string, error) {
			if exists(plan.archive) {
				return "", &Fail{Refused: true, Msg: home(plan.archive) + " already exists: two lanes share the feature name", Next: "rename one of them by hand"}
			}
			if err := os.MkdirAll(filepath.Dir(plan.archive), 0o755); err != nil {
				return "", err
			}
			return home(plan.archive), os.Rename(plan.specDir, plan.archive)
		}); err != nil {
			return nil, err
		}
	}
	again, err := landedPlanOf(r, args, flags)
	if err != nil {
		return nil, err
	}
	after := again.(landedPlan)
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
