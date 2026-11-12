package main

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// a ticket carrying `carried` labels; linear holds clio-main and clio-wing-2 in the workspace
func ownerServer(t *testing.T, carried string) *fakeLinear {
	issue := `"issue":{"id":"uuid-1","identifier":"FRM-1","description":"the body","updatedAt":"2026-10-07T10:00:00.000Z","priority":3,"state":{"name":"Todo"},
		"team":{"id":"t-frm","states":{"nodes":[{"id":"s-ip","name":"In Progress"}]}},"labels":{"nodes":[` + carried + `]}}`
	owners := `"ownerLabels":{"nodes":[{"id":"l-main","name":"clio-main","team":null},{"id":"l-wing-2","name":"clio-wing-2","team":null}]}`
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "mutation") {
			return `{"data":{"issueUpdate":{"success":true,"issue":{"updatedAt":"2026-10-07T12:00:00.000Z"}}}}`
		}
		return `{"data":{` + issue + `,` + owners + `,"users":{"nodes":[{"id":"u-codie","name":"codie"}]}}}`
	})
}

// the owner a write sent: the labels added and removed, in the one mutation
func ownerSent(t *testing.T, server *fakeLinear) string {
	t.Helper()
	sent := mutations(server)
	if len(sent) != 1 {
		t.Fatalf("%d mutations, want 1", len(sent))
	}
	input, _ := sent[0].Variables["input"].(map[string]any)
	return fmt.Sprint(input["addedLabelIds"], input["removedLabelIds"])
}

// FRM-572 exits 1–3: a clio's claim carries its owner label, a handover swaps it, a member's write touches none
func TestAClaimCarriesItsOwnerLabel(t *testing.T) {
	t.Parallel()
	const main, wing2 = `{"id":"l-main","name":"clio-main"}`, `{"id":"l-wing-2","name":"clio-wing-2"}`
	writes := map[string][]string{
		"in progress": {"linear", "set", "FRM-1", "--state", "In Progress"},
		"a delegate":  {"linear", "set", "FRM-1", "--delegate", "codie"},
	}
	for _, c := range []struct {
		name, role, carried, want string
	}{
		{"main claims an unlabelled ticket", "coordinator", "", "[l-main] <nil>"},
		{"a wing claims an unlabelled ticket", "wing", "", "[l-wing-2] <nil>"},
		{"a wing takes main's ticket", "wing", main, "[l-wing-2] [l-main]"},
		{"main takes a wing's ticket back", "coordinator", wing2, "[l-main] [l-wing-2]"},
		{"main's own ticket stays", "coordinator", main, "<nil> <nil>"},
		{"a codie's write", "codie", main, "<nil> <nil>"},
		{"a sixth sense's write", "sixth-sense", "", "<nil> <nil>"},
		{"a session with no record", "", "", "<nil> <nil>"},
	} {
		for write, argv := range writes {
			t.Run(c.name+", "+write, func(t *testing.T) {
				t.Parallel()
				server := ownerServer(t, c.carried)
				_, got := runLinear(t, server, sessionsFixture(t, "🦉🪽 clio: wing 2", c.role), argv...)
				if got.code != 0 {
					t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
				}
				if sent := ownerSent(t, server); sent != c.want {
					t.Errorf("labels added and removed %s, want %s", sent, c.want)
				}
			})
		}
	}
}

func TestABodyWriteCarriesItsOwnerLabel(t *testing.T) {
	t.Parallel()
	server := ownerServer(t, `{"id":"l-main","name":"clio-main"}`)
	env := append(sessionsFixture(t, "any name", "wing"), "X_STATE="+t.TempDir())
	file := filepath.Join(t.TempDir(), "body.md")
	if _, got := runLinear(t, server, env, "linear", "body", "FRM-1", "--to", file); got.code != 0 {
		t.Fatalf("the pull: exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	write(t, file, "the body, edited")
	if _, got := runLinear(t, server, env, "linear", "body", "FRM-1", "--set", file); got.code != 0 {
		t.Fatalf("the set: exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}

	if sent := ownerSent(t, server); sent != "[l-wing-2] [l-main]" {
		t.Errorf("labels added and removed %s, want the wing's owner in and main's out", sent)
	}
}

// W2: the label words live once in x, so a rename of a linear label is one line
func TestTheOwnerLabelWordsLiveInOnePlace(t *testing.T) {
	t.Parallel()
	files, _ := filepath.Glob("*.go")
	var holders []string
	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}
		raw, _ := os.ReadFile(file)
		if strings.Contains(string(raw), `"clio-main"`) || strings.Contains(string(raw), `"clio-wing-"`) {
			holders = append(holders, file)
		}
	}
	if !slices.Equal(holders, []string{"linear_set.go"}) {
		t.Errorf("the owner words sit in %v, want linear_set.go alone", holders)
	}
}
