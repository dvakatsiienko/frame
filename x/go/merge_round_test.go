package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// a gated repo, frame or bytes: its merges need a reviewer round
func roundWorld(t *testing.T) *mergeWorld {
	w := newMergeWorld(t, "apps/speak/src/a.ts")
	// the server already runs: a write after it takes the lock, the only edge the race detector sees, since
	// the request that reads it comes from a child process
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/branches/main/protection/required_status_checks"] = `{"contexts":["test","build"]}`
	w.hub.pages[repoPath+"/actions/workflows/review.yml"] = `{"name":"review"}`
	w.env = append(w.env, "X_ROUND_REPO=o/r")
	w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[
		{"id":1,"head_branch":"codie/x","head_sha":"` + w.head + `","status":"completed","conclusion":"success"}]}`
	w.hub.pages[repoPath+"/actions/runs/1/jobs"] = jobOf("success", "")
	return w
}

// a real row's shape: the caller's job is named `review-round / reviewer`, a failed step names itself, and the
// last step shows as skipped when an earlier one failed
func jobOf(conclusion, failedStep string) string {
	return `{"jobs":[{"name":"review-round / reviewer","conclusion":"` + conclusion + `","steps":[{"name":"` + failedStep + `","conclusion":"failure"},
		{"name":"A round with no review is red","conclusion":"skipped"}]}]}`
}

func (w *mergeWorld) reviewRun(conclusion, job, failedStep string) {
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[
		{"id":1,"head_branch":"codie/x","head_sha":"` + w.head + `","status":"completed","conclusion":"` + conclusion + `"}]}`
	w.hub.pages[repoPath+"/actions/runs/1/jobs"] = jobOf(job, failedStep)
}

func TestMergeAutoLandsAGatedPrOnItsRoundWithNoApprove(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)

	planned := w.run(t, "7")
	got := w.run(t, "7", "--apply")

	if planned.code != 4 || got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
		t.Fatalf("exits %d and %d, %d merges, want a plan and one merge:\n%s\n%s", planned.code, got.code, len(w.hub.sent("PUT ")), planned.stdout, got.stdout)
	}
	if approves := w.hub.sent("POST " + repoPath + "/pulls/7/reviews"); len(approves) != 0 {
		t.Errorf("an approve went out: %v", approves)
	}
	for _, a := range w.hub.auth {
		if a != "Bearer gho_dima" {
			t.Fatalf("a call went out as %q, want dima's gh login", a)
		}
	}
}

func TestMergeAutoRefusesAGatedPrWithNoFinishedRound(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		change func(w *mergeWorld)
	}{
		{"no run on the branch", func(w *mergeWorld) {
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[
				{"id":1,"head_branch":"other","head_sha":"` + w.head + `","status":"completed","conclusion":"success"}]}`
		}},
		{"a run still going", func(w *mergeWorld) {
			w.reviewRun("success", "success", "")
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			key := repoPath + "/actions/workflows/review.yml/runs"
			w.hub.pages[key] = strings.Replace(w.hub.pages[key], `"status":"completed"`, `"status":"in_progress"`, 1)
		}},
		{"the run skipped", func(w *mergeWorld) { w.reviewRun("skipped", "skipped", "") }},
		{"the run cancelled", func(w *mergeWorld) { w.reviewRun("cancelled", "cancelled", "") }},
		{"a green run whose reviewer job skipped", func(w *mergeWorld) { w.reviewRun("success", "skipped", "") }},
		{"a green run whose reviewer job cancelled", func(w *mergeWorld) { w.reviewRun("success", "cancelled", "") }},
		{"a green run whose only green job is not the reviewer", func(w *mergeWorld) {
			w.reviewRun("success", "skipped", "")
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			w.hub.pages[repoPath+"/actions/runs/1/jobs"] = `{"jobs":[{"name":"other","conclusion":"success","steps":[]},
				{"name":"review-round / reviewer","conclusion":"skipped","steps":[]}]}`
		}},
		{"a run dead on the cap", func(w *mergeWorld) { w.reviewRun("failure", "failure", "One review round per PR") }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := roundWorld(t)
			c.change(w)

			got := w.run(t, "7")

			if err := envelopeOf(got).Error; got.code != 1 || !strings.Contains(err, "no reviewer round finished") || !strings.Contains(err, "x lane review 7") || strings.Contains(err, "stood down") {
				t.Fatalf("exit %d, want a refusal naming the missing round, x lane review 7 and no stand-down:\n%s", got.code, got.stdout)
			}
		})
	}
}

func TestMergeAutoNamesTheDoorForAStandDown(t *testing.T) {
	t.Parallel()
	for _, step := range []string{"A green review means a clean review", "A round with no review is red"} {
		t.Run(step, func(t *testing.T) {
			t.Parallel()
			w := roundWorld(t)
			w.reviewRun("failure", "failure", step)

			got := w.run(t, "7")

			if err := envelopeOf(got).Error; got.code != 1 || !strings.Contains(err, "stood down") || !strings.Contains(err, "--dima-ok 7") {
				t.Fatalf("exit %d, want the stand-down door:\n%s", got.code, got.stdout)
			}
			if word := w.run(t, "7", "--dima-ok", "7"); word.code != 4 {
				t.Errorf("exit %d on dima's word, want a plan to confirm:\n%s", word.code, word.stdout)
			}
		})
	}
}

func TestMergeAutoNamesNoStandDownDoorOffTheHeadsHistory(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)
	w.reviewRun("failure", "failure", "A round with no review is red")
	w.rebaseWithANewCommit(t)

	got := w.run(t, "7", "--dima-ok", "7")

	if err := envelopeOf(got).Error; got.code != 1 || !strings.Contains(err, "x lane review 7") || strings.Contains(err, "stood down") {
		t.Fatalf("exit %d, want no stand-down door for a run off the history:\n%s", got.code, got.stdout)
	}
}

func TestMergeAutoExemptsARenovatePrFromTheRound(t *testing.T) {
	t.Parallel()
	for _, login := range []string{"x-renovate[bot]", "renovate[bot]"} {
		t.Run(login, func(t *testing.T) {
			t.Parallel()
			w := roundWorld(t)
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"number":7,`, `"number":7,"user":{"login":"`+login+`"},`, 1)
			w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[]}`
			w.hub.mu.Unlock()

			if got := w.run(t, "7"); got.code != 4 {
				t.Fatalf("exit %d, want a renovate pr past the round check:\n%s", got.code, got.stdout)
			}
		})
	}
}

// a commit as github answers it on a real renovate pr (frame#136, bytes#137)
const renovateCommit = `{"sha":"HEAD","author":{"login":"x-renovate[bot]"},"committer":{"login":"web-flow"},"commit":{"verification":{"verified":true}}}`

// no clean in the store, so only the exemption can pass the sixth-sense check
func (w *mergeWorld) renovatePr(t *testing.T, login, commits string) {
	t.Helper()
	write(t, w.store, `{}`)
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"number":7,`, `"number":7,"user":{"login":"`+login+`"},`, 1)
	if commits != "" {
		w.hub.pages[repoPath+"/pulls/7/commits"] = strings.ReplaceAll(commits, "HEAD", w.head)
	}
}

func TestMergeAutoLandsARenovatePrWithNoClean(t *testing.T) {
	t.Parallel()
	for _, login := range []string{"x-renovate[bot]", "renovate[bot]"} {
		t.Run(login, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "pnpm-lock.yaml")
			commit := strings.ReplaceAll(renovateCommit, "x-renovate[bot]", login)
			w.renovatePr(t, login, "["+commit+","+commit+"]")

			got := w.run(t, "7", "--apply")

			merges := w.hub.sent("PUT ")
			if got.code != 0 || len(merges) != 1 || !strings.Contains(got.stdout, "renovate's own commits") {
				t.Fatalf("exit %d, %d merges, want one merge naming the exemption:\n%s", got.code, len(merges), got.stdout)
			}
			if !strings.Contains(merges[0], "Clean-exempt: renovate's own commits") || !strings.Contains(merges[0], mergeTrailer) {
				t.Errorf("the squash message records no exemption beside the trailer: %s", merges[0])
			}
		})
	}
}

func TestMergeAutoAsksACleanOfARenovateWorkflowBump(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, files, want string }{
		{"a workflow file", `[{"filename":"pnpm-lock.yaml"},{"filename":".github/workflows/ci.yml"}]`, "it changes a workflow file, so a clean reads it: .github/workflows/ci.yml"},
		{"a workflow file moved away", `[{"filename":"old/ci.yml","previous_filename":".github/workflows/ci.yml"}]`, "it changes a workflow file, so a clean reads it: .github/workflows/ci.yml"},
		{"the files do not read", "", "github answered 500 for repos/o/r/pulls/7/files"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "pnpm-lock.yaml")
			w.renovatePr(t, "x-renovate[bot]", `[`+renovateCommit+`]`)
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/7/files"] = c.files
			if c.files == "" {
				w.hub.pages[repoPath+"/pulls/7/files"] = serverDown
			}
			w.hub.mu.Unlock()

			got := w.run(t, "7", "--apply")

			if e := envelopeOf(got).Error; got.code == 0 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(e, c.want) {
				t.Fatalf("exit %d, %d merges, error %q, want %q", got.code, len(w.hub.sent("PUT ")), e, c.want)
			}
		})
	}
}

func TestMergeAutoRecordsNoExemptionOnARenovatePrWithAClean(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "pnpm-lock.yaml")
	w.renovatePr(t, "x-renovate[bot]", `[`+renovateCommit+`]`)
	write(t, w.store, `{"o/r#7":"`+w.head+`"}`)

	got := w.run(t, "7", "--apply")

	merges := w.hub.sent("PUT ")
	if got.code != 0 || len(merges) != 1 || strings.Contains(merges[0], "Clean-exempt") {
		t.Fatalf("exit %d, merges %q, want one merge with no exemption line", got.code, merges)
	}
}

// a member's push on a renovate branch makes it a member's pr
func TestMergeAutoAsksACleanOfARenovatePrItCannotTrust(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, login, commits string }{
		{"a member's push on top", "x-renovate[bot]", `[` + renovateCommit + `,{"sha":"HEAD","author":{"login":"dvakatsiienko"},"committer":{"login":"dvakatsiienko"},"commit":{"verification":{"verified":true}}}]`},
		{"renovate's name on a member's push", "x-renovate[bot]", `[{"sha":"HEAD","author":{"login":"x-renovate[bot]"},"committer":{"login":"dvakatsiienko"},"commit":{"verification":{"verified":true}}}]`},
		{"github's name on an unsigned commit", "x-renovate[bot]", `[{"sha":"HEAD","author":{"login":"x-renovate[bot]"},"committer":{"login":"web-flow"},"commit":{"verification":{"verified":false}}}]`},
		{"a commit with no github account", "x-renovate[bot]", `[{"sha":"HEAD","author":null,"committer":{"login":"web-flow"},"commit":{"verification":{"verified":true}}}]`},
		{"no commits", "x-renovate[bot]", `[]`},
		{"a list cut short of the head", "x-renovate[bot]", `[` + strings.Replace(renovateCommit, "HEAD", "0000000", 1) + `]`},
		{"the commits do not read", "x-renovate[bot]", ""},
		{"a user named like the bot", "x-renovate", `[{"sha":"HEAD","author":{"login":"x-renovate"},"committer":{"login":"web-flow"},"commit":{"verification":{"verified":true}}}]`},
		{"a member's own pr of renovate's commit", "dvakatsiienko", `[` + renovateCommit + `]`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := roundWorld(t)
			w.renovatePr(t, c.login, c.commits)

			got := w.run(t, "7", "--apply")

			if got.code != 1 || !strings.Contains(envelopeOf(got).Error, "no clean recorded for o/r#7") {
				t.Fatalf("exit %d, error %q, want the missing clean named", got.code, envelopeOf(got).Error)
			}
			if sent := append(w.hub.sent("PUT "), w.hub.sent("POST "+repoPath+"/pulls/7/reviews")...); len(sent) != 0 {
				t.Errorf("a merge or an approve went out: %v", sent)
			}
		})
	}
}

func TestMergeAutoKeepsTheOtherGatesOnARenovatePr(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, path string
		change     func(w *mergeWorld)
		want       string
	}{
		{"a required job skipped", "pnpm-lock.yaml", func(w *mergeWorld) {
			w.hub.pages[repoPath+"/commits/"+w.head+"/check-runs"] = `{"check_runs":[{"name":"test","status":"completed","conclusion":"success"},
				{"name":"build","status":"completed","conclusion":"skipped"}]}`
		}, "build is skipped"},
		{"a repo with 0 required checks", "pnpm-lock.yaml", func(w *mergeWorld) {
			delete(w.hub.pages, repoPath+"/branches/main/protection/required_status_checks")
		}, "0 required checks on main"},
		{"one open review thread", "pnpm-lock.yaml", func(w *mergeWorld) {
			w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[
				{"isResolved":false,"path":"a.go","line":3,"comments":{"nodes":[{"url":"https://t/2"}]}}]}}}}}`
		}, "1 open review thread"},
		{"a self-edit", "x/go/merge_auto.go", func(*mergeWorld) {}, "self-edit, needs dima's word"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, c.path)
			w.renovatePr(t, "x-renovate[bot]", `[`+renovateCommit+`]`)
			w.hub.mu.Lock()
			c.change(w)
			w.hub.mu.Unlock()

			got := w.run(t, "7", "--apply")

			if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(envelopeOf(got).Error, "wait: "+c.want) {
				t.Fatalf("exit %d, %d merges, error %q, want the wait on %q", got.code, len(w.hub.sent("PUT ")), envelopeOf(got).Error, c.want)
			}
		})
	}
}

func TestMergeAutoRefusesAFinishedRoundWithAnOpenThread(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)
	w.hub.mu.Lock()
	w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[
		{"isResolved":false,"path":"a.ts","line":1,"comments":{"nodes":[{"url":"https://t/1"}]}}]}}}}}`
	w.hub.mu.Unlock()

	if got := w.run(t, "7"); got.code != 1 || !strings.Contains(envelopeOf(got).Error, "1 open review thread") {
		t.Fatalf("exit %d, want the open thread named:\n%s", got.code, got.stdout)
	}
}

func TestMergeAutoCountsARoundOnAnAncestorOfTheHead(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)
	write(t, filepath.Join(w.seed, "fix.ts"), "a fix after the round\n")
	gitT(t, w.seed, "add", ".")
	gitT(t, w.seed, "commit", "-q", "-m", "a fix after the round")
	w.moveHead(t)
	write(t, w.store, `{"o/r#7":"`+w.head+`"}`)

	if got := w.run(t, "7"); got.code != 4 {
		t.Fatalf("exit %d, want the round on the ancestor to count:\n%s", got.code, got.stdout)
	}
}

func TestMergeAutoCarriesARoundAcrossARebaseWithTheSameCode(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)
	w.mainMoves(t, "one.txt")
	w.moveHead(t)

	if got := w.run(t, "7"); got.code != 4 {
		t.Fatalf("exit %d, want the round to carry by patch-id:\n%s", got.code, got.stdout)
	}
}

// rebaseWithANewCommit leaves the old head off the history and the branch's change different
func (w *mergeWorld) rebaseWithANewCommit(t *testing.T) {
	t.Helper()
	w.mainMoves(t, "one.txt")
	write(t, filepath.Join(w.seed, "fix.ts"), "a change inside the rebase\n")
	gitT(t, w.seed, "add", ".")
	gitT(t, w.seed, "commit", "-q", "-m", "a change inside the rebase")
	w.moveHead(t)
	write(t, w.store, `{"o/r#7":"`+w.head+`"}`)
}

func TestMergeAutoCountsNoRoundWhenARebaseChangedTheCode(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)
	w.rebaseWithANewCommit(t)

	if got := w.run(t, "7"); got.code != 1 || !strings.Contains(envelopeOf(got).Error, "x lane review 7") {
		t.Fatalf("exit %d, want a round on other code not to count:\n%s", got.code, got.stdout)
	}
}

func TestRoundGatedNamesFrameAndBytes(t *testing.T) {
	// serial: t.Setenv clears X_TEST, so the real repo list is read
	t.Setenv("X_TEST", "")
	for repo, want := range map[string]bool{"dvakatsiienko/frame": true, "dvakatsiienko/bytes": true, "o/other": false} {
		if got := roundGated(repo); got != want {
			t.Errorf("roundGated(%q) = %v, want %v", repo, got, want)
		}
	}
}

func TestMergeAutoAsksNoRoundOutsideAGatedRepo(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/actions/workflows/review.yml"] = `{"name":"review"}`
	w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[]}`
	w.hub.mu.Unlock()

	if got := w.run(t, "7"); got.code != 4 {
		t.Fatalf("exit %d, want no round asked of frame:\n%s", got.code, got.stdout)
	}
}
