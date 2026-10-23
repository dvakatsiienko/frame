//go:build !nostacks

package main

import (
	"bytes"
	"os/exec"
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
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-coder:x": farFuture + ":ghs_coder"})
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
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `"}}`
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
	w.hub.pages[repoPath+"/pulls/7/merge-async"] = `{"status":"merged","details":{"sha":"` + mergedSha + `"}}`
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
		{"no clean record", "verifier", func(w *mergeWorld) { write(t, w.store, `{"o/r#8":"`+w.head+`"}`) }},
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

// a mismatch whose label github refused leaves no brake behind, so the message says so and names the hand step
func TestMergeAutoSaysTheBrakeIsOffWhenItsLabelFailed(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	// the merged-by-x labels land before the merge; only the brake label after it fails
	w.hub.pages["labels:"+brakeLabel] = serverDown
	w.hub.mu.Unlock()

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

	if !strings.Contains(got.stdout, `"name":"verifier"`) {
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

func TestPrOpenRefusesABaseMissingFromOrigin(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "coder/FRM-1-gone", "part 2", bodyFile(t))

	if got.code == 0 || !strings.Contains(got.stdout, "coder/FRM-1-gone") || exists(log) {
		t.Fatalf("exit %d, want a refusal naming the missing base and no gh call\n%s", got.code, got.stdout)
	}
}
