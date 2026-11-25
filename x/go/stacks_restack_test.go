//go:build !nostacks

package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func TestRestackMergesEachLowerLayerUpAndPushes(t *testing.T) {
	t.Parallel()
	clone := movedStack(t, "lower.txt", "the fix\n")
	lower := originHead(t, clone, "codie/FRM-1-a")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	upper := originHead(t, clone, "codie/FRM-1-a-2")
	if got.code != 0 || gitT(t, clone, "merge-base", "--is-ancestor", lower, upper) != "" {
		t.Fatalf("exit %d, want origin's top layer to hold the lower layer's %s\n%s", got.code, short(lower), got.stdout)
	}
	if branch := gitT(t, clone, "branch", "--show-current"); branch != "codie/FRM-1-a-2" {
		t.Errorf("left on %s, want the branch restack started on", branch)
	}
}

func TestRestackStopsAtALayerThatConflicts(t *testing.T) {
	t.Parallel()
	// the top layer's own file, changed under it in the lower layer
	clone := movedStack(t, "codie-FRM-1-a-2.txt", "the lower layer's version\n")
	before := originHead(t, clone, "codie/FRM-1-a-2")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "codie/FRM-1-a-2") || !strings.Contains(got.stdout, "codie-FRM-1-a-2.txt") || originHead(t, clone, "codie/FRM-1-a-2") != before {
		t.Fatalf("exit %d, want a stop naming the layer and the conflicted file, origin untouched\n%s", got.code, got.stdout)
	}
}

func TestRestackRefusesATreeWithChanges(t *testing.T) {
	t.Parallel()
	clone := movedStack(t, "lower.txt", "the fix\n")
	write(t, filepath.Join(clone, "codie-FRM-1-a-2.txt"), "an edit in flight\n")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "codie-FRM-1-a-2.txt") {
		t.Fatalf("exit %d, want a refusal naming the changed file\n%s", got.code, got.stdout)
	}
}

// a conflict high in the stack keeps the layers under it pushed, so the rerun after the fix goes through
func TestRestackRerunsAfterAResolvedConflict(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	gitT(t, clone, "switch", "-q", "codie/FRM-1-a")
	write(t, filepath.Join(clone, "codie-FRM-1-a-3.txt"), "the lower layer's version\n")
	gitT(t, clone, "add", ".")
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", "codie/FRM-1-a")
	lower := gitT(t, clone, "rev-parse", "HEAD")
	gitT(t, clone, "switch", "-q", "codie/FRM-1-a-3")

	stopped := xIn(t, clone, nil, "lane", "restack", "--apply")

	if stopped.code == 0 || !ok(gitIn(clone, "merge-base", "--is-ancestor", lower, originHead(t, clone, "codie/FRM-1-a-2"))) {
		t.Fatalf("exit %d, want a stop at the top layer with codie/FRM-1-a-2 already pushed\n%s", stopped.code, stopped.stdout)
	}
	write(t, filepath.Join(clone, "codie-FRM-1-a-3.txt"), "both versions\n")
	gitT(t, clone, "add", "codie-FRM-1-a-3.txt")
	gitT(t, clone, "commit", "-q", "--no-edit")
	if pushed := xIn(t, clone, nil, "lane", "push", "--apply"); pushed.code != 0 {
		t.Fatalf("the resolved layer's push: exit %d\n%s", pushed.code, pushed.stdout)
	}

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code != 0 {
		t.Fatalf("exit %d, want the rerun the stop named to go through\n%s", got.code, got.stdout)
	}
}

// the rival lands the moment restack's merge is made, the gap before its push; once, so the rerun meets no second rival
func rivalInTheGap(t *testing.T, clone, layer string) string {
	t.Helper()
	dir, sha := rivalClone(t, clone, layer)
	write(t, filepath.Join(clone, ".git/hooks/post-merge"), "#!/bin/sh\nunset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE\nrm \"$0\"\ngit -C '"+dir+"' push -q origin "+layer+"\n")
	return sha
}

func TestRestackSurvivesARivalPushWithNoHandReset(t *testing.T) {
	t.Parallel()
	clone := movedStack(t, "lower.txt", "the fix\n")
	lower := originHead(t, clone, "codie/FRM-1-a")
	rival := rivalInTheGap(t, clone, "codie/FRM-1-a-2")

	stopped := xIn(t, clone, nil, "lane", "restack", "--apply")
	if stopped.code == 0 {
		t.Fatalf("the rival landed in the gap, want the first run's push refused\n%s", stopped.stdout)
	}

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	head := originHead(t, clone, "codie/FRM-1-a-2")
	if got.code != 0 {
		t.Fatalf("exit %d, want the rerun to land the push\n%s", got.code, got.stdout)
	}
	for name, sha := range map[string]string{"the rival's": rival, "the lower layer's": lower} {
		if !ok(gitIn(clone, "merge-base", "--is-ancestor", sha, head)) {
			t.Errorf("%s %s is not reachable from the pushed head %s", name, short(sha), short(head))
		}
	}
	if local := gitT(t, clone, "rev-parse", "refs/heads/codie/FRM-1-a-2"); local != head {
		t.Errorf("the local layer is %s, origin %s", short(local), short(head))
	}
}

func TestRestackTakesOriginsLayerWhenTheLocalOneOnlyLagsIt(t *testing.T) {
	t.Parallel()
	clone := movedStack(t, "lower.txt", "the fix\n")
	dir, rival := rivalClone(t, clone, "codie/FRM-1-a-2")
	gitT(t, dir, "push", "-q", "origin", "codie/FRM-1-a-2")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code != 0 || !ok(gitIn(clone, "merge-base", "--is-ancestor", rival, originHead(t, clone, "codie/FRM-1-a-2"))) {
		t.Fatalf("exit %d, want the rival's %s under the pushed head\n%s", got.code, short(rival), got.stdout)
	}
}

// a rival push on the bottom layer: nothing local to lose, and the merges read origin's sha
func TestRestackTakesARivalPushOnTheBottomLayer(t *testing.T) {
	t.Parallel()
	const bottom = "codie/FRM-1-a"
	clone := layers(t, bottom, "codie/FRM-1-a-2")
	gitT(t, clone, "fetch", "-q", "origin", bottom+":"+bottom)
	dir, rival := rivalClone(t, clone, bottom)
	gitT(t, dir, "push", "-q", "origin", bottom)

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code != 0 || !ok(gitIn(clone, "merge-base", "--is-ancestor", rival, originHead(t, clone, "codie/FRM-1-a-2"))) {
		t.Fatalf("exit %d, want the rival's %s under the top layer\n%s", got.code, short(rival), got.stdout)
	}
}

// a commit on the bottom layer that origin lacks still refuses, a restack never merges into that layer
func TestRestackRefusesABottomLayerAheadOfOrigin(t *testing.T) {
	t.Parallel()
	const bottom = "codie/FRM-1-a"
	clone := layers(t, bottom, "codie/FRM-1-a-2")
	gitT(t, clone, "fetch", "-q", "origin", bottom+":"+bottom)
	gitT(t, clone, "switch", "-q", bottom)
	write(t, filepath.Join(clone, "hand.txt"), "by hand\n")
	gitT(t, clone, "add", "hand.txt")
	gitT(t, clone, "commit", "-q", "-m", "a hand fix")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, bottom) {
		t.Fatalf("exit %d, want a refusal naming the bottom layer\n%s", got.code, got.stdout)
	}
}

// merged up, a hand commit shows on both refs: the refusal sends the coder to the layer that holds it
func TestRestackNamesTheLayerAHandCommitSitsOn(t *testing.T) {
	t.Parallel()
	const low, mid, top = "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3"
	clone := layers(t, low, mid, top)
	gitT(t, clone, "fetch", "-q", "origin", low+":"+low, mid+":"+mid)
	gitT(t, clone, "switch", "-q", mid)
	write(t, filepath.Join(clone, "hand.txt"), "by hand\n")
	gitT(t, clone, "add", "hand.txt")
	gitT(t, clone, "commit", "-q", "-m", "a hand commit")
	gitT(t, clone, "switch", "-q", top)
	gitT(t, clone, "merge", "-q", "--no-ff", "-m", "restack: merge 7654321 into "+top, mid)

	got := xIn(t, clone, nil, "lane", "restack")

	if got.code == 0 || !strings.Contains(got.stdout, mid+" holds what origin does not") || !strings.Contains(got.stdout, "git switch "+mid+" ") {
		t.Errorf("exit %d, want the refusal on %s:\n%s", got.code, mid, got.stdout)
	}
}

func TestRestackRefusesACommitNoRestackMade(t *testing.T) {
	t.Parallel()
	const layer = "codie/FRM-1-a-2"
	handCommit := func(t *testing.T, clone string) {
		write(t, filepath.Join(clone, "hand.txt"), "by hand\n")
		gitT(t, clone, "add", "hand.txt")
		gitT(t, clone, "commit", "-q", "-m", "a hand fix")
	}
	cases := []struct {
		name, subject string
		plant         func(t *testing.T, clone string)
	}{
		{"a hand commit", "a hand fix", handCommit},
		{"a hand commit above a restack merge", "a hand fix", func(t *testing.T, clone string) {
			rivalInTheGap(t, clone, layer)
			xIn(t, clone, nil, "lane", "restack", "--apply")
			handCommit(t, clone)
		}},
		{"a plain commit worded as a restack merge", "restack: merge 1234567 into " + layer, func(t *testing.T, clone string) {
			write(t, filepath.Join(clone, "hand.txt"), "by hand\n")
			gitT(t, clone, "add", "hand.txt")
			gitT(t, clone, "commit", "-q", "-m", "restack: merge 1234567 into "+layer)
		}},
		{"a hand merge of another branch", "merge in the side branch", func(t *testing.T, clone string) {
			gitT(t, clone, "switch", "-q", "-c", "side")
			handCommit(t, clone)
			gitT(t, clone, "switch", "-q", layer)
			gitT(t, clone, "merge", "-q", "--no-ff", "-m", "merge in the side branch", "side")
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			clone := movedStack(t, "lower.txt", "the fix\n")
			c.plant(t, clone)
			held := gitT(t, clone, "rev-parse", "HEAD")
			before := originHead(t, clone, layer)

			got := xIn(t, clone, nil, "lane", "restack", "--apply")

			if got.code == 0 || !strings.Contains(got.stdout, c.subject) || originHead(t, clone, layer) != before {
				t.Fatalf("exit %d, want a refusal naming %q, origin untouched\n%s", got.code, c.subject, got.stdout)
			}
			if now := gitT(t, clone, "rev-parse", "refs/heads/"+layer); now != held {
				t.Errorf("the local layer moved to %s, it held %s", short(now), short(held))
			}
		})
	}
}

// a layer checked out in another worktree cannot be switched to, so the plan refuses before any layer merges
func TestRestackRefusesALayerAnotherWorktreeHolds(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	gitT(t, clone, "switch", "-q", "codie/FRM-1-a")
	write(t, filepath.Join(clone, "lower.txt"), "the fix\n")
	gitT(t, clone, "add", "lower.txt")
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", "codie/FRM-1-a")
	gitT(t, clone, "worktree", "add", "-q", filepath.Join(t.TempDir(), "held"), "codie/FRM-1-a-3")

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "codie/FRM-1-a-3") || ok(gitIn(clone, "rev-parse", "-q", "--verify", "refs/heads/codie/FRM-1-a-2")) {
		t.Fatalf("exit %d, want a refusal naming the held layer and no layer merged\n%s", got.code, got.stdout)
	}
}
