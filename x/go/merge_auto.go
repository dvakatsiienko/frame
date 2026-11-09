package main

import (
	"cmp"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// github's own auto-merge is never turned on: a stack cannot take it (gh-stack#504)
const mergeTrailer = "Merged-by: x lane merge-auto"

const renovateExemptTrailer = "Clean-exempt: renovate's own commits, ci is their review"

// the mark of a merge whose commit carries no trailer (github's async merge takes no message)
const mergedLabel = "merged-by-x"

// the mark of a merge that landed another head than the one the gate read: the brake, until dima's typed word
const brakeLabel = "merge-brake"

type mergeCheck struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
	// the store has no clean for this pr at all, as against one on another head or a store that does not read
	noClean bool
	// passed with no clean, as renovate's own commits; the squash message records it
	renovateExempt bool
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
	Sign     string       `json:"sign,omitempty"`
	// set while operator-override prs is on: every check below hold and brake goes unread
	Override *overrideUsed `json:"override,omitempty"`
	// --override-off's scopes, and whether it clears only a shift's
	Cleared   []string `json:"cleared,omitempty"`
	shiftOnly bool
	title     string
	body      string
	layered   bool
	heads     map[string]string // a stack's every gated head, pr → sha
	signs     map[string]chunkSign
	dimaOK    bool // --dima-ok named this pr; x-mod-guard proved it against his last typed prompt
	landed    string
	headRef   string
	holds     []string
	Trees     []string `json:"trees,omitempty"`
	Holds     string   `json:"holds,omitempty"`
}

type pullHead struct {
	Title  string `json:"title"`
	Body   string `json:"body"`
	State  string `json:"state"`
	Merged bool   `json:"merged"`
	User   struct {
		Login string `json:"login"`
	} `json:"user"`
	Head struct {
		Sha string `json:"sha"`
		Ref string `json:"ref"`
	} `json:"head"`
	Base struct {
		Ref string `json:"ref"`
	} `json:"base"`
	// github's own read of whether it would merge: null while it computes, after a push
	Mergeable      *bool  `json:"mergeable"`
	MergeableState string `json:"mergeable_state"`
}

/* Verbs */
func mergeAutoPlan(r *Run, args []string, flags Flags) (any, error) {
	off, _ := flags["override-off"].(bool)
	shiftOnly, _ := flags["shift-only"].(bool)
	check, _ := flags["override-check"].(bool)
	switch {
	case flags["brake-check"] == true:
		alone := len(args) == 0 && !off && !shiftOnly && !check
		for _, other := range []string{"hold", "release-hold", "release-brake"} {
			alone = alone && flags[other] != true
		}
		if word, _ := flags["dima-ok"].(string); !alone || word != "" {
			return nil, usageFail("--brake-check reads the fleet's brake: it takes no pr and no other switch", "x lane merge-auto --brake-check")
		}
		return brakeCheckPlan(r)
	case check && (off || shiftOnly || len(args) > 0):
		return nil, usageFail("--override-check reads every open pr: it takes no pr and no other switch", "x lane merge-auto --override-check")
	case check:
		return overrideCheckPlan(r)
	case shiftOnly && !off:
		return nil, usageFail("--shift-only narrows --override-off", "x lane merge-auto --override-off --shift-only --apply")
	case off && len(args) > 0:
		return nil, usageFail("--override-off takes no pr: it turns the whole switch off", "x lane merge-auto --override-off --apply")
	case off:
		return overrideOffPlan(r, shiftOnly)
	case len(args) == 0:
		return nil, usageFail("name the pr", "x lane merge-auto <pr number>")
	}
	n := args[0]
	if !prNumber.MatchString(n) {
		return nil, usageFail(n+" is not a pr number", "x lane merge-auto <pr number>")
	}
	word, _ := flags["dima-ok"].(string)
	if word != "" && word != n {
		return nil, usageFail("--dima-ok names #"+word+", this merge is #"+n+": dima's word counts for the pr it names", "x lane merge-auto "+n+" --apply --dima-ok "+n)
	}
	hold, _ := flags["hold"].(bool)
	releaseHold, _ := flags["release-hold"].(bool)
	switch {
	case hold && releaseHold:
		return nil, usageFail("--hold and --release-hold undo each other: name one", "x lane merge-auto "+n+" --hold --apply")
	case releaseHold && word == "":
		return nil, usageFail("a hold is released only on dima's typed word", "x lane merge-auto "+n+" --release-hold --dima-ok "+n+" --apply")
	case hold:
		return holdPlan(r, n, "hold", flags)
	case releaseHold:
		return holdPlan(r, n, "release-hold", flags)
	}
	if release, _ := flags["release-brake"].(bool); release {
		if word == "" {
			return nil, usageFail("the brake is released only on dima's typed word", releaseBrake(n))
		}
		repo, err := repoOf(flags)
		if err != nil {
			return nil, err
		}
		r.Open("#" + n + " " + repo)
		return &mergeDecision{Repo: repo, PR: n, Decision: "release", Risky: []string{}}, nil
	}
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	api := githubBase() + "/repos/" + repo
	r.Open("#" + n + " " + repo)

	var pr pullHead
	var layers *prLayers
	var held []string
	var holdErr error
	var override *overrideUsed
	if grant, on := overrideOn(overrideScopePrs, ""); on {
		override = &overrideUsed{Scope: overrideScopePrs, By: grant.By, At: grant.At, DevBuild: isDevBuild()}
	}
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
		held, holdErr = readHolds(repo)
		if stop := holdStop(repo, n, held, holdErr); stop != "" && word == "" {
			return "", holdRefusal(n, stop)
		}
		if laneAddOn.layersOf != nil {
			var err error
			layers, err = laneAddOn.layersOf(repo, n, pr)
			switch {
			// a stack's read that failed stops nothing under the override: github refuses the plain merge of a stacked pr in its own words
			case err != nil && override != nil && pr.Base.Ref == "main":
				layers = nil
			case err != nil:
				return "", err
			case layers != nil && layers.wait != "":
				return "", &Fail{Refused: true, Msg: "wait: " + layers.wait, Next: "x lane merge-auto " + n}
			}
		}
		return pr.Head.Ref + " at " + short(pr.Head.Sha), nil
	}); err != nil {
		return nil, err
	}
	d := &mergeDecision{Repo: repo, PR: n, Head: pr.Head.Sha, Risky: []string{}, title: pr.Title, body: pr.Body, headRef: pr.Head.Ref, signs: map[string]chunkSign{}, dimaOK: word != ""}
	if override != nil {
		d.Override, d.Sign = override, override.named()
	}
	trunk := pr.Base.Ref
	if layers == nil {
		r.skip("layers")
	} else {
		trunk, d.layered = layers.trunk, true
		d.heads = map[string]string{n: pr.Head.Sha}
		if err := r.Step("layers", "gating every layer under the pr", func() (string, error) {
			for _, below := range layers.below {
				if stop := holdStop(repo, below, held, holdErr); stop != "" && word == "" {
					return "", holdRefusal(n, stop+" — a stack merges all of its layers at once")
				}
				if d.Override != nil {
					var layer pullHead
					if _, err := ghFetch(asDima, api+"/pulls/"+below, &layer); err != nil {
						return "", err
					}
					d.heads[below] = layer.Head.Sha
					continue
				}
				wait, err := layerWait(repo, api, trunk, below, d)
				if err != nil {
					return "", err
				}
				if wait != "" {
					return "", &Fail{Refused: true, Msg: "wait: " + wait + " — a stack merges all of its layers at once", Next: "x lane merge-auto " + n}
				}
			}
			if d.Override != nil {
				return "under the override, no layer's checks read", nil
			}
			if len(layers.below) == 0 {
				return "the bottom layer, onto " + trunk, nil
			}
			return "#" + strings.Join(layers.below, ", #") + " clean, green, threadless", nil
		}); err != nil {
			return nil, err
		}
	}

	var sixthSense, ci, round, mergeable, deploy, threads mergeCheck
	if d.Override != nil {
		r.skip("sixth-sense", "ci", "mergeable", "deploy", "round", "threads")
	} else {
		if err := r.Step("sixth-sense", "reading sixth sense's clean", func() (string, error) {
			sixthSense = d.sixthSenseOf(api, repo, n, pr)
			return sixthSense.shown()
		}); err != nil {
			return nil, err
		}
		if err := r.Step("ci", "reading the required checks on the head", func() (string, error) {
			var err error
			if ci, err = ciCheck(api, trunk, pr.Head.Sha); err != nil {
				return "", err
			}
			return ci.shown()
		}); err != nil {
			return nil, err
		}
		if err := r.Step("mergeable", "reading whether github would merge it", func() (string, error) {
			var err error
			// a pr in a stack, its bottom layer included, is fixed by the restack, so it reads with no trunk as a layer does
			plainTrunk := trunk
			if d.layered {
				plainTrunk = ""
			}
			if mergeable, err = mergeableCheck(api, n, pr, plainTrunk, newWaitClock()); err != nil {
				return "", err
			}
			return mergeable.shown()
		}); err != nil {
			return nil, err
		}
		if err := r.Step("deploy", "reading main's deploy, which the merge lands on", func() (string, error) {
			var err error
			// production deploys from main whatever the pr's base, so main's tip is the one a merge lands on in the end
			if deploy, err = deployCheck(api, repo, "main"); err != nil {
				return "", err
			}
			return deploy.shown()
		}); err != nil {
			return nil, err
		}
		if err := r.Step("round", "reading the reviewer's round on the branch", func() (string, error) {
			var err error
			if round, err = roundCheck(api, repo, n, pr.Base.Ref, pr.Head.Ref, pr.Head.Sha, pr.User.Login, d.dimaOK); err != nil {
				return "", err
			}
			return round.shown()
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
		d.Checks = []mergeCheck{sixthSense, ci, mergeable, deploy, threads}
		if roundGated(repo) {
			d.Checks = []mergeCheck{sixthSense, ci, mergeable, deploy, round, threads}
		}
	}
	selfWait := ""
	if err := r.Step("risky", "matching the changed paths on the risky list", func() (string, error) {
		own, ownSelf, err := riskyPaths(api, n)
		if d.Override != nil {
			// the list only names; a read that failed stops nothing under the override
			if err != nil {
				return "the risky list did not read: " + err.Error(), nil
			}
			d.Risky = append(own, d.Risky...)
			return d.Override.named(), nil
		}
		if err != nil {
			return "", err
		}
		// a stack's lower layers named theirs in the layers step; the card shows every layer's
		d.Risky = append(own, d.Risky...)
		if selfWait, err = d.selfWait(pr, ownSelf); err != nil {
			return "", err
		}
		switch {
		case selfWait != "":
			return "", notHeld(selfWait)
		case len(ownSelf) > 0:
			return strings.Join(d.Risky, ", ") + " — " + d.Sign, nil
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
		brake, err = brakeOn(repo, trunk)
		switch {
		case err != nil:
			return "", brakeReadFail(err)
		case brake != "":
			return "", notHeld("on: " + brake)
		}
		return "off", nil
	}); err != nil {
		return nil, err
	}

	if d.Override != nil && brake == "" {
		d.Decision = "merge"
		return d, nil
	}
	d.Decision, d.Wait = decide(brake, selfWait, sixthSense, round, ci, mergeable, deploy, threads)
	if d.Decision == "wait" {
		// --apply could only refuse a wait, so it never prints as a plan to confirm
		return nil, &Fail{Refused: true, Msg: "wait: " + d.Wait + "\n" + d.summary(), Next: "x lane merge-auto " + n, Data: d}
	}
	return d, nil
}

// the brake and a self-edit outrank every check
// the checks in the order their waits outrank each other: mergeable after ci, since a pending required check is what
// github's blocked means, so ci names it first
func decide(brake, selfWait string, checks ...mergeCheck) (decision, wait string) {
	switch {
	case brake != "":
		return "wait", "brake on, needs dima's word — " + brake
	case selfWait != "":
		return "wait", selfWait
	}
	for _, c := range checks {
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
	sixthSense := d.sixthSenseOf(api, repo, n, pr)
	ci, err := ciCheck(api, trunk, pr.Head.Sha)
	if err != nil {
		return "", err
	}
	round, err := roundCheck(api, repo, n, pr.Base.Ref, pr.Head.Ref, pr.Head.Sha, pr.User.Login, d.dimaOK)
	if err != nil {
		return "", err
	}
	threads, err := threadsCheck(repo, n)
	if err != nil {
		return "", err
	}
	// a layer's conflict is fixed by restacking the stack onto main, never by merging main into one layer, so no trunk
	mergeable, err := mergeableCheck(api, n, pr, "", newWaitClock())
	if err != nil {
		return "", err
	}
	risky, ownSelf, err := riskyPaths(api, n)
	if err != nil {
		return "", err
	}
	for _, path := range risky {
		d.Risky = append(d.Risky, "#"+n+" "+path)
	}
	selfWait, err := d.selfWait(pr, ownSelf)
	if err != nil {
		return "", err
	}
	layer := "#" + n + " (" + pr.Head.Ref + ")"
	// main's deploy is the merged pr's own check, read once for the whole stack
	decision, wait := decide("", selfWait, sixthSense, round, ci, mergeable, threads)
	if decision == "merge" {
		return "", nil
	}
	for _, c := range []mergeCheck{sixthSense, ci, round, mergeable, threads} {
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
				Next: "x lane merge-auto <pr>, once sixth sense cleared #" + n + "'s new head"}
		}
	}
	return nil
}

func askMergeAuto(plan any) string {
	d := plan.(*mergeDecision)
	switch d.Decision {
	case "override-off":
		return "turn operator-override off?"
	case "release":
		return "release the brake #" + d.PR + " holds?"
	case "hold":
		return "hold #" + strings.Join(d.holds, ", #") + " until dima's word?"
	case "release-hold":
		return "release the hold on #" + strings.Join(d.holds, ", #") + "?"
	}
	return "merge #" + d.PR + " at " + short(d.Head) + "?"
}

func mergeAuto(r *Run, _ []string, _ Flags, plan any) (any, error) {
	d := plan.(*mergeDecision)
	api := githubBase() + "/repos/" + d.Repo
	if d.Decision == "override-off" {
		return overrideOffApply(r, d)
	}
	if d.Decision == "hold" || d.Decision == "release-hold" {
		return holdApply(r, d)
	}
	if d.Decision == "release" {
		if err := r.Step("brake", "removing the "+brakeLabel+" label, on dima's typed word", func() (string, error) {
			status, _, err := ghSend(asDima, http.MethodDelete, api+"/issues/"+d.PR+"/labels/"+brakeLabel, nil, nil)
			if err != nil && status != http.StatusNotFound {
				return "", err
			}
			said := "#" + d.PR + " released"
			if status == http.StatusNotFound {
				said = "#" + d.PR + " wore no " + brakeLabel + " label"
			}
			if raw, err := os.ReadFile(brakeRecord(d.Repo)); err == nil {
				var note brakeNote
				// a record naming another pr is that pr's brake; an unreadable one goes with any release
				if json.Unmarshal(raw, &note) != nil || note.PR == d.PR || note.PR == "" {
					if err := os.Remove(brakeRecord(d.Repo)); err != nil {
						return "", err
					}
					said += ", its record here removed"
				}
			}
			return said, nil
		}); err != nil {
			return nil, err
		}
		r.Done("brake released on #"+d.PR, "")
		return d, nil
	}
	if err := r.Step("merge", "squash-merging the read head", func() (string, error) {
		if d.Override != nil {
			if _, on := overrideOn(d.Override.Scope, ""); !on {
				return "", &Fail{Refused: true, Msg: "operator-override " + d.Override.Scope + " went off after the read; nothing merged", Next: "x lane merge-auto " + d.PR}
			}
		}
		// a hold set since the plan read
		if !d.dimaOK {
			held, holdErr := readHolds(d.Repo)
			if stop := holdStop(d.Repo, d.PR, held, holdErr); stop != "" {
				return "", holdRefusal(d.PR, stop)
			}
			for layer := range d.heads {
				if stop := holdStop(d.Repo, layer, held, holdErr); stop != "" {
					return "", holdRefusal(d.PR, stop)
				}
			}
		}
		if d.layered && laneAddOn.mergeLayers != nil {
			// a stacked pr refuses the plain endpoint (403); its layers land together or not at all
			if err := headsHeld(api, d.heads); err != nil {
				return "", err
			}
			// before the merge, so a stack that lands always wears it; a label on a pr that then fails to merge is harmless
			for n := range d.heads {
				if _, _, err := ghSend(asDima, http.MethodPost, api+"/issues/"+n+"/labels", map[string][]string{"labels": {mergedLabel}}, nil); err != nil {
					return "", err
				}
			}
			shown, sha, err := laneAddOn.mergeLayers(d.Repo, d.PR, d.Head)
			d.landed = shown
			d.Merged = sha
			return shown, err
		}
		var merged struct {
			Sha string `json:"sha"`
		}
		trailers := mergeTrailer
		if len(d.Checks) > 0 && d.Checks[0].renovateExempt {
			trailers += "\n" + renovateExemptTrailer
		}
		if d.Override != nil {
			trailers += "\nOperator-override: " + d.Override.Scope + ", by " + d.Override.By + " at " + d.Override.At
		}
		// the sha pins the merge to the head the checks read: a push since makes github refuse it
		status, _, err := ghSend(asDima, http.MethodPut, api+"/pulls/"+d.PR+"/merge", map[string]string{
			"sha": d.Head, "merge_method": "squash", "commit_title": d.title + " (#" + d.PR + ")",
			"commit_message": strings.TrimSpace(d.body) + "\n\n" + trailers,
		}, &merged)
		// every check passed, so a moved branch is github seeing what changed since the read: a fresh run reads it again;
		// any other refusal (a draft or a rule, under the override) stays github's own, since a rerun meets it again
		if refused, ok := errors.AsType[*Fail](err); ok && (status == http.StatusMethodNotAllowed || status == http.StatusConflict) && strings.Contains(refused.Msg, "was modified") {
			return "", &Fail{Refused: true, Msg: "github refused the merge of #" + d.PR + ": " + refused.Msg, Next: "x lane merge-auto " + d.PR + ", again"}
		}
		d.Merged = merged.Sha
		return "#" + d.PR + " → " + short(merged.Sha), err
	}); err != nil {
		return nil, err
	}
	_ = r.Step("hold", "the landed layers' held marks", func() (string, error) {
		d.Holds = dropLandedHolds(d)
		return d.Holds, nil
	})
	_ = r.Step("decamp", "the merged lane's clean trees", func() (string, error) {
		d.Trees = decampMerged(d)
		return strings.Join(d.Trees, "; "), nil
	})
	result := "merged #" + d.PR + " at " + short(d.Merged)
	if d.layered {
		result = d.landed
	}
	if d.Override != nil {
		result += "\n" + d.Override.named()
		what := d.Repo + "#" + d.PR + " at " + short(d.Head)
		if d.Merged == "" {
			what += ", still enqueued"
		}
		if err := overrideLogPass(d.Override, what); err != nil {
			result += "\n⚠ the override's log line did not land: " + err.Error()
		}
	}
	if d.Holds != "" {
		result += "\n" + d.Holds
	}
	if len(d.Trees) > 0 {
		result += "\n" + strings.Join(d.Trees, "\n")
	}
	r.Done(result+"\n"+d.summary(), "")
	return d, nil
}

// a merged lane's worktrees go with it, or stay with a named reason; nothing here can fail a done merge. a tree that
// stays is x lane landed's. only a tree at a head the merge landed is judged: any other holds what the merge did not carry
func decampMerged(d *mergeDecision) []string {
	repo, err := top()
	if err != nil {
		return []string{"⚠ no tree decamped: " + err.Error()}
	}
	main := mainCheckout(repo)
	listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return []string{"⚠ no tree decamped: " + err.Error()}
	}
	landed := []string{d.Head}
	for _, sha := range d.heads {
		landed = append(landed, sha)
	}
	under := resolved(filepath.Join(main, ".claude", "worktrees")) + string(filepath.Separator)
	selves := []string{resolved(repo), resolved(frameRoot())}
	var notes []string
	for _, e := range worktreesOf(listed) {
		if !strings.HasPrefix(resolved(e.path), under) {
			continue
		}
		atLanded := slices.Contains(landed, e.sha)
		reason := ""
		switch {
		case d.Merged == "" && (atLanded || e.branch == d.headRef):
			reason = "the merge is still enqueued"
		// a branch still at the head that lands is a layer just cut above it, never the merged one
		case e.branch != "" && e.branch != d.headRef && (!atLanded || e.sha == d.Head):
			if !gitAncestorOfAny(e.path, landed) {
				continue
			}
			reason = "it sits on an upper layer of the stack"
		case e.branch != d.headRef && !atLanded:
			continue
		default:
			merged := ""
			if atLanded {
				merged = e.sha
			}
			reason = treeStay(e, main, selves, merged)
			if !atLanded {
				reason = strings.TrimSuffix("it is not at the landed head, "+reason, ", ")
			}
		}
		if reason != "" {
			notes = append(notes, home(e.path)+" stays: "+reason+"; x lane landed <ticket> --pr "+d.PR+" --apply takes it once clean")
			continue
		}
		if err := removeTree(main, e.path); err != nil {
			notes = append(notes, "⚠ "+home(e.path)+" stays: "+err.Error())
			continue
		}
		if _, err := hooksHome(main, e.path); err != nil {
			notes = append(notes, "⚠ "+home(e.path)+" decamped, then "+err.Error())
			continue
		}
		notes = append(notes, home(e.path)+" decamped")
	}
	if d.Merged != "" {
		if note := laneBranchNote(asDima, main, d.Repo, d.headRef, d.Head); note != "" {
			notes = append(notes, note)
		}
	}
	return notes
}

// only a lane's own branch shapes go by themselves; coder/ is a branch cut before the rename
func isLaneBranch(ref string) bool {
	return strings.HasPrefix(ref, "codie/") || strings.HasPrefix(ref, "coder/")
}

// the sha origin holds for a branch, "" with none or with no origin at all
func remoteBranch(dir, ref string) (string, error) {
	if !ok(gitIn(dir, "remote", "get-url", "origin")) {
		return "", nil
	}
	listed, err := mustGitIn(dir, "ls-remote", "ls-remote", "origin", "refs/heads/"+ref)
	sha, _, _ := strings.Cut(listed, "\t")
	return sha, err
}

func branchStands(main, ref string) bool {
	if ok(gitIn(main, "rev-parse", "--verify", "-q", "refs/heads/"+ref)) {
		return true
	}
	sha, err := remoteBranch(main, ref)
	return sha != "" || err != nil
}

// a rebase or a bisect detaches its tree, and only these files still name what it will come back to
func stoppedOn(tree string) string {
	for _, path := range gitPaths(tree, "rebase-merge/head-name", "rebase-apply/head-name", "BISECT_START") {
		if raw, err := os.ReadFile(path); err == nil {
			return strings.TrimPrefix(strings.TrimSpace(string(raw)), "refs/heads/")
		}
	}
	return ""
}

// the shas a branch was judged at: its delete leases on them, so a push since the read survives
type branchTips struct{ local, remote string }

// why a branch must stay, "" when it may go: a tree on it, or a commit carried does not vouch for
func branchStay(main, ref, uncarried string, carried func(sha string) bool) (string, branchTips) {
	var tips branchTips
	listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return "the worktree list did not read", tips
	}
	for _, e := range worktreesOf(listed) {
		if e.branch == ref || (e.detached && stoppedOn(e.path) == ref) {
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

func branchDrop(main, ref string, tips branchTips) string {
	if tips.local != "" {
		if deleted, _ := gitIn(main, "update-ref", "-d", "refs/heads/"+ref, tips.local); !deleted.ok {
			return "⚠ " + ref + " stays: it moved since the read"
		}
	}
	if tips.remote != "" {
		// a ref delete carries no commit for the pre-push gates to read
		if deleted, _ := gitIn(main, "-c", "core.hooksPath=/dev/null", "push", "-q", "--force-with-lease=refs/heads/"+ref+":"+tips.remote, "origin", ":refs/heads/"+ref); !deleted.ok {
			return "⚠ " + ref + " stays on origin: the delete failed or it moved since the read"
		}
	}
	return ref + " gone"
}

// an open pr based on the branch would close with it
func laneBranchWhy(as, main, slug, ref, head string) (string, branchTips) {
	var open []struct {
		Number int `json:"number"`
	}
	if _, err := ghFetch(as, githubBase()+"/repos/"+slug+"/pulls?state=open&base="+url.QueryEscape(ref), &open); err != nil {
		return "the open prs based on it did not read", branchTips{}
	}
	if len(open) > 0 {
		return fmt.Sprintf("#%d is based on it", open[0].Number), branchTips{}
	}
	return branchStay(main, ref, "the merge did not carry", func(sha string) bool {
		return sha == head || ok(gitIn(main, "merge-base", "--is-ancestor", sha, head))
	})
}

// one line on the merged branch, "" when no lane branch stands
func laneBranchNote(as, main, slug, ref, head string) string {
	if !isLaneBranch(ref) || !branchStands(main, ref) {
		return ""
	}
	why, tips := laneBranchWhy(as, main, slug, ref, head)
	if why != "" {
		return ref + " stays: " + why
	}
	return branchDrop(main, ref, tips)
}

func gitAncestorOfAny(tree string, shas []string) bool {
	return slices.ContainsFunc(shas, func(sha string) bool {
		return ok(gitIn(tree, "merge-base", "--is-ancestor", sha, "HEAD"))
	})
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

func releaseBrake(n string) string {
	return "x lane merge-auto " + n + " --release-brake --dima-ok " + n
}

// a pr wearing the brake label: a merge that landed another head than the gate read
func brakeLabelled(api string) (string, error) {
	var labelled []struct {
		Number int `json:"number"`
	}
	// a brake merge-auto cannot read never reads as off: any failure, a 404 included, stops the merge
	if _, err := ghFetch(asDima, api+"/issues?state=all&labels="+brakeLabel, &labelled); err != nil {
		return "", err
	}
	if len(labelled) == 0 {
		return "", nil
	}
	n := fmt.Sprint(labelled[0].Number)
	return "#" + n + " merged a head its gate never read; release once dima looked: " + releaseBrake(n), nil
}

// the brake's own record on this mac, for a brake github refused to label (dima, o194)
func brakeRecord(repo string) string {
	state := stateDir()
	if !mergeTestEnvOn() {
		state = filepath.Join(systemHome(), ".local/state/x")
	}
	return filepath.Join(state, "merge-brake", strings.ReplaceAll(repo, "/", "_")+".json")
}

type brakeNote struct {
	PR  string `json:"pr"`
	Why string `json:"why"`
}

func recordBrake(repo, n, why string) error {
	raw, err := json.Marshal(brakeNote{PR: n, Why: why})
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(brakeRecord(repo)), 0o755); err != nil {
		return err
	}
	return os.WriteFile(brakeRecord(repo), raw, 0o644)
}

// a record merge-auto cannot read never reads as off
func brakeRecorded(repo string) (string, error) {
	raw, err := os.ReadFile(brakeRecord(repo))
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	var note brakeNote
	if err := json.Unmarshal(raw, &note); err != nil || note.PR == "" {
		return "", &Fail{Msg: "the brake record " + brakeRecord(repo) + " is unreadable, so the brake reads on", Next: "cat " + brakeRecord(repo)}
	}
	return "#" + note.PR + " " + note.Why + "; release once dima looked: " + releaseBrake(note.PR), nil
}

// a *Fail keeps its shape, or the dispatcher would print it without the name
func brakeReadFail(err error) error {
	const named = "the brake did not read, so it stops the merge: "
	if fail, isFail := errors.AsType[*Fail](err); isFail {
		copied := *fail
		copied.Msg = named + fail.Msg
		return &copied
	}
	return fmt.Errorf(named+"%w", err)
}

// the label, then this mac's record, then reverts; git's revert names the sha, github's revert button only the subject
func brakeOn(repo, base string) (string, error) {
	api := githubBase() + "/repos/" + repo
	if labelled, err := brakeLabelled(api); err != nil || labelled != "" {
		return labelled, err
	}
	if recorded, err := brakeRecorded(repo); err != nil || recorded != "" {
		return recorded, err
	}
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
	since := clock().Add(-brakeFor).Format(time.RFC3339)
	recent, err := mustGit("brake", "log", "origin/"+base, "--since="+since, "--format=%H%x00%B%x1e")
	if err != nil {
		return "", err
	}
	for record := range strings.SplitSeq(recent, "\x1e") {
		sha, message, _ := strings.Cut(strings.TrimSpace(record), "\x00")
		if match := revertsSha.FindStringSubmatch(message); match != nil {
			ours, err := mergedByX(api, merged, match[1], "/commits/"+match[1]+"/pulls")
			if err != nil || ours {
				return short(sha) + " reverts " + short(match[1]), err
			}
		}
		if match := revertsSubject.FindStringSubmatch(message); match != nil {
			pr := ""
			if n := prOfSubject.FindStringSubmatch(match[1]); n != nil {
				pr = "/pulls/" + n[1]
			}
			ours, err := mergedByX(api, merged, match[1], pr)
			if err != nil || ours {
				return short(sha) + " reverts «" + match[1] + "»", err
			}
		}
	}
	return "", nil
}

var prOfSubject = regexp.MustCompile(`\(#(\d+)\)$`)

// a reverted commit is merge-auto's when it carries the trailer, or when github says its pr wears the label
func mergedByX(api string, trailered map[string]bool, key, path string) (bool, error) {
	if trailered[key] {
		return true, nil
	}
	if path == "" {
		return false, nil
	}
	type labelled struct {
		Labels []struct {
			Name string `json:"name"`
		} `json:"labels"`
	}
	var prs []labelled
	var target any = &prs
	var one labelled
	if strings.HasPrefix(path, "/pulls/") {
		target = &one
	}
	status, _, err := ghSend(asDima, http.MethodGet, api+path, nil, target)
	switch {
	case status == http.StatusNotFound:
		return false, nil
	case err != nil:
		return false, err
	}
	if target == &one {
		prs = []labelled{one}
	}
	for _, pr := range prs {
		for _, label := range pr.Labels {
			if label.Name == mergedLabel {
				return true, nil
			}
		}
	}
	return false, nil
}

func clock() time.Time {
	if mergeTestEnvOn() {
		if at, err := time.Parse(time.RFC3339, os.Getenv("X_NOW")); err == nil {
			return at
		}
	}
	return time.Now()
}

/* Checks */

func renovateAuthor(login string) bool {
	return login == "x-renovate[bot]" || login == "renovate[bot]"
}

// a renovate pr needs no clean while every commit is renovate's own, signed by github: a member's push onto its branch
// makes it a member's pr; an unread list, or one cut short of the head (github
// stops at 250, a push can land between reads), counts as that push; a changed workflow file asks the clean too
func (d *mergeDecision) sixthSenseOf(api, repo, n string, pr pullHead) mergeCheck {
	c := d.wordOpens(pr, sixthSenseCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref))
	if c.OK || !renovateAuthor(pr.User.Login) {
		return c
	}
	type login struct {
		Login string `json:"login"`
	}
	commits, err := ghPages[struct {
		Sha       string `json:"sha"`
		Author    login  `json:"author"`
		Committer login  `json:"committer"`
		Commit    struct {
			Verification struct {
				Verified bool `json:"verified"`
			} `json:"verification"`
		} `json:"commit"`
	}](asDima, api+"/pulls/"+n+"/commits", "")
	if err != nil {
		c.Detail += "; its commits did not read: " + err.Error()
		return c
	}
	for _, commit := range commits {
		if !renovateAuthor(commit.Author.Login) || commit.Committer.Login != "web-flow" || !commit.Commit.Verification.Verified {
			c.Detail += "; a commit on it is not renovate's own"
			return c
		}
	}
	if len(commits) == 0 || commits[len(commits)-1].Sha != pr.Head.Sha {
		c.Detail += "; its commit list does not end at the head"
		return c
	}
	type file struct {
		Filename         string `json:"filename"`
		PreviousFilename string `json:"previous_filename"`
	}
	files, err := ghPages[file](asDima, api+"/pulls/"+n+"/files", "")
	if err != nil {
		c.Detail += "; its files did not read: " + err.Error()
		return c
	}
	for _, f := range files {
		for _, path := range []string{f.PreviousFilename, f.Filename} {
			// a bumped action runs with the repo's secrets, and ci running it proves nothing about what it took
			if strings.HasPrefix(path, ".github/workflows/") {
				c.Detail += "; it changes a workflow file, so a clean reads it: " + path
				return c
			}
		}
	}
	c.OK, c.Detail, c.renovateExempt = true, "renovate's own commits, ci is their review", true
	return c
}

// a «clean» in a pr comment or body is never read: only sixth sense and a stamp through watch-pr.sh write this store; a
// sibling `<repo>#<n>:by` key names a verifier other than sixth sense, and the gate treats both alike, only the detail differs
func sixthSenseCheck(repo, n, head, base, ref string) mergeCheck {
	c := mergeCheck{Name: "sixth-sense"}
	home, _ := os.UserHomeDir()
	path := filepath.Join(home, ".claude/shelf/pr-verified.json")
	if mergeTestEnvOn() {
		path = cmp.Or(os.Getenv("X_VERIFIED"), path)
	}
	raw, err := os.ReadFile(path)
	var store map[string]string
	if err != nil || json.Unmarshal(raw, &store) != nil {
		c.Detail = "no sixth sense store at " + path
		c.noClean = errors.Is(err, fs.ErrNotExist)
		return c
	}
	verified := store[repo+"#"+n]
	by := "sixth sense"
	if who := store[repo+"#"+n+":by"]; who != "" {
		by = who + "'s read"
	}
	switch {
	case verified == "":
		c.Detail = "no clean recorded for " + repo + "#" + n
		c.noClean = true
	case verified == head:
		c.OK, c.Detail = true, "clean on "+short(head)+" by "+by
	default:
		c.OK, c.Detail = carried(verified, by, head, base, ref)
	}
	return c
}

// the whole branch change is compared, merges included: per-commit patch-ids let an edit inside a merge slip
// (sixth sense round 1); they only name the commit to blame
func carried(verified, by, head, base, ref string) (bool, string) {
	moved := "the clean by " + by + " is on " + short(verified) + ", the head is " + short(head)
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
		return true, "clean on " + short(verified) + " by " + by + ", carried to " + short(head) + ": the branch's patch-id is unchanged"
	}
	was, errWas := patchIDs(verified, base)
	now, errNow := patchIDs(head, base)
	if errWas == nil && errNow == nil {
		for _, c := range now {
			if !slices.ContainsFunc(was, func(v patchCommit) bool { return v.id == c.id }) {
				return false, short(c.sha) + " " + c.subject + " is past the clean by " + by + " on " + short(verified)
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

// github's own read of the merge, an allow-list: clean passes, and unstable, a red or pending check no branch rule
// requires, which ciCheck ignores too; github computes it after a push, so a null or unknown is read again
func mergeableCheck(api, n string, pr pullHead, trunk string, clock *waitClock) (mergeCheck, error) {
	c := mergeCheck{Name: "mergeable"}
	for read := 1; pr.Mergeable == nil || pr.MergeableState == "unknown"; read++ {
		if read == 3 {
			c.Detail = "github is still computing whether #" + n + " merges; run it again in a minute"
			return c, nil
		}
		clock.sleep(2 * time.Second)
		if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
			return c, err
		}
	}
	switch state := pr.MergeableState; state {
	case "clean", "unstable":
		c.OK, c.Detail = true, "github would merge it ("+state+")"
	case "dirty", "behind":
		// merge-main merges origin/main, so it fixes a plain pr onto main; a stack's layer restacks onto main whole
		door := "x lane restack --apply"
		if trunk != "" && pr.Base.Ref == "main" {
			door = "x lane merge-main"
		}
		said := "conflicts with"
		if state == "behind" {
			said = "is behind"
		}
		c.Detail = "#" + n + " " + said + " " + pr.Base.Ref + " → " + door
	case "blocked":
		c.Detail = "github's branch protection holds it: a required check or review is still missing"
	case "":
		c.Detail = "github gave #" + n + " no mergeable state"
	default:
		c.Detail = "github will not merge #" + n + ": its mergeable state is " + state
	}
	return c, nil
}

// «no run» and «skipped» are never green
func ciCheck(api, base, head string) (mergeCheck, error) {
	c := mergeCheck{Name: "ci"}
	var protection struct {
		Contexts []string `json:"contexts"`
		Checks   []struct {
			Context string `json:"context"`
		} `json:"checks"`
	}
	status, _, err := ghSend(asDima, http.MethodGet, api+"/branches/"+base+"/protection/required_status_checks", nil, &protection)
	if err != nil && status != http.StatusNotFound {
		return c, err
	}
	required := protection.Contexts
	for _, check := range protection.Checks {
		if !slices.Contains(required, check.Context) {
			required = append(required, check.Context)
		}
	}
	if len(required) == 0 {
		c.Detail = "0 required checks on " + base + ": nothing proves the head"
		return c, nil
	}
	ran, err := checksOf(asDima, api, head)
	if err != nil {
		return c, err
	}
	for _, name := range required {
		i := slices.IndexFunc(ran, func(p prCheck) bool { return p.Name == name })
		switch {
		case i < 0:
			c.Detail = "no run of " + name + " for " + short(head)
			return c, nil
		case ran[i].State != "success":
			c.Detail = name + " is " + ran[i].State + " on " + short(head)
			return c, nil
		}
	}
	c.OK, c.Detail = true, fmt.Sprintf("%d of %d required green on %s", len(required), len(required), short(head))
	return c, nil
}

// a repo whose main deploys from ci, so a merge onto a red or running deploy stacks a second failure on it
func deployGated(repo string) bool {
	if mergeTestEnvOn() {
		return repo == os.Getenv("X_DEPLOY_REPO")
	}
	return repo == "dvakatsiienko/bytes"
}

// main's tip, never the pr head: bytes pr heads carry no deploy, since production deploys run from ci after a merge
func deployCheck(api, repo, trunk string) (mergeCheck, error) {
	c := mergeCheck{Name: "deploy"}
	if !deployGated(repo) {
		c.OK, c.Detail = true, "no deploy: skipped"
		return c, nil
	}
	// a ci or docs commit deploys nothing, so the commit read is main's last one that deployed, newest first
	var history []struct {
		Sha string `json:"sha"`
	}
	if _, err := ghFetch(asDima, api+"/commits?sha="+trunk+"&per_page="+fmt.Sprint(deployLookback), &history); err != nil {
		return c, err
	}
	for _, commit := range history[:min(len(history), deployLookback)] {
		checks, err := checksOf(asDima, api, commit.Sha)
		if err != nil {
			return c, err
		}
		var apps []string
		for _, check := range checks {
			app, isDeploy := strings.CutPrefix(check.Name, "Vercel – ")
			if !isDeploy {
				continue
			}
			apps = append(apps, app)
			// a skipped deploy reads success and passes: the hold is a red or a running deploy only (dima, o45)
			switch check.State {
			case "success":
			case "pending":
				c.Detail = "main's deploy is running: " + app + " on " + short(commit.Sha)
				return c, nil
			default:
				// the pr that fixes main meets this same wait, so the door that lands it is named, never «fix main» alone
				c.Detail = app + "'s deploy is " + check.State + " on main at " + short(commit.Sha) + ": a merge would stack on it; a fix for main lands under dima's operator-override for prs"
				return c, nil
			}
		}
		if len(apps) > 0 {
			c.OK, c.Detail = true, strings.Join(apps, ", ")+" deployed on main at "+short(commit.Sha)
			return c, nil
		}
	}
	c.Detail = fmt.Sprintf("no deploy in main's last %d commits, so nothing proves main deploys", deployLookback)
	return c, nil
}

// how far back main's last deploy is looked for: a run of ci and docs commits is a few, never a release's worth
const deployLookback = 20

// the one repo whose merges need a reviewer round; frame's round stays advice
func roundGated(repo string) bool {
	if mergeTestEnvOn() {
		return repo == os.Getenv("X_ROUND_REPO")
	}
	return repo == "dvakatsiienko/bytes"
}

// a run's jobs, as github answers /actions/runs/<id>/jobs
type runJobs struct {
	Jobs []runJob `json:"jobs"`
}

type runJob struct {
	Name       string `json:"name"`
	Conclusion string `json:"conclusion"`
	Steps      []struct {
		Name       string `json:"name"`
		Conclusion string `json:"conclusion"`
	} `json:"steps"`
}

// a run counts as a round only here: a green run can hold a skipped job
func (j runJobs) reviewerFinished() bool {
	return slices.ContainsFunc(j.Jobs, func(job runJob) bool {
		return strings.HasSuffix(job.Name, "reviewer") && job.Conclusion == "success"
	})
}

// the steps that end a round red when the reviewer posted nothing; a findings round ends green (review-round.yml)
var standDownSteps = []string{"A green review means a clean review", "A round with no review is red"}

// a run reaches the head from its history, or by a rebase that kept the code, as a clean carries (dima, o66, o95)
func roundReaches(sha, head, base, ref string) bool {
	if ok(gitIn("", "merge-base", "--is-ancestor", sha, head)) {
		return true
	}
	carries, _ := carried(sha, "the reviewer", head, base, ref)
	return carries
}

// a round is a run of review.yml whose reviewer job itself finished, reaching the head: a green run can hold a
// skipped job, a branch name can be reused, and sixth sense's clean on the head covers the commits after it.
// the server's ?branch= filter once answered 0 over a success (review.go, #116): filtered here instead
func roundCheck(api, repo, n, base, ref, head, author string, dimaOK bool) (mergeCheck, error) {
	c := mergeCheck{Name: "round"}
	switch {
	case !roundGated(repo):
		c.OK, c.Detail = true, "no round asked on "+repo
		return c, nil
	case renovateAuthor(author):
		c.OK, c.Detail = true, "renovate's pr, ci is its review"
		return c, nil
	}
	type run struct {
		ID         int64  `json:"id"`
		HeadBranch string `json:"head_branch"`
		HeadSha    string `json:"head_sha"`
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
	}
	runs, err := ghPages[run](asDima, api+"/actions/workflows/review.yml/runs", "workflow_runs")
	if err != nil {
		return c, err
	}
	if got, _ := gitIn("", "fetch", "-q", "origin", ref); !got.ok {
		c.Detail = "git could not fetch " + ref + " to read the round's history: " + logLine(got.log)
		return c, nil
	}
	stoodDown := false
	for _, r := range runs {
		if r.HeadBranch != ref || r.Status != "completed" || (r.Conclusion != "success" && r.Conclusion != "failure") ||
			!roundReaches(r.HeadSha, head, base, ref) {
			continue
		}
		var answer runJobs
		if _, err := ghFetch(asDima, fmt.Sprintf("%s/actions/runs/%d/jobs", api, r.ID), &answer); err != nil {
			return c, err
		}
		if answer.reviewerFinished() {
			c.OK, c.Detail = true, "the reviewer finished a round on "+short(r.HeadSha)
			return c, nil
		}
		for _, job := range answer.Jobs {
			for _, step := range job.Steps {
				stoodDown = stoodDown || (step.Conclusion == "failure" && slices.Contains(standDownSteps, step.Name))
			}
		}
	}
	switch {
	case stoodDown && dimaOK:
		c.OK, c.Detail = true, "the reviewer stood down on #"+n+", landing on dima's word"
	case stoodDown:
		c.Detail = "the reviewer stood down on #" + n + ", posting nothing, so it holds no round; it lands on dima's word, his prompt or a tick quoting it: x lane merge-auto " + n + " --apply --dima-ok " + n + "; that red can also be a failed read: x lane review " + n
	default:
		c.Detail = "no reviewer round finished in " + ref + "'s history — x lane review " + n
	}
	return c, nil
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
