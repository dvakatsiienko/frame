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
	if data, _ := envelope["data"].(map[string]any); data["actor"] != "cclio" {
		t.Errorf("the write does not print its actor: %s", got.stdout)
	}
}

func TestBodySetRefusesWhenTheTicketMovedSinceThePull(t *testing.T) {
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
