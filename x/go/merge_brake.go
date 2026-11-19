package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

/* The brake */

const brakeFor = 7 * 24 * time.Hour

var (
	revertsSha     = regexp.MustCompile(`(?m)^This reverts commit ([0-9a-f]{40})`)
	revertsSubject = regexp.MustCompile(`^Revert "(.+)"`)
)

func releaseBrake(n string) string {
	return "x lane merge-auto " + n + " --release-brake --dima-ok " + n
}

// a pr wearing the brake label: a merge that landed another head than the gate read. the pr being merged (n, "" for
// none) is read by its own labels first: github's label list lags a fresh label by up to a minute (the 16 Nov probe)
func brakeLabelled(api, n string) (string, error) {
	var labelled []struct {
		Number int `json:"number"`
	}
	// a brake merge-auto cannot read never reads as off: any failure, a 404 included, stops the merge
	if n != "" {
		var own []label
		if _, err := ghFetch(asDima, api+"/issues/"+n+"/labels", &own); err != nil {
			return "", err
		}
		if slices.Contains(own, label{brakeLabel}) {
			return "#" + n + " wears the " + brakeLabel + " label; release once dima looked: " + releaseBrake(n), nil
		}
	}
	if _, err := ghFetch(asDima, api+"/issues?state=all&labels="+brakeLabel, &labelled); err != nil {
		return "", err
	}
	if len(labelled) == 0 {
		return "", nil
	}
	n = fmt.Sprint(labelled[0].Number)
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
func brakeOn(repo, base, n string) (what, kind string, err error) {
	api := githubBase() + "/repos/" + repo
	if labelled, err := brakeLabelled(api, n); err != nil || labelled != "" {
		return labelled, "label", err
	}
	if recorded, err := brakeRecorded(repo); err != nil || recorded != "" {
		return recorded, "record", err
	}
	if _, err := mustGit("brake", "fetch", "-q", "origin", base); err != nil {
		return "", "", err
	}
	ours, err := mustGit("brake", "log", "origin/"+base, "--fixed-strings", "--grep="+mergeTrailer, "--format=%H%x00%s")
	if err != nil {
		return "", "", err
	}
	merged := map[string]bool{}
	for line := range strings.Lines(ours) {
		sha, subject, _ := strings.Cut(strings.TrimSpace(line), "\x00")
		merged[sha], merged[subject] = true, true
	}
	since := clock().Add(-brakeFor).Format(time.RFC3339)
	recent, err := mustGit("brake", "log", "origin/"+base, "--since="+since, "--format=%H%x00%B%x1e")
	if err != nil {
		return "", "", err
	}
	for record := range strings.SplitSeq(recent, "\x1e") {
		sha, message, _ := strings.Cut(strings.TrimSpace(record), "\x00")
		if match := revertsSha.FindStringSubmatch(message); match != nil {
			ours, err := mergedByX(api, merged, match[1], "/commits/"+match[1]+"/pulls")
			if err != nil || ours {
				return short(sha) + " reverts " + short(match[1]), "revert", err
			}
		}
		if match := revertsSubject.FindStringSubmatch(message); match != nil {
			pr := ""
			if n := prOfSubject.FindStringSubmatch(match[1]); n != nil {
				pr = "/pulls/" + n[1]
			}
			ours, err := mergedByX(api, merged, match[1], pr)
			if err != nil || ours {
				return short(sha) + " reverts «" + match[1] + "»", "revert", err
			}
		}
	}
	return "", "", nil
}

// what a lifting grant leaves in place of the brake's stop: its source named, its release door left out
func liftedBrake(kind, what string) string {
	what, _, _ = strings.Cut(what, "; release once dima looked")
	switch kind {
	case "label":
		num, _, _ := strings.Cut(what, " ")
		return "label " + num + ": a stack landed a head the gate never read"
	case "record":
		return "record " + what
	}
	return "revert " + what
}

// the one human line a lifted brake leaves: the board's summary, and stderr in agent mode, where the json alone held it
func brakeWarning(scope, brake string) string {
	return "⚠ brake lifted by operator-override " + scope + ": " + brake
}

// his typed word and his band press lift the brake; a shift's grant does not, until dima says so
func liftsBrake(used *overrideUsed) bool {
	return used != nil && (used.By == "word" || used.By == "band")
}
