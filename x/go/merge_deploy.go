package main

import (
	"fmt"
	"os"
	"strings"
)

// a repo whose main deploys from ci, so a merge onto a red or running deploy stacks a second failure on it
func deployGated(repo string) bool {
	if mergeTestEnvOn() {
		return repo == os.Getenv("X_DEPLOY_REPO")
	}
	return repo == "dvakatsiienko/bytes"
}

// main's tip, never the pr head: bytes pr heads carry no deploy, since production deploys run from ci after a merge
func deployCheck(api, repo, trunk string) (mergeCheck, error) {
	c := mergeCheck{Name: "deploy"}
	if !deployGated(repo) {
		c.OK, c.Detail = true, "no deploy: skipped"
		return c, nil
	}
	// a ci or docs commit deploys nothing, so the commit read is main's last one that deployed, newest first
	var history []struct {
		Sha string `json:"sha"`
	}
	if _, err := ghFetch(asDima, api+"/commits?sha="+trunk+"&per_page="+fmt.Sprint(deployLookback), &history); err != nil {
		return c, err
	}
	for _, commit := range history[:min(len(history), deployLookback)] {
		checks, err := checksOf(asDima, api, commit.Sha)
		if err != nil {
			return c, err
		}
		var apps []string
		for _, check := range checks {
			app, isDeploy := strings.CutPrefix(check.Name, "Vercel – ")
			if !isDeploy {
				continue
			}
			apps = append(apps, app)
			// a skipped deploy reads success and passes: the hold is a red or a running deploy only (dima, o45)
			switch check.State {
			case "success":
			case "pending":
				c.Detail = "main's deploy is running: " + app + " on " + short(commit.Sha)
				return c, nil
			default:
				// the pr that fixes main meets this same wait, so the door that lands it is named, never «fix main» alone
				c.Detail = app + "'s deploy is " + check.State + " on main at " + short(commit.Sha) + ": a merge would stack on it; a fix for main lands under dima's operator-override for prs"
				return c, nil
			}
		}
		if len(apps) > 0 {
			c.OK, c.Detail = true, strings.Join(apps, ", ")+" deployed on main at "+short(commit.Sha)
			return c, nil
		}
	}
	c.Detail = fmt.Sprintf("no deploy in main's last %d commits, so nothing proves main deploys", deployLookback)
	return c, nil
}

// how far back main's last deploy is looked for: a run of ci and docs commits is a few, never a release's worth
const deployLookback = 20
