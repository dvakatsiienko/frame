//go:build !nostacks

package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// a top layer's merge reaches the middle layer's through its second parent: each is booked on its own layer
func TestRestackBooksEachMergeOnItsOwnLayer(t *testing.T) {
	t.Parallel()
	const low, mid, top = "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3"
	clone := layers(t, low, mid, top)
	gitT(t, clone, "fetch", "-q", "origin", low+":"+low, mid+":"+mid)
	gitT(t, clone, "switch", "-q", low)
	write(t, filepath.Join(clone, "lower.txt"), "the fix\n")
	gitT(t, clone, "add", "lower.txt")
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", low)
	gitT(t, clone, "switch", "-q", mid)
	gitT(t, clone, "merge", "-q", "--no-ff", "-m", "restack: merge 1234567 into "+mid, low)
	midMerge := gitT(t, clone, "rev-parse", "HEAD")
	gitT(t, clone, "switch", "-q", top)
	gitT(t, clone, "merge", "-q", "--no-ff", "-m", "restack: merge 7654321 into "+top, mid)
	topMerge := gitT(t, clone, "rev-parse", "HEAD")

	got := xIn(t, clone, nil, "lane", "restack")

	plan := got.stdout
	if !strings.Contains(plan, `"`+mid+`":["`+short(midMerge)+`"]`) || !strings.Contains(plan, `"`+top+`":["`+short(topMerge)+`"]`) {
		t.Errorf("want each merge under its own layer:\n%s", plan)
	}
}

// a fix pushed on the lower layer, merged up by hand with an edit in the result: a resolution a reset would lose
func editedMerge(t *testing.T, clone, low, mid, file string) string {
	t.Helper()
	gitT(t, clone, "switch", "-q", low)
	write(t, filepath.Join(clone, file), "the fix\n")
	gitT(t, clone, "add", file)
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", low)
	gitT(t, clone, "switch", "-q", mid)
	gitT(t, clone, "merge", "-q", "--no-ff", "--no-commit", low)
	write(t, filepath.Join(clone, file), "the fix, by hand\n")
	gitT(t, clone, "add", file)
	gitT(t, clone, "commit", "-q", "-m", "restack: merge 1234567 into "+mid)
	return gitT(t, clone, "rev-parse", "HEAD")
}

// the upper layer alone still holds the lower one's edited merge, and the reset takes it
func TestRestackNamesALostResolutionOnceTheLowerLayersRefMoved(t *testing.T) {
	t.Parallel()
	const low, mid, top = "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3"
	clone := layers(t, low, mid, top)
	gitT(t, clone, "fetch", "-q", "origin", low+":"+low, mid+":"+mid)
	before := gitT(t, clone, "rev-parse", mid)
	edited := editedMerge(t, clone, low, mid, "lower.txt")
	gitT(t, clone, "switch", "-q", top)
	gitT(t, clone, "merge", "-q", "--no-ff", "-m", "restack: merge 7654321 into "+top, mid)
	gitT(t, clone, "branch", "-f", mid, before)

	got := xIn(t, clone, nil, "lane", "restack")

	if !strings.Contains(got.stdout, `"lost_resolutions":{"`+mid+`":"`+short(edited)+`"}`) {
		t.Errorf("want the edited merge %s named under its own layer:\n%s", short(edited), got.stdout)
	}
}

// the upper layer reaches a newer edited merge than the lower ref does, and the newest is the one to take back
func TestRestackNamesTheNewestResolutionAcrossLayers(t *testing.T) {
	t.Parallel()
	const low, mid, top = "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3"
	clone := layers(t, low, mid, top)
	gitT(t, clone, "fetch", "-q", "origin", low+":"+low, mid+":"+mid)
	older := editedMerge(t, clone, low, mid, "older.txt")
	newer := editedMerge(t, clone, low, mid, "newer.txt")
	gitT(t, clone, "switch", "-q", top)
	gitT(t, clone, "merge", "-q", "--no-ff", "-m", "restack: merge 7654321 into "+top, mid)
	gitT(t, clone, "branch", "-f", mid, older)

	got := xIn(t, clone, nil, "lane", "restack")

	if !strings.Contains(got.stdout, `"lost_resolutions":{"`+mid+`":"`+short(newer)+`"}`) {
		t.Errorf("want the newer merge %s, not %s:\n%s", short(newer), short(older), got.stdout)
	}
}

// the same rule the other way round: the lower ref reaches the newer merge, the upper one only the older
func TestRestackNamesTheNewestResolutionWhenTheLowerRefHoldsIt(t *testing.T) {
	t.Parallel()
	const low, mid, top = "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3"
	clone := layers(t, low, mid, top)
	gitT(t, clone, "fetch", "-q", "origin", low+":"+low, mid+":"+mid)
	older := editedMerge(t, clone, low, mid, "older.txt")
	gitT(t, clone, "switch", "-q", top)
	gitT(t, clone, "merge", "-q", "--no-ff", "-m", "restack: merge 7654321 into "+top, mid)
	newer := editedMerge(t, clone, low, mid, "newer.txt")
	gitT(t, clone, "switch", "-q", top)

	got := xIn(t, clone, nil, "lane", "restack")

	if !strings.Contains(got.stdout, `"lost_resolutions":{"`+mid+`":"`+short(newer)+`"}`) {
		t.Errorf("want the newer merge %s, not %s:\n%s", short(newer), short(older), got.stdout)
	}
}

// a restack stopped on the top layer, its conflict resolved by hand and left unpushed; the clone and the resolution's sha
func resolvedRestack(t *testing.T) (clone, resolved string) {
	t.Helper()
	const file = "codie-FRM-1-a-2.txt"
	clone = movedStack(t, file, "the lower layer's version\n")
	if stopped := xIn(t, clone, nil, "lane", "restack", "--apply"); stopped.code == 0 {
		t.Fatalf("want a conflict stop\n%s", stopped.stdout)
	}
	write(t, filepath.Join(clone, file), "both versions\n")
	gitT(t, clone, "add", file)
	gitT(t, clone, "commit", "-q", "--no-edit")
	return clone, gitT(t, clone, "rev-parse", "HEAD")
}

// the hand resolution goes with the reset, so the stop names the commit it can be taken back from
func TestRestackNamesAResolutionTheResetLoses(t *testing.T) {
	t.Parallel()
	const layer = "codie/FRM-1-a-2"
	clone, resolved := resolvedRestack(t)
	dir, _ := rivalClone(t, clone, layer)
	gitT(t, dir, "push", "-q", "origin", layer)

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "resolution") || !strings.Contains(got.stdout, short(resolved)) {
		t.Fatalf("exit %d, want the conflict's stop to name the resolution in %s\n%s", got.code, short(resolved), got.stdout)
	}
}

// the resolution goes even when the new merge is clean, so the verb's data names it
func TestRestackNamesALostResolutionOnACleanRerun(t *testing.T) {
	t.Parallel()
	const layer = "codie/FRM-1-a-2"
	clone, resolved := resolvedRestack(t)
	// the rival settles the conflict its own way, so the rerun's merge meets none
	dir, _ := rivalClone(t, clone, layer)
	gitT(t, dir, "fetch", "-q", "origin", "codie/FRM-1-a")
	gitT(t, dir, "merge", "-q", "-X", "ours", "--no-edit", "FETCH_HEAD")
	gitT(t, dir, "push", "-q", "origin", layer)

	got := xIn(t, clone, nil, "lane", "restack", "--apply")

	if got.code != 0 || !strings.Contains(got.stdout, short(resolved)) {
		t.Fatalf("exit %d, want a clean rerun naming the lost resolution %s\n%s", got.code, short(resolved), got.stdout)
	}
}
