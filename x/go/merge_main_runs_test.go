package main

import (
	"fmt"
	"strings"
	"testing"
)

// main's workflow runs, newest first, as /actions/runs?branch=main answers
func (w *mergeWorld) mainRuns(runs ...string) {
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/actions/runs"] = `{"workflow_runs":[` + strings.Join(runs, ",") + `]}`
}

// a real row's shape: a run is named by its run-name, so its workflow file is what tells ci from deploy
func mainRun(id int, workflow, status, conclusion, sha string) string {
	return fmt.Sprintf(`{"id":%d,"name":"%s %s","path":".github/workflows/%s","event":"push","status":"%s","conclusion":"%s","head_sha":"%s"}`,
		id, strings.TrimSuffix(workflow, ".yml"), sha, workflow, status, conclusion, sha)
}

// a sha whose short form tells it apart: 2222222…
func runSha(n int) string { return strings.Repeat(fmt.Sprint(n), 40) }

// FRM-553 exit 2: a red ci on main's newest commit refuses the merge, in a repo that deploys and one that does not
func TestMergeAutoRefusesWhileMainsCIIsRed(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		deploys bool
	}{{"frame", false}, {"bytes", true}} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			if c.deploys {
				w.mainHistory(vercel("hq", "success", "Deployment has completed"))
			}
			w.mainRuns(mainRun(2, "ci.yml", "completed", "failure", runSha(2)), mainRun(1, "ci.yml", "completed", "success", runSha(1)))

			got := w.run(t, "7", "--apply")

			want := "main's ci is red on " + short(runSha(2))
			if wait := envelopeOf(got).Data.Wait; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(wait, want) {
				t.Fatalf("exit %d, wait %q, want a refusal naming %q:\n%s", got.code, wait, want, got.stdout)
			}
		})
	}
}

// only main's newest ci run is read: a red one under a newer green, or under a cancelled one, holds nothing
func TestMergeAutoReadsOnlyMainsNewestCIRun(t *testing.T) {
	t.Parallel()
	for _, newest := range []string{"success", "cancelled"} {
		t.Run(newest, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mainRuns(mainRun(3, "codeberg-mirror.yml", "completed", "failure", runSha(2)),
				mainRun(2, "ci.yml", "completed", newest, runSha(2)), mainRun(1, "ci.yml", "completed", "failure", runSha(1)))

			if got := w.run(t, "7", "--apply"); got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
				t.Fatalf("exit %d, want the merge over an older red:\n%s", got.code, got.stdout)
			}
		})
	}
}

// FRM-553 exits 1 and 4: in a repo that deploys, a queued or running ci or deploy run on main is one read and a wait naming it
func TestMergeAutoWaitsWhileMainsCIOrDeployRuns(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ workflow, status string }{
		{"deploy.yml", "in_progress"}, {"deploy.yml", "queued"}, {"ci.yml", "in_progress"}, {"ci.yml", "queued"},
	} {
		t.Run(c.workflow+" "+c.status, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mainHistory(vercel("hq", "success", "Deployment has completed"))
			w.mainRuns(mainRun(9, c.workflow, c.status, "", runSha(2)), mainRun(1, "ci.yml", "completed", "success", runSha(1)))

			got := w.run(t, "7", "--apply")

			wait := envelopeOf(got).Data.Wait
			if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(wait, "main's deploy is running") || !strings.Contains(wait, "run 9") {
				t.Fatalf("exit %d, wait %q, want a wait naming main's running deploy and run 9:\n%s", got.code, wait, got.stdout)
			}
		})
	}
}

// FRM-553 exit 1: the same runs finished green land
func TestMergeAutoLandsOnceMainsDeployFinishedGreen(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainHistory(vercel("hq", "success", "Deployment has completed"))
	w.mainRuns(mainRun(9, "deploy.yml", "completed", "success", runSha(2)), mainRun(8, "ci.yml", "completed", "success", runSha(2)))

	if got := w.run(t, "7", "--apply"); got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
		t.Fatalf("exit %d, want the merge once main's runs finished green:\n%s", got.code, got.stdout)
	}
}

// FRM-553 exit 2: frame deploys nothing, so its running deploy run holds no merge
func TestMergeAutoIsNotHeldByARunningDeployInARepoThatDeploysNothing(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainRuns(mainRun(2, "deploy.yml", "in_progress", "", runSha(1)), mainRun(1, "ci.yml", "completed", "success", runSha(1)))

	if got := w.run(t, "7", "--apply"); got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
		t.Fatalf("exit %d, want the merge:\n%s", got.code, got.stdout)
	}
}
