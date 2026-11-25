package main

import (
	"fmt"
	"net/http"
	"slices"
)

// «no run» and «skipped» are never green
func ciCheck(api, base, head string) (mergeCheck, error) {
	c := mergeCheck{Name: "ci"}
	var protection struct {
		Contexts []string `json:"contexts"`
		Checks   []struct {
			Context string `json:"context"`
		} `json:"checks"`
	}
	status, _, err := ghSend(asDima, http.MethodGet, api+"/branches/"+base+"/protection/required_status_checks", nil, &protection)
	if err != nil && status != http.StatusNotFound {
		return c, err
	}
	required := protection.Contexts
	for _, check := range protection.Checks {
		if !slices.Contains(required, check.Context) {
			required = append(required, check.Context)
		}
	}
	if len(required) == 0 {
		c.Detail = "0 required checks on " + base + ": nothing proves the head"
		return c, nil
	}
	ran, err := checksOf(asDima, api, head)
	if err != nil {
		return c, err
	}
	for _, name := range required {
		i := slices.IndexFunc(ran, func(p prCheck) bool { return p.Name == name })
		switch {
		case i < 0:
			c.Detail = "no run of " + name + " for " + short(head)
			return c, nil
		case ran[i].State != "success":
			c.Detail = name + " is " + ran[i].State + " on " + short(head)
			return c, nil
		}
	}
	c.OK, c.Detail = true, fmt.Sprintf("%d of %d required green on %s", len(required), len(required), short(head))
	return c, nil
}

// main's own ci and deploy runs, newest first: a red ci on main holds every merge onto it, and in a repo that deploys
// a ci or deploy still queued or running holds it too, for door 1's deploy read sees only the older green one then.
// one read, the wait a pr's own pending ci gets, no poll (dima o53). a run is named by its run-name («deploy <sha>»),
// so its workflow file is what tells ci from deploy
func mainRunsCheck(api string, deploys bool) (mergeCheck, error) {
	c := mergeCheck{Name: "main-ci"}
	type run struct {
		ID         int64  `json:"id"`
		HeadSha    string `json:"head_sha"`
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
		Event      string `json:"event"`
	}
	// each workflow read on its own, so another workflow's runs can never push ci's out of the page; branch=main also
	// matches a fork's pr from a branch it named main, so only main's own events count: ci's push, and deploy's
	// workflow_run (it starts off ci's finished run), push or dispatch
	runsOf := func(workflow, query string, events ...string) ([]run, error) {
		var answer struct {
			Runs []run `json:"workflow_runs"`
		}
		_, err := ghFetch(asDima, api+"/actions/workflows/"+workflow+"/runs?branch=main"+query+"&per_page=5", &answer)
		return slices.DeleteFunc(answer.Runs, func(r run) bool { return !slices.Contains(events, r.Event) }), err
	}
	ci, err := runsOf("ci.yml", "&event=push", "push")
	if err != nil {
		return c, err
	}
	workflows := map[string][]run{"ci.yml": ci}
	if deploys {
		if workflows["deploy.yml"], err = runsOf("deploy.yml", "", "workflow_run", "push", "workflow_dispatch"); err != nil {
			return c, err
		}
	}
	for _, workflow := range []string{"ci.yml", "deploy.yml"} {
		for _, r := range workflows[workflow] {
			if deploys && r.Status != "completed" {
				c.Detail = fmt.Sprintf("main's deploy is running: run %d (%s) on %s", r.ID, workflow, short(r.HeadSha))
				return c, nil
			}
		}
	}
	// the newest run that finished on its own decides: one still running, or one a newer push cancelled (ci.yml cancels in
	// progress), would hide a red under it; a timeout or a failed start never proved main
	i := slices.IndexFunc(ci, func(r run) bool { return r.Status == "completed" && r.Conclusion != "cancelled" })
	// a page with no such run proves nothing, so it waits like a running ci (steer 21:15)
	if i < 0 && len(ci) > 0 {
		c.Detail = fmt.Sprintf("no ci run on main finished on its own in its newest %d: each is running or cancelled, so nothing proves main green; run %d is newest", len(ci), ci[0].ID)
		return c, nil
	}
	if i >= 0 && slices.Contains([]string{"failure", "timed_out", "startup_failure"}, ci[i].Conclusion) {
		c.Detail = fmt.Sprintf("main's ci is red on %s, run %d (%s): a merge would stack on it; a fix for main lands under dima's operator-override for prs", short(ci[i].HeadSha), ci[i].ID, ci[i].Conclusion)
		return c, nil
	}
	c.OK, c.Detail = true, "main's newest ci is not red"
	return c, nil
}
