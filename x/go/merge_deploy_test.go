package main

import (
	"fmt"
	"strings"
	"testing"
)

// main's history in a repo that deploys, newest first: each entry is one commit's statuses, "" for a commit that deployed nothing
func (w *mergeWorld) mainHistory(commits ...string) []string {
	w.env = append(w.env, "X_DEPLOY_REPO=o/r")
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	var shas, list []string
	for i, statuses := range commits {
		sha := fmt.Sprintf("%040d", i+1)
		shas = append(shas, sha)
		list = append(list, `{"sha":"`+sha+`"}`)
		w.hub.pages[repoPath+"/commits/"+sha+"/check-runs"] = `{"total_count":0,"check_runs":[]}`
		w.hub.pages[repoPath+"/commits/"+sha+"/statuses"] = "[" + statuses + "]"
	}
	w.hub.pages[repoPath+"/commits"] = "[" + strings.Join(list, ",") + "]"
	return shas
}

func vercel(app, state, description string) string {
	return `{"context":"Vercel – ` + app + `","state":"` + state + `","description":"` + description + `","target_url":"https://vercel.com/` + app + `"}`
}

const ciOnly = `{"context":"ci","state":"success","description":"","target_url":""}`

// exit line 7: a merge onto main's last deploying commit while it is red or running waits, naming the app and that commit
func TestMergeAutoWaitsOnMainsDeploy(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		history []string
		says    string
		at      int
	}{
		{"a red deploy", []string{vercel("speak", "success", "Deployment has completed") + "," + vercel("hq", "failure", "Deployment has failed")}, "hq", 0},
		{"an error", []string{vercel("hq", "error", "Deployment errored")}, "hq", 0},
		{"a running deploy", []string{vercel("hq", "pending", "Building")}, "main's deploy is running: hq", 0},
		{"a docs tip over a red deploy", []string{ciOnly, "", vercel("hq", "failure", "Deployment has failed")}, "hq", 2},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			shas := w.mainHistory(c.history...)

			got := w.run(t, "7", "--apply")

			wait := envelopeOf(got).Data.Wait
			if merges := w.hub.sent("PUT "); got.code == 0 || len(merges) != 0 || !strings.Contains(wait, c.says) || !strings.Contains(wait, short(shas[c.at])) {
				t.Fatalf("exit %d, %d merge calls, wait %q, want a deploy wait naming %q at %s:\n%s", got.code, len(merges), wait, c.says, short(shas[c.at]), got.stdout)
			}
		})
	}
}

// exit line 7: none of main's last 20 commits deployed, so nothing proves main deploys
func TestMergeAutoWaitsWhenMainDeployedNothingLately(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	history := make([]string, 25)
	history[22] = vercel("hq", "success", "Deployment has completed")
	w.mainHistory(history...)

	got := w.run(t, "7", "--apply")

	if wait := envelopeOf(got).Data.Wait; got.code == 0 || !strings.Contains(wait, "no deploy in main's last 20 commits") {
		t.Fatalf("exit %d, wait %q, want «no deploy in main's last 20 commits»:\n%s", got.code, wait, got.stdout)
	}
}

// exit line 7: the newest deploying commit decides; green, a skipped success, or a docs tip over a green deploy all pass
func TestMergeAutoMergesOntoAGreenDeploy(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		history []string
	}{
		{"every app green, an older red under a newer green", []string{vercel("hq", "success", "Deployment has completed") + "," + vercel("hq", "failure", "Deployment has failed") + "," + vercel("speak", "success", "Deployment has completed")}},
		{"a skipped success", []string{vercel("hq", "success", "Deployment was skipped")}},
		{"a docs tip over a green deploy", []string{"", ciOnly, vercel("hq", "success", "Deployment has completed"), vercel("hq", "failure", "Deployment has failed")}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mainHistory(c.history...)

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 {
				t.Fatalf("exit %d, %d merge calls, want one merge onto a green deploy:\n%s", got.code, len(merges), got.stdout)
			}
			if !hasCheck(envelopeOf(got).Data.Checks, "deploy", true) {
				t.Errorf("checks %+v, want a green deploy row", envelopeOf(got).Data.Checks)
			}
		})
	}
}

// review round: a pr onto another branch still lands on main in the end, so main's deploy is the one it reads
func TestMergeAutoReadsMainsDeployForAPrOffMain(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainHistory(vercel("hq", "failure", "Deployment has failed"))
	gitT(t, w.seed, "push", "-q", "origin", "main:release")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"base":{"ref":"main"}`, `"base":{"ref":"release"}`, 1)
	w.hub.pages[repoPath+"/branches/release/protection/required_status_checks"] = w.hub.pages[repoPath+"/branches/main/protection/required_status_checks"]
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if wait := envelopeOf(got).Data.Wait; got.code == 0 || !strings.Contains(wait, "hq") {
		t.Fatalf("exit %d, wait %q, want main's red hq deploy to hold a pr onto release:\n%s", got.code, wait, got.stdout)
	}
	if calls := w.hub.sent("GET " + repoPath + "/commits"); len(calls) == 0 || !strings.Contains(w.hub.lastQuery(repoPath+"/commits"), "sha=main") {
		t.Errorf("main's history was never read by name: %q", calls)
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
	if reads := w.hub.reads[repoPath+"/commits"]; reads != 0 {
		t.Errorf("a repo with no deploy read main's history %d times", reads)
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
