package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// the one lookup `set` sends answers everything at once; a mutation answers success
const setLookupReply = `{"data":{
	"issue":{"id":"uuid-1","identifier":"FRM-1","priority":3,"estimate":1,"state":{"name":"Todo"},"parent":null,"delegate":null,
		"project":{"id":"p-old","name":"old","projectMilestones":{"nodes":[{"id":"m-old","name":"v0"}]}},"projectMilestone":null,
		"team":{"id":"t-frm","states":{"nodes":[{"id":"s-todo","name":"Todo"},{"id":"s-ip","name":"In Progress"}]}},
		"labels":{"nodes":[{"id":"l-agent","name":"agent"},{"id":"l-human","name":"human"},{"id":"l-bug","name":"bug"}]}},
	"labels":{"nodes":[{"id":"l-feature-byt","name":"feature","team":{"id":"t-byt"}},{"id":"l-feature","name":"feature","team":null}]},
	"parent":{"id":"uuid-9","identifier":"FRM-9"},
	"projects":{"nodes":[{"id":"p-cli","name":"cli","projectMilestones":{"nodes":[{"id":"m-v1","name":"v1"}]}}]},
	"users":{"nodes":[{"id":"u-coder","name":"coder"}]}}}`

func setServer(t *testing.T) *fakeLinear {
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "mutation") {
			return `{"data":{"issueUpdate":{"success":true}}}`
		}
		return setLookupReply
	})
}

func updateInput(t *testing.T, server *fakeLinear) map[string]any {
	t.Helper()
	sent := mutations(server)
	if len(sent) != 1 {
		t.Fatalf("%d mutations, want 1", len(sent))
	}
	input, _ := sent[0].Variables["input"].(map[string]any)
	return input
}

func TestSetSendsEveryFieldResolvedInOneUpdate(t *testing.T) {
	server := setServer(t)
	envelope, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--state", "in progress", "--priority", "2",
		"--estimate", "3", "--parent", "FRM-9", "--project", "cli", "--milestone", "v1", "--delegate", "coder")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if n := len(server.requests()); n != 2 {
		t.Errorf("%d requests, want one lookup and one update", n)
	}
	want := map[string]any{"stateId": "s-ip", "priority": float64(2), "estimate": float64(3), "parentId": "uuid-9",
		"projectId": "p-cli", "projectMilestoneId": "m-v1", "delegateId": "u-coder"}
	input := updateInput(t, server)
	for key, value := range want {
		if input[key] != value {
			t.Errorf("input.%s = %v, want %v", key, input[key], value)
		}
	}
	if _, has := input["labelIds"]; has {
		t.Error("labels went out though no label flag was given")
	}
	changes, _ := json.Marshal(envelope["data"].(map[string]any)["changes"])
	if !strings.Contains(string(changes), `"state: Todo → In Progress"`) {
		t.Errorf("changes do not read field: old → new: %s", changes)
	}
}

func TestSetKeepsEveryLabelItWasNotToldToTouch(t *testing.T) {
	server := setServer(t)
	if _, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--add-label", "Feature", "--remove-label", "human"); got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	// deltas, never the whole set: a label another writer adds between x's read and its write survives
	input := updateInput(t, server)
	if _, has := input["labelIds"]; has {
		t.Errorf("the update replaced the whole label set: %v", input)
	}
	if fmt.Sprint(input["addedLabelIds"]) != "[l-feature]" || fmt.Sprint(input["removedLabelIds"]) != "[l-human]" {
		t.Errorf("added %v removed %v, want [l-feature] (the workspace one) and [l-human]", input["addedLabelIds"], input["removedLabelIds"])
	}
}

func TestSetRefusesAnUnknownNameAndListsTheValidOnes(t *testing.T) {
	server := setServer(t)
	envelope, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--state", "Doing")
	msg := fmt.Sprint(envelope["error"])
	if got.code != 1 || !strings.Contains(msg, "Todo") || !strings.Contains(msg, "In Progress") {
		t.Errorf("exit %d, want 1 listing the valid states: %s", got.code, got.stdout)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d mutations went out for an unknown state", n)
	}
}

func TestSetRefusesToRemoveALabelTheTicketLacks(t *testing.T) {
	server := setServer(t)
	envelope, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--remove-label", "nope")
	if got.code != 1 || !strings.Contains(fmt.Sprint(envelope["error"]), "agent, human, bug") {
		t.Errorf("exit %d, want 1 naming the ticket's labels: %s", got.code, got.stdout)
	}
	if n := len(mutations(server)); n != 0 {
		t.Errorf("%d updates went out for a label the ticket lacks", n)
	}
}

func TestSetWithNoFieldIsUsage(t *testing.T) {
	server := setServer(t)
	if _, got := runLinear(t, server, nil, "linear", "set", "FRM-1"); got.code != 2 {
		t.Errorf("exit %d, want 2", got.code)
	}
	if n := len(server.requests()); n != 0 {
		t.Errorf("%d requests for a set with nothing to set", n)
	}
}
