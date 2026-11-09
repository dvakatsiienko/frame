package main

import (
	"errors"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// git grep's ERE, so a plain group
const citedDoc = `docs/(research|test-drive)/[A-Za-z0-9_./-]+\.md`

// a research or test-drive doc that memory, a skill or clio cites is read as instructions, so it is never light; the
// pocket, the gazette and scratch are history, never a cite
func TestMergeAutoReadsEveryCitedDocAsMemory(t *testing.T) {
	t.Parallel()
	root, _ := filepath.Abs("../..")
	c := exec.Command("git", "grep", "-ohE", citedDoc, "--", "home/.claude", "_clio", "_crow",
		":(exclude)_clio/pocket", ":(exclude)_clio/gazette", ":(exclude)**/.scratch/**")
	c.Dir, c.Env = root, cleanEnv()
	out, err := c.Output()
	// git grep exits 1 for «no match»; anything else is a broken search, never a pass
	if exit, ok := errors.AsType[*exec.ExitError](err); err != nil && (!ok || exit.ExitCode() != 1) {
		t.Fatalf("git grep: %v", err)
	}
	cited := slices.Compact(slices.Sorted(slices.Values(strings.Fields(string(out)))))
	if len(cited) == 0 {
		t.Fatal("no cited doc found — the check would pass by having nothing to check")
	}
	for _, doc := range cited {
		if tier := tierOf([]string{doc}); tier.Tier == "light" {
			t.Errorf("%s is cited as instructions and reads light: add it to risky.json's memory", doc)
		}
	}
}
