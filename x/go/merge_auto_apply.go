package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
)

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
		return releaseBrakeApply(r, d, api)
	}
	if err := r.Step("merge", "squash-merging the read head", func() (string, error) {
		if d.Override != nil {
			if _, on := overrideOn(d.Override.Scope, ""); !on {
				return "", &Fail{Refused: true, Msg: "operator-override " + d.Override.Scope + " went off after the read; nothing merged", Next: "x lane merge-auto " + d.PR}
			}
		}
		if err := holdsStill(d); err != nil {
			return "", err
		}
		if d.layered && laneAddOn.mergeLayers != nil {
			return mergeLayered(d, api)
		}
		var merged struct {
			Sha string `json:"sha"`
		}
		// the sha pins the merge to the head the checks read: a push since makes github refuse it
		status, _, err := ghSend(asDima, http.MethodPut, api+"/pulls/"+d.PR+"/merge", map[string]string{
			"sha": d.Head, "merge_method": "squash", "commit_title": d.title + " (#" + d.PR + ")",
			"commit_message": strings.TrimSpace(d.body) + "\n\n" + mergeTrailers(d),
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
	r.Done(mergeReport(d)+"\n"+d.summary(), "")
	return d, nil
}

func releaseBrakeApply(r *Run, d *mergeDecision, api string) (any, error) {
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

// a hold set since the plan read
func holdsStill(d *mergeDecision) error {
	if d.dimaOK {
		return nil
	}
	held, holdErr := readHolds(d.Repo)
	if stop := holdStop(d.Repo, d.PR, held, holdErr); stop != "" {
		return holdRefusal(d.PR, stop)
	}
	for layer := range d.heads {
		if stop := holdStop(d.Repo, layer, held, holdErr); stop != "" {
			return holdRefusal(d.PR, stop)
		}
	}
	return nil
}

// a stacked pr refuses the plain endpoint (403); its layers land together or not at all
func mergeLayered(d *mergeDecision, api string) (string, error) {
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

func mergeTrailers(d *mergeDecision) string {
	trailers := mergeTrailer
	if len(d.Checks) > 0 && d.Checks[0].renovateExempt {
		trailers += "\n" + renovateExemptTrailer
	}
	if d.Override != nil {
		trailers += "\nOperator-override: " + d.Override.Scope + ", by " + d.Override.By + " at " + d.Override.At
		if d.Brake != "" {
			trailers += "\nBrake-lifted: " + d.Brake
		}
	}
	return trailers
}

// what landed, and the override's log line, written here: a merge under it is logged once
func mergeReport(d *mergeDecision) string {
	result := "merged #" + d.PR + " at " + short(d.Merged)
	if d.layered {
		result = d.landed
	}
	if d.Override != nil {
		result += "\n" + d.Override.named()
		what := d.Repo + "#" + d.PR + " at " + short(d.Head)
		if d.Brake != "" {
			what += ", brake lifted: " + d.Brake
		}
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
	return result
}
