//go:build !nostacks

// the gh stacks add-on reaches core only through laneAddOn; `pnpm x-go:test` proves it with -tags nostacks
package main

import (
	"cmp"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

//go:embed stacks.json
var stacksJSON []byte

func init() {
	var source struct {
		Flags map[string]map[string]FlagSpec `json:"flags"`
	}
	if err := json.Unmarshal(stacksJSON, &source); err != nil {
		panic(fmt.Sprintf("stacks.json: %v", err))
	}
	_, added := loadRegistry(stacksJSON)
	verbs = append(verbs, added...)
	for i := range verbs {
		if own, ok := source.Flags[verbs[i].Name]; ok {
			maps.Copy(verbs[i].Flags, own)
			verbs[i].Usage = usageOf(verbs[i])
		}
	}
	impls["lane stack link"] = Impl{Plan: stackLinkPlan, Apply: stackLink, Undone: "no stack was linked", Ask: askStackLink}
	impls["lane stack view"] = Impl{Run: stackView}
	impls["lane restack"] = Impl{Plan: restackPlan, Apply: restack, Undone: "no layer was merged or pushed", Ask: askRestack}
	laneAddOn.prBase = stackBase
	laneAddOn.layersOf = stackLayersOf
	laneAddOn.mergeLayers = stackMerge
	laneAddOn.stackShown = stackShown
}

// the stack a pr tops, read from github's stacks api, one line per open layer up to it, bottom-up
func stackShown(repo, n string) ([]string, error) {
	api := githubBase() + "/repos/" + repo
	var stacks []remoteStack
	status, _, err := ghSend(asCodie, http.MethodGet, api+"/stacks?pull_request="+n, nil, &stacks)
	switch {
	case status == http.StatusNotFound:
		return nil, &Fail{Refused: true, Msg: "the stacks api answered 404 for " + repo + ": no stacks there to read", Next: "x lane verify-tree <pr url>, one layer"}
	case err != nil:
		return nil, err
	case len(stacks) == 0:
		return nil, &Fail{Refused: true, Msg: "#" + n + " is in no stack", Next: "x lane verify-tree <pr url>, one layer"}
	}
	var lines []string
	for _, layer := range stacks[0].PullRequests {
		if layer.State != "open" || layer.MergedAt != nil {
			continue
		}
		var pr struct {
			pullHead
			Commits int `json:"commits"`
		}
		if _, err := ghFetch(asCodie, fmt.Sprintf("%s/pulls/%d", api, layer.Number), &pr); err != nil {
			return nil, err
		}
		lines = append(lines, fmt.Sprintf("#%d %s onto %s at %s, adds %s", layer.Number, pr.Head.Ref, pr.Base.Ref, short(pr.Head.Sha), plural(pr.Commits, "commit")))
		if strconv.Itoa(layer.Number) == n {
			return lines, nil
		}
	}
	return nil, &Fail{Msg: fmt.Sprintf("github's stack %d does not list #%s among its open layers", stacks[0].Number, n), Next: "x lane stack view"}
}

// a pr in a github stack merges with every open layer under it; a pr onto another pr's branch with no
// github stack waits for that pr, and once it merged, its branch is a dead end until retargeted
func stackLayersOf(repo, n string, pr pullHead) (*prLayers, error) {
	var stacks []remoteStack
	status, _, err := ghSend(asDima, http.MethodGet, githubBase()+"/repos/"+repo+"/stacks?pull_request="+n, nil, &stacks)
	switch {
	case status == http.StatusNotFound:
	case err != nil:
		return nil, err
	case len(stacks) > 0:
		layers := &prLayers{trunk: stacks[0].Base.Ref, below: []string{}}
		for _, layer := range stacks[0].PullRequests {
			if strconv.Itoa(layer.Number) == n {
				return layers, nil
			}
			if layer.State == "open" && layer.MergedAt == nil {
				layers.below = append(layers.below, strconv.Itoa(layer.Number))
			}
		}
		return nil, &Fail{Msg: fmt.Sprintf("github's stack %d does not list #%s", stacks[0].Number, n), Next: "x lane stack view"}
	}
	if pr.Base.Ref == "main" {
		return nil, nil
	}
	wait, err := unlinkedWait(repo, pr)
	if err != nil || wait == "" {
		return nil, err
	}
	return &prLayers{wait: wait}, nil
}

func unlinkedWait(repo string, pr pullHead) (string, error) {
	owner, _, _ := strings.Cut(repo, "/")
	var below []struct {
		Number   int     `json:"number"`
		State    string  `json:"state"`
		MergedAt *string `json:"merged_at"`
		Head     struct {
			Ref string `json:"ref"`
		} `json:"head"`
	}
	if _, err := ghFetch(asDima, githubBase()+"/repos/"+repo+"/pulls?state=all&head="+url.QueryEscape(owner+":"+pr.Base.Ref), &below); err != nil {
		return "", err
	}
	for _, lower := range below {
		switch {
		case lower.Head.Ref != pr.Base.Ref:
		case lower.State == "open":
			return fmt.Sprintf("#%d (%s) merges first: a stack merges bottom-up, one layer per call", lower.Number, pr.Base.Ref), nil
		case lower.MergedAt != nil:
			return fmt.Sprintf("#%d (%s) already merged, so this pr would land on a dead branch; retarget it first: gh pr edit <this pr> --base main", lower.Number, pr.Base.Ref), nil
		}
	}
	return "", nil
}

const stackMergeBudget = 10 * time.Minute

// github's async merge, the one door a stacked pr takes: every open layer up to n lands at once or none does.
// it takes no commit message, so these squashes carry no merge-auto trailer for the brake to find; it takes no sha
// either, so the head github merged is read back against the gated one, and a mismatch turns the brake on
func stackMerge(repo, n, head string) (merged, sha string, err error) {
	api := githubBase() + "/repos/" + repo + "/pulls/" + n + "/merge-async"
	var res struct {
		Status  string `json:"status"`
		Details struct {
			UUID         string `json:"uuid"`
			SHA          string `json:"sha"`
			Message      string `json:"message"`
			ExpectedHead string `json:"expected_head_sha"`
		} `json:"details"`
	}
	status, _, err := ghSend(asDima, http.MethodPut, api, map[string]string{"merge_method": "squash", "merge_action": "default"}, &res)
	switch {
	case status == http.StatusNotFound:
		return "", "", &Fail{Refused: true, Msg: "github has no async merge for " + repo + ", so a stacked pr cannot merge here", Next: "gh stack merge " + n}
	// any other failed submit may still have reached github and taken the merge (dima, o195)
	case err != nil:
		said := fmt.Sprintf("⚠ the stack merge submit of #%s failed (%v), so whether github took the gated %s is unverified", n, err, short(head))
		return "", "", brakeAfter(repo, n, "a merge submit github may have taken", said)
	}
	// the first answer naming the head github took holds: a later answer may name none
	took := res.Details.ExpectedHead
	clock := newStackClock()
	var polled error
	for res.Status == "pending" && clock.elapsed() < stackMergeBudget {
		clock.sleep(2 * time.Second)
		if _, polled = ghFetch(asDima, api+"/"+res.Details.UUID, &res); polled != nil {
			break
		}
		took = cmp.Or(took, res.Details.ExpectedHead)
	}
	switch {
	case took != "" && took != head:
		said := fmt.Sprintf("⚠ the stack merge of #%s (%s) reports head %s, not the gated %s", n, res.Status, short(took), short(head))
		return "", "", brakeAfter(repo, n, "merged a head its gate never read", said)
	// only github's own «failed» says nothing merged; any other answer with no head may still land one
	case took == "" && (res.Status != "failed" || polled != nil):
		said := fmt.Sprintf("⚠ the stack merge of #%s (%s) named no head it took, so the gated %s is unverified", n, res.Status, short(head))
		if polled != nil {
			said = fmt.Sprintf("⚠ the stack merge of #%s went unread (its poll failed: %v), so the gated %s is unverified", n, polled, short(head))
		}
		return "", "", brakeAfter(repo, n, "merged a head github never named", said)
	case polled != nil:
		return "", "", polled
	}
	switch res.Status {
	case "merged":
		return "#" + n + " and every layer under it → " + short(res.Details.SHA), res.Details.SHA, nil
	case "enqueued":
		return "#" + n + " and every layer under it are in the merge queue", "", nil
	case "failed":
		return "", "", &Fail{Msg: "the stack merge failed, nothing merged: " + res.Details.Message, Next: "x lane stack view"}
	}
	return "", "", &Fail{Msg: fmt.Sprintf("the stack merge is still %s after %s", res.Status, stackMergeBudget), Next: "x lane stack view"}
}

// gh-stack's own merge compares the same field (merge_async.go:88); the label is the brake every run reads,
// and a label github refused falls back to this mac's record, so the brake never stays off
func brakeAfter(repo, n, why, said string) error {
	_, _, err := ghSend(asDima, http.MethodPost, githubBase()+"/repos/"+repo+"/issues/"+n+"/labels", map[string][]string{"labels": {brakeLabel}}, nil)
	if err == nil {
		said += ": the brake is on, nothing else merges until dima looks"
		return &Fail{Msg: said, Log: []string{said}, Next: releaseBrake(n)}
	}
	labelStep := "gh pr edit " + n + " --add-label " + brakeLabel
	if rerr := recordBrake(repo, n, why); rerr != nil {
		said += "; the brake is NOT on — github refused its " + brakeLabel + " label (" + err.Error() + ") and its record here failed (" + rerr.Error() + "); set the label by hand before any other merge"
		return &Fail{Msg: said, Log: []string{said}, Next: labelStep}
	}
	said += "; github refused the " + brakeLabel + " label (" + err.Error() + "), so the brake is on from this mac's record only; label the pr by hand so every other session sees it"
	return &Fail{Msg: said, Log: []string{said}, Next: labelStep}
}

/* Verbs */
type stackLayer struct {
	Branch string `json:"branch"`
	PR     int    `json:"pr"`
}

// gh stack link pushes every branch it is given, and a frame worktree's push dies at the mirror
// gate, so the layers go in as their pr numbers, which it never pushes
func stackLinkPlan(r *Run, _ []string, flags Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var names []string
	if err := r.Step("layers", "reading this branch's layers on origin", func() (string, error) {
		names, err = stackLayers(name)
		return strings.Join(names, " → "), err
	}); err != nil {
		return nil, err
	}
	var layers []stackLayer
	if err := r.Step("prs", "finding each layer's open pr", func() (string, error) {
		var shown []string
		for _, layer := range names {
			n, err := openPR(repo, layer)
			if err != nil {
				return "", err
			}
			layers = append(layers, stackLayer{layer, n})
			shown = append(shown, fmt.Sprintf("#%d", n))
		}
		return strings.Join(shown, " → "), nil
	}); err != nil {
		return nil, err
	}
	return layers, nil
}

func askStackLink(plan any) string {
	var shown []string
	for _, layer := range plan.([]stackLayer) {
		shown = append(shown, fmt.Sprintf("#%d %s", layer.PR, layer.Branch))
	}
	return "link " + strings.Join(shown, " → ") + " into a github stack?"
}

func stackLink(r *Run, _ []string, _ Flags, plan any) (any, error) {
	layers := plan.([]stackLayer)
	args := []string{"link"}
	for _, layer := range layers {
		args = append(args, strconv.Itoa(layer.PR))
	}
	if err := r.Step("link", "gh stack link, bottom-up", func() (string, error) {
		got, err := stackCall(args...)
		return got.out, err
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%d layers linked: %s", len(layers), strings.Join(args[1:], " → ")), "x lane stack view")
	return ordered{{"layers", layers}}, nil
}

// the open pr whose head is branch
func openPR(repo, branch string) (int, error) {
	var open []struct {
		Number int `json:"number"`
		Head   struct {
			Ref string `json:"ref"`
		} `json:"head"`
	}
	owner, _, _ := strings.Cut(repo, "/")
	if _, err := ghFetch(asCodie, githubBase()+"/repos/"+repo+"/pulls?state=open&head="+url.QueryEscape(owner+":"+branch), &open); err != nil {
		return 0, err
	}
	for _, pr := range open {
		if pr.Head.Ref == branch {
			return pr.Number, nil
		}
	}
	return 0, &Fail{Refused: true, Msg: branch + " has no open pr", Next: "x lane pr-open --apply --base <the layer below> <title> <body-file>"}
}

// one stack as github's stacks api answers it (the api gh-stack itself calls), prs bottom-up
type remoteStack struct {
	Number int `json:"number"`
	Base   struct {
		Ref string `json:"ref"`
	} `json:"base"`
	PullRequests []struct {
		Number   int     `json:"number"`
		State    string  `json:"state"`
		MergedAt *string `json:"merged_at"`
		Head     struct {
			Ref string `json:"ref"`
		} `json:"head"`
	} `json:"pull_requests"`
}

// gh-stack's own view reads a local stack file its link never writes, so x asks github
func stackView(r *Run, _ []string, flags Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	r.Open(name)
	api := githubBase() + "/repos/" + repo
	var n int
	if err := r.Step("pr", "finding this branch's open pr", func() (string, error) {
		n, err = openPR(repo, name)
		return fmt.Sprintf("#%d", n), err
	}); err != nil {
		return nil, err
	}
	var stacks []remoteStack
	if err := r.Step("view", "reading github's stack for the pr", func() (string, error) {
		status, _, err := ghSend(asCodie, http.MethodGet, fmt.Sprintf("%s/stacks?pull_request=%d", api, n), nil, &stacks)
		switch {
		case status == http.StatusNotFound:
			return "", &Fail{Refused: true, Msg: "the stacks api answered 404 for " + repo + ": stacked prs are off there, or the codie app cannot read stacks", Next: "x lane pr-open --apply <title> <body-file>, a plain pr"}
		case err != nil:
			return "", err
		case len(stacks) == 0:
			return "", &Fail{Refused: true, Msg: fmt.Sprintf("#%d is in no stack", n), Next: "x lane stack link --apply"}
		}
		return fmt.Sprintf("stack %d", stacks[0].Number), nil
	}); err != nil {
		return nil, err
	}
	stack := stacks[0]
	lines := []string{stack.Base.Ref}
	for _, pr := range stack.PullRequests {
		state := pr.State
		if pr.MergedAt != nil {
			state = "merged"
		}
		lines = append(lines, fmt.Sprintf("└ %s #%d %s", pr.Head.Ref, pr.Number, state))
	}
	r.Done(strings.Join(lines, "\n"), "")
	return ordered{{"pr", n}, {"stack", stack}}, nil
}

/* Restack */

type restackTarget struct {
	Branch string            `json:"branch"`
	Layers []string          `json:"layers"`
	Leases map[string]string `json:"leases"`
	from   string
}

// a layer on origin whose local copy differs would lose a commit to the merge or push a stale one, so it refuses
func restackPlan(r *Run, _ []string, _ Flags) (any, error) {
	if name, paused := pausedRebase(); paused {
		return nil, &Fail{Refused: true, Msg: "a rebase of " + name + " is stopped here; finish it with git rebase --continue, or git rebase --abort", Next: "git rebase --continue"}
	}
	if merging, _ := git("rev-parse", "-q", "--verify", "MERGE_HEAD"); merging.ok {
		return nil, &Fail{Refused: true, Msg: "a merge is stopped here; finish it with git merge --continue, or git merge --abort", Next: "git merge --continue"}
	}
	if dirty, _ := git("status", "--porcelain", "--untracked-files=no"); dirty.out != "" {
		return nil, &Fail{Refused: true, Msg: "the tree holds changes a restack would carry between layers:\n" + dirty.out, Next: "x lane commit <msg-file> -- <paths>"}
	}
	name, err := branch()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	t := &restackTarget{Branch: name, Leases: map[string]string{}}
	if err := r.Step("layers", "reading this branch's layers on origin", func() (string, error) {
		if t.Layers, err = stackLayers(name); err != nil {
			return "", err
		}
		if _, err := mustGit("fetch", append([]string{"fetch", "-q", "origin"}, t.Layers...)...); err != nil {
			return "", err
		}
		for _, layer := range t.Layers {
			if t.Leases[layer], err = remoteSha(layer); err != nil {
				return "", err
			}
			if local, _ := git("rev-parse", "-q", "--verify", "refs/heads/"+layer); local.ok && local.out != t.Leases[layer] {
				return "", &Fail{Refused: true, Msg: fmt.Sprintf("%s is %s here and %s on origin: push it, or take origin's, before a restack", layer, short(local.out), short(t.Leases[layer])),
					Next: "git switch " + layer + " && x lane push --apply"}
			}
		}
		if held := heldElsewhere(t.Layers[1:]); held != "" {
			return "", &Fail{Refused: true, Msg: held + ": a restack switches to each upper layer, and git refuses a branch another worktree holds",
				Next: "git -C <that worktree> switch --detach"}
		}
		if t.from, _, err = pushHome(); err != nil {
			return "", err
		}
		return strings.Join(t.Layers, " → "), nil
	}); err != nil {
		return nil, err
	}
	return t, nil
}

func askRestack(plan any) string {
	return "merge each layer up into the next and push: " + strings.Join(plan.(*restackTarget).Layers, " → ") + "?"
}

// a merge, never a rebase: the layers' pushed history stays, and a reviewer's clean carries by patch-id
func restack(r *Run, _ []string, _ Flags, plan any) (any, error) {
	t := plan.(*restackTarget)
	moved := map[string]string{}
	if err := r.Step("merge", "merging each lower layer up into the next", func() (string, error) {
		below := t.Leases[t.Layers[0]]
		var shown []string
		for _, layer := range t.Layers[1:] {
			if _, err := mustGit("switch", "switch", "-q", "-C", layer, t.Leases[layer]); err != nil {
				return "", err
			}
			merged, _ := git("merge", "-q", "--no-edit", "-m", "restack: merge "+short(below)+" into "+layer, below)
			if !merged.ok {
				conflicts, _ := git("diff", "--name-only", "--diff-filter=U")
				stop := &Fail{Msg: layer + " conflicts with the layer below in " + strings.ReplaceAll(or(conflicts.out, "no file"), "\n", ", ") +
					" — the tree is on " + layer + " mid-merge: resolve, git add, git merge --continue, x lane push --apply, then x lane restack --apply again; or git merge --abort",
					Next: "git merge --continue", Log: nonBlank(merged.log)}
				// the layers under it merged clean: pushed now, a rerun reads them equal to origin
				return "", errors.Join(t.push(moved), stop)
			}
			sha, err := head()
			if err != nil {
				return "", err
			}
			if sha != t.Leases[layer] {
				moved[layer] = sha
				shown = append(shown, layer+" → "+short(sha))
			}
			below = sha
		}
		if len(shown) == 0 {
			return "every layer already holds the one below", nil
		}
		return strings.Join(shown, ", "), nil
	}); err != nil {
		return nil, err
	}
	if err := r.Step("push", "pushing each moved layer, leased on the sha read", func() (string, error) {
		if err := t.push(moved); err != nil {
			_, back := mustGit("switch", "switch", "-q", t.Branch)
			return "", errors.Join(err, back)
		}
		return plural(len(moved), "layer") + " pushed", nil
	}); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the remote back, then the branch restack started on", func() (string, error) {
		for layer, sha := range moved {
			if remote, err := remoteSha(layer); err != nil || remote != sha {
				return "", errors.Join(err, &Fail{Msg: fmt.Sprintf("origin/%s is %s, the restack made %s", layer, short(remote), short(sha)), Next: "x lane restack --apply"})
			}
		}
		_, err := mustGit("switch", "switch", "-q", t.Branch)
		return "on " + t.Branch, err
	}); err != nil {
		return nil, err
	}
	r.Done(plural(len(moved), "layer")+" restacked: "+strings.Join(t.Layers, " → "), "")
	return ordered{{"layers", t.Layers}, {"moved", moved}}, nil
}

// a plain push: each merge descends from the sha read, so origin moving since is a non-fast-forward git refuses
func (t *restackTarget) push(moved map[string]string) error {
	for _, layer := range t.Layers[1:] {
		sha, ok := moved[layer]
		if !ok {
			continue
		}
		if pushed, _ := pushRetrying(t.from, sha+":refs/heads/"+layer); !pushed.ok {
			return &Fail{Msg: "the push of " + layer + " failed — origin moved since the read, or a hook refused; the output is above", Next: "x lane restack --apply", Log: nonBlank(pushed.log)}
		}
	}
	return nil
}

// the first of these branches another worktree has checked out, with that worktree's path
func heldElsewhere(branches []string) string {
	here, _ := top()
	list, _ := git("worktree", "list", "--porcelain")
	path := ""
	for line := range strings.SplitSeq(list.out, "\n") {
		if p, ok := strings.CutPrefix(line, "worktree "); ok {
			path = p
		}
		ref, ok := strings.CutPrefix(line, "branch refs/heads/")
		if ok && !samePath(path, here) && slices.Contains(branches, ref) {
			return ref + " is checked out in " + path
		}
	}
	return ""
}

/* Layers */

// the root is this branch less a -N only when origin holds it, so a slug ending in a number stays its own root
var layerSuffix = regexp.MustCompile(`-\d+$`)

func stackLayers(name string) ([]string, error) {
	out, err := mustGit("layers", "ls-remote", "--heads", "origin")
	if err != nil {
		return nil, err
	}
	heads := map[string]bool{}
	for line := range strings.Lines(out) {
		_, ref, _ := strings.Cut(strings.TrimSpace(line), "\t")
		heads[strings.TrimPrefix(ref, "refs/heads/")] = true
	}
	root := name
	if cut := layerSuffix.ReplaceAllString(name, ""); cut != name && heads[cut] {
		root = cut
	}
	if !heads[root] {
		return nil, &Fail{Refused: true, Msg: "origin has no branch " + root, Next: "x lane push --apply"}
	}
	names := []string{root}
	for n := 2; ; n++ {
		layer := fmt.Sprintf("%s-%d", root, n)
		if !heads[layer] {
			break
		}
		names = append(names, layer)
	}
	if len(names) < 2 {
		return nil, &Fail{Refused: true, Msg: "a stack needs 2 layers; origin holds only " + root, Next: "push " + root + "-2, then x lane stack link --apply"}
	}
	return names, nil
}

/* gh stack */

// gh-stack's exit codes (its cmd/utils.go); the lock covers the whole clone (gh-stack#568)
const (
	stackRebasePaused = 7
	stackLocked       = 8
	stackNotEnabled   = 9
)

const stackLockBudget = 2 * time.Minute

var (
	pausedIn  = regexp.MustCompile(`Operation started in worktree (\S+)`)
	pausedLog = regexp.MustCompile(`already in progress \((\S+)\)`)
)

func stackCall(args ...string) (result, error) {
	listed, err := ghCodie("extension", "list")
	if err != nil {
		return listed, err
	}
	if !strings.Contains(listed.out, "github/gh-stack") {
		return listed, &Fail{Refused: true, Msg: "the gh-stack extension is not installed", Next: "gh extension install github/gh-stack"}
	}
	token, err := tokenFor("codie", "gh")
	if err != nil {
		return result{}, &Fail{Msg: "no gh token for the codie app: " + err.Error(), Next: "x schema as"}
	}
	clock := newStackClock()
	pause := 2 * time.Second
	for calls := 1; ; calls++ {
		got, err := run("", []string{"GH_TOKEN=" + token}, "", "gh", append([]string{"stack"}, args...)...)
		code := 0
		if exit, ok := errors.AsType[*exec.ExitError](err); ok {
			code = exit.ExitCode()
		}
		switch {
		case got.ok:
			return got, nil
		case code == stackLocked && clock.elapsed() < stackLockBudget:
			clock.sleep(min(pause, stackLockBudget-clock.elapsed()))
			pause = min(pause*2, 16*time.Second)
			continue
		case code == stackLocked:
			return got, &Fail{Msg: fmt.Sprintf("the gh-stack lock stayed held for %s over %s; another worktree's gh stack is still running", stackLockBudget, plural(calls, "call")),
				Next: "x lane stack " + args[0] + " once that command ends", Log: nonBlank(got.log)}
		case code == stackRebasePaused:
			where := "another worktree"
			if m := pausedIn.FindStringSubmatch(got.log); m != nil {
				where = m[1]
			} else if m := pausedLog.FindStringSubmatch(got.log); m != nil {
				where = m[1]
			}
			return got, &Fail{Refused: true, Msg: "a gh stack rebase is paused in " + where + "; finish it there with gh stack rebase --continue, or drop it with gh stack rebase --abort",
				Next: "gh stack rebase --continue, in " + where, Log: nonBlank(got.log)}
		case code == stackNotEnabled:
			repo, err := repoOf(nil)
			if err != nil {
				repo, _ = mustGit("repo", "remote", "get-url", "origin")
			}
			return got, &Fail{Refused: true, Msg: "stacked prs are not enabled for " + cmp.Or(repo, "this repo") + " (the stacks api answered 404)",
				Next: "x lane pr-open --apply <title> <body-file>, a plain pr", Log: nonBlank(got.log)}
		}
		return got, &Fail{Msg: "gh stack " + args[0] + " failed — its output is above", Next: "gh stack " + args[0], Log: nonBlank(got.log)}
	}
}

// under X_TEST, X_FAKE_SLEEP counts the waits instead of sleeping them
type stackClock struct {
	start   time.Time
	skipped time.Duration
	fake    bool
}

func newStackClock() *stackClock {
	return &stackClock{start: time.Now(), fake: os.Getenv("X_TEST") != "" && os.Getenv("X_FAKE_SLEEP") != ""}
}

func (c *stackClock) elapsed() time.Duration { return time.Since(c.start) + c.skipped }

func (c *stackClock) sleep(d time.Duration) {
	if c.fake {
		c.skipped += d
		return
	}
	time.Sleep(d)
}

func stackBase(flags Flags) (string, error) {
	base, _ := flags["base"].(string)
	if base == "" {
		return "", nil
	}
	sha, err := remoteSha(base)
	if err != nil {
		return "", err
	}
	if sha == "" {
		return "", &Fail{Refused: true, Msg: "origin has no branch " + base, Next: "x lane push --apply, from " + base}
	}
	return base, nil
}
