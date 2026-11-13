package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var wishItem = regexp.MustCompile(`(?m)^\s*(?:[*-]\s+(?:\[?(?:PK|FRM|BYT)-\d+\]?(?:\([^)\s]*\))?:)?|\[?(?:PK|FRM|BYT)-\d+\]?(?:\([^)\s]*\))?:)W\d+\b`)

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
	// the clean trees a stale lock alone held, unlocked before their decamp
	unlocks []string
	// the lane plan whose closing slice for this ticket is still open, ticked on --apply
	openClosing string
	// the merged pr's branch, when one stands; --apply takes it
	mergedRef, mergedHead, ghRepo string
	// the merged worktree- branches no tree holds, each with the tips its delete leases on
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
	if paths, _ := laneSpecSection(frame, id); len(paths) > 0 {
		dir := filepath.Dir(paths[0])
		if waiting := unmergedChunks(main, paths[0], id); len(waiting) > 0 {
			spec.detail = home(dir) + " waits on " + strings.Join(waiting, ", ") + ", no commit on " + home(main) + "'s origin/main: a spec moves when its every chunk merged"
			spec.fix = "git -C " + home(main) + " fetch origin main, or land " + strings.Join(waiting, ", ") + "; then x lane landed " + id + " --apply"
		} else {
			plan.specDir, plan.archive = dir, filepath.Join(filepath.Dir(dir), archived, filepath.Base(dir))
			spec.detail = home(dir) + " is not archived"
		}
	} else if found := archivedSpec(frame, id); found != "" {
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
	var notes []string
	found, terr := laneTrees(main, repo, id, laneRefs{pr, headRef, headSha, mergedHead, commits, underReview})
	var swept []string
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
		case tree.swept:
			swept = append(swept, home(tree.path)+" stays: "+tree.reason)
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
	case len(swept) > 0:
		trees.detail = strings.Join(swept, "; ")
	}
	lines = append(lines, trees)
	lines = append(lines, worktreeBranchesLine(main, id, plan))

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

var (
	habitsHead = regexp.MustCompile(`(?m)^## 🪢 habits[ \t]*$`)
	habitItem  = regexp.MustCompile(`(?m)^[-*] \[([ xX])\] (.+?)[ \t\r]*$`)
)

// a ticket's `## 🪢 habits` lines, each a habit the lane must leave in place, red while one is unticked; nil when the body
// holds none (FRM-505's exit 6)
func habitsLine(body, id string) *landedLine {
	at := habitsHead.FindStringIndex(body)
	if at == nil {
		return nil
	}
	section := body[at[1]:]
	if next := nextHeading.FindStringIndex(section); next != nil {
		section = section[:next[0]]
	}
	var open []string
	items := habitItem.FindAllStringSubmatch(section, -1)
	for _, item := range items {
		if item[1] == " " {
			open = append(open, "«"+item[2]+"»")
		}
	}
	switch {
	case len(items) == 0:
		return nil
	case len(open) > 0:
		return &landedLine{name: "habits", detail: "unticked: " + strings.Join(open, ", "), fix: "tick each habit line in " + id + "'s body once it holds"}
	}
	return &landedLine{name: "habits", ok: true, detail: plural(len(items), "habit line") + " ticked"}
}

const warnOnlyFile = "home/.claude/plugin-x/mods/x-mod-guard/hooks/register.ts"

var (
	warnOnlySet  = regexp.MustCompile(`(?s)const WARN_ONLY\b[^=]*= new Set\(\[(.*?)\]\)`)
	warnOnlyRule = regexp.MustCompile(`'([^']+)'`)
)

// the guard's warn-only rules at a ref, nil with no such file; a rule leaves the set at its sixth sense's clean
func warnOnlyAt(repo, ref string) ([]string, error) {
	listed, _ := gitIn(repo, "ls-tree", ref, "--", warnOnlyFile)
	if !listed.ok {
		return nil, fmt.Errorf("%s does not read here", short(ref))
	}
	if listed.out == "" {
		return nil, nil
	}
	shown, err := mustGitIn(repo, "show", "show", ref+":"+warnOnlyFile)
	if err != nil {
		return nil, err
	}
	var rules []string
	if set := warnOnlySet.FindStringSubmatch(shown); set != nil {
		for _, m := range warnOnlyRule.FindAllStringSubmatch(set[1], -1) {
			rules = append(rules, m[1])
		}
	}
	return rules, nil
}

// a rule the pr added to the set and the land still lists; nil when the pr added none, so the older rules print nothing
func warnOnlyLine(repo, head string, merged bool) *landedLine {
	if got, _ := gitIn(repo, "ls-tree", "origin/main", "--", warnOnlyFile); got.ok && got.out == "" {
		return nil
	}
	line := &landedLine{name: "warn-only", fix: "take the rule out of WARN_ONLY in " + warnOnlyFile + ", its clean said"}
	land := head
	if merged {
		land = "origin/main"
	}
	// a squash leaves the pr's shas on no branch; a failed fetch shows at the read below
	_, _ = gitIn(repo, "fetch", "-q", "origin", head)
	_, _ = gitIn(repo, "fetch", "-q", "origin", "main")
	// the fork point, never github's base sha, which can sit behind a branch that took main in: another lane's rule would read as this pr's
	var before, after, now []string
	base, err := mustGitIn(repo, "merge-base", "merge-base", head, "origin/main")
	if err == nil {
		before, err = warnOnlyAt(repo, base)
	}
	if err == nil {
		after, err = warnOnlyAt(repo, head)
	}
	if err == nil {
		now, err = warnOnlyAt(repo, land)
	}
	if err != nil {
		line.detail = "the warn-only set did not read: " + err.Error()
		return line
	}
	return warnOnlyVerdict(line, warnOnlyAdded(nil, before, after), now)
}

func warnOnlyAdded(added, before, after []string) []string {
	for _, rule := range after {
		if !slices.Contains(before, rule) && !slices.Contains(added, rule) {
			added = append(added, rule)
		}
	}
	return added
}

func warnOnlyVerdict(line *landedLine, added, now []string) *landedLine {
	var left []string
	for _, rule := range added {
		if slices.Contains(now, rule) {
			left = append(left, rule)
		}
	}
	switch {
	case len(added) == 0:
		return nil
	case len(left) > 0:
		line.detail = strings.Join(left, ", ") + " still warn-only at the land"
	default:
		line.ok, line.detail = true, strings.Join(added, ", ")+" enforcing"
	}
	return line
}

// a lane with no pr: the rules its own commits added, each read against its parent, since main interleaves other lanes
func quickWarnOnlyLine(repo string, commits []string) *landedLine {
	if got, _ := gitIn(repo, "ls-tree", "origin/main", "--", warnOnlyFile); got.ok && got.out == "" {
		return nil
	}
	line := &landedLine{name: "warn-only", fix: "take the rule out of WARN_ONLY in " + warnOnlyFile + ", its clean said"}
	var added []string
	for _, commit := range commits {
		sha, _, _ := strings.Cut(commit, " ")
		after, err := warnOnlyAt(repo, sha)
		if err == nil && len(after) > 0 {
			var before []string
			if before, err = warnOnlyAt(repo, sha+"^"); err == nil {
				added = warnOnlyAdded(added, before, after)
			}
		}
		if err != nil {
			line.detail = "the warn-only set did not read: " + err.Error()
			return line
		}
	}
	now, err := warnOnlyAt(repo, "origin/main")
	if err != nil {
		line.detail = "the warn-only set did not read: " + err.Error()
		return line
	}
	return warnOnlyVerdict(line, added, now)
}

// a ticket another open one still blocks is not freed
func freedTickets(issue landedRead, id string) []string {
	closed := func(state string) bool { return state == "completed" || state == "canceled" }
	var freed []string
	for _, relation := range issue.Relations.Nodes {
		blocked := relation.RelatedIssue
		if relation.Type != "blocks" || closed(blocked.State.Type) {
			continue
		}
		if !slices.ContainsFunc(blocked.InverseRelations.Nodes, func(by blockerRelation) bool {
			return by.Type == "blocks" && by.Issue.Identifier != id && !closed(by.Issue.State.Type)
		}) {
			freed = append(freed, blocked.Identifier)
		}
	}
	return freed
}

const (
	lookSentLine   = "👀 look sent "
	sixthSenseMark = ", sixth sense "
)

// what the last 🚀 line of a ticket's body recorded; a line a ↩️ leads below it took the dispatch back
type dispatchRead struct {
	base          string
	hasSixthSense bool
}

// the 🚀 line in force, "" when none is or one was taken back; a ↩️ inside a sentence only names one
func heldDispatch(text string) string {
	at := strings.LastIndex(text, dispatchedLine)
	if at < 0 || takenBackOf.MatchString(text[at:]) {
		return ""
	}
	line, _, _ := strings.Cut(text[at:], "\n")
	return strings.TrimSpace(line)
}

func dispatchOf(body string) dispatchRead {
	line := heldDispatch(body)
	read := dispatchRead{hasSixthSense: strings.Contains(line, sixthSenseMark)}
	if m := dispatchBaseOf.FindStringSubmatch(line); m != nil {
		read.base = m[1]
	}
	return read
}

func (r landedRead) hasLookCard() bool {
	return slices.ContainsFunc(r.Comments.Nodes, func(c struct{ Body string }) bool { return isLookCard(c.Body) })
}

var (
	dispatchBaseOf = regexp.MustCompile(`, main:([0-9a-f]{7,40})\b`)
	takenBackOf    = regexp.MustCompile(`(?m)^[\s>*-]*↩️`)
	lookSentOf     = regexp.MustCompile(`(?m)^` + lookSentLine + `\d{4}-\d{2}-\d{2}`)
	verifiedOf     = regexp.MustCompile(`\bverified\b[*:\s]+([0-9a-f]{7,40})\b`)
	worthSection   = regexp.MustCompile(`(?s)## ⚖️ worth it\n(.*?)(\n## |\z)`)
	newVerbLine    = regexp.MustCompile(`(?mi)^[\s*\d.-]*new verbs?\**:\**[ \t]*(.*)$`)
	newVerbQuoted  = regexp.MustCompile("`([^`]+)`")
	newVerbSplit   = regexp.MustCompile(`,| and `)
	ticketRepoLine = regexp.MustCompile(`(?m)^repo:\s*(\S+)\s*$`)
)

// a quick lane's commits carry no ticket line (x:cmt), and main interleaves lanes: merged counts the verified tip and
// the commits under it whose step line names this ticket; while a named sixth sense has not said verified the lane is
// mid-verify, and --apply refuses on this line
func quickMerged(repo, id, base string, issue landedRead) ([]string, landedLine) {
	merged := landedLine{name: "merged", fix: "wait for sixth sense's clean, its verified: <sha> comment on " + id}
	verified := ""
	for _, c := range issue.Comments.Nodes {
		if m := verifiedOf.FindStringSubmatch(c.Body); m != nil {
			verified = m[1]
		}
	}
	if verified == "" && dispatchOf(issue.Description).hasSixthSense {
		merged.detail = id + " is mid-verify: the dispatch named a sixth sense and no comment says verified"
		return nil, merged
	}
	// with no sixth sense only codie's done comment bounds the range: past it, another lane's commit would read this one's
	if verified == "" {
		merged.detail, merged.fix = "no verified sha and no look card on "+id+": the lane may still be working", "wait for codie's done comment on "+id
		if issue.hasLookCard() {
			merged.detail, merged.fix = "the done comment on "+id+" names no verified: sha, so the range past main:"+short(base)+" is open", "add verified: <head sha> to the done comment on "+id
		}
		return nil, merged
	}
	tip := verified
	merged.fix = "land " + id + "'s commits on main"
	if !ok(gitIn(repo, "merge-base", "--is-ancestor", tip, "origin/main")) {
		merged.detail = short(tip) + " is not on origin/main"
		return nil, merged
	}
	got, _ := gitIn(repo, "log", base+".."+tip, "--format=%h %s")
	named, _ := gitIn(repo, "log", base+".."+tip, "-E", "--grep=^step [0-9]+ of "+id+"([^0-9]|$)", "--format=%h %s")
	var commits []string
	others := 0
	if got.ok && got.out != "" {
		stepped := strings.Split(named.out, "\n")
		for i, row := range strings.Split(got.out, "\n") {
			// the log opens on the verified tip, which the comment itself names as the lane's
			if i == 0 || slices.Contains(stepped, row) {
				commits = append(commits, row)
			} else {
				others++
			}
		}
	}
	merged.ok, merged.detail = len(commits) > 0, plural(len(commits), "commit")+" from main:"+short(base)+" to "+short(tip)
	if others > 0 {
		merged.detail += fmt.Sprintf(", not counted: %d name no step of %s", others, id)
	}
	return commits, merged
}

// where a ticket's repo: line points, else its team's repo; "" for a frame ticket with no line, a refusal when the
// checkout is not on this mac
func ticketRepo(id, body string) (string, error) {
	name := ""
	if m := ticketRepoLine.FindStringSubmatch(body); m != nil {
		name = m[1]
	} else if strings.HasPrefix(id, "BYT-") {
		name = "bytes"
	} else if strings.HasPrefix(id, "FRM-") {
		name = "frame"
	}
	switch name {
	case "":
		return "", nil
	case "frame":
		return mainCheckout(frameRoot()), nil
	}
	userHome, _ := os.UserHomeDir()
	path := filepath.Join(userHome, "projects", name)
	if !exists(path) {
		return "", usageFail("the ticket's repo: "+name+" has no checkout at "+home(path), "x lane landed <ticket> --repo <path>")
	}
	return path, nil
}

// the x verbs a ticket's `new verb: <name>` lines name, and the names no verb answers to; prose guesses nothing.
// a line's first name and any spelled `x <verb>` must answer; past those a comma may open prose. a backticked name is
// the verb and its flags whole, a bare one may run on into a sentence, so `x stats dayly` reds and x stats dayly reads stats
func newVerbsOf(body string) (verbs, nameless []string) {
	section := worthSection.FindStringSubmatch(body)
	if section == nil {
		return nil, nil
	}
	read := func(name string, first, whole bool) {
		name = strings.TrimSpace(name)
		words := strings.Fields(strings.TrimPrefix(name, "x "))
		verb, depth, found := findVerb(words)
		if flag := slices.IndexFunc(words, func(w string) bool { return strings.HasPrefix(w, "-") }); whole && flag >= 0 {
			words = words[:flag]
		}
		switch {
		case found && (!whole || depth == len(words)):
			if !slices.Contains(verbs, verb.Name) {
				verbs = append(verbs, verb.Name)
			}
		case first || strings.HasPrefix(name, "x "):
			nameless = append(nameless, name)
		}
	}
	for _, m := range newVerbLine.FindAllStringSubmatch(section[1], -1) {
		named, _, _ := strings.Cut(strings.ReplaceAll(m[1], "*", ""), "—")
		opening := strings.Fields(named)
		if len(opening) == 0 || strings.Trim(strings.ToLower(opening[0]), ".,:;()`") == "none" {
			continue
		}
		for i, piece := range newVerbSplit.Split(named, -1) {
			// a backticked flag is prose about the verb, never a name
			var quoted []string
			for _, q := range newVerbQuoted.FindAllStringSubmatch(piece, -1) {
				if !strings.HasPrefix(q[1], "-") {
					quoted = append(quoted, q[1])
				}
			}
			if len(quoted) == 0 {
				read(strings.ReplaceAll(piece, "`", ""), i == 0, false)
			}
			for j, name := range quoted {
				read(name, i == 0 && j == 0, true)
			}
		}
	}
	return verbs, nameless
}

// a new verb is measured at its milestone's close, the merge is too early to say: no ticket left open, this one included, is the close
func wiredLine(verb string, issue landedRead) landedLine {
	line := landedLine{name: "wired", ok: true, detail: "wired: unmeasured yet"}
	milestone := issue.ProjectMilestone
	if milestone == nil || slices.ContainsFunc(milestone.Issues.Nodes, func(n milestoneIssue) bool {
		return n.State.Type != "completed" && n.State.Type != "canceled"
	}) {
		return line
	}
	calls := verbCalls(verb, wiredDays)
	line.ok = calls > 0
	line.detail = plural(calls, "call") + " of x " + verb + " in " + strconv.Itoa(wiredDays) + " days"
	line.fix = "back to Todo with the ↩️ awaited call of x " + verb
	return line
}

// the look card's two fields every done report carries, each a «- **field**:» line (crew-codie how-you-work.md)
var lookFields = []*regexp.Regexp{regexp.MustCompile(`(?im)^\W*proven\W*:`), regexp.MustCompile(`(?im)^\W*not checked\W*:`)}

func isLookCard(body string) bool {
	return !slices.ContainsFunc(lookFields, func(field *regexp.Regexp) bool { return !field.MatchString(body) })
}

const wiredDays = 30

type milestoneIssue struct {
	State struct{ Type string }
}

type landedRead struct {
	Description      string
	Comments         connection[struct{ Body string }]
	ProjectMilestone *struct {
		Issues connection[milestoneIssue]
	}
	Relations connection[struct {
		Type         string
		RelatedIssue struct {
			Identifier       string
			State            struct{ Type string }
			InverseRelations connection[blockerRelation]
		}
	}]
}

type blockerRelation struct {
	Type  string
	Issue struct {
		Identifier string
		State      struct{ Type string }
	}
}

func landedIssue(flags Flags, id string) (landedRead, error) {
	actor, err := actorOf(flags)
	if err != nil {
		return landedRead{}, err
	}
	data, _, err := gql(actor, `query($id: String!) { issue(id: $id) { description comments(first: 100) { nodes { body } }
		relations(first: 50) { nodes { type relatedIssue { identifier state { type } inverseRelations(first: 50) { nodes { type issue { identifier state { type } } } } } } }
		projectMilestone { issues(first: 100) { nodes { state { type } } } } } }`, map[string]any{"id": id})
	if err != nil {
		return landedRead{}, err
	}
	var read landedRead
	if raw, found := data["issue"]; !found || string(raw) == "null" || json.Unmarshal(raw, &read) != nil {
		return landedRead{}, &Fail{Msg: "linear sent no issue " + id, Next: "x linear read " + id}
	}
	return read, nil
}

// swept: a quick lane's verify-<sha> tree whose sha is on main, any lane's: it never holds this lane's landing
type laneTree struct {
	path, reason string
	swept        bool
	// why the tree's lock is stale, when that lock alone held it: unlocked on --apply
	staleLock string
}

// what names a lane's trees beyond its codie/<ticket>-* branches: the pr, its head, its head once merged
type laneRefs struct {
	pr, headRef, headSha, mergedHead string
	commits                          []string // a quick lane's commits on origin/main, «<short sha> <subject>»
	underReview                      bool     // its sixth sense has not said verified: its verify tree stays
}

// the ticket ids a lane spec names as its chunks, in order, each once
// the spec's chunks, each the ids its heading names: a joint `## FRM-436 + FRM-424` heading is one chunk of two
func specChunks(spec string) [][]string {
	raw, _ := os.ReadFile(spec)
	var chunks [][]string
	for _, m := range chunkHeading.FindAllStringSubmatch(string(raw), -1) {
		ids := strings.Split(m[1], " + ")
		if !slices.ContainsFunc(chunks, func(c []string) bool { return slices.Equal(c, ids) }) {
			chunks = append(chunks, ids)
		}
	}
	return chunks
}

func mainCheckout(dir string) string {
	if common, linked, err := worktreeOf(dir); err == nil && linked {
		return filepath.Dir(common)
	}
	return dir
}

var chunkHeading = regexp.MustCompile(`(?m)^## ((?:FRM|BYT|PK)-\d+(?: \+ (?:FRM|BYT|PK)-\d+)*)\b`)

// unmergedChunks names the spec's other chunks with no commit on origin/main; a squash merge carries the pr
// body's «- ticket:» lines, so a chunk merged in the same pr reads merged, and a joint chunk merged by any of its ids
func unmergedChunks(repo, spec, id string) []string {
	var waiting []string
	for _, chunk := range specChunks(spec) {
		if slices.Contains(chunk, id) || slices.ContainsFunc(chunk, func(other string) bool { return len(ticketCommits(repo, other)) > 0 }) {
			continue
		}
		waiting = append(waiting, strings.Join(chunk, " + "))
	}
	return waiting
}

// laneTrees lists the ticket's trees under .claude/worktrees/, each with why it must stay, or clean by
// the root rule: no change in git status, no file in .scratch/, every commit on an origin ref or in the merged pr.
// a lane tree is a codie/<ticket>-* branch or the pr's head ref; a detached one is sixth sense's verify tree,
// named verify-pr-<n> (frame), verify-<ticket> (any other repo) or sitting at the pr's head
var verifySha = regexp.MustCompile(`^verify-[0-9a-f]{7,40}$`)

// the merged worktree- branches no tree holds go on --apply, by decamp's main-holds rule and lease; one main lacks stays,
// named, never holding the landing: it is any session's, never this lane's (FRM-553)
func worktreeBranchesLine(main, id string, plan *landedPlan) landedLine {
	line := landedLine{name: "worktree branches", ok: true, detail: "no merged worktree- branch"}
	plan.worktreeDrops = nil
	listed, err := mustGitIn(main, "for-each-ref", "for-each-ref", "--format=%(refname:short)", "refs/heads/worktree-*")
	if err != nil {
		line.detail = "the branches did not read: " + err.Error()
		return line
	}
	var going, staying []string
	for ref := range strings.FieldsSeq(listed) {
		why, tips := branchStay(main, ref, "main does not hold", func(sha string) bool { return onMain(main, sha) })
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

func laneTrees(main, repo, id string, refs laneRefs) ([]laneTree, error) {
	mergedHead := refs.mergedHead
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
	for _, entry := range worktreesOf(listed) {
		path, branch, sha, detached := entry.path, entry.branch, entry.sha, entry.detached
		ours := branch != "" && (strings.HasPrefix(branch, "codie/"+id+"-") || branch == refs.headRef)
		name := filepath.Base(path)
		// a quick lane's verify tree is verify-<short sha> at one of the ticket's commits on main
		atCommit := strings.HasPrefix(name, "verify-") && slices.ContainsFunc(refs.commits, func(c string) bool {
			short, _, _ := strings.Cut(c, " ")
			return short != "" && strings.HasPrefix(sha, short)
		})
		verify := detached && (name == "verify-"+id || (refs.pr != "" && name == "verify-pr-"+refs.pr) || (refs.headSha != "" && sha == refs.headSha) || atCommit)
		// any quick lane's verify tree once its sha is on main: its lane landed, so nothing reviews it any more (FRM-553)
		swept := !verify && !ours && detached && verifySha.MatchString(name) && onMain(main, sha)
		if !strings.HasPrefix(resolved(path), under) || !(ours || verify || swept) {
			continue
		}
		// a lock whose pid is gone keeps no tree: landed unlocks it, named, on --apply; a reused pid only names the unlock
		stale, isGone := staleLock(entry)
		if !isGone {
			stale = ""
		}
		if stale != "" {
			entry.locked = false
		}
		reason := treeStay(entry, main, selves, sha)
		if !swept {
			reason = treeStay(entry, main, selves, mergedHead)
		}
		if stale != "" && reason != "" {
			reason += ", its lock is stale, " + stale + ": git worktree unlock " + path
			stale = ""
		}
		if verify && refs.underReview {
			reason = strings.TrimSuffix("its lane is still under review, "+reason, ", ")
		}
		trees = append(trees, laneTree{path, reason, swept, stale})
	}
	return trees, nil
}

type worktreeEntry struct {
	path, branch, sha string
	detached, locked  bool
	// what `git worktree lock --reason` holds: cc writes its session's pid and start time there
	lockReason string
}

var lockHolder = regexp.MustCompile(`\(pid (\d+) start ([^)]+)\)`)

func worktreesOf(listed string) []worktreeEntry {
	var entries []worktreeEntry
	for block := range strings.SplitSeq(listed, "\n\n") {
		var e worktreeEntry
		for line := range strings.SplitSeq(block, "\n") {
			if reason, found := strings.CutPrefix(line, "locked "); found || line == "locked" {
				e.locked, e.lockReason = true, reason
			}
			if v, ok := strings.CutPrefix(line, "worktree "); ok {
				e.path = v
			}
			if v, ok := strings.CutPrefix(line, "HEAD "); ok {
				e.sha = v
			}
			if v, ok := strings.CutPrefix(line, "branch refs/heads/"); ok {
				e.branch = v
			}
			e.detached = e.detached || line == "detached"
		}
		entries = append(entries, e)
	}
	return entries
}

// why a tree must stay, or "" when it may go: its own dirt, a git lock, a live session in it
func treeStay(e worktreeEntry, main string, selves []string, mergedHead string) string {
	reason := treeDirt(e.path, main, selves, mergedHead)
	if e.locked {
		// git worktree lock: a session working in it, git refuses to remove it either way
		reason = strings.TrimPrefix(reason+", "+lockSays(e), ", ")
	}
	if session := liveSessionIn(e.path); session != "" {
		reason = strings.TrimPrefix(reason+", a live session sits in it: "+session, ", ")
	}
	return reason
}

// a lock outlives a session that was stopped; its pid and start time, read together, say whether the holder is still that
// process. a lock that names no pid cannot be read, so it holds
func lockSays(e worktreeEntry) string {
	if why, _ := staleLock(e); why != "" {
		return "its lock is stale, " + why + ": git worktree unlock " + e.path
	}
	return "a live session holds it"
}

// why a tree's lock no longer holds, "" while its holder lives or the lock names none; isGone only when no process holds the
// pid, the one case landed unlocks by itself
func staleLock(e worktreeEntry) (why string, isGone bool) {
	return staleLockBy(e, processStarted)
}

// gone is the kernel's word alone (kill 0 answers no such process); a ps that did not run, or printed nothing for a
// live pid, holds, since a spawn failure under this mac's process limit must never read as a dead holder
func staleLockBy(e worktreeEntry, startOf func(int) string) (why string, isGone bool) {
	holder := lockHolder.FindStringSubmatch(e.lockReason)
	if !e.locked || holder == nil {
		return "", false
	}
	pid, _ := strconv.Atoi(holder[1])
	if err := syscall.Kill(pid, 0); errors.Is(err, syscall.ESRCH) {
		return "pid " + holder[1] + " is gone", true
	}
	if sameStart(holder[2], startOf(pid), time.Local) {
		return "", false
	}
	return "pid " + holder[1] + " is another process now", false
}

// cc stamps a lock's start in UTC and ps prints it in local time: the two are one instant or not; a stamp or a ps answer
// that does not parse (an empty one included) reads as the same start, so what cannot be read holds
func sameStart(lock, ps string, local *time.Location) bool {
	const layout = "Mon Jan 2 15:04:05 2006"
	lock = strings.Join(strings.Fields(lock), " ")
	at, err := time.ParseInLocation(layout, ps, local)
	if err != nil || lock == ps {
		return true
	}
	asUTC, utcErr := time.ParseInLocation(layout, lock, time.UTC)
	asLocal, localErr := time.ParseInLocation(layout, lock, local)
	return (utcErr != nil && localErr != nil) || asUTC.Equal(at) || asLocal.Equal(at)
}

// the session registry names each session's pid; a file left by a dead pid says nothing, and the registry's cwd may be
// where the session started, so the process's own cwd says where it sits. the session sitting in tree, named, or ""
func liveSessionIn(tree string) string {
	files, _ := filepath.Glob(filepath.Join(sessionsDir(), "*.json"))
	root := resolved(tree)
	for _, file := range files {
		var session struct {
			Cwd  string `json:"cwd"`
			Pid  int    `json:"pid"`
			Name string `json:"name"`
			ID   string `json:"sessionId"`
		}
		raw, err := os.ReadFile(file)
		if err != nil || json.Unmarshal(raw, &session) != nil || session.Pid <= 0 {
			continue
		}
		if err := syscall.Kill(session.Pid, 0); err != nil && !errors.Is(err, syscall.EPERM) {
			continue
		}
		for _, at := range []string{cmp.Or(processCwd(session.Pid), session.Cwd), transcriptCwd(session.ID)} {
			if cwd := resolved(at); at != "" && (cwd == root || strings.HasPrefix(cwd, root+string(filepath.Separator))) {
				return fmt.Sprintf("%s (pid %d)", cmp.Or(session.Name, session.ID, "unnamed"), session.Pid)
			}
		}
	}
	return ""
}

// a Bash cd moves no process (probed on a bare cc, 2026-11-05); cc stamps the cwd it carried on every transcript row, so the last row says where the session went
func transcriptCwd(id string) string {
	newest := newestTranscript(id)
	if newest == "" {
		return ""
	}
	return lastCwdIn(newest)
}

// a session moved between trees can leave a transcript under two project dirs: the newest is where it sits
func newestTranscript(id string) string {
	if id == "" {
		return ""
	}
	files, _ := filepath.Glob(filepath.Join(projectsDir(), "*", id+".jsonl"))
	newest, at := "", time.Time{}
	for _, file := range files {
		if info, err := os.Stat(file); err == nil && info.ModTime().After(at) {
			newest, at = file, info.ModTime()
		}
	}
	return newest
}

const transcriptTail = 256 * 1024

// the end of the file first: transcripts run to tens of MB, and this runs per session per tree. a cut first line fails
// its parse and is skipped; a tail with no cwd widens, since a last row past its size would read as no session in the tree
func lastCwdIn(path string) string {
	file, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return ""
	}
	for size := min(info.Size(), transcriptTail); ; size = min(info.Size(), size*4) {
		tail := make([]byte, size)
		if _, err := file.ReadAt(tail, info.Size()-size); err != nil {
			return ""
		}
		for _, raw := range slices.Backward(bytes.Split(tail, []byte("\n"))) {
			var row struct {
				Cwd string `json:"cwd"`
			}
			if json.Unmarshal(raw, &row) == nil && row.Cwd != "" {
				return row.Cwd
			}
		}
		if size == info.Size() {
			return ""
		}
	}
}

// "" when the process can't be read, and the caller falls back on the registry: a wrong spare costs a later landed, a wrong decamp a live tree
func processCwd(pid int) string {
	if link, err := os.Readlink(fmt.Sprintf("/proc/%d/cwd", pid)); err == nil {
		return link
	}
	got, err := run("", nil, "", "lsof", "-a", "-p", strconv.Itoa(pid), "-d", "cwd", "-Fn")
	if err != nil || !got.ok {
		return ""
	}
	for line := range strings.SplitSeq(got.out, "\n") {
		if name, ok := strings.CutPrefix(line, "n"); ok {
			return name
		}
	}
	return ""
}

// the ignored paths an install, a build or a seed makes again, from frame's and bytes' .gitignore build lines;
// any other ignored path keeps the tree, since worktree remove deletes it (nothing of dima's is destroyed)
var disposable = regexp.MustCompile(`(^|/)(node_modules|\.next|\.vite|\.turbo|\.vercel|\.generated|dist|build|out|coverage|\.vitest|\.stryker|__pycache__|\.pnpm-store)/` +
	`|(^|/)\.claude-plugin/types/` +
	`|(^|/)(\.DS_Store|\.worktree-offset|[^/]*\.tsbuildinfo|(npm|yarn|\.pnpm)-[^/]*\.log[^/]*)$` +
	`|^(x/go/bin/|x/go/x$|home/\.claude/sline/(bin/|sline$)|schedule/jobs/[^/]+/bin/|home/\.claude/plugin-x/mods/[^/]+/tsconfig\.json$)`)

// a seed's copy (bytes copies its .env files in) is the main checkout's file byte for byte, so the main keeps it
func seedCopy(tree, main, file string) bool {
	if strings.HasSuffix(file, "/") {
		return false
	}
	ours, err := os.ReadFile(filepath.Join(tree, file))
	if err != nil {
		return false
	}
	theirs, err := os.ReadFile(filepath.Join(main, file))
	return err == nil && string(ours) == string(theirs)
}

func resolved(path string) string {
	if real, err := filepath.EvalSymlinks(path); err == nil {
		return real
	}
	return path
}

func treeDirt(tree, main string, selves []string, mergedHead string) string {
	var reasons []string
	if slices.Contains(selves, resolved(tree)) {
		reasons = append(reasons, "x runs from it")
	}
	// worktree remove deletes ignored files too: only build, install and seed output goes with the tree
	status, _ := gitIn(tree, "status", "--porcelain", "--ignored=matching")
	var changed, ignored []string
	for line := range strings.SplitSeq(status.out, "\n") {
		// run trims stdout, so the first line may have lost its leading status blank
		if len(line) <= 2 {
			continue
		}
		file := strings.TrimSpace(line[2:])
		switch {
		case !strings.HasPrefix(line, "!!"):
			changed = append(changed, file)
		case file != ".scratch/" && file != seedLink && !disposable.MatchString(file) && !seedCopy(tree, main, file):
			ignored = append(ignored, file)
		}
	}
	switch {
	case !status.ok:
		reasons = append(reasons, "git status failed")
	case len(changed) > 0:
		reasons = append(reasons, "changes in "+strings.Join(changed, ", "))
	}
	if len(ignored) > 0 {
		reasons = append(reasons, "ignored files no build or seed makes: "+strings.Join(ignored, ", "))
	}
	if holdsAFile(filepath.Join(tree, ".scratch")) {
		reasons = append(reasons, "holds a file in .scratch/")
	}
	if stoppedOn(tree) != "" {
		reasons = append(reasons, "a rebase or bisect is stopped in it")
	}
	// a squash merge leaves the branch's commits off main, and a deleted branch leaves them on no remote:
	// a tree at the merged pr's head, or at an earlier one, holds nothing the pr did not carry
	carried := false
	if mergedHead != "" {
		within, _ := gitIn(tree, "merge-base", "--is-ancestor", "HEAD", mergedHead)
		carried = within.ok
	}
	if !carried {
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

// worktree-seed.sh's link for a fork's tree: nothing of a session's, and excluded so git calls it ignored
const seedLink = ".claude/agents/wishkeeper.md"

const closingWords = "reviewed and closed"

// a lane plan's step line, read as the glide card reads it: its ticket is the first id in its text
var (
	planStepLine = regexp.MustCompile(`^- \[([ xX])\] \d+ · (.+?)[ \t\r]*$`)
	stepTicket   = regexp.MustCompile(`\b(?:FRM|BYT)-\d+\b`)
	// a trailing note in parens still reads as the closer: «reviewed and closed (round 2)»
	closingStep = regexp.MustCompile(`\b(?:reviewed and closed|closes)(?:\s+\(.*\))?$`)
)

var stepTextPast = regexp.MustCompile(`^\s*[:·—–-]?\s+(\S.*)$`)

type planStep struct {
	Done   bool   `json:"done"`
	Text   string `json:"text"`
	Ticket string `json:"ticket,omitempty"`
}

// a lane plan's steps as the glide card draws them: numbered column-0 lines only, the text past a leading id and its
// separator, since the card draws that id as its link
func planStepsOf(plan string) []planStep {
	steps := []planStep{}
	for line := range strings.Lines(plan) {
		m := planStepLine.FindStringSubmatch(strings.TrimRight(line, "\n"))
		if m == nil {
			continue
		}
		step := planStep{Done: m[1] != " ", Text: m[2], Ticket: stepTicket.FindString(m[2])}
		if rest, ok := strings.CutPrefix(m[2], step.Ticket); ok && step.Ticket != "" {
			if past := stepTextPast.FindStringSubmatch(rest); past != nil {
				step.Text = past[1]
			}
		}
		steps = append(steps, step)
	}
	return steps
}

// x-mod-stash's one read of a lane plan, spawned only when the plan file moved: no network, so the card never waits
func lanePlanSteps(r *Run, args []string, _ Flags) (any, error) {
	raw, err := os.ReadFile(args[0])
	if err != nil {
		return nil, &Fail{Msg: "no lane plan at " + home(args[0]), Next: "ls " + quote(filepath.Dir(args[0]))}
	}
	r.Open(home(args[0]))
	steps := planStepsOf(string(raw))
	r.Done(plural(len(steps), "step"), "")
	return map[string]any{"plan": args[0], "steps": steps}, nil
}

// the mark and text of a step belonging to id; a line of another ticket or no step at all answers false
func stepOf(line, id string) (mark, text string, ok bool) {
	m := planStepLine.FindStringSubmatch(line)
	if m == nil || stepTicket.FindString(m[2]) != id {
		return "", "", false
	}
	return m[1], m[2], true
}

// the plans of a ticket's specs, live first, then the first holding a step of the ticket: a stale spec may sort ahead
func lanePlanOf(frame, id string) (path string, lines []string) {
	specs, _ := laneSpecSection(frame, id)
	if found := archivedSpec(frame, id); found != "" {
		specs = append(specs, found)
	}
	for _, spec := range specs {
		candidate := filepath.Join(stateDir(), "lanes", filepath.Base(filepath.Dir(spec)), "lane-plan.md")
		raw, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		split := strings.Split(string(raw), "\n")
		for _, line := range split {
			if _, _, ok := stepOf(line, id); ok {
				return candidate, split
			}
		}
	}
	return "", nil
}

// the chunk's closing slice, -1 for none: its last step, when that ends in a closing word, so a second round's own line
// is read, not the first round's, and a build line that happens to end so never is
func closingIndex(lines []string, id string) int {
	at := -1
	for i, l := range lines {
		if _, _, ok := stepOf(l, id); ok {
			at = i
		}
	}
	if at >= 0 {
		if _, text, _ := stepOf(lines[at], id); !closingStep.MatchString(text) {
			return -1
		}
	}
	return at
}

// an open closing-shaped step ahead of the closer: the card stays on it, so the closer's tick alone would not move it
func openCloserBefore(lines []string, id string, at int) string {
	for _, l := range lines[:at] {
		if mark, text, ok := stepOf(l, id); ok && mark == " " && closingStep.MatchString(text) {
			return text
		}
	}
	return ""
}

// closingLine reads the slice that holds a chunk on the glide card while its reviews run; has is false when no
// lane plan names the chunk, and open names the plan while the slice waits for --apply
func closingLine(frame, id string) (line landedLine, open string, has bool) {
	path, lines := lanePlanOf(frame, id)
	if path == "" {
		return line, "", false
	}
	line = landedLine{name: "closing"}
	at := closingIndex(lines, id)
	if at < 0 {
		line.detail = home(path) + " holds no closing slice for " + id
		line.fix = "end " + id + "'s slices in " + home(path) + " with «- [ ] NN · " + id + " " + closingWords + "»"
		return line, "", true
	}
	mark, _, _ := stepOf(lines[at], id)
	isOpen := mark == " "
	if earlier := openCloserBefore(lines, id, at); earlier != "" {
		line.detail = "«" + earlier + "» sits open ahead of " + id + "'s closing slice in " + home(path)
		line.fix = "tick or reword that line, the glide card stays on it"
		if isOpen {
			return line, path, true
		}
		return line, "", true
	}
	if !isOpen {
		line.ok, line.detail = true, id+"'s closing slice is ticked"
		return line, "", true
	}
	line.detail, line.fix = id+"'s closing slice is open in "+home(path), "x lane landed "+id+" --apply"
	return line, path, true
}

// tickClosing marks the one closing line and leaves every other byte as it was
func tickClosing(path, id string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	lines := strings.Split(string(raw), "\n")
	if at := closingIndex(lines, id); at >= 0 {
		lines[at] = strings.Replace(lines[at], "- [ ]", "- [x]", 1)
	}
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0o644)
}

// the archived spec that holds § id, beside the main checkout's other specs
func archivedSpec(main, id string) string {
	specs, _ := filepath.Glob(filepath.Join(main, ".scratch", archived, "*", "spec.md"))
	head := specHead(id)
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
	if merged := plan.lines[0]; !merged.ok {
		return nil, &Fail{Refused: true, Msg: "the lane has not landed (" + merged.detail + "): --apply archives and decamps only after the merge", Next: merged.fix}
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
		after.Lines = append(after.Lines, landedLine{name: "branch", ok: !strings.HasPrefix(note, "⚠"), detail: note, fix: "git branch --list worktree-*"}.String())
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

// a walk that fails holds something it could not read, so it reads as holding a file
func holdsAFile(dir string) bool {
	found := false
	err := filepath.WalkDir(dir, func(_ string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			found = true
			return fs.SkipAll
		}
		return nil
	})
	return found || err != nil && !errors.Is(err, fs.ErrNotExist)
}

// clearThreadTicket takes a landed ticket off each thread record that names it, so its display drops the unit; best effort,
// since a merged lane stands whatever its store says
func clearThreadTicket(id string) (string, error) {
	path := threadStorePath()
	if path == "" {
		return "no thread store", nil
	}
	unlock, err := lockThreadStore(path)
	if err != nil {
		return "", err
	}
	defer unlock()
	store, err := readThreadStore(path)
	if err != nil {
		return "", err
	}
	cleared := 0
	for i := range store.Threads {
		if store.Threads[i].Ticket == id {
			store.Threads[i].Ticket = ""
			drawNames(&store.Threads[i])
			cleared++
		}
	}
	if cleared == 0 {
		return "no record names it", nil
	}
	return plural(cleared, "record") + " cleared", writeThreadStore(path, time.Now(), store.Threads)
}
