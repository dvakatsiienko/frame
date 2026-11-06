package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// the pr's branch renamed to the lane's shape, on the seed, the origin and the hub's answer
func (w *mergeWorld) laneBranch(t *testing.T, name string) {
	t.Helper()
	gitT(t, w.seed, "branch", "-m", "coder/x", name)
	gitT(t, w.seed, "push", "-q", "origin", name)
	gitT(t, w.seed, "push", "-q", "origin", ":coder/x")
	w.hub.pages[repoPath+"/pulls/7"] = strings.ReplaceAll(w.hub.pages[repoPath+"/pulls/7"], "coder/x", name)
}

func (w *mergeWorld) treeOn(t *testing.T, branch string) string {
	t.Helper()
	tree := filepath.Join(w.clone, ".claude/worktrees/lane")
	gitT(t, w.clone, "fetch", "-q", "origin", branch+":"+branch)
	gitT(t, w.clone, "worktree", "add", "-q", tree, branch)
	return tree
}

func (w *mergeWorld) onOrigin(t *testing.T, branch string) bool {
	t.Helper()
	return strings.TrimSpace(gitT(t, w.origin, "for-each-ref", "refs/heads/"+branch)) != ""
}

func (w *mergeWorld) onClone(t *testing.T, branch string) bool {
	t.Helper()
	return strings.TrimSpace(gitT(t, w.clone, "branch", "--list", branch)) != ""
}

func TestMergeAutoTakesTheMergedBranchLocalAndRemote(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	tree := w.laneTree(t)

	got := w.run(t, "7", "--apply")

	if got.code != 0 || exists(tree) || w.onClone(t, "coder/x") || w.onOrigin(t, "coder/x") {
		t.Fatalf("exit %d, tree %v, local %v, remote %v: want all gone\n%s", got.code, exists(tree), w.onClone(t, "coder/x"), w.onOrigin(t, "coder/x"), got.stdout)
	}
}

func TestMergeAutoKeepsABranchAndNamesWhy(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name      string
		plant     func(t *testing.T, w *mergeWorld)
		why       string
		keepsBoth bool
	}{
		{"a dirty tree holds it", func(t *testing.T, w *mergeWorld) {
			write(t, filepath.Join(w.laneTree(t), "loose.txt"), "not committed\n")
		}, "a tree holds it", true},
		{"a local commit the merge did not carry", func(t *testing.T, w *mergeWorld) {
			tree := w.laneTree(t)
			write(t, filepath.Join(tree, "y.txt"), "local only\n")
			gitT(t, tree, "add", "y.txt")
			gitT(t, tree, "commit", "-q", "-m", "local only")
			gitT(t, w.clone, "worktree", "remove", tree)
		}, "the merge did not carry", true},
		{"a push past the merged head", func(t *testing.T, w *mergeWorld) {
			write(t, filepath.Join(w.seed, "z.txt"), "a later push\n")
			gitT(t, w.seed, "add", "z.txt")
			gitT(t, w.seed, "commit", "-q", "-m", "later")
			gitT(t, w.seed, "push", "-q", "origin", "coder/x")
		}, "the merge did not carry", false},
		{"an open pr based on it", func(t *testing.T, w *mergeWorld) {
			w.hub.pages[repoPath+"/pulls"] = `[{"number":9}]`
		}, "#9 is based on it", true},
		{"the open prs do not read", func(t *testing.T, w *mergeWorld) {
			w.hub.pages[repoPath+"/pulls"] = serverDown
		}, "did not read", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.withPnpm(t, "exit 0")
			gitT(t, w.clone, "fetch", "-q", "origin", "coder/x:coder/x")
			c.plant(t, w)

			got := w.run(t, "7", "--apply")

			if got.code != 0 || !strings.Contains(got.stdout, c.why) || !w.onOrigin(t, "coder/x") || (c.keepsBoth && !w.onClone(t, "coder/x")) {
				t.Fatalf("exit %d, local %v, remote %v, want %q in:\n%s", got.code, w.onClone(t, "coder/x"), w.onOrigin(t, "coder/x"), c.why, got.stdout)
			}
		})
	}
}

func TestMergeAutoLeavesABranchOutsideTheLaneShapes(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	w.laneBranch(t, "feature/x")

	got := w.run(t, "7", "--apply")

	if got.code != 0 || !w.onOrigin(t, "feature/x") {
		t.Fatalf("exit %d, remote %v: a branch no lane named stays\n%s", got.code, w.onOrigin(t, "feature/x"), got.stdout)
	}
}

// a tree the merge kept goes at the landed, and takes the branch it held along
func TestLandedApplyTakesATreeAndItsBranchOnceClean(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	w.laneBranch(t, "codie/FRM-1-x")
	tree := w.treeOn(t, "codie/FRM-1-x")
	loose := filepath.Join(tree, "loose.txt")
	write(t, loose, "not committed\n")
	if got := w.run(t, "7", "--apply"); got.code != 0 || !exists(tree) || !w.onClone(t, "codie/FRM-1-x") {
		t.Fatalf("exit %d, tree %v: want the dirty tree and its branch kept\n%s", got.code, exists(tree), got.stdout)
	}
	if err := os.Remove(loose); err != nil {
		t.Fatal(err)
	}

	got := w.landedAfterMerge(t, "--apply")

	if exists(tree) || w.onClone(t, "codie/FRM-1-x") || w.onOrigin(t, "codie/FRM-1-x") {
		t.Fatalf("exit %d, tree %v, local %v, remote %v: want all gone\n%s", got.code, exists(tree), w.onClone(t, "codie/FRM-1-x"), w.onOrigin(t, "codie/FRM-1-x"), got.stdout)
	}
}

func TestLandedNamesWhatHoldsABranchItCannotTake(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	w.laneBranch(t, "codie/FRM-1-x")
	gitT(t, w.clone, "fetch", "-q", "origin", "codie/FRM-1-x:codie/FRM-1-x")
	w.hub.pages[repoPath+"/pulls"] = `[{"number":9}]`
	if got := w.run(t, "7", "--apply"); got.code != 0 || !w.onClone(t, "codie/FRM-1-x") {
		t.Fatalf("exit %d: want the branch kept\n%s", got.code, got.stdout)
	}

	got := w.landedAfterMerge(t)

	if !strings.Contains(got.stdout, "settle codie/FRM-1-x (#9 is based on it), then x lane landed FRM-1 --pr 7 --apply") {
		t.Fatalf("want the fix to name what holds the branch:\n%s", got.stdout)
	}
}

// x lane landed on the merged pr, with a linear that knows FRM-1
func (w *mergeWorld) landedAfterMerge(t *testing.T, args ...string) ran {
	t.Helper()
	w.hub.pages[repoPath+"/pulls/7"] = strings.ReplaceAll(strings.ReplaceAll(w.hub.pages[repoPath+"/pulls/7"], `"merged":false`, `"merged":true`), `"the body"`, `"- ticket: FRM-1"`)
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-1","projectMilestone":null,"description":"body","updatedAt":"2026-10-30T00:00:00.000Z","comments":{"nodes":[]}}}}`
	})
	keys := keysFixture(t, map[string]string{
		"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder",
		"keychain:x-token-linear-codie:x":  farFuture + ":tok-codie",
		"keychain:x-token-linear-clio:x":   farFuture + ":tok-clio",
	})
	env := append(append([]string{}, w.env...), "X_KEYS="+keys, "X_LINEAR_URL="+server.URL, "X_FRAME_ROOT="+w.clone)
	return xIn(t, w.clone, env, append([]string{"lane", "landed", "FRM-1", "--repo", w.clone, "--pr", "7"}, args...)...)
}

// exit 6, the want line: a chunk that merges leaves no tree and no branch, and no retro goes with them (exit 5d)
func TestAMergedChunkLeavesNoTreeNoBranchAndKeepsItsRetro(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	w.laneBranch(t, "codie/FRM-1-x")
	tree := w.treeOn(t, "codie/FRM-1-x")
	retro := filepath.Join(w.state, "lanes/lane-1/lane-1-codie-retro.md")
	write(t, retro, "- a line\n")

	merge := w.run(t, "7", "--apply")
	landed := w.landedAfterMerge(t, "--apply")

	if listed := gitT(t, w.clone, "worktree", "list"); exists(tree) || strings.Contains(listed, tree) {
		t.Errorf("the tree stands:\n%s\n%s", listed, merge.stdout)
	}
	if left := gitT(t, w.clone, "branch", "--list", "codie/FRM-1-*"); strings.TrimSpace(left) != "" {
		t.Errorf("the branch stands: %s\n%s\n%s", left, merge.stdout, landed.stdout)
	}
	if w.onOrigin(t, "codie/FRM-1-x") {
		t.Errorf("the remote branch stands:\n%s", merge.stdout)
	}
	if !exists(retro) {
		t.Errorf("the retro went with the lane's end")
	}
}

// a fork's tree off a repo with an origin/main: the branch's one commit, and how it reached main
func forkWorld(t *testing.T, landing string) (main, tree string) {
	t.Helper()
	main = repo(t)
	gitT(t, main, "update-ref", "refs/remotes/origin/main", "HEAD")
	tree = filepath.Join(main, ".claude/worktrees/fork")
	gitT(t, main, "worktree", "add", "-q", tree, "-b", "worktree-fork-abc")
	write(t, filepath.Join(tree, "f.txt"), "the fork's change\n")
	gitT(t, tree, "add", "f.txt")
	gitT(t, tree, "commit", "-q", "-m", "the fork's change")
	switch landing {
	case "ancestor":
		gitT(t, main, "update-ref", "refs/remotes/origin/main", "worktree-fork-abc")
	case "squash":
		// main's own commit with the same content, the branch's sha on no ref of main
		write(t, filepath.Join(main, "f.txt"), "the fork's change\n")
		write(t, filepath.Join(main, "other.txt"), "main moved on\n")
		gitT(t, main, "add", "f.txt", "other.txt")
		gitT(t, main, "commit", "-q", "-m", "squash of the fork")
		gitT(t, main, "update-ref", "refs/remotes/origin/main", "HEAD")
	}
	return main, tree
}

func decampIn(t *testing.T, main string, args ...string) ran {
	t.Helper()
	return xIn(t, main, []string{stubPnpm(t), "X_STATE=" + t.TempDir()}, append([]string{"lane", "decamp"}, args...)...)
}

func TestDecampTakesAForkWhoseCommitsAreOnMain(t *testing.T) {
	t.Parallel()
	for _, landing := range []string{"ancestor", "squash"} {
		t.Run(landing, func(t *testing.T) {
			t.Parallel()
			main, tree := forkWorld(t, landing)
			// the seed's own link, excluded as worktree-seed.sh excludes it
			write(t, filepath.Join(main, ".git/info/exclude"), ".claude/agents/wishkeeper.md\n")
			if err := os.MkdirAll(filepath.Join(tree, ".claude/agents"), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink("../../_clio/.claude/agents/wishkeeper.md", filepath.Join(tree, ".claude/agents/wishkeeper.md")); err != nil {
				t.Fatal(err)
			}

			got := decampIn(t, main, tree, "--apply")

			if got.code != 0 || exists(tree) || strings.TrimSpace(gitT(t, main, "branch", "--list", "worktree-fork-abc")) != "" {
				t.Fatalf("exit %d, tree %v: want the tree and the branch gone\n%s", got.code, exists(tree), got.stdout)
			}
		})
	}
}

func TestDecampKeepsAForkBranchMainDoesNotHold(t *testing.T) {
	t.Parallel()
	main, tree := forkWorld(t, "nowhere")

	got := decampIn(t, main, tree, "--apply")

	if got.code != 0 || strings.TrimSpace(gitT(t, main, "branch", "--list", "worktree-fork-abc")) == "" || !strings.Contains(got.stdout, "main does not hold") {
		t.Fatalf("exit %d: want the branch kept and named\n%s", got.code, got.stdout)
	}
}

// a commit on no ref dies with the tree: a detached tree has no branch to keep it
func TestDecampKeepsADetachedTreeHoldingACommit(t *testing.T) {
	t.Parallel()
	main := repo(t)
	gitT(t, main, "update-ref", "refs/remotes/origin/main", "HEAD")
	tree := filepath.Join(main, ".claude/worktrees/verify-x")
	gitT(t, main, "worktree", "add", "-q", "--detach", tree, "HEAD")
	write(t, filepath.Join(tree, "y.txt"), "local only\n")
	gitT(t, tree, "add", "y.txt")
	gitT(t, tree, "commit", "-q", "-m", "local only")

	got := decampIn(t, main, tree, "--apply")

	if got.code == 0 || !exists(tree) || !strings.Contains(got.stdout, "on no remote") {
		t.Fatalf("exit %d, tree %v: want it kept and named\n%s", got.code, exists(tree), got.stdout)
	}
}

// main's tree matches the tip, yet the commit under it is on no ref of main
func TestDecampKeepsAForkThatRevertedItsOwnWork(t *testing.T) {
	t.Parallel()
	main, tree := forkWorld(t, "nowhere")
	gitT(t, tree, "revert", "--no-edit", "HEAD")

	got := decampIn(t, main, tree, "--apply")

	if strings.TrimSpace(gitT(t, main, "branch", "--list", "worktree-fork-abc")) == "" || !strings.Contains(got.stdout, "main does not hold") {
		t.Fatalf("exit %d: want the branch kept and named\n%s", got.code, got.stdout)
	}
}

func TestDecampKeepsATreeHoldingWorkAndNamesIt(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, file, why string }{
		{"an untracked file", "loose.txt", "loose.txt"},
		{"a scratch file", ".scratch/notes.md", ".scratch"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			main, tree := forkWorld(t, "ancestor")
			write(t, filepath.Join(main, ".git/info/exclude"), ".scratch/\n")
			write(t, filepath.Join(tree, c.file), "mine\n")

			got := decampIn(t, main, tree, "--apply")

			if got.code == 0 || !exists(filepath.Join(tree, c.file)) || !strings.Contains(got.stdout, c.why) {
				t.Fatalf("exit %d, file %v, want %q named\n%s", got.code, exists(filepath.Join(tree, c.file)), c.why, got.stdout)
			}
		})
	}
}

// exit 5d on the decamp door
func TestDecampLeavesTheLanesRetro(t *testing.T) {
	t.Parallel()
	main, tree := forkWorld(t, "ancestor")
	state := t.TempDir()
	retro := filepath.Join(state, "lanes/fork/fork-codie-retro.md")
	write(t, retro, "- a line\n")

	got := xIn(t, main, []string{stubPnpm(t), "X_STATE=" + state}, "lane", "decamp", tree, "--apply")

	if got.code != 0 || !exists(retro) {
		t.Fatalf("exit %d, retro %v\n%s", got.code, exists(retro), got.stdout)
	}
}

func TestLandedNamesAVerifyTreeOfALaneUnderReview(t *testing.T) {
	t.Parallel()
	w, head := quickWorld(t)
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+short(head))
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, head)

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !exists(verify) || !strings.Contains(out, "under review") || !strings.Contains(out, "verify-"+short(head)) {
		t.Fatalf("tree %v: want it kept and named\n%s", exists(verify), out)
	}
}

// a two-commit pr, squash-merged and its branch gone: the landed sees both commits on no remote
func landedOnTwoCommitPr(t *testing.T, plant func(w landedWorld, earlier, merged string)) asRun {
	t.Helper()
	w := newLandedWorld(t)
	gitT(t, w.repo, "remote", "add", "origin", "https://github.com/o/r.git")
	squashed := w.laneTree(t, "squashed")
	commit := func(name string) string {
		write(t, filepath.Join(squashed, name), name+"\n")
		gitT(t, squashed, "add", name)
		gitT(t, squashed, "commit", "-q", "-m", name)
		return strings.TrimSpace(gitT(t, squashed, "rev-parse", "HEAD"))
	}
	earlier, merged := commit("first.txt"), commit("second.txt")
	plant(w, earlier, merged)
	server, _ := fakeGithub(t, map[string]string{repoPath + "/pulls/7": `{"merged":true,"head":{"ref":"codie/FRM-1-squashed","sha":"` + merged + `"}}`})
	keys := keysFixture(t, map[string]string{
		"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder",
		"keychain:x-token-linear-codie:x":  farFuture + ":tok-codie",
		"keychain:x-token-linear-clio:x":   farFuture + ":tok-clio",
	})
	return runAs(t, []string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL, "X_LINEAR_URL=" + w.server.URL, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)},
		"lane", "landed", "FRM-1", "--repo", w.repo, "--pr", "7", "--apply")
}

func TestLandedTakesAVerifyTreeAtAnEarlierHeadOfTheMergedPr(t *testing.T) {
	t.Parallel()
	var verify string
	got := landedOnTwoCommitPr(t, func(w landedWorld, earlier, _ string) {
		verify = filepath.Join(w.repo, ".claude/worktrees/verify-pr-7")
		gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, earlier)
	})

	if exists(verify) {
		t.Fatalf("the verify tree at the pr's earlier head was kept:\n%s", got.stdout)
	}
}

func TestLandedKeepsALaneTreeACommitPastTheMergedHead(t *testing.T) {
	t.Parallel()
	var past string
	got := landedOnTwoCommitPr(t, func(w landedWorld, _, merged string) {
		past = w.laneTree(t, "past")
		gitT(t, past, "reset", "-q", "--hard", merged)
		write(t, filepath.Join(past, "third.txt"), "local only\n")
		gitT(t, past, "add", "third.txt")
		gitT(t, past, "commit", "-q", "-m", "local only")
	})

	if !exists(past) || !strings.Contains(got.stdout, "3 commits on no remote") {
		t.Fatalf("tree %v: want it kept, naming its commits on no remote\n%s", exists(past), got.stdout)
	}
}

func TestDecampListStaleCountsWhatForEachRefCounts(t *testing.T) {
	t.Parallel()
	main := repo(t)
	gitT(t, main, "update-ref", "refs/remotes/origin/main", "HEAD")
	for _, name := range []string{"worktree-fork-merged", "codie/FRM-1-merged", "coder/old-merged"} {
		gitT(t, main, "branch", name)
	}
	gitT(t, main, "branch", "someone-elses")
	gitT(t, main, "switch", "-q", "-c", "codie/FRM-2-open")
	write(t, filepath.Join(main, "o.txt"), "not on main\n")
	gitT(t, main, "add", "o.txt")
	dated := exec.Command("git", "commit", "-q", "-m", "open work")
	dated.Dir = main
	dated.Env = append(cleanEnv(), "GIT_COMMITTER_DATE=2026-10-27T00:00:00Z")
	if out, err := dated.CombinedOutput(); err != nil {
		t.Fatalf("%v: %s", err, out)
	}
	gitT(t, main, "switch", "-q", "main")

	got := xIn(t, main, []string{stubPnpm(t), "X_STATE=" + t.TempDir(), "X_NOW=2026-11-06T00:00:00Z"}, "lane", "decamp", "--list-stale")

	var envelope struct {
		Data struct {
			Count    int `json:"count"`
			Branches []struct {
				Name   string `json:"name"`
				Merged bool   `json:"merged"`
				Age    string `json:"age"`
			} `json:"branches"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(got.stdout), &envelope); err != nil || got.code != 0 {
		t.Fatalf("exit %d, %v:\n%s", got.code, err, got.stdout)
	}
	want := strings.Fields(gitT(t, main, "for-each-ref", "--format=%(refname:short)", "refs/heads/worktree-*", "refs/heads/codie/", "refs/heads/coder/"))
	if envelope.Data.Count != len(want) || len(envelope.Data.Branches) != len(want) {
		t.Fatalf("count %d, want %d %v:\n%s", envelope.Data.Count, len(want), want, got.stdout)
	}
	for _, b := range envelope.Data.Branches {
		if b.Merged == (b.Name == "codie/FRM-2-open") {
			t.Errorf("%+v: only codie/FRM-2-open is not merged", b)
		}
		if b.Name == "codie/FRM-2-open" && b.Age != "10d" {
			t.Errorf("%+v: want the age from its commit date, 10d", b)
		}
	}
	if strings.TrimSpace(gitT(t, main, "branch", "--list", "codie/FRM-1-merged")) == "" {
		t.Error("the listing removed a branch")
	}
}

func TestDecampWantsAPathOrTheListing(t *testing.T) {
	t.Parallel()
	if got := decampIn(t, repo(t)); got.code != 2 {
		t.Fatalf("exit %d, want a usage error\n%s", got.code, got.stdout)
	}
}

func TestLandedPrintsWhatItsLandingFreed(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	blockers := func(nodes string) string { return `,"inverseRelations":{"nodes":[` + nodes + `]}` }
	self := `{"type":"blocks","issue":{"identifier":"FRM-1","state":{"type":"started"}}}`
	*w.relations = `[{"type":"blocks","relatedIssue":{"identifier":"FRM-2","state":{"type":"unstarted"}` + blockers(self) + `}},
		{"type":"blocks","relatedIssue":{"identifier":"FRM-3","state":{"type":"completed"}` + blockers(self) + `}},
		{"type":"related","relatedIssue":{"identifier":"FRM-4","state":{"type":"unstarted"}` + blockers("") + `}},
		{"type":"blocks","relatedIssue":{"identifier":"FRM-5","state":{"type":"unstarted"}` + blockers(self+`,{"type":"blocks","issue":{"identifier":"FRM-9","state":{"type":"started"}}}`) + `}},
		{"type":"blocks","relatedIssue":{"identifier":"FRM-6","state":{"type":"unstarted"}` + blockers(self+`,{"type":"blocks","issue":{"identifier":"FRM-8","state":{"type":"completed"}}}`) + `}}]`

	envelope, _ := w.landed(t)

	out := linesOf(envelope)
	if !strings.Contains(out, "✅ freed") || !strings.Contains(out, "FRM-2") || !strings.Contains(out, "FRM-6") {
		t.Errorf("want FRM-2 and FRM-6, whose other blocker is done, named as freed:\n%s", out)
	}
	if strings.Contains(out, "FRM-3") || strings.Contains(out, "FRM-4") || strings.Contains(out, "FRM-5") {
		t.Errorf("a done ticket, a plain relation and a ticket another open one still blocks are not freed:\n%s", out)
	}
}

func TestLandedPrintsNoFreedLineWithNothingFreed(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); strings.Contains(out, "freed") {
		t.Errorf("no blocks relation, no line:\n%s", out)
	}
}

// exit 5c: a rule a quick lane's own commit added, read with no pr
func TestLandedRedsARuleAQuickLaneLeftWarnOnly(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name       string
		onMain     []string
		wants, not []string
	}{
		{"still listed", []string{"older-rule", "new-rule"}, []string{"🔴 warn-only", "new-rule"}, []string{"older-rule"}},
		{"removed since", []string{"older-rule"}, []string{"✅ warn-only", "new-rule"}, []string{"🔴 warn-only"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			commit := func(rules []string, message ...string) {
				write(t, filepath.Join(w.repo, warnOnlyFile), warnSet(rules...))
				gitT(t, w.repo, "add", warnOnlyFile)
				args := []string{"commit", "-q", "--allow-empty"}
				for _, m := range message {
					args = append(args, "-m", m)
				}
				gitT(t, w.repo, args...)
			}
			commit([]string{"older-rule"}, "another lane's rule")
			commit([]string{"older-rule", "new-rule"}, "a guard rule", "- ticket: FRM-1")
			commit(c.onMain, "main at the land")
			gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")

			envelope, _ := w.landed(t)

			out := linesOf(envelope)
			for _, want := range c.wants {
				if !strings.Contains(out, want) {
					t.Errorf("want %q in:\n%s", want, out)
				}
			}
			for _, absent := range c.not {
				if strings.Contains(out, absent) {
					t.Errorf("want no %q in:\n%s", absent, out)
				}
			}
		})
	}
}

// the real dispatch shape: the 🚀 line's base and a verified sha bound the range
func TestLandedRedsARuleOnADispatchedQuickLane(t *testing.T) {
	t.Parallel()
	w, _ := quickWorld(t)
	write(t, filepath.Join(w.repo, warnOnlyFile), warnSet("older-rule"))
	gitT(t, w.repo, "add", warnOnlyFile)
	gitT(t, w.repo, "commit", "-q", "-m", "another lane's rule")
	write(t, filepath.Join(w.repo, warnOnlyFile), warnSet("older-rule", "new-rule"))
	gitT(t, w.repo, "add", warnOnlyFile)
	gitT(t, w.repo, "commit", "-q", "-m", "a guard rule")
	tip := gitT(t, w.repo, "rev-parse", "HEAD")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", tip)
	*w.comments = `[{"body":"verified: ` + tip + `"}]`

	envelope, _ := w.landed(t)

	out := linesOf(envelope)
	if !strings.Contains(out, "🔴 warn-only") || !strings.Contains(out, "new-rule") || strings.Contains(out, "older-rule") {
		t.Errorf("want only this lane's rule red:\n%s", out)
	}
}

func TestLandedPrintsNoWarnLineForAQuickLaneThatAddedNoRule(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, warnOnlyFile), warnSet("older-rule"))
	gitT(t, w.repo, "add", warnOnlyFile)
	gitT(t, w.repo, "commit", "-q", "-m", "another lane's rule")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); strings.Contains(out, "warn-only") {
		t.Errorf("no rule of this ticket, no line:\n%s", out)
	}
}
