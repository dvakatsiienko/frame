package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// an untracked file in the way: git refuses the merge, and nothing conflicts
func TestMergeMainNamesGitsOwnLineWhenItFailsWithoutConflicts(t *testing.T) {
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
	if got.code != 1 || !strings.Contains(envelope.Error, "untracked working tree files would be overwritten by merge") {
		t.Fatalf("exit %d, envelope error %q", got.code, envelope.Error)
	}
}
