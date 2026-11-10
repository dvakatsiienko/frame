package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// a clone on a side branch, with origin's main one commit ahead
func mainAhead(t *testing.T) (clone string) {
	t.Helper()
	origin := repo(t)
	clone = filepath.Join(t.TempDir(), "clone")
	gitT(t, origin, "clone", "-q", origin, clone)
	gitT(t, clone, "switch", "-q", "-c", "side")
	write(t, filepath.Join(origin, "new.txt"), "from main\n")
	gitT(t, origin, "add", "new.txt")
	gitT(t, origin, "commit", "-q", "-m", "add new.txt")
	return clone
}

func TestMergeMainRefusesOverStagedWorkBeforeItMerges(t *testing.T) {
	t.Parallel()
	clone := mainAhead(t)
	head := gitT(t, clone, "rev-parse", "HEAD")
	write(t, filepath.Join(clone, "mine.txt"), "staged, in no one's way\n")
	write(t, filepath.Join(clone, "sub/other.txt"), "staged too\n")
	gitT(t, clone, "add", "mine.txt", "sub/other.txt")

	got := xIn(t, clone, nil, "lane", "merge-main")

	said := envelopeOf(got).Error
	if got.code != 1 || !strings.Contains(said, "mine.txt") || !strings.Contains(said, "sub/other.txt") {
		t.Fatalf("exit %d, error %q, want 1 naming both staged files", got.code, said)
	}
	commit, again := strings.Index(got.next, "x lane commit"), strings.Index(got.next, "x lane merge-main")
	if commit < 0 || again < commit || !strings.Contains(got.next, "mine.txt sub/other.txt") {
		t.Errorf("next %q, want the commit of the staged files, then merge-main again", got.next)
	}
	if now := gitT(t, clone, "rev-parse", "HEAD"); now != head || exists(filepath.Join(clone, "new.txt")) {
		t.Errorf("HEAD %s, was %s: the merge ran over staged work", short(now), short(head))
	}
}

func TestMergeMainMergesOverAnUnstagedEdit(t *testing.T) {
	t.Parallel()
	clone := mainAhead(t)
	write(t, filepath.Join(clone, "readme.txt"), "an edit, not staged\n")

	got := xIn(t, clone, nil, "lane", "merge-main")

	if got.code != 0 || !exists(filepath.Join(clone, "new.txt")) {
		t.Fatalf("exit %d, want main merged in:\n%s", got.code, got.stdout)
	}
}

// an untracked file in the way: git refuses the merge, and nothing conflicts
func TestMergeMainNamesGitsOwnLineWhenItFailsWithoutConflicts(t *testing.T) {
	t.Parallel()
	origin := repo(t)
	clone := filepath.Join(t.TempDir(), "clone")
	gitT(t, origin, "clone", "-q", origin, clone)
	gitT(t, clone, "switch", "-q", "-c", "side")
	write(t, filepath.Join(origin, "new.txt"), "from main\n")
	gitT(t, origin, "add", "new.txt")
	gitT(t, origin, "commit", "-q", "-m", "add new.txt")
	write(t, filepath.Join(clone, "new.txt"), "mine, untracked\n")

	got := xIn(t, clone, nil, "lane", "merge-main")

	var envelope struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	if got.code != 1 || !strings.Contains(envelope.Error, "untracked working tree files would be overwritten by merge: new.txt") {
		t.Fatalf("exit %d, envelope error %q", got.code, envelope.Error)
	}
}
