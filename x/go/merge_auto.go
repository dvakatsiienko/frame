package main

import (
	"cmp"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// the merge gate as one verb (FRM-401): a pr merges when the verifier is clean on its head, every required
// check ran green for that head and no review thread is open. github's own auto-merge is never turned on:
// a stack cannot take it (gh-stack#504)

const mergeTrailer = "Merged-by: x lane merge-auto"

type mergeCheck struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

type mergeDecision struct {
	Repo     string       `json:"repo"`
	PR       string       `json:"pr"`
	Head     string       `json:"head"`
	Decision string       `json:"decision"`
	Wait     string       `json:"wait,omitempty"`
	Checks   []mergeCheck `json:"checks"`
	Risky    []string     `json:"risky"`
	Merged   string       `json:"merged,omitempty"`
	title    string
	body     string
}

type pullHead struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	State  string `json:"state"`
	Merged bool   `json:"merged"`
	Head   struct {
		Sha string `json:"sha"`
		Ref string `json:"ref"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
}

/* Verbs */
func mergeAutoPlan(r *Run, args []string, flags Flags) (any, error) {
	n := args[0]
	if !prNumber.MatchString(n) {
		return nil, usageFail(n+" is not a pr number", "x lane merge-auto <pr number>")
	}
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	api := githubBase() + "/repos/" + repo
	r.Open("#" + n + " " + repo)

	var pr pullHead
	if err := r.Step("pr", "reading the pr head", func() (string, error) {
		if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
			return "", err
		}
		if pr.Merged || pr.State != "open" {
			return "", &Fail{Refused: true, Msg: "#" + n + " is " + cmp.Or(map[bool]string{true: "merged"}[pr.Merged], pr.State) + ", nothing to merge",
				Next: "x gh pr " + n}
		}
		return pr.Head.Ref + " at " + short(pr.Head.Sha), nil
	}); err != nil {
		return nil, err
	}
	d := &mergeDecision{Repo: repo, PR: n, Head: pr.Head.Sha, Risky: []string{}, title: pr.Title, body: pr.Body}

	verifier := mergeCheck{Name: "verifier"}
	if err := r.Step("verifier", "reading the verifier's clean", func() (string, error) {
		verifier = verifierCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref)
		return verifier.shown()
	}); err != nil {
		return nil, err
	}
	ci := mergeCheck{Name: "ci"}
	needsApprove := false
	if err := r.Step("ci", "reading the required checks on the head", func() (string, error) {
		var err error
		ci, needsApprove, err = ciCheck(api, pr.Base.Ref, pr.Head.Sha)
		if err != nil || needsApprove {
			return ci.Detail, err
		}
		return ci.shown()
	}); err != nil {
		return nil, err
	}
	threads := mergeCheck{Name: "threads"}
	if err := r.Step("threads", "counting the open review threads", func() (string, error) {
		var err error
		threads, err = threadsCheck(repo, n)
		if err != nil {
			return "", err
		}
		return threads.shown()
	}); err != nil {
		return nil, err
	}
	d.Checks = []mergeCheck{verifier, ci, threads}
	var self []string
	if err := r.Step("risky", "matching the changed paths on the risky list", func() (string, error) {
		var err error
		d.Risky, self, err = riskyPaths(api, n)
		switch {
		case err != nil:
			return "", err
		case len(self) > 0:
			return "", notHeld("self-edit: " + strings.Join(self, ", "))
		case len(d.Risky) == 0:
			return "none touched", nil
		}
		return strings.Join(d.Risky, ", "), nil
	}); err != nil {
		return nil, err
	}
	brake := ""
	if err := r.Step("brake", "looking for a revert of a merge-auto merge in 7 days", func() (string, error) {
		var err error
		brake, err = brakeOn(pr.Base.Ref)
		switch {
		case err != nil:
			return "", err
		case brake != "":
			return "", notHeld("on: " + brake)
		}
		return "off", nil
	}); err != nil {
		return nil, err
	}

	d.Decision, d.Wait = decide(brake, self, needsApprove, d.Checks)
	if d.Decision == "wait" {
		// a wait is never a plan to confirm: --apply could only refuse it, so it exits 1 with or without it
		return nil, &Fail{Refused: true, Msg: "wait: " + d.Wait + "\n" + d.summary(), Next: "x lane merge-auto " + n + " once it holds"}
	}
	return d, nil
}

// the brake and a self-edit wait for dima first; then a bytes head missing only review:clean is approved;
// else the first check that does not hold names the wait
func decide(brake string, self []string, needsApprove bool, checks []mergeCheck) (decision, wait string) {
	verifier, threads := checks[0], checks[2]
	switch {
	case brake != "":
		return "wait", "brake on, needs dima's word — " + brake
	case len(self) > 0:
		return "wait", "self-edit, needs dima's word — " + strings.Join(self, ", ")
	case verifier.OK && threads.OK && needsApprove:
		return "approve", ""
	}
	for _, c := range checks {
		if !c.OK {
			return "wait", c.Detail
		}
	}
	return "merge", ""
}

func askMergeAuto(plan any) string {
	d := plan.(*mergeDecision)
	return "merge #" + d.PR + " at " + short(d.Head) + "?"
}

func mergeAuto(r *Run, _ []string, _ Flags, plan any) (any, error) {
	d := plan.(*mergeDecision)
	api := githubBase() + "/repos/" + d.Repo
	if d.Decision != "approve" {
		r.skip("approve")
	} else if err := r.Step("approve", "approving the head on dima's account, then waiting for review:clean", func() (string, error) {
		return approveAndAwait(api, d)
	}); err != nil {
		return nil, err
	}
	if err := r.Step("merge", "squash-merging the read head", func() (string, error) {
		var merged struct {
			Sha string `json:"sha"`
		}
		// the sha pins the merge to the head the checks were read on: a push since makes github refuse it
		_, err := ghCall(asDima, http.MethodPut, api+"/pulls/"+d.PR+"/merge", map[string]string{
			"sha": d.Head, "merge_method": "squash", "commit_title": d.title + " (#" + d.PR + ")",
			"commit_message": strings.TrimSpace(d.body) + "\n\n" + mergeTrailer,
		}, &merged)
		d.Merged = merged.Sha
		return "#" + d.PR + " → " + short(merged.Sha), err
	}); err != nil {
		return nil, err
	}
	r.Done("merged #"+d.PR+" at "+short(d.Merged)+"\n"+d.summary(), "")
	return d, nil
}

// a check's step line: ✓ with its detail when it holds, ✗ when it does not, and the run goes on
func (c mergeCheck) shown() (string, error) {
	if c.OK {
		return c.Detail, nil
	}
	return "", notHeld(c.Detail)
}

// the three checks and the risky line, the look card's lines on both outcomes
func (d *mergeDecision) summary() string {
	var lines []string
	for _, c := range d.Checks {
		mark := "✓"
		if !c.OK {
			mark = "✗"
		}
		lines = append(lines, mark+" "+c.Name+": "+c.Detail)
	}
	if len(d.Risky) > 0 {
		lines = append(lines, "risky: "+strings.Join(d.Risky, ", "))
	}
	return strings.Join(lines, "\n")
}

/* Risky paths */

// a path that can turn the checks themselves green; a self path is one merge-auto must not merge alone —
// the guards, the review workflows, this list and this file (dima, 2026-10-22, o57)
//
//go:embed risky.json
var riskyJSON []byte

var riskyList = func() (list struct{ Risky, Self []*regexp.Regexp }) {
	var raw struct{ Risky, Self []string }
	if err := json.Unmarshal(riskyJSON, &raw); err != nil {
		panic("risky.json: " + err.Error())
	}
	for _, g := range raw.Risky {
		list.Risky = append(list.Risky, globRegexp(g))
	}
	for _, g := range raw.Self {
		list.Self = append(list.Self, globRegexp(g))
	}
	return list
}()

// a glob over repo paths: `**/` is any number of dirs, `**` anything, `*` and `?` stay inside one segment
func globRegexp(glob string) *regexp.Regexp {
	var b strings.Builder
	b.WriteString("^")
	for i := 0; i < len(glob); i++ {
		switch {
		case strings.HasPrefix(glob[i:], "**/"):
			b.WriteString("(?:.*/)?")
			i += 2
		case strings.HasPrefix(glob[i:], "**"):
			b.WriteString(".*")
			i++
		case glob[i] == '*':
			b.WriteString("[^/]*")
		case glob[i] == '?':
			b.WriteString("[^/]")
		default:
			b.WriteString(regexp.QuoteMeta(glob[i : i+1]))
		}
	}
	return regexp.MustCompile(b.String() + "$")
}

func matchesAny(path string, globs []*regexp.Regexp) bool {
	return slices.ContainsFunc(globs, func(g *regexp.Regexp) bool { return g.MatchString(path) })
}

// every path the pr touches, a rename's old name included: a file moved out of a risky dir is still a
// change to it
func riskyPaths(api, n string) (risky, self []string, err error) {
	type file struct {
		Filename         string `json:"filename"`
		PreviousFilename string `json:"previous_filename"`
	}
	files, err := ghPages[file](asDima, api+"/pulls/"+n+"/files", "")
	if err != nil {
		return nil, nil, err
	}
	risky = []string{}
	for _, f := range files {
		for _, path := range []string{f.PreviousFilename, f.Filename} {
			if path == "" || slices.Contains(risky, path) {
				continue
			}
			isSelf := matchesAny(path, riskyList.Self)
			if isSelf {
				self = append(self, path)
			}
			if isSelf || matchesAny(path, riskyList.Risky) {
				risky = append(risky, path)
			}
		}
	}
	return risky, self, nil
}

/* The brake */

const brakeFor = 7 * 24 * time.Hour

var (
	revertsSha     = regexp.MustCompile(`(?m)^This reverts commit ([0-9a-f]{40})`)
	revertsSubject = regexp.MustCompile(`^Revert "(.+)"`)
)

// the brake keeps no state: a revert on base of a merge merge-auto made, in the last 7 days, holds every pr
// until dima's word, and lifts itself once it ages out (grill, 2026-10-20). git's own revert names the sha;
// github's revert button names only the subject
func brakeOn(base string) (string, error) {
	if got, _ := gitIn("", "fetch", "-q", "origin", base); !got.ok {
		return "", &Fail{Msg: "git could not fetch origin/" + base + " to read the brake: " + logLine(got.log), Next: "git fetch origin " + base}
	}
	ours, _ := gitIn("", "log", "origin/"+base, "--fixed-strings", "--grep="+mergeTrailer, "--format=%H%x00%s")
	merged := map[string]bool{}
	for line := range strings.Lines(ours.out) {
		sha, subject, _ := strings.Cut(strings.TrimSpace(line), "\x00")
		merged[sha], merged[subject] = true, true
	}
	if len(merged) == 0 {
		return "", nil
	}
	since := clock().Add(-brakeFor).Format(time.RFC3339)
	recent, _ := gitIn("", "log", "origin/"+base, "--since="+since, "--format=%H%x00%B%x1e")
	for record := range strings.SplitSeq(recent.out, "\x1e") {
		sha, message, _ := strings.Cut(strings.TrimSpace(record), "\x00")
		if match := revertsSha.FindStringSubmatch(message); match != nil && merged[match[1]] {
			return short(sha) + " reverts " + short(match[1]), nil
		}
		if match := revertsSubject.FindStringSubmatch(message); match != nil && merged[match[1]] {
			return short(sha) + " reverts «" + match[1] + "»", nil
		}
	}
	return "", nil
}

// X_NOW fixes the clock under X_TEST only
func clock() time.Time {
	if os.Getenv("X_TEST") != "" {
		if at, err := time.Parse(time.RFC3339, os.Getenv("X_NOW")); err == nil {
			return at
		}
	}
	return time.Now()
}

/* Checks */

// the verifier records its clean in one shared json, "<owner/repo>#<pr>" → the head sha it said clean on;
// a «clean» anywhere else (a pr comment, a body) is never read
func verifierCheck(repo, n, head, base, ref string) mergeCheck {
	c := mergeCheck{Name: "verifier"}
	home, _ := os.UserHomeDir()
	path := cmp.Or(os.Getenv("X_VERIFIED"), filepath.Join(home, ".claude/shelf/pr-verified.json"))
	raw, err := os.ReadFile(path)
	var store map[string]string
	if err != nil || json.Unmarshal(raw, &store) != nil {
		c.Detail = "no verifier store at " + home + "/.claude/shelf/pr-verified.json"
		return c
	}
	verified := store[repo+"#"+n]
	switch {
	case verified == "":
		c.Detail = "no verifier clean recorded for " + repo + "#" + n
	case verified == head:
		c.OK, c.Detail = true, "clean on "+short(head)
	default:
		c.OK, c.Detail = carried(verified, head, base, ref)
	}
	return c
}

// a clean carries to a new head when the branch's whole change is the verified one: the diff from its merge
// base with origin's base to its tip, hashed by `git patch-id --stable`. a rebase or a plain merge of main
// keeps it; an edit inside a merge, a dropped or an added commit changes it. the per-commit patch-ids only
// name the commit to blame
func carried(verified, head, base, ref string) (bool, string) {
	moved := "the verifier's clean is on " + short(verified) + ", the head is " + short(head)
	if got, _ := gitIn("", "fetch", "-q", "origin", base, ref); !got.ok {
		return false, moved + "; git could not fetch them to compare: " + logLine(got.log)
	}
	if got, _ := gitIn("", "cat-file", "-e", verified+"^{commit}"); !got.ok {
		if got, _ := gitIn("", "fetch", "-q", "origin", verified); !got.ok {
			return false, moved + "; " + short(verified) + " is gone from origin, nothing to compare"
		}
	}
	wasChange, err := branchPatch(verified, base)
	if err != nil {
		return false, moved + "; " + err.Error()
	}
	nowChange, err := branchPatch(head, base)
	if err != nil {
		return false, moved + "; " + err.Error()
	}
	if wasChange == nowChange {
		return true, "clean on " + short(verified) + ", carried to " + short(head) + ": the branch's patch-id is unchanged"
	}
	was, _ := patchIDs(verified, base)
	now, _ := patchIDs(head, base)
	for _, c := range now {
		if !slices.ContainsFunc(was, func(v patchCommit) bool { return v.id == c.id }) {
			return false, short(c.sha) + " " + c.subject + " is past the verifier's clean on " + short(verified)
		}
	}
	return false, moved + "; the branch's change differs from the verified one (a merge that edits, or a dropped commit)"
}

// the patch-id of everything a branch changes over origin's base, its merges included
func branchPatch(tip, base string) (string, error) {
	from, _ := gitIn("", "merge-base", "origin/"+base, tip)
	if !from.ok {
		return "", fmt.Errorf("git found no merge base of %s and origin/%s: %s", short(tip), base, logLine(from.log))
	}
	diff, _ := gitIn("", "diff", "--no-ext-diff", from.out, tip)
	id, _ := run("", nil, diff.out+"\n", "git", "patch-id", "--stable")
	patch, _, _ := strings.Cut(id.out, " ")
	return patch, nil
}

type patchCommit struct{ sha, subject, id string }

// the commits a branch adds over origin's base, merges skipped (merge-main's own commits carry no patch)
func patchIDs(tip, base string) ([]patchCommit, error) {
	listed, _ := gitIn("", "log", "--reverse", "--no-merges", "--format=%H %s", "origin/"+base+".."+tip)
	if !listed.ok {
		return nil, fmt.Errorf("git could not list %s's commits: %s", short(tip), logLine(listed.log))
	}
	var out []patchCommit
	for line := range strings.Lines(listed.out) {
		sha, subject, _ := strings.Cut(strings.TrimSpace(line), " ")
		shown, _ := gitIn("", "show", "--format=", sha)
		id, _ := run("", nil, shown.out+"\n", "git", "patch-id", "--stable")
		patch, _, _ := strings.Cut(id.out, " ")
		out = append(out, patchCommit{sha, subject, patch})
	}
	return out, nil
}

func logLine(text string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(text), "\n")
	return line
}

// bytes' review:clean: one ci round, then an approve on dima's account makes review-approved.yml publish it
// (PK-103 W101); merge-auto gives that approve only on the verifier's clean
const reviewClean = "review:clean"

func approveAndAwait(api string, d *mergeDecision) (string, error) {
	if _, err := ghCall(asDima, http.MethodPost, api+"/pulls/"+d.PR+"/reviews", map[string]string{
		"commit_id": d.Head, "event": "APPROVE", "body": "verifier clean on " + short(d.Head) + " — x lane merge-auto",
	}, nil); err != nil {
		return "", err
	}
	wait, poll := durationEnv("X_REVIEW_WAIT", 10*time.Minute), durationEnv("X_POLL", 15*time.Second)
	for deadline := time.Now().Add(wait); ; time.Sleep(poll) {
		ran, err := checksOf(asDima, api, d.Head)
		if err != nil {
			return "", err
		}
		if i := slices.IndexFunc(ran, func(p prCheck) bool { return p.Name == reviewClean }); i >= 0 && ran[i].State == "success" {
			return "approved " + short(d.Head) + ", " + reviewClean + " green", nil
		}
		if time.Now().After(deadline) {
			return "", &Fail{Msg: fmt.Sprintf("approved %s, and %s was not green on it after %s", short(d.Head), reviewClean, wait),
				Next: "gh run list --workflow review-approved.yml, then x lane merge-auto " + d.PR}
		}
	}
}

// a wait or a poll shortened by env, under X_TEST only
func durationEnv(name string, fallback time.Duration) time.Duration {
	if os.Getenv("X_TEST") != "" {
		if d, err := time.ParseDuration(os.Getenv(name)); err == nil {
			return d
		}
	}
	return fallback
}

// every required check ran for this head and concluded success; «no run» and «skipped» are never green.
// needsApprove: review:clean is the only one missing, and an approve publishes it
func ciCheck(api, base, head string) (mergeCheck, bool, error) {
	c := mergeCheck{Name: "ci"}
	var protection struct {
		Contexts []string `json:"contexts"`
		Checks   []struct {
			Context string `json:"context"`
		} `json:"checks"`
	}
	status, _, err := ghSend(asDima, http.MethodGet, api+"/branches/"+base+"/protection/required_status_checks", nil, &protection)
	if err != nil && status != http.StatusNotFound {
		return c, false, err
	}
	required := protection.Contexts
	for _, check := range protection.Checks {
		if !slices.Contains(required, check.Context) {
			required = append(required, check.Context)
		}
	}
	if len(required) == 0 {
		c.Detail = "0 required checks on " + base + ": nothing proves the head"
		return c, false, nil
	}
	ran, err := checksOf(asDima, api, head)
	if err != nil {
		return c, false, err
	}
	reviewState := ""
	for _, name := range required {
		i := slices.IndexFunc(ran, func(p prCheck) bool { return p.Name == name })
		switch {
		case name == reviewClean && (i < 0 || ran[i].State != "success"):
			reviewState = "missing"
			if i >= 0 {
				reviewState = ran[i].State
			}
		case i < 0:
			c.Detail = "no run of " + name + " for " + short(head)
			return c, false, nil
		case ran[i].State != "success":
			c.Detail = name + " is " + ran[i].State + " on " + short(head)
			return c, false, nil
		}
	}
	if reviewState != "" {
		c.Detail = fmt.Sprintf("%s is %s on %s, the rest of %d required green", reviewClean, reviewState, short(head), len(required))
		return c, true, nil
	}
	c.OK, c.Detail = true, fmt.Sprintf("%d of %d required green on %s", len(required), len(required), short(head))
	return c, false, nil
}

func threadsCheck(repo, n string) (mergeCheck, error) {
	c := mergeCheck{Name: "threads"}
	owner, name, _ := strings.Cut(repo, "/")
	var answer struct {
		Data struct {
			Repository struct {
				PullRequest struct {
					ReviewThreads struct {
						Nodes []struct {
							IsResolved bool   `json:"isResolved"`
							Path       string `json:"path"`
							Line       *int   `json:"line"`
							Comments   struct {
								Nodes []struct {
									URL string `json:"url"`
								} `json:"nodes"`
							} `json:"comments"`
						} `json:"nodes"`
					} `json:"reviewThreads"`
				} `json:"pullRequest"`
			} `json:"repository"`
		} `json:"data"`
	}
	query := `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){
reviewThreads(first:100){nodes{isResolved path line comments(first:1){nodes{url}}}}}}}`
	var number int
	_, _ = fmt.Sscan(n, &number)
	if _, err := ghCall(asDima, http.MethodPost, githubBase()+"/graphql", map[string]any{
		"query": query, "variables": map[string]any{"owner": owner, "name": name, "number": number},
	}, &answer); err != nil {
		return c, err
	}
	var open []string
	for _, t := range answer.Data.Repository.PullRequest.ReviewThreads.Nodes {
		if t.IsResolved {
			continue
		}
		where := t.Path
		if t.Line != nil {
			where = fmt.Sprintf("%s:%d", t.Path, *t.Line)
		}
		if len(t.Comments.Nodes) > 0 {
			where += " " + t.Comments.Nodes[0].URL
		}
		open = append(open, where)
	}
	if len(open) > 0 {
		c.Detail = plural(len(open), "open review thread") + ": " + strings.Join(open, ", ")
		return c, nil
	}
	c.OK, c.Detail = true, "0 open"
	return c, nil
}
