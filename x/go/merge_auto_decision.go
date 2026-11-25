package main

import (
	"slices"
	"strings"
)

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
	Tier     string       `json:"tier,omitempty"`
	Asks     []string     `json:"asks,omitempty"`
	Merged   string       `json:"merged,omitempty"`
	Sign     string       `json:"sign,omitempty"`
	Brake    string       `json:"brake,omitempty"`
	// set while operator-override prs is on: every check below the hold goes unread; the brake warns
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

// the branch the merge lands on: a stack's trunk once every layer under the pr passed, else the pr's own base
func gateLayers(r *Run, d *mergeDecision, read mergeRead) (trunk string, err error) {
	if read.layers == nil {
		r.skip("layers")
		return read.pr.Base.Ref, nil
	}
	api := githubBase() + "/repos/" + d.Repo
	trunk, d.layered = read.layers.trunk, true
	d.heads = map[string]string{d.PR: d.Head}
	if err := r.Step("layers", "gating every layer under the pr", func() (string, error) {
		for _, below := range read.layers.below {
			if stop := holdStop(d.Repo, below, read.held, read.holdErr); stop != "" && !d.dimaOK {
				return "", holdRefusal(d.PR, stop+" — a stack merges all of its layers at once")
			}
			if d.Override != nil {
				var layer pullHead
				if _, err := ghFetch(asDima, api+"/pulls/"+below, &layer); err != nil {
					return "", err
				}
				d.heads[below] = layer.Head.Sha
				continue
			}
			wait, err := layerWait(d.Repo, api, trunk, below, d)
			if err != nil {
				return "", err
			}
			if wait != "" {
				return "", &Fail{Refused: true, Msg: "wait: " + wait + " — a stack merges all of its layers at once", Next: "x lane merge-auto " + d.PR}
			}
		}
		if d.Override != nil {
			return "under the override, no layer's checks read", nil
		}
		if len(read.layers.below) == 0 {
			return "the bottom layer, onto " + trunk, nil
		}
		return "#" + strings.Join(read.layers.below, ", #") + " clean, green, threadless", nil
	}); err != nil {
		return "", err
	}
	return trunk, nil
}

// why a layer under the merged pr holds the merge, as the same gate reads it; "" when it passes
func layerWait(repo, api, trunk, n string, d *mergeDecision) (string, error) {
	var pr pullHead
	paths, err := headAndPaths(api, n, &pr)
	if err != nil {
		return "", err
	}
	d.heads[n] = pr.Head.Sha
	sixthSense := d.sixthSenseOf(api, repo, n, pr, paths)
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
	risky, ownSelf := riskyOf(paths)
	for _, path := range risky {
		d.Risky = append(d.Risky, "#"+n+" "+path)
	}
	selfWait, err := d.selfWait(pr, ownSelf)
	if err != nil {
		return "", err
	}
	// a layer lands with the stack, so its own paths ask their checks; its sixth sense stays, as a layer's always did
	tier := tierOf(paths)
	security := mergeCheck{Name: "security", OK: true}
	if slices.Contains(tier.Asks, "security") {
		security = securityCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref)
	}
	wishkeeper := mergeCheck{Name: "wishkeeper", OK: true}
	if slices.Contains(tier.Asks, "wishkeeper") {
		if wishkeeper, err = wishkeeperCheck(api, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref, paths); err != nil {
			return "", err
		}
	}
	layer := "#" + n + " (" + pr.Head.Ref + ")"
	// main's deploy is the merged pr's own check, read once for the whole stack
	decision, wait := decide("", selfWait, sixthSense, security, wishkeeper, round, ci, mergeable, threads)
	if decision == "merge" {
		return "", nil
	}
	for _, c := range []mergeCheck{sixthSense, security, wishkeeper, ci, round, mergeable, threads} {
		if !c.OK && c.Detail == wait {
			wait = c.Name + ": " + wait
		}
	}
	return layer + " — " + wait, nil
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
	if d.Brake != "" {
		lines = append(lines, brakeWarning(d.Override.Scope, d.Brake))
	}
	return strings.Join(lines, "\n")
}
