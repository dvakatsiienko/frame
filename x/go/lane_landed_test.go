package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// landedWorld is a merged lane: a repo whose origin/main carries FRM-1's commit, the lane spec under
// .scratch/lane-1/, and a state dir for the lane's retros
type landedWorld struct {
	repo, state string
	server      *fakeLinear
}

func newLandedWorld(t *testing.T) landedWorld {
	t.Helper()
	w := landedWorld{repo: repo(t), state: t.TempDir()}
	write(t, filepath.Join(w.repo, "x.txt"), "the change\n")
	gitT(t, w.repo, "add", "x.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "the change", "-m", "- ticket: FRM-1")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	write(t, filepath.Join(w.repo, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — the chunk\n\n### exit lines\n\n1. `x lane unlock` prints ok\n")
	body, _ := json.Marshal("## wish\n\n* W1 (2026-10-30, dima): a thing\n* W2 (2026-10-30, dima): another\n\n## signed\n")
	w.server = newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-1","description":` + string(body) + `,"updatedAt":"2026-10-30T00:00:00.000Z"}}}`
	})
	return w
}

// done fills every line but the ones a case leaves out
func (w landedWorld) done(t *testing.T) {
	t.Helper()
	write(t, filepath.Join(w.repo, "docs/test-drive/review-rounds.md"), "- FRM-1 · codie · 2 rounds\n")
	write(t, filepath.Join(w.state, "lanes/lane-1/2026-10-30-FRM-1-codie-retro.md"), "retro\n")
	write(t, filepath.Join(w.state, "lanes/lane-1/2026-10-30-FRM-1-sixth-sense-retro.md"), "retro\n")
}

func (w landedWorld) landed(t *testing.T, args ...string) (map[string]any, asRun) {
	t.Helper()
	return runLinear(t, w.server, []string{"X_STATE=" + w.state}, append([]string{"lane", "landed", "FRM-1", "--repo", w.repo}, args...)...)
}

func linesOf(envelope map[string]any) string {
	return jsonOf(envelope["plan"]) + jsonOf(envelope["data"]) + jsonOf(envelope["error"])
}

func TestLandedRedsEveryGapAndWritesNothing(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, got := w.landed(t)

	out := linesOf(envelope)
	for _, want := range []string{"🔴 spec", "🔴 review-rounds", "🔴 retros", "✅ merged", "✅ wish"} {
		if !strings.Contains(out, want) {
			t.Errorf("want %q in:\n%s", want, out)
		}
	}
	if got.code != 4 {
		t.Errorf("exit %d, want 4: x's apply gate prints the list and writes nothing", got.code)
	}
	if !exists(filepath.Join(w.repo, ".scratch/lane-1/spec.md")) {
		t.Error("the spec moved without --apply")
	}
}

func TestLandedApplyArchivesTheSpecAndNothingElse(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, got := w.landed(t, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md")) || exists(filepath.Join(w.repo, ".scratch/lane-1")) {
		t.Fatalf("the spec dir did not move into the archive:\n%s", got.stdout)
	}
	out := linesOf(envelope)
	if !strings.Contains(out, "✅ spec") || !strings.Contains(out, "🔴 review-rounds") || got.code != 1 {
		t.Errorf("exit %d, want the spec green and the other gaps still red:\n%s", got.code, out)
	}
}

func TestLandedApplyDecampsOnlyTheCleanTrees(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	// worktrees share info/exclude, so a gitignored .scratch/ hides from git status as it does in frame
	write(t, filepath.Join(w.repo, ".git/info/exclude"), ".scratch/\n")
	trees := map[string]string{}
	for _, name := range []string{"clean", "loose", "scratch", "unpushed"} {
		trees[name] = filepath.Join(w.repo, ".claude/worktrees", name)
		gitT(t, w.repo, "worktree", "add", "-q", trees[name], "-b", "codie/FRM-1-"+name)
	}
	write(t, filepath.Join(trees["loose"], "loose.txt"), "not committed\n")
	write(t, filepath.Join(trees["scratch"], ".scratch/notes.md"), "a plan\n")
	write(t, filepath.Join(trees["unpushed"], "y.txt"), "local only\n")
	gitT(t, trees["unpushed"], "add", "y.txt")
	gitT(t, trees["unpushed"], "commit", "-q", "-m", "local only")
	// hooksHome runs lefthook install through pnpm; the fixture has no node_modules
	bin := t.TempDir()
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\nexit 0\n")

	envelope, got := runLinear(t, w.server, []string{"X_STATE=" + w.state, "PATH=" + bin + ":" + os.Getenv("PATH")},
		"lane", "landed", "FRM-1", "--repo", w.repo, "--apply")

	out := linesOf(envelope)
	if exists(trees["clean"]) || strings.Contains(gitT(t, w.repo, "worktree", "list"), trees["clean"]) {
		t.Errorf("the clean tree was not decamped:\n%s", out)
	}
	for name, reason := range map[string]string{"loose": "loose.txt", "scratch": "holds a .scratch/ dir", "unpushed": "on no remote"} {
		if !exists(trees[name]) {
			t.Errorf("the %s tree was removed", name)
		}
		if !strings.Contains(out, reason) {
			t.Errorf("want the %s tree's reason %q in:\n%s", name, reason, out)
		}
	}
	if got.code != 1 {
		t.Errorf("exit %d, want 1: three trees still stand", got.code)
	}
}

func TestLandedPassesWhenEveryLineIsMet(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	w.done(t)
	write(t, filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — the chunk\n")
	if err := os.RemoveAll(filepath.Join(w.repo, ".scratch/lane-1")); err != nil {
		t.Fatal(err)
	}

	envelope, got := w.landed(t, "--apply")

	if out := linesOf(envelope); got.code != 0 || strings.Contains(out, "🔴") {
		t.Errorf("exit %d, want 0 with every line ✅:\n%s", got.code, out)
	}
}
