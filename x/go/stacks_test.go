//go:build !nostacks

package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestPrOpenWithBaseOpensOntoTheLayerBelow(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "coder/FRM-1-a", "part 2", bodyFile(t))

	calls := strings.TrimSpace(read(t, log))
	if got.code != 0 || !strings.HasPrefix(calls, "ghs_coder pr create --base coder/FRM-1-a --head coder/FRM-1-a-2 ") || strings.Contains(calls, "\n") {
		t.Fatalf("exit %d, gh calls %q, want one pr create onto coder/FRM-1-a\n%s", got.code, calls, got.stdout)
	}
}

// a gh with the gh-stack extension: FAKE_NO_STACK leaves it uninstalled, view answers for three layers
const ghStack = `'extension list'*) if [ -z "$FAKE_NO_STACK" ]; then printf 'gh stack\tgithub/gh-stack\tv0.0.6\n'; fi ;;
'stack link'*) n=$(cat "$FAKE_DIR/n" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "$FAKE_DIR/n"
	code=$(echo "$FAKE_EXITS" | cut -d' ' -f$n); code=${code:-$(echo "$FAKE_EXITS" | awk '{print $NF}')}
	case "$code" in
	7) echo "a rebase operation is already in progress (/repo/.git/worktrees/w2/gh-stack-rebase-state)" >&2
		echo "Operation started in worktree /trees/w2"
		echo 'Run ` + "`gh stack rebase --continue` or `gh stack rebase --abort`" + ` before another mutation' ;;
	8) echo "could not acquire stack lock" >&2 ;;
	9) echo "Stacked PRs are not enabled for this repository" >&2 ;;
	esac
	exit "${code:-0}" ;;
'stack'*) echo "fake gh-stack: unexpected $*" >&2; exit 1 ;;`

// github's side of a linked stack: the open prs, and the stacks api answering for the pr it is asked about
func stackGithub(t *testing.T, clone string, stacks string) []string {
	t.Helper()
	onGithub(t, clone)
	pages := map[string]string{repoPath + "/pulls": `[{"number":11,"head":{"ref":"coder/FRM-1-a"}},{"number":12,"head":{"ref":"coder/FRM-1-a-2"}},
		{"number":13,"head":{"ref":"coder/FRM-1-a-3"}},{"number":21,"head":{"ref":"coder/FRM-1-v-2"}},{"number":22,"head":{"ref":"coder/FRM-1-v-2-2"}}]`}
	if stacks != "" {
		pages[repoPath+"/stacks"] = stacks
	}
	server, _ := fakeGithub(t, pages)
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"})
	return []string{"X_GITHUB_URL=" + server.URL, "X_KEYS=" + keys}
}

// the clone's origin reads as github.com/o/r and still fetches from the bare fixture
func onGithub(t *testing.T, clone string) {
	t.Helper()
	origin := gitT(t, clone, "remote", "get-url", "origin")
	gitT(t, clone, "remote", "set-url", "origin", "https://github.com/o/r.git")
	gitT(t, clone, "config", "url."+origin+".insteadOf", "https://github.com/o/r.git")
}

const linkedStack = `[{"number":4,"base":{"ref":"main"},"pull_requests":[
	{"number":11,"state":"closed","merged_at":"2026-10-23T10:00:00Z","head":{"ref":"coder/FRM-1-a"}},
	{"number":12,"state":"open","head":{"ref":"coder/FRM-1-a-2"}},
	{"number":13,"state":"open","head":{"ref":"coder/FRM-1-a-3"}}]}]`

// linkEnv is a gh with the extension plus github answering the layers' prs
func linkEnv(t *testing.T, clone string) (env []string, log string) {
	t.Helper()
	env, log = ghRecorder(t, ghStack)
	return append(env, stackGithub(t, clone, "")...), log
}

// by pr number: gh stack link pushes every branch it is named, and a frame worktree's push dies
func TestStackLinkLinksTheLayersBottomUp(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env, log := linkEnv(t, clone)

	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

	var links []string
	for line := range strings.Lines(read(t, log)) {
		if strings.Contains(line, " stack link ") {
			links = append(links, strings.TrimSpace(line))
		}
	}
	if want := "ghs_coder stack link 11 12 13"; got.code != 0 || len(links) != 1 || links[0] != want {
		t.Fatalf("exit %d, stack link calls %q, want [%q]\n%s", got.code, links, want, got.stdout)
	}
}

// gh-stack's own view reads a local file its link never writes, so view asks github's stacks api
func TestStackViewPrintsTheStackGithubHolds(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env := stackGithub(t, clone, linkedStack)

	got := xIn(t, clone, env, "lane", "stack", "view")

	a, b, c := strings.Index(got.stdout, `"coder/FRM-1-a"`), strings.Index(got.stdout, `"coder/FRM-1-a-2"`), strings.Index(got.stdout, `"coder/FRM-1-a-3"`)
	if got.code != 0 || a < 0 || !(a < b && b < c) || !strings.Contains(got.stdout, `"pr":13`) {
		t.Fatalf("exit %d, want the 3 layers bottom-up with their prs:\n%s", got.code, got.stdout)
	}
}

func TestStackViewOfAPrInNoStackNamesLink(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env := stackGithub(t, clone, `[]`)

	got := xIn(t, clone, env, "lane", "stack", "view")

	if got.code == 0 || !strings.Contains(got.stdout, "#13") || got.next != "x lane stack link --apply" {
		t.Fatalf("exit %d, next %q, want a failure naming #13 and the link verb\n%s", got.code, got.next, got.stdout)
	}
}

func TestStackViewOnARepoWithoutStacksSaysSo(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env := stackGithub(t, clone, "")

	got := xIn(t, clone, env, "lane", "stack", "view")

	if got.code == 0 || !strings.Contains(got.stdout, "stacks api answered 404 for o/r") {
		t.Fatalf("exit %d, want a refusal naming the 404 and the repo\n%s", got.code, got.stdout)
	}
}

func TestStackViewShowsAMergedLayerAsMerged(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env := stackGithub(t, clone, linkedStack)

	got := xIn(t, clone, env, "lane", "stack", "view", "--board")

	if got.code != 0 || !strings.Contains(sgr.ReplaceAllString(got.stdout, ""), "coder/FRM-1-a #11 merged") {
		t.Fatalf("exit %d, want #11 shown merged:\n%s", got.code, got.stdout)
	}
}

func TestStackLinkWithoutTheExtensionNamesTheInstall(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	env, log := linkEnv(t, clone)
	env = append(env, "FAKE_NO_STACK=1")

	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "gh extension install github/gh-stack") || strings.Contains(read(t, log), " stack ") {
		t.Fatalf("exit %d, want a failure naming the install and no gh stack call:\n%s", got.code, got.stdout)
	}
}

// gh stack link exits as exits lists, the last code repeating; it returns the run and the link count
func linkWith(t *testing.T, exits string) (ran, int) {
	t.Helper()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	env, log := linkEnv(t, clone)
	env = append(env, "FAKE_DIR="+t.TempDir(), "FAKE_EXITS="+exits, "X_FAKE_SLEEP=1")
	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")
	return got, strings.Count(read(t, log), " stack link ")
}

func TestStackLinkRetriesAHeldLock(t *testing.T) {
	t.Parallel()
	got, calls := linkWith(t, "8 8 0")

	if got.code != 0 || calls != 3 {
		t.Fatalf("exit %d after %d links, want success on the 3rd\n%s", got.code, calls, got.stdout)
	}
}

func TestStackLinkGivesUpOnTheLockAfterTwoMinutes(t *testing.T) {
	t.Parallel()
	start := time.Now()
	got, calls := linkWith(t, "8")

	if got.code == 0 || !strings.Contains(got.stdout, "lock") || !strings.Contains(got.stdout, "2m0s") || calls < 4 {
		t.Fatalf("exit %d after %d links, want a failure naming the lock and its 2m0s budget\n%s", got.code, calls, got.stdout)
	}
	if took := time.Since(start); took > 30*time.Second {
		t.Errorf("took %s: the budget ran on the wall clock, not the test clock", took)
	}
}

func TestStackLinkRefusesAPausedRebaseAtOnce(t *testing.T) {
	t.Parallel()
	got, calls := linkWith(t, "7")

	for _, want := range []string{"/trees/w2", "gh stack rebase --continue", "gh stack rebase --abort"} {
		if got.code == 0 || calls != 1 || !strings.Contains(got.stdout, want) {
			t.Fatalf("exit %d after %d links, want 1 call and a refusal naming %q\n%s", got.code, calls, want, got.stdout)
		}
	}
}

func TestStackLinkRefusesARepoWithoutStacksAtOnce(t *testing.T) {
	t.Parallel()
	got, calls := linkWith(t, "9")

	if got.code == 0 || calls != 1 || !strings.Contains(got.stdout, "not enabled for o/r") {
		t.Fatalf("exit %d after %d links, want 1 call and a refusal naming the repo\n%s", got.code, calls, got.stdout)
	}
}

const (
	lowerOpen   = `{"number":7,"state":"open","head":{"ref":"coder/x"}}`
	lowerMerged = `{"number":7,"state":"closed","merged_at":"2026-10-23T10:00:00Z","head":{"ref":"coder/x"}}`
)

// a merge world where #7 (coder/x onto main) is the lower layer, as lower says, and #8 sits on base
func stackedMergeWorld(t *testing.T, base, lower string) *mergeWorld {
	t.Helper()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/pulls/8"] = `{"number":8,"title":"part 2","state":"open","merged":false,"body":"b",
		"head":{"sha":"` + w.head + `","ref":"coder/x-2"},"base":{"ref":"` + base + `"}}`
	w.hub.pages[repoPath+"/pulls"] = `[{"number":9,"state":"open","head":{"ref":"coder/y"}},` + lower + `]`
	w.hub.pages[repoPath+"/pulls/8/files"] = w.hub.pages[repoPath+"/pulls/7/files"]
	return w
}

// a linked stack on github: #7 (coder/x onto main) under #8, both clean, green and threadless; the async
// merge of #8 starts pending and the poll answers merged
func linkedMergeWorld(t *testing.T) *mergeWorld {
	t.Helper()
	w := stackedMergeWorld(t, "coder/x", lowerOpen)
	write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#8":"`+w.head+`"}`)
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/stacks"] = `[{"number":5,"base":{"ref":"main"},"pull_requests":[
		{"number":7,"state":"open","head":{"ref":"coder/x"}},{"number":8,"state":"open","head":{"ref":"coder/x-2"}}]}]`
	w.hub.pages[repoPath+"/pulls/8/merge-async"] = `{"status":"pending","details":{"uuid":"u1"}}`
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + w.head + `"}}`
	return w
}

func TestMergeAutoLandsALinkedStackInOneCall(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)

	got := w.run(t, "8", "--apply", "--json")

	asyncs := w.hub.sent("PUT " + repoPath + "/pulls/8/merge-async")
	if got.code != 0 || len(asyncs) != 1 || len(w.hub.sent("PUT "+repoPath+"/pulls/7")) != 0 || len(w.hub.sent("PUT "+repoPath+"/pulls/8/merge ")) != 0 {
		t.Fatalf("exit %d, async merges %q, all puts %q: want one async merge of #8 and nothing else\n%s", got.code, asyncs, w.hub.sent("PUT"), got.stdout)
	}
	if !strings.Contains(asyncs[0], `"merge_method":"squash"`) || envelopeOf(got).Data.Merged != mergedSha {
		t.Errorf("merge call %q, merged %q: want a squash and the merged sha read back\n%s", asyncs[0], envelopeOf(got).Data.Merged, got.stdout)
	}
}

// the find on 2026-10-23: the plain endpoint answered 403 for #99, a stack's bottom layer
func TestMergeAutoLandsAStacksBottomLayerAsync(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7/merge-async"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + w.head + `"}}`
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if got.code != 0 || len(w.hub.sent("PUT "+repoPath+"/pulls/7/merge-async")) != 1 || len(w.hub.sent("PUT "+repoPath+"/pulls/7/merge ")) != 0 {
		t.Fatalf("exit %d, puts %q: want one async merge of #7\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
}

func TestMergeAutoHoldsAStackOnALowerLayersGate(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, reason string
		fail         func(w *mergeWorld)
	}{
		{"no clean record", "sixth-sense", func(w *mergeWorld) { write(t, w.store, `{"o/r#8":"`+w.head+`"}`) }},
		{"a self-edit waiting for dima", "self-edit", func(w *mergeWorld) {
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":"x/go/merge_auto.go","status":"modified"}]`
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := linkedMergeWorld(t)
			c.fail(w)

			got := w.run(t, "8", "--apply")

			if got.code == 0 || !strings.Contains(got.stdout, "#7") || !strings.Contains(got.stdout, c.reason) || len(w.hub.sent("PUT")) != 0 {
				t.Fatalf("exit %d, puts %q: want no merge and a wait naming #7 and %q\n%s", got.code, w.hub.sent("PUT"), c.reason, got.stdout)
			}
		})
	}
}

// github merged a head the gate never read: loud on stderr, and the brake goes on for every next merge
func TestMergeAutoBrakesWhenTheStackMergedAnotherHead(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	moved := strings.Repeat("d", 40)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + moved + `"}}`
	w.hub.mu.Unlock()

	c := exec.Command(xbin, "lane", "merge-auto", "8", "--apply")
	c.Dir = w.clone
	c.Env = append(append(cleanEnv(), "X_TEST=1"), w.env...)
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	code := exitOf(c.Run())

	labelled := w.hub.sent("POST " + repoPath + "/issues/8/labels")
	if code != 1 || !strings.Contains(stderr.String(), short(moved)) || !strings.Contains(stderr.String(), short(w.head)) {
		t.Fatalf("exit %d, stderr %q: want a loud mismatch naming %s and %s", code, stderr.String(), short(moved), short(w.head))
	}
	if !slices.ContainsFunc(labelled, func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
		t.Errorf("label calls %q, want #8 marked %s", labelled, brakeLabel)
	}
}

// the pending answer may be the only one naming the head github took; the poll's answer must not erase it
func TestMergeAutoBrakesOnTheHeadThePendingAnswerNamed(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async"] = `{"status":"pending","details":{"uuid":"u1","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":""}}`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if got.code != 1 || !strings.Contains(envelopeOf(got).Error, "brake is on") {
		t.Fatalf("exit %d, error %q: want the pending answer's head mismatch to brake", got.code, envelopeOf(got).Error)
	}
}

// a mismatch whose label github refused still brakes: this mac's own record holds it, and the hand label step is named
func TestMergeAutoBrakesFromItsOwnRecordWhenTheLabelFailed(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	// the merged-by-x labels land before the merge; only the brake label after it fails
	w.hub.pages["labels:"+brakeLabel] = serverDown
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "this mac's record") || got.next != "gh pr edit 8 --add-label "+brakeLabel {
		t.Fatalf("exit %d, error %q, next %q: want the brake on from the record and the hand label step", got.code, msg, got.next)
	}
	puts := len(w.hub.sent("PUT "))

	next := w.run(t, "7", "--apply")

	if msg := envelopeOf(next).Error; next.code != 1 || !strings.Contains(msg, "brake on") || !strings.Contains(msg, releaseBrake("8")) || len(w.hub.sent("PUT ")) != puts {
		t.Fatalf("exit %d, error %q: want the next merge held by the recorded brake, naming its release", next.code, msg)
	}
}

// github's answer named no head it took and did not say nothing merged, so the gated head is unverified: said on
// stderr, and the brake goes on
func TestMergeAutoBrakesWhenTheStackMergeNamesNoHead(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, answer string }{
		{"merged", `{"status":"merged","details":{"sha":"` + mergedSha + `"}}`},
		{"enqueued", `{"status":"enqueued","details":{}}`},
		{"still pending at the budget", `{"status":"pending","details":{"uuid":"u1"}}`},
		{"a status x does not know", `{"status":"queued","details":{}}`},
		{"a poll that failed", serverDown},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := linkedMergeWorld(t)
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = c.answer
			w.hub.mu.Unlock()

			cmd := exec.Command(xbin, "lane", "merge-auto", "8", "--apply")
			cmd.Dir = w.clone
			cmd.Env = append(append(cleanEnv(), "X_TEST=1", "X_FAKE_SLEEP=1"), w.env...)
			var stdout, stderr bytes.Buffer
			cmd.Stdout, cmd.Stderr = &stdout, &stderr
			code := exitOf(cmd.Run())

			labelled := w.hub.sent("POST " + repoPath + "/issues/8/labels")
			if code != 1 || !strings.Contains(stderr.String(), "unverified") || !slices.ContainsFunc(labelled, func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
				t.Fatalf("exit %d, stderr %q, label calls %q: want the merge called unverified and #8 marked %s", code, stderr.String(), labelled, brakeLabel)
			}
			if !strings.Contains(stdout.String(), releaseBrake("8")) {
				t.Errorf("want the release named as the next step\n%s", stdout.String())
			}
		})
	}
}

// a submit github answered with no 2xx may still have taken the merge, so the gated head is unverified and the brake
// goes on; only a 404, no async merge in the repo at all, takes nothing
func TestMergeAutoBrakesWhenTheStackMergeSubmitFails(t *testing.T) {
	t.Parallel()
	for _, answer := range []string{serverDown, "<status 422>", "<status 502>"} {
		t.Run(answer, func(t *testing.T) {
			w := linkedMergeWorld(t)
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/8/merge-async"] = answer
			w.hub.mu.Unlock()

			cmd := exec.Command(xbin, "lane", "merge-auto", "8", "--apply")
			cmd.Dir = w.clone
			cmd.Env = append(append(cleanEnv(), "X_TEST=1"), w.env...)
			var stdout, stderr bytes.Buffer
			cmd.Stdout, cmd.Stderr = &stdout, &stderr
			code := exitOf(cmd.Run())

			labelled := w.hub.sent("POST " + repoPath + "/issues/8/labels")
			if code != 1 || !strings.Contains(stderr.String(), "unverified") || !slices.ContainsFunc(labelled, func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
				t.Fatalf("exit %d, stderr %q, label calls %q: want the submit called unverified and #8 marked %s", code, stderr.String(), labelled, brakeLabel)
			}
			if !strings.Contains(stdout.String(), releaseBrake("8")) {
				t.Errorf("want the release named as the next step\n%s", stdout.String())
			}
		})
	}
}

// a repo with no async merge answers 404 and takes nothing: a refusal, no brake
func TestMergeAutoRefusesAStackMergeTheRepoHasNoDoorFor(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	delete(w.hub.pages, repoPath+"/pulls/8/merge-async")
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(envelopeOf(got).Error, "no async merge") || exists(filepath.Join(w.state, "merge-brake")) ||
		slices.ContainsFunc(w.hub.sent("POST "+repoPath+"/issues/8/labels"), func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
		t.Fatalf("exit %d, error %q: want a refusal and no brake", got.code, envelopeOf(got).Error)
	}
}

// with the label refused and the record unwritable, nothing holds the brake: the message says so and names the hand step
func TestMergeAutoSaysTheBrakeIsOffWhenItsRecordFailedToo(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	w.hub.pages["labels:"+brakeLabel] = serverDown
	w.hub.mu.Unlock()
	// the record's dir reads as empty and takes no write
	dir := filepath.Join(w.state, "merge-brake")
	if err := os.MkdirAll(dir, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Chmod(dir, 0o755) })

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "NOT on") || got.next != "gh pr edit 8 --add-label "+brakeLabel {
		t.Fatalf("exit %d, error %q, next %q: want the brake named off and the hand label step", got.code, msg, got.next)
	}
}

// a linked stack whose two layers both edit merge-auto, #7 naming FRM-9 (pre-approved) and #8 naming upper
func selfEditStack(t *testing.T, upper string) (*mergeWorld, *fakeLinear) {
	t.Helper()
	w := linkedMergeWorld(t)
	f := w.signs(t, "FRM-9", signedBody(signAbove, "merge: pre-approved\n", signAbove))
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":"x/go/merge_auto.go","status":"modified"}]`
	w.hub.pages[repoPath+"/pulls/8/files"] = w.hub.pages[repoPath+"/pulls/7/files"]
	w.hub.pages[repoPath+"/pulls/8"] = strings.Replace(w.hub.pages[repoPath+"/pulls/8"], `"body":"b"`, `"body":"- ticket: `+upper+`"`, 1)
	return w, f
}

func TestMergeAutoLandsAStackItsChunkPreApproved(t *testing.T) {
	t.Parallel()
	w, f := selfEditStack(t, "FRM-9")

	got := w.run(t, "8", "--apply")

	if asyncs := w.hub.sent("PUT " + repoPath + "/pulls/8/merge-async"); got.code != 0 || len(asyncs) != 1 {
		t.Fatalf("exit %d, %d async merges, want the pre-approved stack landed in one call:\n%s", got.code, len(asyncs), got.stdout)
	}
	if reads := len(f.requests()); reads != 1 {
		t.Errorf("%d linear reads, want the chunk's sign read once for both layers", reads)
	}
}

func TestMergeAutoHoldsAStackWhoseLayerNamesAnUnsignedTicket(t *testing.T) {
	t.Parallel()
	w, _ := selfEditStack(t, "FRM-10")

	got := w.run(t, "8", "--apply")

	if asyncs := w.hub.sent("PUT " + repoPath + "/pulls/8/merge-async"); got.code != 1 || len(asyncs) != 0 || !strings.Contains(envelopeOf(got).Error, "FRM-10 carries no ## signed block") {
		t.Fatalf("exit %d, %d async merges, error %q: want the unsigned layer's wait", got.code, len(asyncs), envelopeOf(got).Error)
	}
}

func TestMergeAutoRefusesAStackWhoseLayerMovedAfterTheGate(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.later = map[string]string{repoPath + "/pulls/7": strings.ReplaceAll(w.hub.pages[repoPath+"/pulls/7"], w.head, strings.Repeat("d", 40))}
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "#7") || !strings.Contains(got.stdout, "moved") || len(w.hub.sent("PUT")) != 0 {
		t.Fatalf("exit %d, puts %q: want a refusal naming #7's moved head and no merge\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
}

func TestMergeAutoNamesALowerLayersRiskyPaths(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":".github/workflows/ci.yml","status":"modified"}]`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply", "--json")

	if got.code != 0 || !slices.Contains(envelopeOf(got).Data.Risky, "#7 .github/workflows/ci.yml") {
		t.Fatalf("exit %d, risky %q: want #7's workflow named\n%s", got.code, envelopeOf(got).Data.Risky, got.stdout)
	}
}

func TestMergeAutoSkipsAMergedLayerBelow(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/stacks"] = `[{"number":5,"base":{"ref":"main"},"pull_requests":[
		{"number":6,"state":"closed","merged_at":"2026-10-23T10:00:00Z","head":{"ref":"coder/w"}},
		{"number":7,"state":"open","head":{"ref":"coder/x"}},{"number":8,"state":"open","head":{"ref":"coder/x-2"}}]}]`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if got.code != 0 || len(w.hub.sent("GET "+repoPath+"/pulls/6")) != 0 {
		t.Fatalf("exit %d, reads of #6 %q: want the merged layer skipped\n%s", got.code, w.hub.sent("GET "+repoPath+"/pulls/6"), got.stdout)
	}
}

func TestMergeAutoLabelsEveryStackLayerBeforeTheMerge(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)

	got := w.run(t, "8", "--apply")

	w.hub.mu.Lock()
	calls := slices.Clone(w.hub.calls)
	w.hub.mu.Unlock()
	at := func(prefix string) int {
		return slices.IndexFunc(calls, func(c string) bool { return strings.HasPrefix(c, prefix) })
	}
	merge := at("PUT " + repoPath + "/pulls/8/merge-async")
	for _, n := range []string{"7", "8"} {
		label := at("POST " + repoPath + "/issues/" + n + "/labels")
		if got.code != 0 || label < 0 || label > merge || !strings.Contains(calls[label], mergedLabel) {
			t.Fatalf("exit %d, #%s label call at %d, merge at %d: want every layer labelled %s first\n%s", got.code, n, label, merge, mergedLabel, got.stdout)
		}
	}
}

func TestMergeAutoReportsAFailedStackMerge(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"failed","details":{"message":"merge conflict in #8"}}`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "merge conflict in #8") || !strings.Contains(got.stdout, "nothing merged") {
		t.Fatalf("exit %d, want the failure named and «nothing merged»\n%s", got.code, got.stdout)
	}
}

func TestMergeAutoRefusesALayerWhoseLowerPrMerged(t *testing.T) {
	t.Parallel()
	w := stackedMergeWorld(t, "coder/x", lowerMerged)

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "#7 (coder/x) already merged") || len(w.hub.sent("PUT")) != 0 {
		t.Fatalf("exit %d, merges %q, want a refusal naming the merged #7 and no merge\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
}

func TestMergeAutoWaitsOnAnUpperLayerNamingTheLowerPr(t *testing.T) {
	t.Parallel()
	w := stackedMergeWorld(t, "coder/x", lowerOpen)

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "#7 (coder/x) merges first") || len(w.hub.sent("PUT")) != 0 {
		t.Fatalf("exit %d, merges %q, want a wait naming #7 and no merge\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
}

func TestMergeAutoMergesTheLowerLayer(t *testing.T) {
	t.Parallel()
	w := stackedMergeWorld(t, "coder/x", lowerOpen)

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, merges %q, want #7 merged\n%s", got.code, merges, got.stdout)
	}
}

func TestMergeAutoLeavesABaseWithNoOpenPrToTheChecks(t *testing.T) {
	t.Parallel()
	w := stackedMergeWorld(t, "release", lowerOpen)
	gitT(t, w.seed, "push", "-q", "origin", "main:release")

	got := w.run(t, "8", "--apply")

	if !strings.Contains(got.stdout, `"name":"sixth-sense"`) {
		t.Fatalf("merge-auto stopped before its checks on a base no pr owns:\n%s", got.stdout)
	}
}

func TestStackLinkReadsTheLayersOnOrigin(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, from string
		branches   []string
		want       string
	}{
		{"a slug ending in a number stays its own root", "coder/FRM-1-v-2", []string{"coder/FRM-1-v-2", "coder/FRM-1-v-2-2"}, "21 22"},
		{"one layer is no stack", "coder/FRM-1-a", []string{"coder/FRM-1-a"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			clone := layers(t, c.branches...)
			gitT(t, clone, "switch", "-q", c.from)
			env, log := linkEnv(t, clone)

			got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

			calls := ""
			if exists(log) {
				calls = read(t, log)
			}
			if c.want == "" && (got.code == 0 || !strings.Contains(got.stdout, "2 layers") || strings.Contains(calls, "stack link")) {
				t.Fatalf("exit %d, want a refusal naming 2 layers and no link\n%s", got.code, got.stdout)
			}
			if c.want != "" && (got.code != 0 || !strings.Contains(calls, "stack link "+c.want+"\n")) {
				t.Fatalf("exit %d, want one link of %q\n%s\n%s", got.code, c.want, got.stdout, calls)
			}
		})
	}
}

// a 2-layer stack on origin whose bottom layer gained a commit after the top was cut; the clone sits on the top
func movedStack(t *testing.T, lowerFile, lowerBody string) string {
	t.Helper()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	gitT(t, clone, "switch", "-q", "coder/FRM-1-a")
	write(t, filepath.Join(clone, lowerFile), lowerBody)
	gitT(t, clone, "add", lowerFile)
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", "coder/FRM-1-a")
	gitT(t, clone, "switch", "-q", "coder/FRM-1-a-2")
	return clone
}

func originHead(t *testing.T, clone, branch string) string {
	t.Helper()
	sha, _, _ := strings.Cut(gitT(t, clone, "ls-remote", "origin", "refs/heads/"+branch), "\t")
	return sha
}

func TestRestackMergesEachLowerLayerUpAndPushes(t *testing.T) {
	t.Parallel()
	clone := movedStack(t, "lower.txt", "the fix\n")
	lower := originHead(t, clone, "coder/FRM-1-a")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	upper := originHead(t, clone, "coder/FRM-1-a-2")
	if got.code != 0 || gitT(t, clone, "merge-base", "--is-ancestor", lower, upper) != "" {
		t.Fatalf("exit %d, want origin's top layer to hold the lower layer's %s\n%s", got.code, short(lower), got.stdout)
	}
	if branch := gitT(t, clone, "branch", "--show-current"); branch != "coder/FRM-1-a-2" {
		t.Errorf("left on %s, want the branch restack started on", branch)
	}
}

func TestRestackStopsAtALayerThatConflicts(t *testing.T) {
	t.Parallel()
	// the top layer's own file, changed under it in the lower layer
	clone := movedStack(t, "coder-FRM-1-a-2.txt", "the lower layer's version\n")
	before := originHead(t, clone, "coder/FRM-1-a-2")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "coder/FRM-1-a-2") || !strings.Contains(got.stdout, "coder-FRM-1-a-2.txt") || originHead(t, clone, "coder/FRM-1-a-2") != before {
		t.Fatalf("exit %d, want a stop naming the layer and the conflicted file, origin untouched\n%s", got.code, got.stdout)
	}
}

// a stack's upper layer pushes onto its own branch, never onto the layer below or main
func TestPushSendsAStackLayerToItsOwnBranch(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	lower, main := originHead(t, clone, "coder/FRM-1-a"), originHead(t, clone, "main")
	write(t, filepath.Join(clone, "upper.txt"), "more in the upper layer\n")
	gitT(t, clone, "add", "upper.txt")
	gitT(t, clone, "commit", "-q", "-m", "more in the upper layer")
	sha := gitT(t, clone, "rev-parse", "HEAD")

	got := xIn(t, clone, nil, "lane", "push", "--apply")

	if got.code != 0 || originHead(t, clone, "coder/FRM-1-a-2") != sha || originHead(t, clone, "coder/FRM-1-a") != lower || originHead(t, clone, "main") != main {
		t.Fatalf("exit %d, want only coder/FRM-1-a-2 moved to %s\n%s", got.code, short(sha), got.stdout)
	}
}

func TestRestackRefusesATreeWithChanges(t *testing.T) {
	t.Parallel()
	clone := movedStack(t, "lower.txt", "the fix\n")
	write(t, filepath.Join(clone, "coder-FRM-1-a-2.txt"), "an edit in flight\n")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "coder-FRM-1-a-2.txt") {
		t.Fatalf("exit %d, want a refusal naming the changed file\n%s", got.code, got.stdout)
	}
}

// a conflict high in the stack keeps the layers under it pushed, so the rerun after the fix goes through
func TestRestackRerunsAfterAResolvedConflict(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	gitT(t, clone, "switch", "-q", "coder/FRM-1-a")
	write(t, filepath.Join(clone, "coder-FRM-1-a-3.txt"), "the lower layer's version\n")
	gitT(t, clone, "add", ".")
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", "coder/FRM-1-a")
	lower := gitT(t, clone, "rev-parse", "HEAD")
	gitT(t, clone, "switch", "-q", "coder/FRM-1-a-3")

	stopped := xIn(t, clone, nil, "lane", "restack", "--apply")

	if stopped.code == 0 || !ok(gitIn(clone, "merge-base", "--is-ancestor", lower, originHead(t, clone, "coder/FRM-1-a-2"))) {
		t.Fatalf("exit %d, want a stop at the top layer with coder/FRM-1-a-2 already pushed\n%s", stopped.code, stopped.stdout)
	}
	write(t, filepath.Join(clone, "coder-FRM-1-a-3.txt"), "both versions\n")
	gitT(t, clone, "add", "coder-FRM-1-a-3.txt")
	gitT(t, clone, "commit", "-q", "--no-edit")
	if pushed := xIn(t, clone, nil, "lane", "push", "--apply"); pushed.code != 0 {
		t.Fatalf("the resolved layer's push: exit %d\n%s", pushed.code, pushed.stdout)
	}

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code != 0 {
		t.Fatalf("exit %d, want the rerun the stop named to go through\n%s", got.code, got.stdout)
	}
}

// a layer checked out in another worktree cannot be switched to, so the plan refuses before any layer merges
func TestRestackRefusesALayerAnotherWorktreeHolds(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	gitT(t, clone, "switch", "-q", "coder/FRM-1-a")
	write(t, filepath.Join(clone, "lower.txt"), "the fix\n")
	gitT(t, clone, "add", "lower.txt")
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", "coder/FRM-1-a")
	gitT(t, clone, "worktree", "add", "-q", filepath.Join(t.TempDir(), "held"), "coder/FRM-1-a-3")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "coder/FRM-1-a-3") || ok(gitIn(clone, "rev-parse", "-q", "--verify", "refs/heads/coder/FRM-1-a-2")) {
		t.Fatalf("exit %d, want a refusal naming the held layer and no layer merged\n%s", got.code, got.stdout)
	}
}

// sixth sense checks a stack in one call: the top layer's tree, and every layer's pr, head and base
func TestVerifyTreeWithStackSeedsTheTopAndListsEveryLayer(t *testing.T) {
	t.Parallel()
	main, prHead := verifyWorld(t)
	lower := strings.Repeat("6", 40)
	h := &hub{pages: map[string]string{
		repoPath + "/stacks": `[{"number":5,"base":{"ref":"main"},"pull_requests":[
			{"number":6,"state":"open","head":{"ref":"coder/x"}},{"number":7,"state":"open","head":{"ref":"coder/x-2"}}]}]`,
		repoPath + "/pulls/6": `{"number":6,"state":"open","head":{"sha":"` + lower + `","ref":"coder/x"},"base":{"ref":"main"},"commits":2}`,
		repoPath + "/pulls/7": `{"number":7,"state":"open","head":{"sha":"` + prHead + `","ref":"coder/x-2"},"base":{"ref":"coder/x"},"commits":1}`,
	}}
	server := h.serve(t)
	env := append(tracing(t.TempDir()), "X_GITHUB_URL="+server.URL,
		"X_KEYS="+keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"}))

	got := xIn(t, main, env, "lane", "verify-tree", "--stack", "https://github.com/o/r/pull/7")

	want := []string{"#6 coder/x onto main at " + short(lower) + ", adds 2 commits", "#7 coder/x-2 onto coder/x at " + short(prHead) + ", adds 1 commit"}
	for _, line := range want {
		if got.code != 0 || !strings.Contains(got.stdout, line) {
			t.Fatalf("exit %d, want %q in the stack listing\n%s", got.code, line, got.stdout)
		}
	}
	if !strings.Contains(got.stdout, "verify-pr-7") || strings.Index(got.stdout, want[0]) > strings.Index(got.stdout, want[1]) {
		t.Errorf("want the top layer's tree and the layers bottom-up\n%s", got.stdout)
	}
}

// a pr in no stack refuses before a tree is cut, so a refusal leaves nothing to clean up
func TestVerifyTreeWithStackRefusesAPrInNoStackBeforeSeeding(t *testing.T) {
	t.Parallel()
	main, _ := verifyWorld(t)
	h := &hub{pages: map[string]string{repoPath + "/stacks": `[]`}}
	server := h.serve(t)
	env := append(tracing(t.TempDir()), "X_GITHUB_URL="+server.URL,
		"X_KEYS="+keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"}))

	got := xIn(t, main, env, "lane", "verify-tree", "--stack", "https://github.com/o/r/pull/7")

	if got.code == 0 || !strings.Contains(got.stdout, "in no stack") || exists(filepath.Join(main, ".claude/worktrees/verify-pr-7")) {
		t.Fatalf("exit %d, want a refusal and no tree seeded\n%s", got.code, got.stdout)
	}
}

func TestVerifyTreeWithStackRefusesAMainSha(t *testing.T) {
	t.Parallel()
	main, _ := verifyWorld(t)

	got := xIn(t, main, nil, "lane", "verify-tree", "--stack", "main:"+short(gitT(t, main, "rev-parse", "HEAD")))

	if got.code != 2 {
		t.Fatalf("exit %d, want a usage refusal: a stack is read from its top pr\n%s", got.code, got.stdout)
	}
}

func TestPrOpenRefusesABaseMissingFromOrigin(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "coder/FRM-1-gone", "part 2", bodyFile(t))

	if got.code == 0 || !strings.Contains(got.stdout, "coder/FRM-1-gone") || exists(log) {
		t.Fatalf("exit %d, want a refusal naming the missing base and no gh call\n%s", got.code, got.stdout)
	}
}
