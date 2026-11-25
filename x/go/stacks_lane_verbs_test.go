//go:build !nostacks

package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestPrOpenWithBaseOpensOntoTheLayerBelow(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "codie/FRM-1-a", "part 2", bodyFile(t))

	calls := strings.TrimSpace(read(t, log))
	if got.code != 0 || !strings.HasPrefix(calls, "ghs_coder pr create --base codie/FRM-1-a --head codie/FRM-1-a-2 ") || strings.Contains(calls, "\n") {
		t.Fatalf("exit %d, gh calls %q, want one pr create onto codie/FRM-1-a\n%s", got.code, calls, got.stdout)
	}
}

// a stack's upper layer pushes onto its own branch, never onto the layer below or main
func TestPushSendsAStackLayerToItsOwnBranch(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2")
	lower, main := originHead(t, clone, "codie/FRM-1-a"), originHead(t, clone, "main")
	write(t, filepath.Join(clone, "upper.txt"), "more in the upper layer\n")
	gitT(t, clone, "add", "upper.txt")
	gitT(t, clone, "commit", "-q", "-m", "more in the upper layer")
	sha := gitT(t, clone, "rev-parse", "HEAD")

	got := xIn(t, clone, nil, "lane", "push", "--apply")

	if got.code != 0 || originHead(t, clone, "codie/FRM-1-a-2") != sha || originHead(t, clone, "codie/FRM-1-a") != lower || originHead(t, clone, "main") != main {
		t.Fatalf("exit %d, want only codie/FRM-1-a-2 moved to %s\n%s", got.code, short(sha), got.stdout)
	}
}

func TestGateHeldLintsTheAddOnsPurposes(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "x/go/registry.json"), `{"verbs":[]}`)
	write(t, filepath.Join(dir, "x/go/stacks.json"), `{"verbs":[{"name":"lane tidy","purpose":"handles stuff"}]}`)

	got := xIn(t, dir, nil, "lane", "gate", "--held")

	if got.code != 1 || !strings.Contains(got.stdout, "stacks.json: lane tidy") {
		t.Errorf("exit %d, want the add-on's red named:\n%s", got.code, got.stdout)
	}
}

// sixth sense checks a stack in one call: the top layer's tree, and every layer's pr, head and base
func TestVerifyTreeWithStackSeedsTheTopAndListsEveryLayer(t *testing.T) {
	t.Parallel()
	main, prHead := verifyWorld(t)
	lower := strings.Repeat("6", 40)
	h := &hub{pages: map[string]string{
		repoPath + "/stacks": `[{"number":5,"base":{"ref":"main"},"pull_requests":[
			{"number":6,"state":"open","head":{"ref":"codie/x"}},{"number":7,"state":"open","head":{"ref":"codie/x-2"}}]}]`,
		repoPath + "/pulls/6": `{"number":6,"state":"open","head":{"sha":"` + lower + `","ref":"codie/x"},"base":{"ref":"main"},"commits":2}`,
		repoPath + "/pulls/7": `{"number":7,"state":"open","head":{"sha":"` + prHead + `","ref":"codie/x-2"},"base":{"ref":"codie/x"},"commits":1}`,
	}}
	server := h.serve(t)
	env := append(tracing(t.TempDir()), "X_GITHUB_URL="+server.URL,
		"X_KEYS="+keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"}))

	got := xIn(t, main, env, "lane", "verify-tree", "--stack", "https://github.com/o/r/pull/7")

	want := []string{"#6 codie/x onto main at " + short(lower) + ", adds 2 commits", "#7 codie/x-2 onto codie/x at " + short(prHead) + ", adds 1 commit"}
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
	clone := layers(t, "codie/FRM-1-a")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "codie/FRM-1-gone", "part 2", bodyFile(t))

	if got.code == 0 || !strings.Contains(got.stdout, "codie/FRM-1-gone") || exists(log) {
		t.Fatalf("exit %d, want a refusal naming the missing base and no gh call\n%s", got.code, got.stdout)
	}
}
