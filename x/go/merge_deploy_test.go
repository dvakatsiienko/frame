package main

import (
	"strings"
	"testing"
)

const mainTip = "1111111111111111111111111111111111111111"

// main's tip in a repo that deploys, holding these Vercel statuses, newest first as github lists them
func (w *mergeWorld) mainDeploys(statuses string) {
	w.env = append(w.env, "X_DEPLOY_REPO=o/r")
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/branches/main"] = `{"name":"main","commit":{"sha":"` + mainTip + `"}}`
	w.hub.pages[repoPath+"/commits/"+mainTip+"/check-runs"] = `{"total_count":0,"check_runs":[]}`
	w.hub.pages[repoPath+"/commits/"+mainTip+"/statuses"] = "[" + statuses + "]"
}

func vercel(app, state, description string) string {
	return `{"context":"Vercel – ` + app + `","state":"` + state + `","description":"` + description + `","target_url":"https://vercel.com/` + app + `"}`
}

// exit line 7: a merge onto a red, running, skipped or absent deploy of main waits, naming the app and main's tip
func TestMergeAutoWaitsOnMainsDeploy(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, statuses, says string }{
		{"a red deploy", vercel("speak", "success", "Deployment has completed") + "," + vercel("hq", "failure", "Deployment has failed"), "hq"},
		{"an error", vercel("hq", "error", "Deployment errored"), "hq"},
		{"a running deploy", vercel("hq", "pending", "Building"), "main's deploy is running: hq"},
		{"a skipped deploy", vercel("hq", "success", "Deployment was skipped"), "hq"},
		{"no deploy at all", `{"context":"ci","state":"success","description":"","target_url":""}`, "no deploy on main's tip " + short(mainTip)},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mainDeploys(c.statuses)

			got := w.run(t, "7", "--apply")

			wait := envelopeOf(got).Data.Wait
			if merges := w.hub.sent("PUT "); got.code == 0 || len(merges) != 0 || !strings.Contains(wait, c.says) || !strings.Contains(wait, "deploy") {
				t.Fatalf("exit %d, %d merge calls, wait %q, want a deploy wait naming %q:\n%s", got.code, len(merges), wait, c.says, got.stdout)
			}
			if !strings.Contains(wait, short(mainTip)) {
				t.Errorf("wait %q names no main tip %s", wait, short(mainTip))
			}
		})
	}
}

// exit line 7: every Vercel status green on main's tip passes the deploy row; an older red under a newer green is history
func TestMergeAutoMergesOntoAGreenDeploy(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainDeploys(vercel("hq", "success", "Deployment has completed") + "," + vercel("hq", "failure", "Deployment has failed") + "," + vercel("speak", "success", "Deployment has completed"))

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want one merge onto a green deploy:\n%s", got.code, len(merges), got.stdout)
	}
	if !hasCheck(envelopeOf(got).Data.Checks, "deploy", true) {
		t.Errorf("checks %+v, want a green deploy row", envelopeOf(got).Data.Checks)
	}
}

// review round: a pr onto another branch still lands on main in the end, so main's tip is the deploy it reads
func TestMergeAutoReadsMainsDeployForAPrOffMain(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainDeploys(vercel("hq", "failure", "Deployment has failed"))
	gitT(t, w.seed, "push", "-q", "origin", "main:release")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"base":{"ref":"main"}`, `"base":{"ref":"release"}`, 1)
	w.hub.pages[repoPath+"/branches/release/protection/required_status_checks"] = w.hub.pages[repoPath+"/branches/main/protection/required_status_checks"]
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if wait := envelopeOf(got).Data.Wait; got.code == 0 || !strings.Contains(wait, "hq") {
		t.Fatalf("exit %d, wait %q, want main's red hq deploy to hold a pr onto release:\n%s", got.code, wait, got.stdout)
	}
}

// exit line 8: frame deploys nothing, so the row says it skipped and never holds the merge
func TestMergeAutoSkipsTheDeployInARepoThatDeploysNothing(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")

	got := w.run(t, "7", "--apply")

	checks := envelopeOf(got).Data.Checks
	if got.code != 0 || !hasCheck(checks, "deploy", true) {
		t.Fatalf("exit %d, checks %+v, want a passing deploy row:\n%s", got.code, checks, got.stdout)
	}
	for _, c := range checks {
		if c.Name == "deploy" && c.Detail != "no deploy: skipped" {
			t.Errorf("the deploy row reads %q, want «no deploy: skipped»", c.Detail)
		}
	}
	if reads := w.hub.reads[repoPath+"/branches/main"]; reads != 0 {
		t.Errorf("a repo with no deploy read main %d times", reads)
	}
}

func hasCheck(checks []mergeCheck, name string, ok bool) bool {
	for _, c := range checks {
		if c.Name == name && c.OK == ok {
			return true
		}
	}
	return false
}
