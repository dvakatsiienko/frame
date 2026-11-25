package main

import (
	"errors"
	"strings"
)

func mergeAutoPlan(r *Run, args []string, flags Flags) (plan any, err error) {
	form, err := mergeAutoForm(r, args, flags)
	if err != nil || form.isPlanned {
		return form.plan, err
	}
	r.Open("#" + form.pr + " " + form.repo)

	var override *overrideUsed
	if grant, on := overrideOn(overrideScopePrs, ""); on {
		override = &overrideUsed{Scope: overrideScopePrs, By: grant.By, At: grant.At, DevBuild: isDevBuild()}
	}
	// the tier reads before any refusal, so a dry run names its checks before a sign is asked; every refusal carries it
	var read mergeRead
	var d *mergeDecision
	defer func() {
		if f, failed := errors.AsType[*Fail](err); failed && f.Data == nil {
			f.Data = read.tier
			if d != nil {
				f.Data = d
			}
		}
	}()
	if read, err = readMergeTier(r, form, override != nil); err != nil {
		return nil, err
	}
	if err := readMergePr(r, form, override != nil, &read); err != nil {
		return nil, err
	}
	d = &mergeDecision{Repo: form.repo, PR: form.pr, Head: read.pr.Head.Sha, Risky: []string{}, Tier: read.tier.Tier, Asks: read.tier.Asks, title: read.pr.Title, body: read.pr.Body, headRef: read.pr.Head.Ref, signs: map[string]chunkSign{}, dimaOK: form.word != ""}
	if override != nil {
		d.Override, d.Sign = override, override.named()
	}
	trunk, err := gateLayers(r, d, read)
	if err != nil {
		return nil, err
	}
	checks, err := readMergeChecks(r, d, read, trunk)
	if err != nil {
		return nil, err
	}
	selfWait, err := riskyStep(r, d, read)
	if err != nil {
		return nil, err
	}
	brake, err := brakeStep(r, d, trunk)
	if err != nil {
		return nil, err
	}

	if d.Override != nil && brake == "" {
		d.Decision = "merge"
		return d, nil
	}
	d.Decision, d.Wait = decide(brake, selfWait, checks.inWaitOrder()...)
	if d.Decision == "wait" {
		// --apply could only refuse a wait, so it never prints as a plan to confirm
		return nil, &Fail{Refused: true, Msg: "wait: " + d.Wait + "\n" + d.summary(), Next: "x lane merge-auto " + form.pr, Data: d}
	}
	return d, nil
}

// what the argv asks: a plan its form alone makes, or a pr to read, with dima's word on it
type mergeForm struct {
	repo, pr, word string
	plan           any
	isPlanned      bool
}

func plannedForm(plan any, err error) (mergeForm, error) {
	return mergeForm{plan: plan, isPlanned: true}, err
}

func mergeAutoForm(r *Run, args []string, flags Flags) (mergeForm, error) {
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
			return mergeForm{}, usageFail("--brake-check reads the fleet's brake: it takes no pr and no other switch", "x lane merge-auto --brake-check")
		}
		return plannedForm(brakeCheckPlan(r))
	case check && (off || shiftOnly || len(args) > 0):
		return mergeForm{}, usageFail("--override-check reads every open pr: it takes no pr and no other switch", "x lane merge-auto --override-check")
	case check:
		return plannedForm(overrideCheckPlan(r))
	case shiftOnly && !off:
		return mergeForm{}, usageFail("--shift-only narrows --override-off", "x lane merge-auto --override-off --shift-only --apply")
	case off && len(args) > 0:
		return mergeForm{}, usageFail("--override-off takes no pr: it turns the whole switch off", "x lane merge-auto --override-off --apply")
	case off:
		return plannedForm(overrideOffPlan(r, shiftOnly))
	case len(args) == 0:
		return mergeForm{}, usageFail("name the pr", "x lane merge-auto <pr number>")
	}
	n := args[0]
	if !prNumber.MatchString(n) {
		return mergeForm{}, usageFail(n+" is not a pr number", "x lane merge-auto <pr number>")
	}
	word, _ := flags["dima-ok"].(string)
	if word != "" && word != n {
		return mergeForm{}, usageFail("--dima-ok names #"+word+", this merge is #"+n+": dima's word counts for the pr it names", "x lane merge-auto "+n+" --apply --dima-ok "+n)
	}
	hold, _ := flags["hold"].(bool)
	releaseHold, _ := flags["release-hold"].(bool)
	switch {
	case hold && releaseHold:
		return mergeForm{}, usageFail("--hold and --release-hold undo each other: name one", "x lane merge-auto "+n+" --hold --apply")
	case releaseHold && word == "":
		return mergeForm{}, usageFail("a hold is released only on dima's typed word", "x lane merge-auto "+n+" --release-hold --dima-ok "+n+" --apply")
	case hold:
		return plannedForm(holdPlan(r, n, "hold", flags))
	case releaseHold:
		return plannedForm(holdPlan(r, n, "release-hold", flags))
	}
	if release, _ := flags["release-brake"].(bool); release {
		if word == "" {
			return mergeForm{}, usageFail("the brake is released only on dima's typed word", releaseBrake(n))
		}
		repo, err := repoOf(flags)
		if err != nil {
			return mergeForm{}, err
		}
		r.Open("#" + n + " " + repo)
		return plannedForm(&mergeDecision{Repo: repo, PR: n, Decision: "release", Risky: []string{}}, nil)
	}
	repo, err := repoOf(flags)
	return mergeForm{repo: repo, pr: n, word: word}, err
}

// what the tier and pr steps read, for the steps after
type mergeRead struct {
	pr       pullHead
	paths    []string
	pathsErr error
	tier     prTier
	layers   *prLayers
	held     []string
	holdErr  error
}

// the pr is read first and its paths after, so they are its head's or a later push's, never an older one's; a push past
// the read leaves the merge pinned to the read head, which github refuses
func readMergeTier(r *Run, form mergeForm, isOverridden bool) (read mergeRead, err error) {
	api := githubBase() + "/repos/" + form.repo
	err = r.Step("tier", "reading the checks the changed paths ask", func() (string, error) {
		if read.paths, read.pathsErr = headAndPaths(api, form.pr, &read.pr); read.pathsErr != nil {
			if isOverridden {
				// the tier only names; a read that failed stops nothing under the override
				return "the paths did not read: " + read.pathsErr.Error(), nil
			}
			return "", read.pathsErr
		}
		read.tier = tierOf(read.paths)
		return read.tier.shown(), nil
	})
	return read, err
}

func readMergePr(r *Run, form mergeForm, isOverridden bool, read *mergeRead) error {
	n := form.pr
	api := githubBase() + "/repos/" + form.repo
	return r.Step("pr", "reading the pr head", func() (string, error) {
		// read in the tier step, unless that read failed under the override
		if read.pr.Head.Sha == "" {
			if _, err := ghFetch(asDima, api+"/pulls/"+n, &read.pr); err != nil {
				return "", err
			}
		}
		state := read.pr.State
		if read.pr.Merged {
			state = "merged"
		}
		if state != "open" {
			return "", &Fail{Refused: true, Msg: "#" + n + " is " + state + ", nothing to merge", Next: "x gh pr " + n}
		}
		read.held, read.holdErr = readHolds(form.repo)
		if stop := holdStop(form.repo, n, read.held, read.holdErr); stop != "" && form.word == "" {
			return "", holdRefusal(n, stop)
		}
		if laneAddOn.layersOf != nil {
			var err error
			read.layers, err = laneAddOn.layersOf(form.repo, n, read.pr)
			switch {
			// a stack's read that failed stops nothing under the override: github refuses the plain merge of a stacked pr in its own words
			case err != nil && isOverridden && read.pr.Base.Ref == "main":
				read.layers = nil
			case err != nil:
				return "", err
			case read.layers != nil && read.layers.wait != "":
				return "", &Fail{Refused: true, Msg: "wait: " + read.layers.wait, Next: "x lane merge-auto " + n}
			}
		}
		return read.pr.Head.Ref + " at " + short(read.pr.Head.Sha), nil
	})
}

func riskyStep(r *Run, d *mergeDecision, read mergeRead) (selfWait string, err error) {
	err = r.Step("risky", "matching the changed paths on the risky list", func() (string, error) {
		own, ownSelf := riskyOf(read.paths)
		err := read.pathsErr
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
		if selfWait, err = d.selfWait(read.pr, ownSelf); err != nil {
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
	})
	return selfWait, err
}
