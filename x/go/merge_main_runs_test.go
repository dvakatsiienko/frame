package main

import (
	"fmt"
	"strings"
	"testing"
)

type mainRunRow struct{ workflow, body string }

// main's runs, newest first, each workflow's on its own page as /actions/workflows/<file>/runs?branch=main answers
func (w *mergeWorld) mainRuns(runs ...mainRunRow) {
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	pages := map[string][]string{"ci.yml": nil, "deploy.yml": nil}
	for _, r := range runs {
		pages[r.workflow] = append(pages[r.workflow], r.body)
	}
	for workflow, rows := range pages {
		w.hub.pages[repoPath+"/actions/workflows/"+workflow+"/runs"] = `{"workflow_runs":[` + strings.Join(rows, ",") + `]}`
	}
}

// a real row's shape: a run is named by its run-name («deploy <sha>»), never by its workflow
func mainRun(id int, workflow, status, conclusion, sha string) mainRunRow {
	return mainRunRow{workflow, fmt.Sprintf(`{"id":%d,"name":"%s %s","path":".github/workflows/%s","event":"push","status":"%s","conclusion":"%s","head_sha":"%s"}`,
		id, strings.TrimSuffix(workflow, ".yml"), sha, workflow, status, conclusion, sha)}
}

// a sha whose short form tells it apart: 2222222…
func runSha(n int) string { return strings.Repeat(fmt.Sprint(n), 40) }

// FRM-553 exit 2: a red ci on main's newest commit refuses the merge, in a repo that deploys and one that does not
func TestMergeAutoRefusesWhileMainsCIIsRed(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, conclusion string
		deploys          bool
	}{{"frame", "failure", false}, {"bytes", "failure", true}, {"a timeout", "timed_out", false}, {"a failed start", "startup_failure", true}} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			if c.deploys {
				w.mainHistory(vercel("hq", "success", "Deployment has completed"))
			}
			w.mainRuns(mainRun(2, "ci.yml", "completed", c.conclusion, runSha(2)), mainRun(1, "ci.yml", "completed", "success", runSha(1)))

			got := w.run(t, "7", "--apply")

			want := "main's ci is red on " + short(runSha(2))
			if wait := envelopeOf(got).Data.Wait; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(wait, want) {
				t.Fatalf("exit %d, wait %q, want a refusal naming %q:\n%s", got.code, wait, want, got.stdout)
			}
		})
	}
}

// only main's newest finished ci run is read: a red one under a newer green holds nothing
func TestMergeAutoReadsOnlyMainsNewestCIRun(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainRuns(mainRun(3, "codeberg-mirror.yml", "completed", "failure", runSha(2)),
		mainRun(2, "ci.yml", "completed", "success", runSha(2)), mainRun(1, "ci.yml", "completed", "failure", runSha(1)))

	if got := w.run(t, "7", "--apply"); got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
		t.Fatalf("exit %d, want the merge over an older red:\n%s", got.code, got.stdout)
	}
}

// an unfinished or cancelled newer ci run hides nothing: ci.yml cancels in progress, so the newest run that finished on
// its own still refuses a red main
func TestMergeAutoReadsMainsNewestFinishedCIRun(t *testing.T) {
	t.Parallel()
	for name, newer := range map[string][]mainRunRow{
		"in_progress":            {mainRun(3, "ci.yml", "in_progress", "", runSha(3))},
		"queued":                 {mainRun(3, "ci.yml", "queued", "", runSha(3))},
		"cancelled":              {mainRun(3, "ci.yml", "completed", "cancelled", runSha(3))},
		"running over cancelled": {mainRun(4, "ci.yml", "in_progress", "", runSha(4)), mainRun(3, "ci.yml", "completed", "cancelled", runSha(3))},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mainRuns(append(newer, mainRun(2, "ci.yml", "completed", "failure", runSha(2)))...)

			got := w.run(t, "7", "--apply")

			want := "main's ci is red on " + short(runSha(2))
			if wait := envelopeOf(got).Data.Wait; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(wait, want) {
				t.Fatalf("exit %d, wait %q, want a refusal naming %q:\n%s", got.code, wait, want, got.stdout)
			}
		})
	}
}

// a page of main's runs with none that finished on its own proves nothing: it waits, never reads green
func TestMergeAutoWaitsWhenNoMainCIRunFinished(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainRuns(mainRun(3, "ci.yml", "in_progress", "", runSha(3)), mainRun(2, "ci.yml", "completed", "cancelled", runSha(2)))

	got := w.run(t, "7", "--apply")

	if wait := envelopeOf(got).Data.Wait; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(wait, "no ci run on main finished") {
		t.Fatalf("exit %d, wait %q, want a wait naming no finished run:\n%s", got.code, wait, got.stdout)
	}
}

// a fork's pr from a branch it named main shows on branch=main as a pull_request run: only main's own pushes count
func TestMergeAutoReadsOnlyMainsOwnPushRuns(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	fork := mainRun(3, "ci.yml", "completed", "failure", runSha(3))
	fork.body = strings.Replace(fork.body, `"event":"push"`, `"event":"pull_request"`, 1)
	w.mainRuns(fork, mainRun(2, "ci.yml", "completed", "success", runSha(2)))

	if got := w.run(t, "7", "--apply"); got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
		t.Fatalf("exit %d, want the merge over a fork's red run:\n%s", got.code, got.stdout)
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
