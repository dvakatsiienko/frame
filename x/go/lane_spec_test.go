package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// FRM-572: a bytes lane's spec lives in bytes and heads its chunk as an h1; landed finds it there
func TestLandedReadsAnH1SpecInTheLanesOwnRepo(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, ".scratch/lane-1/spec.md"), "# FRM-1 — the chunk\n\n### exit lines\n\n1. a line\n")
	frame := repo(t)

	envelope, got := runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + frame, stubPnpm(t)}, "lane", "landed", "FRM-1", "--repo", w.repo)

	if out := linesOf(envelope); !strings.Contains(out, "lane-1 is not archived") {
		t.Fatalf("exit %d: want the spec found in the lane's repo\n%s", got.code, out)
	}
}

// an h1 section keeps its own h2s, its exit lines among them, and stops at the next h1
func TestAnH1SpecSectionRunsToTheNextH1(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	write(t, filepath.Join(dir, ".scratch/f/spec.md"), "# the lane\n\n# BYT-9\n\n### decisions\n\n## BYT-9 exit lines\n\n1. the line\n\n# BYT-10\n\n1. not this\n")

	paths, section := laneSpecSection(dir, "BYT-9")

	if len(paths) != 1 || !strings.Contains(section, "1. the line") || strings.Contains(section, "not this") {
		t.Fatalf("paths %v, section:\n%s", paths, section)
	}
}
