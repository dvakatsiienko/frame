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

func landedLines(repo string, plan *landedPlan, issue landedRead, issueErr error) (lines []landedLine, err error) {
	id, pr := plan.id, plan.pr
	main := mainCheckout(repo)
	plan.main = main
	// the spec and the review log live in frame; the pr and the trees in the lane's repo (bytes, say)
	frame := mainCheckout(frameRoot())

	merged := landedLine{name: "merged"}
	var headRef, headSha, baseSha, mergedHead string
	var commits []string
	if pr != "" {
		// --repo here is the checkout's path, so the github slug comes from its origin
		ghRepo := originSlugIn(repo)
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
			Base struct {
				Sha string `json:"sha"`
			} `json:"base"`
		}
		if _, ferr := ghFetch(asCodie, githubBase()+"/repos/"+ghRepo+"/pulls/"+pr, &read); ferr != nil {
			return nil, ferr
		}
		baseSha = read.Base.Sha
		// another lane's pr would green «merged» and hand its trees to this ticket
		if !strings.HasPrefix(read.Head.Ref, "codie/"+id+"-") && !bodyNamesTicket(read.Body, id) {
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

	rounds := landedLine{name: "review-rounds", detail: "no line names " + id + " in docs/test-drive/review-rounds.md",
		fix: "add the lane's graded lines to docs/test-drive/review-rounds.md"}
	if raw, rerr := os.ReadFile(filepath.Join(frame, "docs/test-drive/review-rounds.md")); rerr == nil && regexp.MustCompile(`\b`+regexp.QuoteMeta(id)+`\b`).Match(raw) {
		rounds.ok, rounds.detail = true, "a line names "+id
	}
	lines = append(lines, rounds)

	trees := landedLine{name: "trees", ok: true, detail: "no lane tree under .claude/worktrees/"}
	plan.clean = nil
	var notes []string
	found, terr := laneTrees(main, repo, id, laneRefs{pr, headRef, headSha, mergedHead, commits})
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
	if pr != "" {
		if line := warnOnlyLine(repo, baseSha, headSha, mergedHead != ""); line != nil {
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
func warnOnlyLine(repo, base, head string, merged bool) *landedLine {
	line := &landedLine{name: "warn-only", fix: "take the rule out of WARN_ONLY in " + warnOnlyFile + ", its clean said"}
	land := head
	if merged {
		land = "origin/main"
	}
	// a squash leaves the pr's shas on no branch; a failed fetch shows at the read below
	_, _ = gitIn(repo, "fetch", "-q", "origin", base, head)
	before, err := warnOnlyAt(repo, base)
	var after, now []string
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
	var added, left []string
	for _, rule := range after {
		if !slices.Contains(before, rule) {
			added = append(added, rule)
			if slices.Contains(now, rule) {
				left = append(left, rule)
			}
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

var fenced = regexp.MustCompile("(?s)```.*?```")

// bodyNamesTicket finds a pr body's own «- ticket: <id>» line: never one quoted in a fence, never FRM-1x or FRM-12
func bodyNamesTicket(body, id string) bool {
	return regexp.MustCompile(`(?m)^[\s>*-]*ticket:\s*` + regexp.QuoteMeta(id) + `\b`).MatchString(fenced.ReplaceAllString(body, ""))
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
}

func landedIssue(flags Flags, id string) (landedRead, error) {
	actor, err := actorOf(flags)
	if err != nil {
		return landedRead{}, err
	}
	data, _, err := gql(actor, `query($id: String!) { issue(id: $id) { description comments(first: 100) { nodes { body } }
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

type laneTree struct{ path, reason string }

// what names a lane's trees beyond its codie/<ticket>-* branches: the pr, its head, its head once merged
type laneRefs struct {
	pr, headRef, headSha, mergedHead string
	commits                          []string // a quick lane's commits on origin/main, «<short sha> <subject>»
}

// the ticket ids a lane spec names as its chunks, in order, each once
func specChunks(spec string) []string {
	raw, _ := os.ReadFile(spec)
	var chunks []string
	for _, m := range chunkHeading.FindAllStringSubmatch(string(raw), -1) {
		if !slices.Contains(chunks, m[1]) {
			chunks = append(chunks, m[1])
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

var chunkHeading = regexp.MustCompile(`(?m)^## ((?:FRM|BYT|PK)-\d+)\b`)

// unmergedChunks names the spec's other chunks with no commit on origin/main; a squash merge carries the pr
// body's «- ticket:» lines, so a chunk merged in the same pr reads merged
func unmergedChunks(repo, spec, id string) []string {
	var waiting []string
	for _, chunk := range specChunks(spec) {
		if chunk != id && len(ticketCommits(repo, chunk)) == 0 {
			waiting = append(waiting, chunk)
		}
	}
	return waiting
}

// laneTrees lists the ticket's trees under .claude/worktrees/, each with why it must stay, or clean by
// the root rule: no change in git status, no file in .scratch/, every commit on an origin ref or in the merged pr.
// a lane tree is a codie/<ticket>-* branch or the pr's head ref; a detached one is sixth sense's verify tree,
// named verify-pr-<n> (frame), verify-<ticket> (any other repo) or sitting at the pr's head
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
		if !strings.HasPrefix(resolved(path), under) || !(ours || verify) {
			continue
		}
		trees = append(trees, laneTree{path, treeStay(entry, main, selves, mergedHead)})
	}
	return trees, nil
}

type worktreeEntry struct {
	path, branch, sha string
	detached, locked  bool
}

func worktreesOf(listed string) []worktreeEntry {
	var entries []worktreeEntry
	for block := range strings.SplitSeq(listed, "\n\n") {
		var e worktreeEntry
		for line := range strings.SplitSeq(block, "\n") {
			e.locked = e.locked || line == "locked" || strings.HasPrefix(line, "locked ")
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
		// git worktree lock: a session working in it, decamp refuses it anyway
		reason = strings.TrimPrefix(reason+", a live session holds it", ", ")
	}
	if session := liveSessionIn(e.path); session != "" {
		reason = strings.TrimPrefix(reason+", a live session sits in it: "+session, ", ")
	}
	return reason
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
	if id == "" {
		return ""
	}
	files, _ := filepath.Glob(filepath.Join(projectsDir(), "*", id+".jsonl"))
	// a session moved between trees can leave a transcript under two project dirs
	newest, at := "", time.Time{}
	for _, file := range files {
		if info, err := os.Stat(file); err == nil && info.ModTime().After(at) {
			newest, at = file, info.ModTime()
		}
	}
	if newest == "" {
		return ""
	}
	return lastCwdIn(newest)
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
		case file != ".scratch/" && !disposable.MatchString(file) && !seedCopy(tree, main, file):
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
	if merged := plan.lines[0]; !merged.ok {
		return nil, &Fail{Refused: true, Msg: "the lane has not landed (" + merged.detail + "): --apply archives and decamps only after the merge", Next: merged.fix}
	}
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
