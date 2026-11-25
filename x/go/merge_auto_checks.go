package main

import "slices"

type mergeChecks struct {
	sixthSense, security, wishkeeper, ci, mergeable, deploy, mainCI, round, threads mergeCheck
}

// the order their waits outrank each other
func (checks mergeChecks) inWaitOrder() []mergeCheck {
	return []mergeCheck{checks.sixthSense, checks.security, checks.wishkeeper, checks.round, checks.ci, checks.mergeable, checks.deploy, checks.mainCI, checks.threads}
}

// the checks the decision shows, in its order
func (checks mergeChecks) card(repo string, tier prTier) []mergeCheck {
	card := []mergeCheck{checks.sixthSense, checks.ci, checks.mergeable, checks.deploy, checks.mainCI, checks.threads}
	if roundGated(repo) {
		card = []mergeCheck{checks.sixthSense, checks.ci, checks.mergeable, checks.deploy, checks.mainCI, checks.round, checks.threads}
	}
	if !slices.Contains(tier.Asks, "sixth-sense") {
		card = card[1:]
	}
	if slices.Contains(tier.Asks, "security") {
		card = append(card, checks.security)
	}
	if slices.Contains(tier.Asks, "wishkeeper") {
		card = append(card, checks.wishkeeper)
	}
	return card
}

func readMergeChecks(r *Run, d *mergeDecision, read mergeRead, trunk string) (mergeChecks, error) {
	var checks mergeChecks
	if d.Override != nil {
		r.skip("sixth-sense", "security", "wishkeeper", "ci", "mergeable", "deploy", "main-ci", "round", "threads")
		return checks, nil
	}
	api := githubBase() + "/repos/" + d.Repo
	if err := readAskedChecks(r, d, read, &checks); err != nil {
		return checks, err
	}
	if err := r.Step("ci", "reading the required checks on the head", func() (string, error) {
		var err error
		if checks.ci, err = ciCheck(api, trunk, read.pr.Head.Sha); err != nil {
			return "", err
		}
		return checks.ci.shown()
	}); err != nil {
		return checks, err
	}
	if err := r.Step("mergeable", "reading whether github would merge it", func() (string, error) {
		var err error
		// a pr in a stack, its bottom layer included, is fixed by the restack, so it reads with no trunk as a layer does
		plainTrunk := trunk
		if d.layered {
			plainTrunk = ""
		}
		if checks.mergeable, err = mergeableCheck(api, d.PR, read.pr, plainTrunk, newWaitClock()); err != nil {
			return "", err
		}
		return checks.mergeable.shown()
	}); err != nil {
		return checks, err
	}
	if err := r.Step("deploy", "reading main's deploy, which the merge lands on", func() (string, error) {
		var err error
		// production deploys from main whatever the pr's base, so main's tip is the one a merge lands on in the end
		if checks.deploy, err = deployCheck(api, d.Repo, "main"); err != nil {
			return "", err
		}
		return checks.deploy.shown()
	}); err != nil {
		return checks, err
	}
	if err := r.Step("main-ci", "reading main's ci and deploy runs", func() (string, error) {
		var err error
		if checks.mainCI, err = mainRunsCheck(api, deployGated(d.Repo)); err != nil {
			return "", err
		}
		return checks.mainCI.shown()
	}); err != nil {
		return checks, err
	}
	if err := r.Step("round", "reading the reviewer's round on the branch", func() (string, error) {
		var err error
		if checks.round, err = roundCheck(api, d.Repo, d.PR, read.pr.Base.Ref, read.pr.Head.Ref, read.pr.Head.Sha, read.pr.User.Login, d.dimaOK); err != nil {
			return "", err
		}
		return checks.round.shown()
	}); err != nil {
		return checks, err
	}
	if err := r.Step("threads", "counting the open review threads", func() (string, error) {
		var err error
		if checks.threads, err = threadsCheck(d.Repo, d.PR); err != nil {
			return "", err
		}
		return checks.threads.shown()
	}); err != nil {
		return checks, err
	}
	d.Checks = checks.card(d.Repo, read.tier)
	return checks, nil
}

// the three the tier may not ask
func readAskedChecks(r *Run, d *mergeDecision, read mergeRead, checks *mergeChecks) error {
	api := githubBase() + "/repos/" + d.Repo
	if !slices.Contains(read.tier.Asks, "sixth-sense") {
		r.skip("sixth-sense")
		checks.sixthSense = mergeCheck{Name: "sixth-sense", OK: true, Detail: "light: no sixth sense asked"}
	} else if err := r.Step("sixth-sense", "reading sixth sense's clean", func() (string, error) {
		checks.sixthSense = d.sixthSenseOf(api, d.Repo, d.PR, read.pr, read.paths)
		return checks.sixthSense.shown()
	}); err != nil {
		return err
	}
	checks.security = mergeCheck{Name: "security", OK: true, Detail: "no risky path: no security pass asked"}
	if !slices.Contains(read.tier.Asks, "security") {
		r.skip("security")
	} else if err := r.Step("security", "reading the security pass on the risky paths", func() (string, error) {
		checks.security = securityCheck(d.Repo, d.PR, read.pr.Head.Sha, read.pr.Base.Ref, read.pr.Head.Ref)
		return checks.security.shown()
	}); err != nil {
		return err
	}
	checks.wishkeeper = mergeCheck{Name: "wishkeeper", OK: true, Detail: "no memory path: no wishkeeper read asked"}
	if !slices.Contains(read.tier.Asks, "wishkeeper") {
		r.skip("wishkeeper")
	} else if err := r.Step("wishkeeper", "reading clio's wishkeeper read on the memory paths", func() (string, error) {
		var err error
		if checks.wishkeeper, err = wishkeeperCheck(api, d.PR, read.pr.Head.Sha, read.pr.Base.Ref, read.pr.Head.Ref, read.paths); err != nil {
			return "", err
		}
		return checks.wishkeeper.shown()
	}); err != nil {
		return err
	}
	return nil
}
