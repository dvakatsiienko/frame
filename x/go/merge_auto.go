package main

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"strings"
)

func mergeAutoPlan(r *Run, args []string, flags Flags) (plan any, err error) {
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
	// the tier reads before any refusal, so a dry run names its checks before a sign is asked; every refusal carries it
	var paths []string
	var pathsErr error
	var tier prTier
	var d *mergeDecision
	defer func() {
		if f, failed := errors.AsType[*Fail](err); failed && f.Data == nil {
			f.Data = tier
			if d != nil {
				f.Data = d
			}
		}
	}()
	// the pr is read first and its paths after, so they are its head's or a later push's, never an older one's; a push past
	// the read leaves the merge pinned to the read head, which github refuses
	if err := r.Step("tier", "reading the checks the changed paths ask", func() (string, error) {
		if paths, pathsErr = headAndPaths(api, n, &pr); pathsErr != nil {
			if override != nil {
				// the tier only names; a read that failed stops nothing under the override
				return "the paths did not read: " + pathsErr.Error(), nil
			}
			return "", pathsErr
		}
		tier = tierOf(paths)
		return tier.shown(), nil
	}); err != nil {
		return nil, err
	}
	if err := r.Step("pr", "reading the pr head", func() (string, error) {
		// read in the tier step, unless that read failed under the override
		if pr.Head.Sha == "" {
			if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
				return "", err
			}
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
	d = &mergeDecision{Repo: repo, PR: n, Head: pr.Head.Sha, Risky: []string{}, Tier: tier.Tier, Asks: tier.Asks, title: pr.Title, body: pr.Body, headRef: pr.Head.Ref, signs: map[string]chunkSign{}, dimaOK: word != ""}
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

	var sixthSense, security, wishkeeper, ci, round, mergeable, deploy, mainCI, threads mergeCheck
	if d.Override != nil {
		r.skip("sixth-sense", "security", "wishkeeper", "ci", "mergeable", "deploy", "main-ci", "round", "threads")
	} else {
		if !slices.Contains(tier.Asks, "sixth-sense") {
			r.skip("sixth-sense")
			sixthSense = mergeCheck{Name: "sixth-sense", OK: true, Detail: "light: no sixth sense asked"}
		} else if err := r.Step("sixth-sense", "reading sixth sense's clean", func() (string, error) {
			sixthSense = d.sixthSenseOf(api, repo, n, pr, paths)
			return sixthSense.shown()
		}); err != nil {
			return nil, err
		}
		security = mergeCheck{Name: "security", OK: true, Detail: "no risky path: no security pass asked"}
		if !slices.Contains(tier.Asks, "security") {
			r.skip("security")
		} else if err := r.Step("security", "reading the security pass on the risky paths", func() (string, error) {
			security = securityCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref)
			return security.shown()
		}); err != nil {
			return nil, err
		}
		wishkeeper = mergeCheck{Name: "wishkeeper", OK: true, Detail: "no memory path: no wishkeeper read asked"}
		if !slices.Contains(tier.Asks, "wishkeeper") {
			r.skip("wishkeeper")
		} else if err := r.Step("wishkeeper", "reading clio's wishkeeper read on the memory paths", func() (string, error) {
			var err error
			if wishkeeper, err = wishkeeperCheck(api, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref, paths); err != nil {
				return "", err
			}
			return wishkeeper.shown()
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
		if err := r.Step("main-ci", "reading main's ci and deploy runs", func() (string, error) {
			var err error
			if mainCI, err = mainRunsCheck(api, deployGated(repo)); err != nil {
				return "", err
			}
			return mainCI.shown()
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
		d.Checks = []mergeCheck{sixthSense, ci, mergeable, deploy, mainCI, threads}
		if roundGated(repo) {
			d.Checks = []mergeCheck{sixthSense, ci, mergeable, deploy, mainCI, round, threads}
		}
		if !slices.Contains(tier.Asks, "sixth-sense") {
			d.Checks = d.Checks[1:]
		}
		if slices.Contains(tier.Asks, "security") {
			d.Checks = append(d.Checks, security)
		}
		if slices.Contains(tier.Asks, "wishkeeper") {
			d.Checks = append(d.Checks, wishkeeper)
		}
	}
	selfWait := ""
	if err := r.Step("risky", "matching the changed paths on the risky list", func() (string, error) {
		own, ownSelf := riskyOf(paths)
		err := pathsErr
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
		var kind string
		brake, kind, err = brakeOn(repo, trunk, n)
		switch {
		case err != nil:
			return "", brakeReadFail(err)
		case brake != "" && liftsBrake(d.Override):
			// his word or band press reads the brake as a warning: the merge goes on, the brake named once
			d.Brake = liftedBrake(kind, brake)
			brake = ""
			if !r.human {
				fmt.Fprintln(os.Stderr, brakeWarning(d.Override.Scope, d.Brake))
			}
			return "on: " + d.Brake + " — lifted by operator-override " + d.Override.Scope, nil
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
	d.Decision, d.Wait = decide(brake, selfWait, sixthSense, security, wishkeeper, round, ci, mergeable, deploy, mainCI, threads)
	if d.Decision == "wait" {
		// --apply could only refuse a wait, so it never prints as a plan to confirm
		return nil, &Fail{Refused: true, Msg: "wait: " + d.Wait + "\n" + d.summary(), Next: "x lane merge-auto " + n, Data: d}
	}
	return d, nil
}
