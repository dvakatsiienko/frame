package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/user"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// the scope merge-auto and x-mod-guard's merge rule ask for; `guards` and `all` are later chunks
const overrideScopePrs = "prs"

// one scope's grant in the store, shaped as x-mod-guard's reader reads it
type overrideGrant struct {
	By    string `json:"by"`
	At    string `json:"at"`
	Until string `json:"until,omitempty"`
}

// what the merge's record carries
type overrideUsed struct {
	Scope    string `json:"scope"`
	By       string `json:"by"`
	At       string `json:"at"`
	DevBuild bool   `json:"devBuild,omitempty"`
}

func (u *overrideUsed) named() string {
	said := "operator-override " + u.Scope + ", by " + u.By + " at " + u.At
	if u.DevBuild {
		said += ", from a dev build"
	}
	return said
}

// the store's path: a session's Bash can set HOME and X_STATE, so neither reaches a real run; a test binary
// reads only the store its test names, so a real override on this mac can't land inside a suite
func overrideStore() string {
	if mergeTestEnvOn() {
		return os.Getenv("X_OVERRIDE_STORE")
	}
	return filepath.Join(systemHome(), ".local/state/x/operator-override.json")
}

func overrideLog(store string) string {
	return filepath.Join(filepath.Dir(store), "operator-override.log")
}

// the system's user record, which HOME can't move; no record means no path, and no path reads off
func systemHome() string {
	if home := os.Getenv("X_SYSTEM_HOME"); isTestBuild && home != "" {
		return home
	}
	me, err := user.Current()
	if err != nil {
		return ""
	}
	return me.HomeDir
}

// the one question every lock asks: prs is global, so it names no session; a scope per session keys its grant `<scope>:<session>`.
// a store that does not read answers off, so a broken one locks as today
func overrideOn(scope, session string) (overrideGrant, bool) {
	return overrideGrantIn(overrideStore(), scope, session)
}

func overrideGrantIn(store, scope, session string) (overrideGrant, bool) {
	if store == "" || !filepath.IsAbs(store) {
		return overrideGrant{}, false
	}
	raw, err := os.ReadFile(store)
	if err != nil {
		return overrideGrant{}, false
	}
	var grants map[string]overrideGrant
	if json.Unmarshal(raw, &grants) != nil {
		return overrideGrant{}, false
	}
	key := scope
	if session != "" {
		key += ":" + session
	}
	grant, on := grants[key]
	if !on || grant.By == "" {
		return overrideGrant{}, false
	}
	if grant.Until != "" {
		until, err := time.Parse(time.RFC3339, grant.Until)
		if err != nil || !clock().Before(until) {
			return overrideGrant{}, false
		}
	}
	return grant, true
}

// the scopes --override-off takes and the store left after it; a store that does not read goes with a whole off and
// stays for a shift-only one, since a shift's end has no word to read it by
func overrideAfterOff(raw []byte, shiftOnly bool) (cleared []string, left map[string]overrideGrant) {
	left = map[string]overrideGrant{}
	var grants map[string]overrideGrant
	if json.Unmarshal(raw, &grants) != nil {
		return nil, left
	}
	for scope, grant := range grants {
		if shiftOnly && grant.By != "shift" {
			left[scope] = grant
			continue
		}
		cleared = append(cleared, scope)
	}
	slices.Sort(cleared)
	return cleared, left
}

func overrideOffPlan(r *Run, shiftOnly bool) (any, error) {
	store := overrideStore()
	if store == "" {
		return nil, &Fail{Msg: "the system user record did not read, so the store has no path", Next: "id -P"}
	}
	r.Open("operator-override " + store)
	raw, err := os.ReadFile(store)
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return nil, &Fail{Msg: "the store did not read: " + err.Error(), Next: "ls -l " + store}
	}
	cleared, _ := overrideAfterOff(raw, shiftOnly)
	return &mergeDecision{Decision: "override-off", Risky: []string{}, Cleared: cleared, shiftOnly: shiftOnly}, nil
}

func overrideOffApply(r *Run, d *mergeDecision) (any, error) {
	if err := r.Step("override", "writing the store", func() (string, error) {
		store := overrideStore()
		raw, err := os.ReadFile(store)
		switch {
		case errors.Is(err, fs.ErrNotExist):
			return "no store, already off", nil
		case err != nil:
			return "", err
		}
		// re-read: a word typed since the plan keeps its grant under --shift-only
		cleared, left := overrideAfterOff(raw, d.shiftOnly)
		if d.shiftOnly && cleared == nil {
			return "no grant by a shift", nil
		}
		next, err := json.Marshal(left)
		if err != nil {
			return "", err
		}
		d.Cleared = cleared
		return strings.Join(cleared, ", ") + " off", atomicWrite(store, next)
	}); err != nil {
		return nil, err
	}
	said := "operator-override off"
	if len(d.Cleared) > 0 {
		said = "operator-override: " + strings.Join(d.Cleared, ", ") + " off"
	}
	r.Done(said, "")
	return d, nil
}

// the mod and x may read the store while this writes, and a torn file reads off, never on
func atomicWrite(path string, body []byte) error {
	temp, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*")
	if err != nil {
		return err
	}
	_, err = temp.Write(body)
	if closeErr := temp.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = os.Rename(temp.Name(), path)
	}
	if err != nil {
		_ = os.Remove(temp.Name())
	}
	return err
}

// what --override-check reports for one open pr: nothing in Stops means merge-auto would land it now
type overridePr struct {
	Repo  string `json:"repo"`
	PR    int    `json:"pr"`
	Title string `json:"title,omitempty"`
	Stops string `json:"stops,omitempty"`
}

type overrideCheckReport struct {
	Override *overrideUsed `json:"override,omitempty"`
	Prs      []overridePr  `json:"prs"`
}

// the repos a shift lands in, each read from its own clone: a pr's refs fetched from another repo's clone read as a false «could not fetch»
func overrideClones() [][2]string {
	if mergeTestEnvOn() {
		var clones [][2]string
		for pair := range strings.Lines(os.Getenv("X_OVERRIDE_CLONES")) {
			if repo, dir, found := strings.Cut(strings.TrimSpace(pair), "="); found {
				clones = append(clones, [2]string{repo, dir})
			}
		}
		return clones
	}
	return [][2]string{
		{"dvakatsiienko/frame", mainCheckout(frameRoot())},
		{"dvakatsiienko/bytes", filepath.Join(systemHome(), "projects/bytes")},
	}
}

// x-mod-guard's read of the brake before a raw merge under the override: one reader, brakeOn, and a failed read exits non-zero
func brakeCheckPlan(r *Run) (any, error) {
	r.Open("frame and bytes")
	clones := overrideClones()
	if len(clones) == 0 {
		return nil, brakeReadFail(errors.New("no clone to read it from"))
	}
	for _, clone := range clones {
		if err := os.Chdir(clone[1]); err != nil {
			return nil, brakeReadFail(fmt.Errorf("no clone of %s: %w", clone[0], err))
		}
		brake, err := brakeOn(clone[0], "main")
		if err != nil {
			return nil, brakeReadFail(err)
		}
		if brake != "" {
			r.Done("on: "+clone[0]+" "+brake, "")
			return map[string]string{"brake": clone[0] + " " + brake}, nil
		}
	}
	r.Done("off", "")
	return map[string]string{"brake": ""}, nil
}

// merge-auto's own plan per pr, so the answer can't drift from the door; a ref fetch is the only thing it writes
func overrideCheckPlan(r *Run) (any, error) {
	r.Open("every open pr")
	report := &overrideCheckReport{Prs: []overridePr{}}
	if grant, on := overrideOn(overrideScopePrs, ""); on {
		report.Override = &overrideUsed{Scope: overrideScopePrs, By: grant.By, At: grant.At, DevBuild: isDevBuild()}
	}
	back, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.Chdir(back) }()
	for _, clone := range overrideClones() {
		repo, dir := clone[0], clone[1]
		if err := r.Step("pr", "reading "+repo+"'s open prs", func() (string, error) {
			if err := os.Chdir(dir); err != nil {
				report.Prs = append(report.Prs, overridePr{Repo: repo, Stops: "no clone of " + repo + " at " + dir})
				return "", nil
			}
			open, err := ghPages[struct {
				Number int    `json:"number"`
				Title  string `json:"title"`
			}](asDima, githubBase()+"/repos/"+repo+"/pulls", "")
			if err != nil {
				report.Prs = append(report.Prs, overridePr{Repo: repo, Stops: "the open prs did not read: " + err.Error()})
				return "", nil
			}
			for _, pr := range open {
				row := overridePr{Repo: repo, PR: pr.Number, Title: pr.Title}
				if _, err := mergeAutoPlan(&Run{verb: r.verb}, []string{fmt.Sprint(pr.Number)}, Flags{"repo": repo}); err != nil {
					row.Stops = err.Error()
				}
				// github's own refusals, which the door meets only at the merge; mergeable is null while github computes it
				var shape struct {
					Draft     bool  `json:"draft"`
					Mergeable *bool `json:"mergeable"`
				}
				if _, err := ghFetch(asDima, fmt.Sprintf("%s/repos/%s/pulls/%d", githubBase(), repo, pr.Number), &shape); err == nil && row.Stops == "" {
					switch {
					case shape.Draft:
						row.Stops = "github refuses a draft"
					case shape.Mergeable != nil && !*shape.Mergeable:
						row.Stops = "github refuses it: a conflict"
					}
				}
				report.Prs = append(report.Prs, row)
			}
			return fmt.Sprintf("%d open", len(open)), nil
		}); err != nil {
			return nil, err
		}
	}
	lines := []string{}
	for _, row := range report.Prs {
		said := "lands"
		if row.Stops != "" {
			said = row.Stops
		}
		lines = append(lines, fmt.Sprintf("%s#%d: %s", row.Repo, row.PR, said))
	}
	r.Done(strings.Join(lines, "\n"), "")
	return report, nil
}

// one line per pass; it is what catches a store written around the guard. a line that can't land is named to the
// caller, never a stop: the merge is done by now
func overrideLogPass(used *overrideUsed, what string) error {
	line, err := json.Marshal(map[string]any{"at": clock().Format(time.RFC3339), "by": used.By, "dev_build": used.DevBuild, "scope": used.Scope, "since": used.At, "what": what})
	if err != nil {
		return err
	}
	file, err := os.OpenFile(overrideLog(overrideStore()), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(file, "%s\n", line)
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	return err
}
