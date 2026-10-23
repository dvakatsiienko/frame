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

// github's own auto-merge is never turned on: a stack cannot take it (gh-stack#504)
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
	layered  bool
	heads    map[string]string // a stack's every gated head, pr → sha
	landed   string
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
	var layers *prLayers
	if err := r.Step("pr", "reading the pr head", func() (string, error) {
		if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
			return "", err
		}
		state := pr.State
		if pr.Merged {
			state = "merged"
		}
		if state != "open" {
			return "", &Fail{Refused: true, Msg: "#" + n + " is " + state + ", nothing to merge", Next: "x gh pr " + n}
		}
		if laneAddOn.layersOf != nil {
			var err error
			if layers, err = laneAddOn.layersOf(repo, n, pr); err != nil {
				return "", err
			}
			if layers != nil && layers.wait != "" {
				return "", &Fail{Refused: true, Msg: "wait: " + layers.wait, Next: "x lane merge-auto " + n}
			}
		}
		return pr.Head.Ref + " at " + short(pr.Head.Sha), nil
	}); err != nil {
		return nil, err
	}
	d := &mergeDecision{Repo: repo, PR: n, Head: pr.Head.Sha, Risky: []string{}, title: pr.Title, body: pr.Body}
	trunk := pr.Base.Ref
	if layers == nil {
		r.skip("layers")
	} else {
		trunk, d.layered = layers.trunk, true
		d.heads = map[string]string{n: pr.Head.Sha}
		if err := r.Step("layers", "gating every layer under the pr", func() (string, error) {
			for _, below := range layers.below {
				wait, err := layerWait(repo, api, trunk, below, d)
				if err != nil {
					return "", err
				}
				if wait != "" {
					return "", &Fail{Refused: true, Msg: "wait: " + wait + " — a stack merges all of its layers at once", Next: "x lane merge-auto " + n}
				}
			}
			if len(layers.below) == 0 {
				return "the bottom layer, onto " + trunk, nil
			}
			return "#" + strings.Join(layers.below, ", #") + " clean, green, threadless", nil
		}); err != nil {
			return nil, err
		}
	}

	var verifier, ci, threads mergeCheck
	if err := r.Step("verifier", "reading the verifier's clean", func() (string, error) {
		verifier = verifierCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref)
		return verifier.shown()
	}); err != nil {
		return nil, err
	}
	needsApprove := false
	if err := r.Step("ci", "reading the required checks on the head", func() (string, error) {
		var err error
		ci, needsApprove, err = ciCheck(api, trunk, pr.Head.Ref, pr.Head.Sha)
		if err != nil || needsApprove {
			return ci.Detail, err
		}
		return ci.shown()
	}); err != nil {
		return nil, err
	}
	if err := r.Step("threads", "counting the open review threads", func() (string, error) {
		var err error
		if threads, err = threadsCheck(repo, n); err != nil {
			return "", err
		}
		return threads.shown()
	}); err != nil {
		return nil, err
	}
	d.Checks = []mergeCheck{verifier, ci, threads}
	var self []string
	if err := r.Step("risky", "matching the changed paths on the risky list", func() (string, error) {
		own, ownSelf, err := riskyPaths(api, n)
		// a stack's lower layers named theirs in the layers step; the card shows every layer's
		d.Risky, self = append(own, d.Risky...), ownSelf
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
		brake, err = brakeOn(trunk)
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

	d.Decision, d.Wait = decide(brake, self, needsApprove, verifier, ci, threads)
	if d.Decision == "wait" {
		// --apply could only refuse a wait, so it never prints as a plan to confirm
		return nil, &Fail{Refused: true, Msg: "wait: " + d.Wait + "\n" + d.summary(), Next: "x lane merge-auto " + n, Data: d}
	}
	return d, nil
}

// the brake and a self-edit outrank every check; a bytes head missing only review:clean gets the approve
func decide(brake string, self []string, needsApprove bool, verifier, ci, threads mergeCheck) (decision, wait string) {
	switch {
	case brake != "":
		return "wait", "brake on, needs dima's word — " + brake
	case len(self) > 0:
		return "wait", "self-edit, needs dima's word — " + strings.Join(self, ", ")
	case verifier.OK && threads.OK && needsApprove:
		return "approve", ""
	}
	for _, c := range []mergeCheck{verifier, ci, threads} {
		if !c.OK {
			return "wait", c.Detail
		}
	}
	return "merge", ""
}

// why a layer under the merged pr holds the merge, as the same gate reads it; "" when it passes
func layerWait(repo, api, trunk, n string, d *mergeDecision) (string, error) {
	var pr pullHead
	if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
		return "", err
	}
	d.heads[n] = pr.Head.Sha
	verifier := verifierCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref)
	ci, needsApprove, err := ciCheck(api, trunk, pr.Head.Ref, pr.Head.Sha)
	if err != nil {
		return "", err
	}
	threads, err := threadsCheck(repo, n)
	if err != nil {
		return "", err
	}
	risky, self, err := riskyPaths(api, n)
	if err != nil {
		return "", err
	}
	for _, path := range risky {
		d.Risky = append(d.Risky, "#"+n+" "+path)
	}
	layer := "#" + n + " (" + pr.Head.Ref + ")"
	decision, wait := decide("", self, needsApprove, verifier, ci, threads)
	switch decision {
	case "merge":
		return "", nil
	case "approve":
		return layer + " needs its review:clean first: x lane merge-auto --apply " + n, nil
	}
	for _, c := range []mergeCheck{verifier, ci, threads} {
		if !c.OK && c.Detail == wait {
			wait = c.Name + ": " + wait
		}
	}
	return layer + " — " + wait, nil
}

// the async merge takes no sha to pin, so every gated head is read again right before it: a push since refuses
func headsHeld(api string, heads map[string]string) error {
	for n, gated := range heads {
		var pr pullHead
		if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
			return err
		}
		if pr.Head.Sha != gated {
			return &Fail{Refused: true, Msg: fmt.Sprintf("#%s moved from %s to %s after the gate read it; nothing merged", n, short(gated), short(pr.Head.Sha)),
				Next: "x lane merge-auto <pr>, once the verifier cleared #" + n + "'s new head"}
		}
	}
	return nil
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
		if d.layered && laneAddOn.mergeLayers != nil {
			// a stacked pr refuses the plain endpoint (403); its layers land together or not at all
			if err := headsHeld(api, d.heads); err != nil {
				return "", err
			}
			shown, sha, err := laneAddOn.mergeLayers(d.Repo, d.PR)
			d.landed = shown
			d.Merged = sha
			return shown, err
		}
		var merged struct {
			Sha string `json:"sha"`
		}
		// the sha pins the merge to the head the checks read: a push since makes github refuse it
		_, _, err := ghSend(asDima, http.MethodPut, api+"/pulls/"+d.PR+"/merge", map[string]string{
			"sha": d.Head, "merge_method": "squash", "commit_title": d.title + " (#" + d.PR + ")",
			"commit_message": strings.TrimSpace(d.body) + "\n\n" + mergeTrailer,
		}, &merged)
		d.Merged = merged.Sha
		return "#" + d.PR + " → " + short(merged.Sha), err
	}); err != nil {
		return nil, err
	}
	result := "merged #" + d.PR + " at " + short(d.Merged)
	if d.layered {
		result = d.landed
	}
	r.Done(result+"\n"+d.summary(), "")
	return d, nil
}

func (c mergeCheck) shown() (string, error) {
	if c.OK {
		return c.Detail, nil
	}
	return "", notHeld(c.Detail)
}

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

//go:embed risky.json
var riskyJSON []byte

var riskyList = func() (list struct{ Risky, Self []*regexp.Regexp }) {
	var raw struct{ Risky, Self []string }
	if err := json.Unmarshal(riskyJSON, &raw); err != nil {
		panic("risky.json: " + err.Error())
	}
	compile := func(globs []string) (out []*regexp.Regexp) {
		for _, g := range globs {
			out = append(out, globRegexp(g))
		}
		return out
	}
	list.Risky, list.Self = compile(raw.Risky), compile(raw.Self)
	return list
}()

// `**/` is any number of dirs, `**` anything, `*` and `?` stay inside one segment
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

// a rename's old name counts: a file moved out of a risky dir is still a change to it
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

// no stored state (grill, 2026-10-20); git's revert names the sha, github's revert button only the subject
func brakeOn(base string) (string, error) {
	if _, err := mustGit("brake", "fetch", "-q", "origin", base); err != nil {
		return "", err
	}
	ours, err := mustGit("brake", "log", "origin/"+base, "--fixed-strings", "--grep="+mergeTrailer, "--format=%H%x00%s")
	if err != nil {
		return "", err
	}
	merged := map[string]bool{}
	for line := range strings.Lines(ours) {
		sha, subject, _ := strings.Cut(strings.TrimSpace(line), "\x00")
		merged[sha], merged[subject] = true, true
	}
	if len(merged) == 0 {
		return "", nil
	}
	since := clock().Add(-brakeFor).Format(time.RFC3339)
	recent, err := mustGit("brake", "log", "origin/"+base, "--since="+since, "--format=%H%x00%B%x1e")
	if err != nil {
		return "", err
	}
	for record := range strings.SplitSeq(recent, "\x1e") {
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

func clock() time.Time {
	if os.Getenv("X_TEST") != "" {
		if at, err := time.Parse(time.RFC3339, os.Getenv("X_NOW")); err == nil {
			return at
		}
	}
	return time.Now()
}

/* Checks */

// a «clean» in a pr comment or body is never read: only the verifier writes this store
func verifierCheck(repo, n, head, base, ref string) mergeCheck {
	c := mergeCheck{Name: "verifier"}
	home, _ := os.UserHomeDir()
	path := cmp.Or(os.Getenv("X_VERIFIED"), filepath.Join(home, ".claude/shelf/pr-verified.json"))
	raw, err := os.ReadFile(path)
	var store map[string]string
	if err != nil || json.Unmarshal(raw, &store) != nil {
		c.Detail = "no verifier store at " + path
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

// the whole branch change is compared, merges included: per-commit patch-ids let an edit inside a merge slip
// (verifier round 1); they only name the commit to blame
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
	was, errWas := patchIDs(verified, base)
	now, errNow := patchIDs(head, base)
	if errWas == nil && errNow == nil {
		for _, c := range now {
			if !slices.ContainsFunc(was, func(v patchCommit) bool { return v.id == c.id }) {
				return false, short(c.sha) + " " + c.subject + " is past the verifier's clean on " + short(verified)
			}
		}
	}
	return false, moved + "; the branch's change differs from the verified one (a merge that edits, or a dropped commit)"
}

// the patch-id of everything a branch changes over origin's base, from their merge base
func branchPatch(tip, base string) (string, error) {
	from, err := mustGit("compare", "merge-base", "origin/"+base, tip)
	if err != nil {
		return "", err
	}
	diff, err := mustGit("compare", "diff", "--no-ext-diff", from, tip)
	if err != nil {
		return "", err
	}
	return patchID(diff)
}

func patchID(patch string) (string, error) {
	// --verbatim: --stable drops whitespace, and yaml, python and makefiles read it (dima, 2026-10-22)
	got, _ := run("", nil, patch+"\n", "git", "patch-id", "--verbatim")
	if !got.ok {
		return "", fmt.Errorf("git patch-id failed: %s", logLine(got.log))
	}
	id, _, _ := strings.Cut(got.out, " ")
	return id, nil
}

type patchCommit struct{ sha, subject, id string }

// merges skipped: a plain merge of main carries no patch of its own
func patchIDs(tip, base string) ([]patchCommit, error) {
	listed, err := mustGit("compare", "log", "--reverse", "--no-merges", "--format=%H %s", "origin/"+base+".."+tip)
	if err != nil {
		return nil, err
	}
	var out []patchCommit
	for line := range strings.Lines(listed) {
		sha, subject, _ := strings.Cut(strings.TrimSpace(line), " ")
		shown, err := mustGit("compare", "show", "--format=", sha)
		if err != nil {
			return nil, err
		}
		id, err := patchID(shown)
		if err != nil {
			return nil, err
		}
		out = append(out, patchCommit{sha, subject, id})
	}
	return out, nil
}

func logLine(text string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(text), "\n")
	return line
}

// bytes: one ci review round, then an approve on dima's account makes review-approved.yml publish it
const reviewClean = "review:clean"

func approveAndAwait(api string, d *mergeDecision) (string, error) {
	if _, _, err := ghSend(asDima, http.MethodPost, api+"/pulls/"+d.PR+"/reviews", map[string]string{
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
				Next: "x lane merge-auto " + d.PR}
		}
	}
}

// «no run» and «skipped» are never green; needsApprove when review:clean alone is missing after the ci round
func ciCheck(api, base, ref, head string) (mergeCheck, bool, error) {
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
	if reviewState == "" {
		c.OK, c.Detail = true, fmt.Sprintf("%d of %d required green on %s", len(required), len(required), short(head))
		return c, false, nil
	}
	c.Detail = fmt.Sprintf("%s is %s on %s, the rest of %d required green", reviewClean, reviewState, short(head), len(required))
	rounds, err := reviewRounds(api, ref)
	if err != nil {
		return c, false, err
	}
	if rounds == 0 {
		c.Detail += "; no ci review round ran on " + ref + " yet — x lane review first"
		return c, false, nil
	}
	return c, true, nil
}

// the server's ?branch= filter once answered 0 over a success (review.go, #116): filtered here instead
func reviewRounds(api, ref string) (int, error) {
	type run struct {
		HeadBranch string `json:"head_branch"`
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
	}
	status, _, err := ghSend(asDima, http.MethodGet, api+"/actions/workflows/review.yml", nil, nil)
	if status == http.StatusNotFound {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	runs, err := ghPages[run](asDima, api+"/actions/workflows/review.yml/runs", "workflow_runs")
	if err != nil {
		return 0, err
	}
	rounds := 0
	for _, r := range runs {
		if r.HeadBranch == ref && r.Status == "completed" && r.Conclusion == "success" {
			rounds++
		}
	}
	return rounds, nil
}

func threadsCheck(repo, n string) (mergeCheck, error) {
	c := mergeCheck{Name: "threads"}
	owner, name, _ := strings.Cut(repo, "/")
	var answer struct {
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
		Data struct {
			Repository struct {
				PullRequest *struct {
					ReviewThreads struct {
						PageInfo struct {
							HasNextPage bool `json:"hasNextPage"`
						} `json:"pageInfo"`
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
reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved path line comments(first:1){nodes{url}}}}}}}`
	var number int
	_, _ = fmt.Sscan(n, &number)
	if _, _, err := ghSend(asDima, http.MethodPost, githubBase()+"/graphql", map[string]any{
		"query": query, "variables": map[string]any{"owner": owner, "name": name, "number": number},
	}, &answer); err != nil {
		return c, err
	}
	// github answers a graphql failure with a 200: an error or a missing pr must never read as 0 open threads
	pr := answer.Data.Repository.PullRequest
	if len(answer.Errors) > 0 || pr == nil {
		said := "no pull request in the answer"
		if len(answer.Errors) > 0 {
			said = answer.Errors[0].Message
		}
		return c, &Fail{Msg: "github could not list the review threads of #" + n + ": " + said, Next: "x gh pr " + n}
	}
	if pr.ReviewThreads.PageInfo.HasNextPage {
		c.Detail = "over 100 review threads, more than one read holds"
		return c, nil
	}
	var open []string
	for _, t := range pr.ReviewThreads.Nodes {
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
