package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// a branch off main with one commit per change, pushed, and its local copy in the clone
func (w *mergeWorld) sideBranch(t *testing.T, name string, changes ...string) string {
	t.Helper()
	gitT(t, w.seed, "fetch", "-q", "origin", "main")
	gitT(t, w.seed, "switch", "-q", "-c", name, "origin/main")
	for i, change := range changes {
		write(t, filepath.Join(w.seed, "side.txt"), strings.Join(changes[:i+1], "\n")+"\n")
		gitT(t, w.seed, "add", "side.txt")
		gitT(t, w.seed, "commit", "-q", "-m", change)
	}
	gitT(t, w.seed, "push", "-q", "origin", name)
	gitT(t, w.clone, "fetch", "-q", "origin", name+":"+name)
	return strings.TrimSpace(gitT(t, w.seed, "rev-parse", "HEAD"))
}

// main takes the branch's whole change as one commit, the way github squashes a pr
func (w *mergeWorld) squashOntoMain(t *testing.T, name string) {
	t.Helper()
	gitT(t, w.seed, "switch", "-q", "--detach", "origin/main")
	gitT(t, w.seed, "merge", "-q", "--squash", name)
	gitT(t, w.seed, "commit", "-q", "-m", "squash of "+name)
	gitT(t, w.seed, "push", "-q", "origin", "HEAD:main")
}

// FRM-660 done test 1: a squash-merged lane branch and its clean tree both go at its landing
func TestLandedApplyTakesASquashMergedLaneBranchAndItsCleanTree(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	tip := w.sideBranch(t, "codie/FRM-1-old", "first line", "second line")
	w.squashOntoMain(t, "codie/FRM-1-old")
	// a squash of two commits leaves git cherry two + lines: the merged pr is what vouches
	w.hub.pages[repoPath+"/commits/"+tip+"/pulls"] = `[{"number":6,"merged_at":"2026-11-19T12:00:00Z","head":{"ref":"codie/FRM-1-old"}}]`
	tree := filepath.Join(w.clone, ".claude/worktrees/old")
	gitT(t, w.clone, "worktree", "add", "-q", tree, "codie/FRM-1-old")

	got := w.landedAfterMerge(t, "--apply")

	if exists(tree) || w.onClone(t, "codie/FRM-1-old") || w.onOrigin(t, "codie/FRM-1-old") || !strings.Contains(got.stdout, "codie/FRM-1-old gone") {
		t.Fatalf("exit %d, tree %v, local %v, remote %v: want the tree and the branch gone, named\n%s",
			got.code, exists(tree), w.onClone(t, "codie/FRM-1-old"), w.onOrigin(t, "codie/FRM-1-old"), got.stdout)
	}
}

// FRM-660: a branch whose change main no longer matches goes when github names its merged pr
func TestLandedApplyTakesABranchItsMergedPrCarries(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	tip := w.sideBranch(t, "strays-chores", "a stray's change")
	w.hub.pages[repoPath+"/commits/"+tip+"/pulls"] = `[{"number":5,"merged_at":"2026-11-19T12:00:00Z","head":{"ref":"strays-chores"}}]`

	got := w.landedAfterMerge(t, "--apply")

	if w.onClone(t, "strays-chores") || w.onOrigin(t, "strays-chores") {
		t.Fatalf("exit %d: want strays-chores gone, local and remote\n%s", got.code, got.stdout)
	}
}

// FRM-660 done test 2: a branch holding a commit main lacks, and no merged pr, stays and is named
func TestLandedApplyKeepsAndNamesABranchMainLacks(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	tip := w.sideBranch(t, "keep/probe", "work nobody merged")
	w.hub.pages[repoPath+"/commits/"+tip+"/pulls"] = `[]`

	got := w.landedAfterMerge(t, "--apply")

	if !w.onClone(t, "keep/probe") || !strings.Contains(got.stdout, "keep/probe stays: the local branch holds a commit main lacks, and no merged pr carries") {
		t.Fatalf("exit %d, kept %v: want keep/probe kept and named\n%s", got.code, w.onClone(t, "keep/probe"), got.stdout)
	}
}

// FRM-660: the halt's listing calls a branch whose patch main holds (an empty git cherry) merged and names one main lacks
func TestDecampListStaleReadsASquashAsMerged(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.sideBranch(t, "codie/FRM-2-done", "one")
	w.squashOntoMain(t, "codie/FRM-2-done")
	// main edits the line since, so merging the branch would conflict: only its patch-id still matches
	write(t, filepath.Join(w.seed, "side.txt"), "one, edited on main\n")
	gitT(t, w.seed, "commit", "-q", "-am", "main moves on")
	gitT(t, w.seed, "push", "-q", "origin", "HEAD:main")
	tip := w.sideBranch(t, "keep/open", "unmerged")
	w.hub.pages[repoPath+"/commits/"+tip+"/pulls"] = `[]`

	got := xIn(t, w.clone, w.env, "lane", "decamp", "--list-stale")

	if !strings.Contains(got.stdout, `"name":"codie/FRM-2-done","merged":true`) || !strings.Contains(got.stdout, `"name":"keep/open","merged":false`) {
		t.Fatalf("exit %d: want the squash merged and keep/open not\n%s", got.code, got.stdout)
	}
}
