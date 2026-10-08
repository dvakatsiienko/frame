package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const headSha, oldSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

// a fake gh answering from files beside it: pr.json, runs.jsonl (absent → 404), body; every call
// lands in calls.log behind the token it ran with
func fakeGh(t *testing.T, runs []string) (env []string, dir string) {
	t.Helper()
	dir = t.TempDir()
	write(t, filepath.Join(dir, "pr.json"), `{"title":"a pr","headRefName":"coder/x","headRefOid":"`+headSha+`","labels":[{"name":"🤖 review:requested"}]}`)
	if runs != nil {
		write(t, filepath.Join(dir, "runs.jsonl"), strings.Join(runs, "\n")+"\n")
	}
	write(t, filepath.Join(dir, "bin/gh"), `#!/bin/sh
d='`+dir+`'
printf '%s %s\n' "$GH_TOKEN" "$*" >> "$d/calls.log"
case "$1" in
api) [ -f "$d/runs.jsonl" ] && exec cat "$d/runs.jsonl"; echo 'gh: Not Found (HTTP 404)' >&2; exit 1 ;;
pr) case "$2 $*" in
	view*'--json body'*) cat "$d/body"; if [ -n "$FAKE_GH_MANGLE" ]; then echo mangled; fi ;;
	view*) cat "$d/pr.json" ;;
	edit*--body-file*) for a; do last=$a; done; cp "$last" "$d/body" ;;
	esac ;;
esac
`)
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-coder:x": farFuture + ":ghs_coder"})
	return []string{"PATH=" + filepath.Join(dir, "bin") + ":" + os.Getenv("PATH"), "X_KEYS=" + keys}, dir
}

func runOf(number int, sha, status, conclusion string) string {
	return fmt.Sprintf(`{"run_number":%d,"head_branch":"coder/x","head_sha":%q,"status":%q,"conclusion":%q}`, number, sha, status, conclusion)
}

func calls(t *testing.T, dir string) string {
	body, _ := os.ReadFile(filepath.Join(dir, "calls.log"))
	return string(body)
}

func TestReviewReRequestsAStaleVerdictUnderTheCap(t *testing.T) {
	env, dir := fakeGh(t, []string{runOf(1, oldSha, "completed", "success"), `{"run_number":2,"head_branch":"other","head_sha":"` + headSha + `","status":"completed","conclusion":"success"}`})

	got := xIn(t, t.TempDir(), env, "lane", "review", "7")

	log := calls(t, dir)
	removed := strings.Index(log, "ghs_coder pr edit 7 --remove-label 🤖 review:requested")
	added := strings.Index(log, "ghs_coder pr edit 7 --add-label 🤖 review:requested")
	if got.code != 0 || removed < 0 || added < removed {
		t.Fatalf("exit %d, want the label removed then added as the coder app:\n%s%s", got.code, log, got.stdout)
	}
	if got.data["judged"] != oldSha || got.data["review"] != "requested" {
		t.Errorf("the envelope does not name the judged commit: %s", got.stdout)
	}
}

func TestReviewLeavesTheLabelAloneWhenNothingIsStale(t *testing.T) {
	cases := []struct {
		name   string
		runs   []string
		review string
	}{
		{"the verdict judged the head", []string{runOf(1, oldSha, "completed", "success"), runOf(2, headSha, "completed", "success")}, "current"},
		{"a round is running on the head", []string{runOf(1, oldSha, "completed", "success"), runOf(2, headSha, "in_progress", "")}, "running"},
		{"the repo has no review lane", nil, "no lane"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			env, dir := fakeGh(t, c.runs)

			got := xIn(t, t.TempDir(), env, "lane", "review", "7")

			if got.code != 0 || got.data["review"] != c.review || strings.Contains(calls(t, dir), "pr edit") {
				t.Fatalf("exit %d, review %v, calls:\n%s", got.code, got.data["review"], calls(t, dir))
			}
		})
	}
}

func TestReviewAtTheCapNamesDimasApprovalAndRequestsNothing(t *testing.T) {
	env, dir := fakeGh(t, []string{runOf(1, oldSha, "completed", "success"), runOf(2, oldSha, "completed", "success"), runOf(3, oldSha, "completed", "failure")})

	got := xIn(t, t.TempDir(), env, "lane", "review", "7")

	if got.code != 1 || strings.Contains(calls(t, dir), "pr edit") {
		t.Fatalf("exit %d, calls:\n%s", got.code, calls(t, dir))
	}
	if !strings.Contains(got.stdout, "dima approves #7") {
		t.Errorf("the refusal does not name dima's approval: %s", got.stdout)
	}
}

func TestPrBodyRefusesACallWithoutANumber(t *testing.T) {
	env, dir := fakeGh(t, nil)
	body := filepath.Join(t.TempDir(), "body.md")
	write(t, body, "the body\n")
	cases := map[string][]string{
		"the file alone":         {body},
		"the file before the pr": {body, "7", "--apply"},
		"a branch for the pr":    {"coder/x", body, "--apply"},
	}
	for name, argv := range cases {
		t.Run(name, func(t *testing.T) {
			got := xIn(t, t.TempDir(), env, append([]string{"lane", "pr-body"}, argv...)...)

			if got.code != 2 || calls(t, dir) != "" {
				t.Fatalf("exit %d, calls:\n%s", got.code, calls(t, dir))
			}
		})
	}
}

func TestPrBodyWritesTheFileAndReadsItBack(t *testing.T) {
	cases := []struct {
		name   string
		mangle string
		code   int
	}{
		{"the read-back matches", "", 0},
		{"the read-back differs", "1", 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			env, dir := fakeGh(t, nil)
			body := filepath.Join(t.TempDir(), "body.md")
			write(t, body, "- ticket: FRM-1\n\nwhat changed\n")

			got := xIn(t, t.TempDir(), append(env, "FAKE_GH_MANGLE="+c.mangle), "lane", "pr-body", "7", body, "--apply")

			if got.code != c.code || read(t, filepath.Join(dir, "body")) != read(t, body) {
				t.Fatalf("exit %d, want %d:\n%s%s", got.code, c.code, calls(t, dir), got.stdout)
			}
			if !strings.Contains(calls(t, dir), "ghs_coder pr edit 7 --body-file "+body) {
				t.Errorf("the body was not written to #7 as the coder app:\n%s", calls(t, dir))
			}
		})
	}
}

// a fixture repo whose origin/main carries one commit for FRM-9 and one for FRM-90
func preflightRepo(t *testing.T) string {
	dir := repo(t)
	write(t, filepath.Join(dir, "docs/shipped.md"), "done\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "ship it", "-m", "- ticket: FRM-9")
	write(t, filepath.Join(dir, "other.md"), "not this one\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "a neighbour", "-m", "- ticket: FRM-90")
	gitT(t, dir, "update-ref", "refs/remotes/origin/main", "HEAD")
	return dir
}

func runPreflight(t *testing.T, body string, id string) (map[string]any, asRun) {
	t.Helper()
	raw, _ := json.Marshal(body)
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})
	return runLinear(t, server, nil, "brief", "preflight", id, "--repo", preflightRepo(t))
}

func TestPreflightPassesACleanTicket(t *testing.T) {
	body := "## want\n\nthe «redesign» word quoted is a name, not a plan\n\n## exit\n\n1. `x lane brand-new <pr>` prints ok\n2. post-merge: dima reads the board\n"

	_, got := runPreflight(t, body, "FRM-1")

	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
}

func TestPreflightNamesEveryProblem(t *testing.T) {
	body := "## want\n\nwe redesign the board\n\n## exit\n\n- `other.md` lists the rest\n2. it works\n3. `x lane unlock` runs in a locked tree\n4. `docs/shipped.md` says done\n"
	want := []string{
		"line 3: grill redesign",
		"line 7: lint exit line — has no number",
		"line 8: lint exit line — names no surface",
		"line 9: main x lane unlock — is already a verb on main",
		"line 10: main docs/shipped.md — already changed on main for FRM-9",
		"ship it — main already carries a commit for FRM-9",
	}

	_, got := runPreflight(t, body, "FRM-9")

	if got.code != 1 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	for _, line := range want {
		if !strings.Contains(got.stdout, line) {
			t.Errorf("missing %q in\n%s", line, got.stdout)
		}
	}
	if strings.Contains(got.stdout, "a neighbour") || strings.Contains(got.stdout, "line 7: main other.md") {
		t.Errorf("FRM-90's commit counted for FRM-9:\n%s", got.stdout)
	}
}
