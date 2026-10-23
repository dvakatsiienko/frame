package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

// a ticket whose exit lines live only in the lane's spec, the section a seal writes under .scratch/<feature>/
func preflightSpec(t *testing.T, section string) asRun {
	t.Helper()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-8 — another chunk\n\n### exit lines\n\n1. `x lane gate --dry` is not this ticket's\n\n"+section)
	raw, _ := json.Marshal("## want\n\na thing\n\n## signed\n\n✍️ signed\n")
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})
	_, got := runLinear(t, server, nil, "brief", "preflight", "FRM-1", "--repo", dir)
	return got
}

func TestPreflightReadsTheExitLinesFromTheLaneSpec(t *testing.T) {
	t.Parallel()
	got := preflightSpec(t, "## FRM-1 — this chunk\n\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n")

	if got.code != 0 || !strings.Contains(got.stdout, ".scratch/lane-1/spec.md") {
		t.Fatalf("exit %d, want a pass naming the spec it read\n%s%s", got.code, got.stdout, got.stderr)
	}
}

// the spec holds FRM-8's section above, so FRM-1's first exit line sits on the spec's line 13
func TestPreflightLintsTheLaneSpecsExitLines(t *testing.T) {
	t.Parallel()
	got := preflightSpec(t, "## FRM-1 — this chunk\n\n### exit lines\n\n1. `x lane unlock --dry` prints ok\n2. a redesign of the gate, `x lane unlock` prints ok\n")

	for _, want := range []string{"line 13: flag --dry", "redesign (spec)", "spec.md § FRM-1"} {
		if got.code == 0 || !strings.Contains(got.stdout, want) {
			t.Fatalf("exit %d, want %q: the spec's lines linted at the spec's own line numbers\n%s%s", got.code, want, got.stdout, got.stderr)
		}
	}
}

// .scratch/ is gitignored, so a worktree holds no spec: preflight there reads the main checkout's
func TestPreflightReadsTheLaneSpecFromAWorktree(t *testing.T) {
	t.Parallel()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "## FRM-1 — this chunk\n\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n")
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, dir, "worktree", "add", "-q", "--detach", tree)
	raw, _ := json.Marshal("## want\n\na thing\n")
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})

	_, got := runLinear(t, server, nil, "brief", "preflight", "FRM-1", "--repo", tree)

	if got.code != 0 || !strings.Contains(got.stdout, ".scratch/lane-1/spec.md") {
		t.Fatalf("exit %d, want the main checkout's spec read from a worktree\n%s%s", got.code, got.stdout, got.stderr)
	}
}

func TestPreflightRefusesATicketTwoLaneSpecsHold(t *testing.T) {
	t.Parallel()
	dir := preflightRepo(t)
	for _, lane := range []string{"lane-1", "lane-2"} {
		write(t, filepath.Join(dir, ".scratch", lane, "spec.md"), "## FRM-1 — a chunk\n\n### exit lines\n\n1. `x lane unlock` prints ok\n")
	}
	raw, _ := json.Marshal("## want\n\na thing\n")
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})

	_, got := runLinear(t, server, nil, "brief", "preflight", "FRM-1", "--repo", dir)

	if got.code == 0 || !strings.Contains(got.stdout, "lane-1") || !strings.Contains(got.stdout, "lane-2") {
		t.Fatalf("exit %d, want a refusal naming both specs\n%s", got.code, got.stdout)
	}
}

// a verb main already has is a finding only on a line that claims to add it
func TestPreflightFlagsAVerbOnMainOnlyWhereTheLineClaimsToAddIt(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, line string
		flagged    bool
	}{
		{"adds", "1. adds `x lane unlock` for a locked tree", true},
		{"a new verb", "1. a new verb `x lane unlock` for a locked tree", true},
		{"introduces", "1. `x lane unlock` is what this ticket introduces", true},
		{"a plain mention as a tool", "1. `x lane unlock` prints ok", false},
		{"a word that only contains add", "1. `x lane unlock` reads the address", false},
		{"a claim far from the verb", "1. `x lane unlock` prints ok after the ticket body is read, and a long clause later the page adds a row", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, got := runPreflight(t, exitSection(c.line), "FRM-1")

			if flagged := strings.Contains(got.stdout, "is already a verb on main"); flagged != c.flagged {
				t.Errorf("flagged = %v, exit %d\n%s", flagged, got.code, got.stdout)
			}
		})
	}
}
