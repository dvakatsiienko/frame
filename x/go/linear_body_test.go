package main

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

// a ticket whose updatedAt the test can move, the way a peer's edit would
func bodyServer(t *testing.T, updatedAt *atomic.Value) *fakeLinear {
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "issueUpdate") {
			return `{"data":{"issueUpdate":{"success":true,"issue":{"updatedAt":"2026-10-07T12:00:00.000Z"}}}}`
		}
		return fmt.Sprintf(`{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":"the body\nwith $VAR and `+"`ticks`"+`","updatedAt":%q}}}`, updatedAt.Load())
	})
}

func mutations(server *fakeLinear) []gqlCall {
	var sent []gqlCall
	for _, call := range server.requests() {
		if strings.Contains(call.Query, "mutation") {
			sent = append(sent, call)
		}
	}
	return sent
}

// runBody shares one X_STATE across calls, so a pull is still there for the set that follows
func runBody(t *testing.T, server *fakeLinear, state string, argv ...string) (map[string]any, asRun) {
	return runLinear(t, server, []string{"X_STATE=" + state}, append([]string{"linear", "body"}, argv...)...)
}

func TestBodyPullsTheDescriptionToAFile(t *testing.T) {
	t.Parallel()
	var updated atomic.Value
	updated.Store("2026-10-07T10:00:00.000Z")
	server := bodyServer(t, &updated)
	file := filepath.Join(t.TempDir(), "body.md")
	envelope, got := runBody(t, server, t.TempDir(), "FRM-1", "--to", file)
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if body := read(t, file); body != "the body\nwith $VAR and `ticks`" {
		t.Errorf("the file holds %q", body)
	}
	if data, _ := envelope["data"].(map[string]any); data["file"] != file {
		t.Errorf("the envelope does not name the file: %s", got.stdout)
	}
}

func TestBodySetWritesTheFileBackWhenTheTicketIsUnchanged(t *testing.T) {
	t.Parallel()
	var updated atomic.Value
	updated.Store("2026-10-07T10:00:00.000Z")
	server := bodyServer(t, &updated)
	state, file := t.TempDir(), filepath.Join(t.TempDir(), "body.md")
	runBody(t, server, state, "FRM-1", "--to", file)
	write(t, file, "edited body")
	envelope, got := runBody(t, server, state, "FRM-1", "--set", file)
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	sent := mutations(server)
	if len(sent) != 1 {
		t.Fatalf("%d mutations, want 1", len(sent))
	}
	if input, _ := json.Marshal(sent[0].Variables); !strings.Contains(string(input), `"description":"edited body"`) {
		t.Errorf("the mutation sent %s", input)
	}
	if data, _ := envelope["data"].(map[string]any); data["actor"] != "clio" {
		t.Errorf("the write does not print its actor: %s", got.stdout)
	}
}

func TestBodySetRefusesWhenTheTicketMovedSinceThePull(t *testing.T) {
	t.Parallel()
	var updated atomic.Value
	updated.Store("2026-10-07T10:00:00.000Z")
	server := bodyServer(t, &updated)
	state, file := t.TempDir(), filepath.Join(t.TempDir(), "body.md")
	runBody(t, server, state, "FRM-1", "--to", file)
	updated.Store("2026-10-07T11:30:00.000Z")
	write(t, file, "edited body")
	envelope, got := runBody(t, server, state, "FRM-1", "--set", file)
	if got.code != 1 || !strings.Contains(fmt.Sprint(envelope["error"]), "changed") {
		t.Errorf("exit %d, want 1 saying the ticket changed: %s", got.code, got.stdout)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d mutations went out over a peer's edit", n)
	}
	if next := fmt.Sprint(envelope["next"]); !strings.Contains(next, "diff") {
		t.Errorf("next %q does not show the drift", next)
	}
}

func TestBodySetRefusesWithoutAPull(t *testing.T) {
	t.Parallel()
	var updated atomic.Value
	updated.Store("2026-10-07T10:00:00.000Z")
	server := bodyServer(t, &updated)
	file := filepath.Join(t.TempDir(), "body.md")
	write(t, file, "edited body")
	envelope, got := runBody(t, server, t.TempDir(), "FRM-1", "--set", file)
	if got.code != 1 || envelope["next"] != "x linear body FRM-1" {
		t.Errorf("exit %d next %v, want 1 and the pull command", got.code, envelope["next"])
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d mutations went out with no pull", n)
	}
}

// a ticket that takes a write the way linear does: the body becomes the file and updatedAt moves
func liveBodyServer(t *testing.T, body string) *fakeLinear {
	var current atomic.Value
	var writes atomic.Int32
	current.Store(body)
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "issueUpdate") {
			current.Store(call.Variables["description"])
			at := fmt.Sprintf("2026-10-07T10:%02d:00.000Z", writes.Add(1))
			return fmt.Sprintf(`{"data":{"issueUpdate":{"success":true,"issue":{"updatedAt":%q}}}}`, at)
		}
		at := fmt.Sprintf("2026-10-07T10:%02d:00.000Z", writes.Load())
		return fmt.Sprintf(`{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":%q,"updatedAt":%q}}}`, current.Load(), at)
	})
}

// pull the ticket, write the edit over the pulled file, set it back
func setAfterPull(t *testing.T, server *fakeLinear, edit string, flags ...string) (map[string]any, asRun) {
	t.Helper()
	state, file := t.TempDir(), filepath.Join(t.TempDir(), "body.md")
	if _, got := runBody(t, server, state, "FRM-1", "--to", file); got.code != 0 {
		t.Fatalf("the pull: exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	write(t, file, edit)
	return runBody(t, server, state, append([]string{"FRM-1", "--set", file}, flags...)...)
}

func TestBodySetRefusesAFileUnderAFifthOfThePull(t *testing.T) {
	t.Parallel()
	pulled := strings.Repeat("a", 1000)
	cases := []struct {
		name    string
		size    int
		flags   []string
		refused bool
	}{
		{"under a fifth", 199, nil, true},
		{"a fifth", 200, nil, false},
		{"under a fifth with --shrink", 199, []string{"--shrink"}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := liveBodyServer(t, pulled)
			envelope, got := setAfterPull(t, server, strings.Repeat("b", c.size), c.flags...)
			if refused := got.code == 1 && len(mutations(server)) == 0; refused != c.refused {
				t.Fatalf("exit %d, %d mutations, want refused %v: %s", got.code, len(mutations(server)), c.refused, got.stdout)
			}
			if said := fmt.Sprint(envelope["error"]); c.refused && (!strings.Contains(said, "199") || !strings.Contains(said, "1000")) {
				t.Errorf("the refusal does not name both sizes: %s", said)
			}
			if next := fmt.Sprint(envelope["next"]); c.refused && !strings.Contains(next, "--shrink") {
				t.Errorf("next %q does not name --shrink", next)
			}
		})
	}
}

func TestBodySetMeasuresALaterSetAgainstThePull(t *testing.T) {
	t.Parallel()
	server := liveBodyServer(t, strings.Repeat("a", 1000))
	state, file := t.TempDir(), filepath.Join(t.TempDir(), "body.md")
	if _, got := runBody(t, server, state, "FRM-1", "--to", file); got.code != 0 {
		t.Fatalf("the pull: exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	write(t, file, strings.Repeat("b", 250))
	if _, got := runBody(t, server, state, "FRM-1", "--set", file); got.code != 0 {
		t.Fatalf("a set at a quarter of the pull: exit %d\n%s", got.code, got.stdout)
	}
	// a fifth of the 250 just written, far under a fifth of the 1000 pulled
	write(t, file, strings.Repeat("c", 60))

	envelope, got := runBody(t, server, state, "FRM-1", "--set", file)

	if said := fmt.Sprint(envelope["error"]); got.code != 1 || len(mutations(server)) != 1 || !strings.Contains(said, "1000") {
		t.Errorf("exit %d, %d mutations, want the second cut refused against the 1000 pulled: %s", got.code, len(mutations(server)), got.stdout)
	}
}

func TestBodySetRefusesAnEmptyFile(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, edit string
		flags      []string
	}{
		{"no bytes", "", nil},
		{"only blank lines", "\n \n", nil},
		{"no bytes with --shrink", "", []string{"--shrink"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := liveBodyServer(t, "the body")
			envelope, got := setAfterPull(t, server, c.edit, c.flags...)
			if got.code != 1 || len(mutations(server)) != 0 || !strings.Contains(fmt.Sprint(envelope["error"]), "empty") {
				t.Errorf("exit %d, %d mutations, want 1 and none, saying empty: %s", got.code, len(mutations(server)), got.stdout)
			}
		})
	}
}

// a body quotes other wishes beside its own: a W-line is its whole id, the home it came from and its number
func TestBodySetTellsWLinesOfTwoWishesApart(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, pulled, edit string
		lost               string
	}{
		{"the ticket's own W5 gone, another wish's W5 kept",
			"## wish\n\n- PK-363:W5 (dima): one\n- FRM-384:W5 (dima): two\n", "## wish\n\n- PK-363:W5 (dima): one\n", "FRM-384:W5"},
		{"another wish's W5 gone, the ticket's own kept",
			"## wish\n\n- PK-363:W5 (dima): one\n- FRM-384:W5 (dima): two\n", "## wish\n\n- FRM-384:W5 (dima): two\n", "PK-363:W5"},
		{"a bare W1 gone beside a homed W1",
			"## wish\n\n* W1 (dima): the ticket's own\n* PK-9:W1 (dima): quoted\n", "## wish\n\n* PK-9:W1 (dima): quoted\n", "W1"},
		{"a bare W1 given the ticket's own id is the same line",
			"## wish\n\n* W1 (dima): the ticket's own\n", "## wish\n\n* FRM-1:W1 (dima): the ticket's own\n", ""},
		{"a linked id and a plain one are the same line",
			"## wish\n\n* [PK-9](https://x.test/PK-9):W1 (dima): a thing\n", "## wish\n\n* PK-9:W1 (dima): a thing\n", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := liveBodyServer(t, c.pulled)
			envelope, got := setAfterPull(t, server, c.edit, "--shrink")
			said := fmt.Sprint(envelope["error"])
			if refused := got.code == 1 && len(mutations(server)) == 0; refused != (c.lost != "") || !strings.Contains(said, c.lost) {
				t.Errorf("exit %d, %d mutations, want refused %v naming %q: %s", got.code, len(mutations(server)), c.lost != "", c.lost, got.stdout)
			}
		})
	}
}

func TestBodySetRefusesALostWLine(t *testing.T) {
	t.Parallel()
	const pulled = "## wish\n\n* FRM-1:W1 (2026-10-30, dima): a thing\n* FRM-1:W2 (2026-10-30, dima): another\n\n## decided\n\n* a call\n"
	cases := []struct {
		name, edit string
		lost       string
	}{
		{"a W-line gone", "## wish\n\n* FRM-1:W1 (2026-10-30, dima): a thing\n\n## decided\n\n* a call\n", "W2"},
		{"every W-line kept, one reworded", strings.Replace(pulled, "another", "another, in the full id shape", 1), ""},
		{"a W-line added", strings.Replace(pulled, "\n\n## decided", "\n* FRM-1:W3 (2026-11-10, dima): a third\n\n## decided", 1), ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := liveBodyServer(t, pulled)
			envelope, got := setAfterPull(t, server, c.edit)
			if c.lost == "" {
				if got.code != 0 || len(mutations(server)) != 1 {
					t.Errorf("exit %d, %d mutations, want the write: %s", got.code, len(mutations(server)), got.stdout)
				}
				return
			}
			if said := fmt.Sprint(envelope["error"]); got.code != 1 || len(mutations(server)) != 0 || !strings.Contains(said, c.lost) || strings.Contains(said, "W1") {
				t.Errorf("exit %d, %d mutations, want a refusal naming only %s: %s", got.code, len(mutations(server)), c.lost, got.stdout)
			}
		})
	}
}

func TestBodySetHoldsASignedBlock(t *testing.T) {
	t.Parallel()
	const above = "## wish\n\n* FRM-1:W1 (2026-10-30, dima): a thing\n\n"
	const block = "## signed\n\n✍️ signed 2026-10-23 · body c2146ea6\nmerge: pre-approved\n"
	const changed = "✏️ changed 2026-11-10 — a typo, no re-sign: tiny · body 897d6b90\n"
	cases := []struct {
		name, pulled, edit string
		refused            bool
	}{
		{"the body edited, the block as it was", above + block, above + "more\n\n" + block, true},
		{"an old line gone", above + block, above + "## signed\n\n✍️ signed 2026-10-23 · body c2146ea6\n" + changed, true},
		{"an old line changed", above + block, above + strings.Replace(block, "c2146ea6", "00000000", 1) + changed, true},
		{"the block gone", above + block, above + "more\n", true},
		{"one changed line gained", above + block, above + "more\n\n" + block + changed, false},
		{"a ticket with no sign block", above, above + "more\n", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := liveBodyServer(t, c.pulled)
			envelope, got := setAfterPull(t, server, c.edit)
			if refused := got.code == 1 && len(mutations(server)) == 0; refused != c.refused {
				t.Fatalf("exit %d, %d mutations, want refused %v: %s", got.code, len(mutations(server)), c.refused, got.stdout)
			}
			if said := fmt.Sprint(envelope["error"]) + fmt.Sprint(envelope["next"]); c.refused && !strings.Contains(said, "ticket-sign.ts changed") {
				t.Errorf("the refusal does not name the sign door: %s", got.stdout)
			}
		})
	}
}

// the 11-07 incident: two sessions pull one ticket, one sets, the other sets its older file
func TestBodySetRefusesAnOlderFileAfterAPeersSet(t *testing.T) {
	t.Parallel()
	server := liveBodyServer(t, "the body, as both sessions pulled it")
	state := t.TempDir()
	as := func(session string, argv ...string) (map[string]any, asRun) {
		return runLinear(t, server, []string{"X_STATE=" + state, "CLAUDE_CODE_SESSION_ID=" + session}, append([]string{"linear", "body", "FRM-1"}, argv...)...)
	}
	fileOf := func(envelope map[string]any) string {
		data, _ := envelope["data"].(map[string]any)
		return fmt.Sprint(data["file"])
	}
	mine, _ := as("session-one")
	theirs, _ := as("session-two")
	if fileOf(mine) == fileOf(theirs) || !exists(fileOf(mine)) {
		t.Fatalf("two sessions pulled into %s and %s, want a file each", fileOf(mine), fileOf(theirs))
	}
	write(t, fileOf(theirs), "the body, stamped by the peer")
	if _, got := as("session-two", "--set", fileOf(theirs)); got.code != 0 {
		t.Fatalf("the peer's set: exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	write(t, fileOf(mine), "the body, as both sessions pulled it, with my older edit")

	envelope, got := as("session-one", "--set", fileOf(mine))

	if got.code != 1 || !strings.Contains(fmt.Sprint(envelope["error"]), "changed since the pull") {
		t.Errorf("exit %d, want 1 saying the ticket changed: %s", got.code, got.stdout)
	}
	if sent := mutations(server); len(sent) != 1 {
		t.Errorf("%d mutations, want the peer's one", len(sent))
	}
}
