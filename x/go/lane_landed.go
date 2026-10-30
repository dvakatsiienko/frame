package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
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
	main    string
	clean   []string
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
		lines, err = landedLines(repo, &plan, flags)
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

func landedLines(repo string, plan *landedPlan, flags Flags) (lines []landedLine, err error) {
	id, pr := plan.id, plan.pr
	main := repo
	if common, linked, werr := worktreeOf(repo); werr == nil && linked {
		main = filepath.Dir(common)
	}
	plan.main = main

	merged := landedLine{name: "merged"}
	var headRef, mergedHead string
	if pr != "" {
		// --repo here is the checkout's path, so the github slug comes from its origin
		ghRepo := originSlugIn(repo)
		if ghRepo == "" {
			return nil, usageFail(home(repo)+" has no github origin to read #"+pr+" from", "git -C "+home(repo)+" remote -v")
		}
		var read struct {
			Merged bool `json:"merged"`
			Head   struct {
				Ref string `json:"ref"`
				Sha string `json:"sha"`
			} `json:"head"`
		}
		if _, ferr := ghFetch(asCodie, githubBase()+"/repos/"+ghRepo+"/pulls/"+pr, &read); ferr != nil {
			return nil, ferr
		}
		headRef = read.Head.Ref
		if read.Merged {
			mergedHead = read.Head.Sha
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
	// the main checkout's spec: a lane tree's own .scratch copy would archive inside a tree about to go
	if paths, _ := laneSpecSection(main, id); len(paths) > 0 {
		plan.specDir = filepath.Dir(paths[0])
		feature = filepath.Base(plan.specDir)
		plan.archive = filepath.Join(filepath.Dir(plan.specDir), archived, feature)
		spec.detail = home(plan.specDir) + " is not archived"
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

	trees := landedLine{name: "trees", ok: true, detail: "no lane tree under .claude/worktrees/"}
	plan.clean = nil
	var notes []string
	found, terr := laneTrees(main, repo, id, headRef, mergedHead)
	for _, tree := range found {
		if tree.reason == "" {
			plan.clean = append(plan.clean, tree.path)
			notes = append(notes, home(tree.path)+" is clean, decamped on --apply")
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
	lines = append(lines, trees)

	wish := landedLine{name: "wish", ok: true, detail: "no W-lines in the body"}
	actor, berr := actorOf(flags)
	var issue bodyIssue
	if berr == nil {
		issue, berr = fetchBody(actor, id)
	}
	switch {
	case berr != nil:
		wish.ok, wish.detail, wish.fix = false, "linear did not read: "+berr.Error(), "x linear read "+id
	case issue.Description != nil:
		if n := len(wishItem.FindAllString(*issue.Description, -1)); n > 0 {
			wish.detail = fmt.Sprintf("%s for the close proposal: x linear read %s", plural(n, "W-line"), id)
		}
	}
	lines = append(lines, wish)
	return lines, nil
}

type laneTree struct{ path, reason string }

// laneTrees lists the ticket's trees under .claude/worktrees/, each with why it must stay, or clean by
// the root rule: no change in git status, no .scratch/ dir, every commit on an origin ref or in the merged pr
func laneTrees(main, repo, id, headRef, mergedHead string) ([]laneTree, error) {
	listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	// git lists a path as it was added, which may run through a symlink (/var → /private/var)
	under := resolved(filepath.Join(main, ".claude", "worktrees")) + string(filepath.Separator)
	selves := []string{resolved(repo), resolved(frameRoot())}
	if cwd, cerr := top(); cerr == nil {
		selves = append(selves, resolved(cwd))
	}
	var trees []laneTree
	for block := range strings.SplitSeq(listed, "\n\n") {
		var path, branch string
		for line := range strings.SplitSeq(block, "\n") {
			if v, ok := strings.CutPrefix(line, "worktree "); ok {
				path = v
			}
			if v, ok := strings.CutPrefix(line, "branch refs/heads/"); ok {
				branch = v
			}
		}
		if !strings.HasPrefix(resolved(path), under) || branch == "" || !(strings.HasPrefix(branch, "codie/"+id+"-") || branch == headRef) {
			continue
		}
		trees = append(trees, laneTree{path, treeDirt(path, selves, mergedHead)})
	}
	return trees, nil
}

func resolved(path string) string {
	if real, err := filepath.EvalSymlinks(path); err == nil {
		return real
	}
	return path
}

func treeDirt(tree string, selves []string, mergedHead string) string {
	var reasons []string
	if slices.Contains(selves, resolved(tree)) {
		reasons = append(reasons, "x runs from it")
	}
	status, _ := gitIn(tree, "status", "--porcelain")
	switch {
	case !status.ok:
		reasons = append(reasons, "git status failed")
	case status.out != "":
		var files []string
		for line := range strings.SplitSeq(status.out, "\n") {
			// run trims stdout, so the first line may have lost its leading status blank
			if len(line) > 2 {
				files = append(files, strings.TrimSpace(line[2:]))
			}
		}
		reasons = append(reasons, "changes in "+strings.Join(files, ", "))
	}
	if exists(filepath.Join(tree, ".scratch")) {
		reasons = append(reasons, "holds a .scratch/ dir")
	}
	// a squash merge leaves the branch's commits off main, and a deleted branch leaves them on no remote:
	// a tree still at the merged pr's head holds nothing the pr did not carry
	at, _ := gitIn(tree, "rev-parse", "HEAD")
	if mergedHead == "" || at.out != mergedHead {
		ahead, _ := gitIn(tree, "rev-list", "HEAD", "--not", "--remotes=origin")
		switch {
		case !ahead.ok:
			reasons = append(reasons, "git rev-list failed")
		case ahead.out != "":
			reasons = append(reasons, plural(len(strings.Split(ahead.out, "\n")), "commit")+" on no remote")
		}
	}
	return strings.Join(reasons, ", ")
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
	return "archive " + plan.(landedPlan).id + "'s lane spec and decamp its clean trees?"
}

// laneLanded moves the spec dir into the archive and decamps the clean trees, then reads the list again
func laneLanded(r *Run, args []string, flags Flags, planned any) (any, error) {
	plan := planned.(landedPlan)
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
		if err := r.Step("decamp", home(tree), func() (string, error) {
			if err := removeTree(plan.main, tree); err != nil {
				return "", err
			}
			return hooksHome(plan.main, tree)
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
