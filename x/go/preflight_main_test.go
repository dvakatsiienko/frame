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
	return preflightSpecOf(t, section, "## want\n\na thing\n\n## signed\n\n✍️ signed\n")
}

func preflightSpecOf(t *testing.T, section, ticket string) asRun {
	t.Helper()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-8 — another chunk\n\n### exit lines\n\n1. `x lane gate --dry` is not this ticket's\n\n"+section+"\n## Problem Statement\n")
	raw, _ := json.Marshal(ticket)
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})
	_, got := runLinear(t, server, nil, "brief", "preflight", "FRM-1", "--repo", dir)
	return got
}

// FRM-700 exit 2: the seal is the spec's recorded hash against the hash of the ticket's current text; a ✍️ or ✏️ line decides nothing
func TestPreflightReadsASpecSectionsRecordedSealAgainstTheTicketsText(t *testing.T) {
	t.Parallel()
	const exits = "\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n"
	section := func(wish string) string { return "## FRM-1 — this chunk\n\n" + wish + "\n" + exits }
	ticket := func(want string, lines ...string) string {
		return "## want\n\n" + want + "\n\n## signed\n\n" + strings.Join(lines, "\n\n") + "\n"
	}
	wish := func(hash string) string { return "wish: FRM-1 · body " + hash + " · the contract" }
	old, moved := bodyHash("## want\n\na thing\n\n"), bodyHash("## want\n\na thing and more\n\n")
	// a quick ticket as a dispatch leaves it: its 🚀 line above the stamp, sealed before it
	quick := func(dispatched string) string {
		return "lane: quick\n\n## want\n\na thing\n\n" + dispatched + "⸻ 🪪 stamp — please keep 🙏\n\n## signed\n\n✍️ signed · body 11111111\n"
	}
	cases := []struct {
		name, wish, ticket string
		red                bool
	}{
		{"the text it was sealed on", wish(old), ticket("a thing", "✍️ signed · body "+old), false},
		{"edited under a ✏️ line after the seal", wish(old), ticket("a thing and more", "✍️ signed · body "+old, "✏️ changed · body "+moved), true},
		{"the spec moved to the new hash", wish(moved), ticket("a thing and more", "✍️ signed · body "+old, "✏️ changed · body "+moved), false},
		{"text moved and no sign line says so", wish(old), ticket("a thing and more", "✍️ signed · body "+old), true},
		{"the raw hash of a text that is not normalized", wish(bodyHash("## want\n\na thing\n\n\n")), "## want\n\na thing\n\n\n## signed\n\n✍️ signed\n", false},
		{"no recorded hash", "wish: FRM-1 · the contract", ticket("a thing", "✍️ signed · body def67890"), false},
		{"sealed before its dispatch line was written", wish(bodyHash("lane: quick\n\n## want\n\na thing\n\n⸻ 🪪 stamp — please keep 🙏\n\n")), quick("🚀 dispatched 2026-11-24 — l, codie s, main:abc1234\n\n"), false},
		{"sealed before a take-back line was written", wish(bodyHash("lane: quick\n\n## want\n\na thing\n\n⸻ 🪪 stamp — please keep 🙏\n\n")), quick("↩️ taken back 2026-11-24\n\n"), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			got := preflightSpecOf(t, section(c.wish), c.ticket)
			if red := got.code != 0; red != c.red {
				t.Fatalf("exit %d, want red %v\n%s%s", got.code, c.red, got.stdout, got.stderr)
			}
			if c.red && !(strings.Contains(got.stdout, old) && strings.Contains(got.stdout, bodySignHash(c.ticket)) && strings.Contains(got.stdout, "text moved since the seal")) {
				t.Errorf("the red names not both hashes and the moved text:\n%s", got.stdout)
			}
		})
	}
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

// FRM-572 exit 8: a wish-block W-line is dima's words, which may name a redesign; only the plan's own lines want a grill
func TestPreflightSkipsAWishLinesGrillWord(t *testing.T) {
	t.Parallel()
	ticket := "## wish\n\n* FRM-1:W1 (2026-11-11, dima): let's redesign the gate\n- W2 (dima): simplify it\n\n## signed\n\n✍️ signed\n"
	got := preflightSpecOf(t, "## FRM-1 — this chunk\n\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n", ticket)

	if got.code != 0 || strings.Contains(got.stdout, "redesign") || strings.Contains(got.stdout, "simplify") {
		t.Fatalf("exit %d, want the W-lines' words unread by the grill lint\n%s%s", got.code, got.stdout, got.stderr)
	}
}

// .scratch/ is gitignored, so a worktree holds no spec: preflight there reads the main checkout's
func TestPreflightReadsTheLaneSpecFromAWorktree(t *testing.T) {
	t.Parallel()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "## FRM-1 — this chunk\n\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n"+"\n## Problem Statement\n")
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

// a worktree's spec for another feature never hides the main checkout's; a stale copy of the same section refuses
func TestPreflightReadsTheMainCheckoutsSpecBesideAWorktreesOwn(t *testing.T) {
	t.Parallel()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "## FRM-1 — this chunk\n\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n"+"\n## Problem Statement\n")
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, dir, "worktree", "add", "-q", "--detach", tree)
	write(t, filepath.Join(tree, ".scratch/lane-9/spec.md"), "## FRM-9 — another chunk\n\n### exit lines\n\n1. `x lane unlock` prints ok\n"+"\n## Problem Statement\n")
	raw, _ := json.Marshal("## want\n\na thing\n")
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})

	_, got := runLinear(t, server, nil, "brief", "preflight", "FRM-1", "--repo", tree)

	if got.code != 0 || !strings.Contains(got.stdout, ".scratch/lane-1/spec.md") {
		t.Fatalf("exit %d, want main's spec read past the worktree's other one\n%s%s", got.code, got.stdout, got.stderr)
	}
}

func TestPreflightRefusesATicketTwoLaneSpecsHold(t *testing.T) {
	t.Parallel()
	dir := preflightRepo(t)
	for _, lane := range []string{"lane-1", "lane-2"} {
		write(t, filepath.Join(dir, ".scratch", lane, "spec.md"), "## Problem Statement\n\n## FRM-1 — a chunk\n\n### exit lines\n\n1. `x lane unlock` prints ok\n"+"\n## Problem Statement\n")
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

// a spec with exit lines and no to-spec section: the seal skipped matt's step
func TestPreflightRefusesASpecThatNeverRanToSpec(t *testing.T) {
	t.Parallel()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "## FRM-1 — this chunk\n\n### exit lines\n\n1. given a tree, when `x lane unlock` runs, then it prints ok\n")
	raw, _ := json.Marshal("## want\n\na thing\n")
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})

	_, got := runLinear(t, server, nil, "brief", "preflight", "FRM-1", "--repo", dir)

	if got.code == 0 || !strings.Contains(got.stdout, "never ran matt's to-spec") {
		t.Fatalf("exit %d, want the missing to-spec named\n%s%s", got.code, got.stdout, got.stderr)
	}
}
