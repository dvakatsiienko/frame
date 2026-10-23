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
	laneAddOn.prBase = stackBase
	laneAddOn.mergeWait = stackMergeWait
}

// a pr onto another pr's branch waits for that pr; once it merged, its branch is a dead end until retargeted
func stackMergeWait(repo string, pr pullHead) (string, error) {
	if pr.Base.Ref == "main" {
		return "", nil
	}
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
	if _, err := ghFetch(asCoder, githubBase()+"/repos/"+repo+"/pulls?state=open&head="+url.QueryEscape(owner+":"+branch), &open); err != nil {
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
		status, _, err := ghSend(asCoder, http.MethodGet, fmt.Sprintf("%s/stacks?pull_request=%d", api, n), nil, &stacks)
		switch {
		case status == http.StatusNotFound:
			return "", &Fail{Refused: true, Msg: "the stacks api answered 404 for " + repo + ": stacked prs are off there, or the coder app cannot read stacks", Next: "x lane pr-open --apply <title> <body-file>, a plain pr"}
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
	listed, err := ghCoder("extension", "list")
	if err != nil {
		return listed, err
	}
	if !strings.Contains(listed.out, "github/gh-stack") {
		return listed, &Fail{Refused: true, Msg: "the gh-stack extension is not installed", Next: "gh extension install github/gh-stack"}
	}
	token, err := tokenFor("coder", "gh")
	if err != nil {
		return result{}, &Fail{Msg: "no gh token for the coder app: " + err.Error(), Next: "x schema as"}
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
