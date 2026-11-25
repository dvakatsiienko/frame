//go:build !nostacks

package main

import (
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

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

// the layers were gated before the checks, so a hold set on one since is the merge's own read
func TestMergeAutoReadsALowerLayersHoldSetWhileItsChecksAreRead(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.onRead = func(path string) {
		if strings.HasSuffix(path, "/check-runs") {
			write(t, holdRecordOf(w), `{"prs":["7"]}`)
		}
	}

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(msg, "held") {
		t.Fatalf("exit %d, puts %q, error %q: want the late hold to stop the stack", got.code, w.hub.sent("PUT "), msg)
	}
}

func TestMergeAutoSkipsAMergedLayerBelow(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/stacks"] = `[{"number":5,"base":{"ref":"main"},"pull_requests":[
		{"number":6,"state":"closed","merged_at":"2026-10-23T10:00:00Z","head":{"ref":"codie/w"}},
		{"number":7,"state":"open","head":{"ref":"codie/x"}},{"number":8,"state":"open","head":{"ref":"codie/x-2"}}]}]`
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
	w := stackedMergeWorld(t, "codie/x", lowerMerged)

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "#7 (codie/x) already merged") || len(w.hub.sent("PUT")) != 0 {
		t.Fatalf("exit %d, merges %q, want a refusal naming the merged #7 and no merge\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
}

func TestMergeAutoWaitsOnAnUpperLayerNamingTheLowerPr(t *testing.T) {
	t.Parallel()
	w := stackedMergeWorld(t, "codie/x", lowerOpen)

	got := w.run(t, "8", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "#7 (codie/x) merges first") || len(w.hub.sent("PUT")) != 0 {
		t.Fatalf("exit %d, merges %q, want a wait naming #7 and no merge\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
}

func TestMergeAutoMergesTheLowerLayer(t *testing.T) {
	t.Parallel()
	w := stackedMergeWorld(t, "codie/x", lowerOpen)

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

func TestStackMergeStillEnqueuedLeavesTheTrees(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"enqueued","details":{"expected_head_sha":"` + w.head + `"}}`
	// no open pr to hold the branch: only the enqueued merge may keep it
	w.hub.pages[repoPath+"/pulls"] = `[]`
	w.hub.mu.Unlock()
	w.withPnpm(t, "exit 0")
	tree := w.laneTree(t)
	gitT(t, w.seed, "push", "-q", "origin", "codie/x:codie/x-2")

	got := w.run(t, "8", "--apply")

	if got.code != 0 || !exists(tree) || !strings.Contains(got.stdout, "still enqueued") {
		t.Fatalf("exit %d, tree there: %v:\n%s", got.code, exists(tree), got.stdout)
	}
	if !w.onOrigin(t, "codie/x-2") {
		t.Fatalf("an enqueued merge took its branch:\n%s", got.stdout)
	}
}
