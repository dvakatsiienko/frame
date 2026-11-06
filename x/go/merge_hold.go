package main

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type holdNote struct {
	PRs []string `json:"prs"`
}

// this mac's record, the one store x-mod-guard's raw-merge rule reads too: it reads with no network, before a command runs
func holdRecord(repo string) string {
	state := stateDir()
	// an env var in a real run would swap the record the gate reads
	if os.Getenv("X_TEST") == "" {
		userHome, _ := os.UserHomeDir()
		state = filepath.Join(userHome, ".local/state/x")
	}
	return filepath.Join(state, "merge-hold", strings.ReplaceAll(repo, "/", "_")+".json")
}

func readHolds(repo string) ([]string, error) {
	raw, err := os.ReadFile(holdRecord(repo))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var note holdNote
	if err := json.Unmarshal(raw, &note); err != nil {
		return nil, err
	}
	if note.PRs == nil {
		return nil, errors.New("no prs list")
	}
	return note.PRs, nil
}

func writeHolds(repo string, prs []string) error {
	if len(prs) == 0 {
		err := os.Remove(holdRecord(repo))
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return err
	}
	raw, err := json.Marshal(holdNote{PRs: prs})
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(holdRecord(repo)), 0o755); err != nil {
		return err
	}
	return os.WriteFile(holdRecord(repo), raw, 0o644)
}

// why a held mark stops pr's merge, "" when it does not; a mark that cannot be read reads as held
func holdStop(repo, pr string, held []string, readErr error) string {
	switch {
	case readErr != nil:
		return "the hold record " + home(holdRecord(repo)) + " is unreadable, so #" + pr + " reads as held: needs dima's word"
	case slices.Contains(held, pr):
		return "#" + pr + " is held by dima's hold: needs his word"
	}
	return ""
}

func holdRefusal(n, stop string) error {
	return &Fail{Refused: true, Msg: "wait: " + stop, Next: "x lane merge-auto " + n + " --apply --dima-ok " + n}
}

// --hold and --release-hold take the pr and every open layer under it, since a top's merge lands them all
func holdPlan(r *Run, n, decision string, flags Flags) (any, error) {
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	api := githubBase() + "/repos/" + repo
	r.Open("#" + n + " " + repo)
	d := &mergeDecision{Repo: repo, PR: n, Decision: decision, Risky: []string{}, holds: []string{n}}
	if err := r.Step("pr", "reading the pr and the layers under it", func() (string, error) {
		var pr pullHead
		if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
			return "", err
		}
		if decision == "hold" && (pr.State != "open" || pr.Merged) {
			return "", &Fail{Refused: true, Msg: "#" + n + " is not open, nothing to hold", Next: "x gh pr " + n}
		}
		if laneAddOn.layersOf != nil {
			layers, err := laneAddOn.layersOf(repo, n, pr)
			if err != nil {
				return "", err
			}
			if layers != nil {
				d.holds = append(d.holds, layers.below...)
			}
		}
		return "#" + strings.Join(d.holds, ", #"), nil
	}); err != nil {
		return nil, err
	}
	return d, nil
}

func holdApply(r *Run, d *mergeDecision) (any, error) {
	if err := r.Step("hold", "writing this mac's hold record", func() (string, error) {
		held, readErr := readHolds(d.Repo)
		if d.Decision == "hold" {
			if readErr != nil {
				return "", &Fail{Refused: true, Msg: "the hold record " + home(holdRecord(d.Repo)) + " is unreadable, nothing written", Next: "x lane merge-auto " + d.PR + " --release-hold --dima-ok " + d.PR + " --apply"}
			}
			for _, pr := range d.holds {
				if !slices.Contains(held, pr) {
					held = append(held, pr)
				}
			}
			return "#" + strings.Join(d.holds, ", #") + " held", writeHolds(d.Repo, held)
		}
		// an unreadable record goes with any release, as the brake's does
		left := slices.DeleteFunc(held, func(pr string) bool { return slices.Contains(d.holds, pr) })
		return "#" + strings.Join(d.holds, ", #") + " released", writeHolds(d.Repo, left)
	}); err != nil {
		return nil, err
	}
	said := "held #" + strings.Join(d.holds, ", #") + "; merges only on dima's word: x lane merge-auto " + d.PR + " --apply --dima-ok " + d.PR
	if d.Decision != "hold" {
		said = "released #" + strings.Join(d.holds, ", #")
	}
	r.Done(said, "")
	return d, nil
}

// a landed layer's mark comes off; nothing here can fail a done merge, and an unreadable record stays for a release to take
func dropLandedHolds(d *mergeDecision) string {
	held, err := readHolds(d.Repo)
	if err != nil {
		return "⚠ the hold record " + home(holdRecord(d.Repo)) + " is unreadable and stays; every merge in this repo waits for dima's word until: x lane merge-auto " + d.PR + " --release-hold --dima-ok " + d.PR + " --apply"
	}
	left := slices.DeleteFunc(slices.Clone(held), func(pr string) bool {
		_, layer := d.heads[pr]
		return pr == d.PR || layer
	})
	if len(left) == len(held) {
		return ""
	}
	if err := writeHolds(d.Repo, left); err != nil {
		return "⚠ the landed layers' held marks stay: " + err.Error()
	}
	return "held mark taken off the landed layers"
}
