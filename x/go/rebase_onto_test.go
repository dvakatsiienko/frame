package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// #1 coder/x squash-merged onto main; coder/x-2 is the layer above it, pushed, checked out in the clone; base is coder/x's old head
func layerOffSquash(t *testing.T) (w *rebaseWorld, base string) {
	t.Helper()
	w = newRebaseWorld(t, "coder/x")
	base = gitT(t, w.clone, "rev-parse", "HEAD")
	gitT(t, w.clone, "switch", "-q", "-c", "coder/x-2")
	write(t, filepath.Join(w.clone, "layer.txt"), "the layer's change\n")
	gitT(t, w.clone, "add", "layer.txt")
	gitT(t, w.clone, "commit", "-q", "-m", "the layer's change")
	gitT(t, w.clone, "push", "-q", "origin", "coder/x-2")
	w.mainMoves(t, "mine.txt", "codie's change\n")
	return w, base
}

func rivalPush(t *testing.T, w *rebaseWorld, branch string) string {
	t.Helper()
	gitT(t, w.side, "fetch", "-q", "origin")
	gitT(t, w.side, "switch", "-q", "-C", "rival", "origin/"+branch)
	write(t, filepath.Join(w.side, "theirs.txt"), "a teammate's commit\n")
	gitT(t, w.side, "add", "theirs.txt")
	gitT(t, w.side, "commit", "-q", "-m", "a teammate's commit")
	gitT(t, w.side, "push", "-q", "origin", "rival:refs/heads/"+branch)
	return gitT(t, w.side, "rev-parse", "HEAD")
}

func subjectsAboveMain(t *testing.T, w *rebaseWorld) string {
	t.Helper()
	return gitT(t, w.clone, "log", "--format=%s", "origin/main..HEAD")
}

func TestRebaseMainOntoMovesALayerOffASquash(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)

	got := w.run(t, "--onto", base, "--apply")

	head := gitT(t, w.clone, "rev-parse", "HEAD")
	if above := subjectsAboveMain(t, w); got.code != 0 || above != "the layer's change" || remoteHead(t, w, "coder/x-2") != head {
		t.Fatalf("exit %d, above main %q, remote %s, head %s: want the layer's own commit alone, pushed:\n%s", got.code, above, short(remoteHead(t, w, "coder/x-2")), short(head), got.stdout)
	}
}

func TestRebaseMainOntoWritesNothingBeforeApply(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)
	before := gitT(t, w.clone, "rev-parse", "HEAD")

	got := w.run(t, "--onto", base)

	if after := gitT(t, w.clone, "rev-parse", "HEAD"); got.code != 4 || after != before || exists(filepath.Join(w.clone, ".git", ontoRecordName)) {
		t.Fatalf("exit %d, HEAD %s → %s: want exit 4 and nothing touched:\n%s", got.code, short(before), short(after), got.stdout)
	}
}

func TestRebaseMainOntoRefusesARivalsCommitOnTheRemote(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)
	theirs := rivalPush(t, w, "coder/x-2")

	got := w.run(t, "--onto", base, "--apply")

	if msg := envelopeOf(got).Error; got.code == 0 || remoteHead(t, w, "coder/x-2") != theirs || !strings.Contains(msg, short(theirs)) {
		t.Fatalf("exit %d, remote %s, error %q: want the rival's %s kept and named", got.code, short(remoteHead(t, w, "coder/x-2")), msg, short(theirs))
	}
}

func TestRebaseMainOntoRefusesAShaNotUnderHead(t *testing.T) {
	t.Parallel()
	w, _ := layerOffSquash(t)
	gitT(t, w.clone, "fetch", "-q", "origin", "main")
	elsewhere := gitT(t, w.clone, "rev-parse", "origin/main")
	before := gitT(t, w.clone, "rev-parse", "HEAD")

	got := w.run(t, "--onto", elsewhere, "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, short(elsewhere)) || gitT(t, w.clone, "rev-parse", "HEAD") != before {
		t.Fatalf("exit %d, error %q: want a refusal naming %s and HEAD untouched", got.code, msg, short(elsewhere))
	}
}

// the layer's own tip as the old base would replay nothing and drop every commit from the remote
func TestRebaseMainOntoRefusesHeadItself(t *testing.T) {
	t.Parallel()
	w, _ := layerOffSquash(t)
	tip := gitT(t, w.clone, "rev-parse", "HEAD")

	got := w.run(t, "--onto", tip, "--apply")

	if got.code != 1 || remoteHead(t, w, "coder/x-2") != tip {
		t.Fatalf("exit %d, remote %s: want a refusal and the remote kept:\n%s", got.code, short(remoteHead(t, w, "coder/x-2")), got.stdout)
	}
}

// a failed push names the rerun that works: a plain rerun refuses on the rewritten head
func TestRebaseMainOntoFailedPushNamesTheOntoRerun(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)
	write(t, filepath.Join(w.origin, "hooks/pre-receive"), "#!/bin/sh\nexit 1\n")
	if err := os.Chmod(filepath.Join(w.origin, "hooks/pre-receive"), 0o755); err != nil {
		t.Fatal(err)
	}

	got := w.run(t, "--onto", base, "--apply")

	if want := "x lane rebase-main --onto " + base + " --apply"; got.code == 0 || got.next != want {
		t.Fatalf("exit %d, next %q, want %q:\n%s", got.code, got.next, want, got.stdout)
	}
}

func TestRebaseMainOntoRefusesAShaGitCannotRead(t *testing.T) {
	t.Parallel()
	w, _ := layerOffSquash(t)

	got := w.run(t, "--onto", "not-a-sha", "--apply")

	if msg := envelopeOf(got).Error; got.code != 2 || !strings.Contains(msg, "not-a-sha") {
		t.Fatalf("exit %d, error %q: want a usage refusal naming it", got.code, msg)
	}
}

// a layer whose own commit conflicts with main: the verb stops, codie continues by hand, the rerun finishes the push
func conflictingLayer(t *testing.T) (w *rebaseWorld, base string) {
	t.Helper()
	w = newRebaseWorld(t, "coder/x")
	base = gitT(t, w.clone, "rev-parse", "HEAD")
	gitT(t, w.clone, "switch", "-q", "-c", "coder/x-2")
	write(t, filepath.Join(w.clone, "clash.txt"), "the layer's line\n")
	gitT(t, w.clone, "add", "clash.txt")
	gitT(t, w.clone, "commit", "-q", "-m", "the layer's change")
	gitT(t, w.clone, "push", "-q", "origin", "coder/x-2")
	w.mainMoves(t, "mine.txt", "codie's change\n")
	w.mainMoves(t, "clash.txt", "main's line\n")
	return w, base
}

func continueByHand(t *testing.T, w *rebaseWorld) {
	t.Helper()
	write(t, filepath.Join(w.clone, "clash.txt"), "resolved\n")
	gitT(t, w.clone, "add", "clash.txt")
	gitT(t, w.clone, "-c", "core.editor=true", "rebase", "--continue")
}

func TestRebaseMainOntoFinishesThePushOnARerunAfterAConflict(t *testing.T) {
	t.Parallel()
	w, base := conflictingLayer(t)
	oldRemote := remoteHead(t, w, "coder/x-2")

	stopped := w.run(t, "--onto", base, "--apply")
	if msg := envelopeOf(stopped).Error; stopped.code != 1 || !strings.Contains(msg, "clash.txt") || remoteHead(t, w, "coder/x-2") != oldRemote {
		t.Fatalf("exit %d, error %q: want the conflict named and no push", stopped.code, msg)
	}
	mid := w.run(t, "--onto", base, "--apply")
	if mid.code != 1 || !strings.Contains(envelopeOf(mid).Error, "stopped here") {
		t.Fatalf("exit %d, error %q: want a rerun mid-rebase refused", mid.code, envelopeOf(mid).Error)
	}
	continueByHand(t, w)

	got := w.run(t, "--onto", base, "--apply")

	head := gitT(t, w.clone, "rev-parse", "HEAD")
	if above := subjectsAboveMain(t, w); got.code != 0 || remoteHead(t, w, "coder/x-2") != head || above != "the layer's change" {
		t.Fatalf("exit %d, above main %q, remote %s, head %s: want the rerun to push the resolved layer:\n%s", got.code, above, short(remoteHead(t, w, "coder/x-2")), short(head), got.stdout)
	}
	if exists(filepath.Join(w.clone, ".git", ontoRecordName)) {
		t.Errorf("the record stayed after the push landed")
	}
}

func TestRebaseMainOntoRerunRefusesARivalPushedDuringTheConflict(t *testing.T) {
	t.Parallel()
	w, base := conflictingLayer(t)
	w.run(t, "--onto", base, "--apply")
	theirs := rivalPush(t, w, "coder/x-2")
	continueByHand(t, w)

	got := w.run(t, "--onto", base, "--apply")

	if msg := envelopeOf(got).Error; got.code == 0 || remoteHead(t, w, "coder/x-2") != theirs || !strings.Contains(msg, short(theirs)) {
		t.Fatalf("exit %d, remote %s, error %q: want the rival's %s kept and named", got.code, short(remoteHead(t, w, "coder/x-2")), msg, short(theirs))
	}
}

func TestRebaseMainOntoRunsAgainAfterAnAbort(t *testing.T) {
	t.Parallel()
	w, base := conflictingLayer(t)
	w.run(t, "--onto", base, "--apply")
	gitT(t, w.clone, "rebase", "--abort")

	got := w.run(t, "--onto", base, "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "clash.txt") {
		t.Fatalf("exit %d, error %q: want the rebase run again to the same conflict", got.code, msg)
	}
}

// the aborted run's record stays; a commit on top of the old head is no finished rewrite, so the rebase still runs
func TestRebaseMainOntoRebasesACommitMadeAfterAnAbort(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)
	write(t, filepath.Join(w.clone, ".git", ontoRecordName), `{"branch":"coder/x-2","head":"`+gitT(t, w.clone, "rev-parse", "HEAD")+`"}`)
	write(t, filepath.Join(w.clone, "more.txt"), "one more\n")
	gitT(t, w.clone, "add", "more.txt")
	gitT(t, w.clone, "commit", "-q", "-m", "one more")

	got := w.run(t, "--onto", base, "--apply")

	if above := subjectsAboveMain(t, w); got.code != 0 || above != "one more\nthe layer's change" {
		t.Fatalf("exit %d, above main %q: want both commits rebased off the squash:\n%s", got.code, above, got.stdout)
	}
}

// an amend rewrites the recorded head too, but the old base still sits under it: no finished rewrite
func TestRebaseMainOntoRebasesAnAmendMadeAfterAnAbort(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)
	write(t, filepath.Join(w.clone, ".git", ontoRecordName), `{"branch":"coder/x-2","head":"`+gitT(t, w.clone, "rev-parse", "HEAD")+`"}`)
	gitT(t, w.clone, "commit", "-q", "--amend", "-m", "the layer's change, amended")

	got := w.run(t, "--onto", base, "--apply")

	if above := subjectsAboveMain(t, w); got.code != 0 || above != "the layer's change, amended" {
		t.Fatalf("exit %d, above main %q: want the amend rebased off the squash:\n%s", got.code, above, got.stdout)
	}
}

// the push landed and its read back failed: the remote holds this very HEAD, so the rerun is no rival's
func TestRebaseMainOntoRerunTakesItsOwnLandedPush(t *testing.T) {
	t.Parallel()
	w, base := conflictingLayer(t)
	was := gitT(t, w.clone, "rev-parse", "HEAD")
	w.run(t, "--onto", base, "--apply")
	continueByHand(t, w)
	gitT(t, w.clone, "push", "-q", "-f", "origin", "coder/x-2")
	if was == gitT(t, w.clone, "rev-parse", "HEAD") {
		t.Fatal("the rewrite left HEAD where it was")
	}

	got := w.run(t, "--onto", base, "--apply")

	if got.code != 0 || exists(filepath.Join(w.clone, ".git", ontoRecordName)) {
		t.Fatalf("exit %d: want the rerun to read its own push back and clear the record:\n%s", got.code, got.stdout)
	}
}

func TestRebaseMainPlainLeavesNoRecord(t *testing.T) {
	t.Parallel()
	w := newRebaseWorld(t, "coder/x")
	w.mainMoves(t, "one.txt", "one\n")

	got := w.run(t, "--apply")

	if got.code != 0 || exists(filepath.Join(w.clone, ".git", ontoRecordName)) {
		t.Fatalf("exit %d: want a plain rebase to land with no record:\n%s", got.code, got.stdout)
	}
}

// a low sha reads like a true old base, and the commits under it would leave the remote: the plan says how many replay
func TestRebaseMainOntoPlanCountsWhatReplays(t *testing.T) {
	t.Parallel()
	w, base := layerOffSquash(t)

	got := w.run(t, "--onto", base)

	if !strings.Contains(got.stdout, "replays 1 of 2") {
		t.Fatalf("exit %d: want the plan to say 1 of 2 commits replay:\n%s", got.code, got.stdout)
	}
}
