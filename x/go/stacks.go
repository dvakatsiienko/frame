//go:build !nostacks

// the gh stacks add-on: stacked prs through github's gh-stack extension. it reaches core only through
// laneAddOn and adds its own verbs and flags at init; deleting this file, stacks.json and stacks_test.go
// leaves the plain pr flow as it was, which `pnpm x-go:test` proves with -tags nostacks
package main

import (
	"cmp"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"net/url"
	"os"
	"os/exec"
	"regexp"
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

// a stack merges bottom-up, one layer per call: a pr onto another pr's branch waits for that pr
func stackMergeWait(repo string, pr pullHead) (string, error) {
	if pr.Base.Ref == "main" {
		return "", nil
	}
	owner, _, _ := strings.Cut(repo, "/")
	var open []struct {
		Number int `json:"number"`
		Head   struct {
			Ref string `json:"ref"`
		} `json:"head"`
	}
	if _, err := ghFetch(asDima, githubBase()+"/repos/"+repo+"/pulls?state=open&head="+url.QueryEscape(owner+":"+pr.Base.Ref), &open); err != nil {
		return "", err
	}
	for _, below := range open {
		if below.Head.Ref == pr.Base.Ref {
			return fmt.Sprintf("#%d (%s) merges first: a stack merges bottom-up, one layer per call", below.Number, pr.Base.Ref), nil
		}
	}
	return "its base " + pr.Base.Ref + " has no open pr; retarget it onto main first", nil
}

/* Verbs */
func stackLinkPlan(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
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
	return names, nil
}

func askStackLink(plan any) string {
	return "link " + strings.Join(plan.([]string), " → ") + " into a github stack?"
}

func stackLink(r *Run, _ []string, _ Flags, plan any) (any, error) {
	names := plan.([]string)
	if err := stackStep(r, "link", "gh stack link, bottom-up", append([]string{"link"}, names...)); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%d layers linked: %s", len(names), strings.Join(names, " → ")), "x lane stack view")
	return ordered{{"layers", names}}, nil
}

type stackShown struct {
	Trunk    string `json:"trunk"`
	Branches []struct {
		Name string `json:"name"`
		PR   *struct {
			Number int    `json:"number"`
			State  string `json:"state"`
		} `json:"pr,omitempty"`
	} `json:"branches"`
}

func stackView(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var got result
	if err := r.Step("view", "gh stack view --json", func() (string, error) {
		got, err = stackCall("view", "--json")
		return "", err
	}); err != nil {
		return nil, err
	}
	var shown stackShown
	if err := json.Unmarshal([]byte(got.out), &shown); err != nil {
		return nil, &Fail{Msg: "gh stack view printed no stack json: " + err.Error(), Next: "gh stack view", Log: nonBlank(got.log)}
	}
	lines := []string{shown.Trunk}
	for _, layer := range shown.Branches {
		line := "└ " + layer.Name
		if layer.PR != nil {
			line += fmt.Sprintf(" #%d %s", layer.PR.Number, strings.ToLower(layer.PR.State))
		}
		lines = append(lines, line)
	}
	r.Done(strings.Join(lines, "\n"), "")
	return shown, nil
}

/* Layers */

// a layer is the root branch or the root plus -2, -3…; the root is this branch less a -N suffix when
// origin holds it, so a slug that ends in a number stays its own root
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
	for n := 2; heads[fmt.Sprintf("%s-%d", root, n)]; n++ {
		names = append(names, fmt.Sprintf("%s-%d", root, n))
	}
	if len(names) < 2 {
		return nil, &Fail{Refused: true, Msg: "a stack needs 2 layers; origin holds only " + root, Next: "push " + root + "-2, then x lane stack link --apply"}
	}
	return names, nil
}

/* gh stack */

func stackStep(r *Run, step, label string, args []string) error {
	return r.Step(step, label, func() (string, error) {
		got, err := stackCall(args...)
		return got.out, err
	})
}

// gh-stack's exit codes (cmd/utils.go): its lock covers the whole clone, so another worktree's
// command holds it for seconds (gh-stack#568, #570); a paused rebase holds it until someone finishes it
const (
	stackRebasePaused = 7
	stackLocked       = 8
	stackOff          = 9
)

const stackLockBudget = 2 * time.Minute

var (
	pausedIn  = regexp.MustCompile(`Operation started in worktree (\S+)`)
	pausedLog = regexp.MustCompile(`already in progress \((\S+)\)`)
)

// stackCall runs one `gh stack` as the coder app, after checking the extension is there; a held lock
// is waited out with backoff up to stackLockBudget, a paused rebase or a repo without stacks refuses at once
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
		case code == stackOff:
			repo, _ := mustGit("repo", "remote", "get-url", "origin")
			return got, &Fail{Refused: true, Msg: "stacked prs are not enabled for " + cmp.Or(repo, "this repo") + " (the stacks api answered 404)",
				Next: "x lane pr-open --apply <title> <body-file>, a plain pr", Log: nonBlank(got.log)}
		}
		return got, &Fail{Msg: "gh stack " + args[0] + " failed — its output is above", Next: "gh stack " + args[0], Log: nonBlank(got.log)}
	}
}

// under X_TEST, X_FAKE_SLEEP turns the waits into a counted offset, so a test spends the budget in no time
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

// --base must already sit on origin: gh would open the pr, and github would refuse it later
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
