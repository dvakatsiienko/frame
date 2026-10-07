package main

import (
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func okAnswer(call gqlCall) string {
	var fields []string
	for alias := range call.Variables {
		fields = append(fields, fmt.Sprintf("%q:{\"success\":true}", alias))
	}
	return `{"data":{` + strings.Join(fields, ",") + `}}`
}

func TestLinkSendsOneRelationPerTargetInOneRequest(t *testing.T) {
	server := newFakeLinear(t, okAnswer)
	envelope, got := runLinear(t, server, nil, "linear", "link", "FRM-1", "blocks", "FRM-2", "FRM-3")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	calls := server.requests()
	if len(calls) != 1 || strings.Count(calls[0].Query, "issueRelationCreate(") != 2 {
		t.Fatalf("want one request with two relation aliases, got %d:\n%v", len(calls), calls)
	}
	var sent []string
	for _, input := range calls[0].Variables {
		in := input.(map[string]any)
		sent = append(sent, fmt.Sprintf("%s %s %s", in["issueId"], in["type"], in["relatedIssueId"]))
	}
	got2 := strings.Join(slices.Sorted(slices.Values(sent)), ",")
	if got2 != "FRM-1 blocks FRM-2,FRM-1 blocks FRM-3" {
		t.Errorf("relations sent: %s", got2)
	}
	if data, _ := envelope["data"].(map[string]any); data["actor"] != "cclio" {
		t.Errorf("the write does not print its actor: %s", got.stdout)
	}
}

func TestLinkRefusesAKindLinearDoesNotHave(t *testing.T) {
	server := newFakeLinear(t, okAnswer)
	envelope, got := runLinear(t, server, nil, "linear", "link", "FRM-1", "fixes", "FRM-2")
	if got.code != 2 || !strings.Contains(fmt.Sprint(envelope["error"]), "blocks, related, duplicate") {
		t.Errorf("exit %d, want 2 naming the kinds: %s", got.code, got.stdout)
	}
	if n := len(server.requests()); n != 0 {
		t.Errorf("%d requests for an unknown kind", n)
	}
}

func TestCommentSendsTheFileByteForByte(t *testing.T) {
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"commentCreate":{"success":true,"comment":{"url":"https://linear.app/x-com/issue/FRM-1#comment-1"}}}}`
	})
	body := "a `tick`, a $VAR, \"quotes\", 'single'\nand a second line\n"
	file := filepath.Join(t.TempDir(), "c.md")
	write(t, file, body)
	envelope, got := runLinear(t, server, nil, "linear", "comment", "FRM-1", "--body-file", file)
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	call := server.requests()[0]
	if call.Variables["body"] != body || call.Variables["issue"] != "FRM-1" {
		t.Errorf("sent %q to %v", call.Variables["body"], call.Variables["issue"])
	}
	if data, _ := envelope["data"].(map[string]any); data["actor"] != "cclio" || data["url"] == nil {
		t.Errorf("the envelope misses the actor or the url: %s", got.stdout)
	}
}

func updateServer(projects, initiatives string) func(gqlCall) string {
	return func(call gqlCall) string {
		switch {
		case strings.Contains(call.Query, "projectUpdateCreate"):
			return `{"data":{"projectUpdateCreate":{"success":true,"projectUpdate":{"url":"https://linear.app/u/1"}}}}`
		case strings.Contains(call.Query, "initiativeUpdateCreate"):
			return `{"data":{"initiativeUpdateCreate":{"success":true,"initiativeUpdate":{"url":"https://linear.app/u/2"}}}}`
		}
		return `{"data":{"projects":{"nodes":[` + projects + `]},"initiatives":{"nodes":[` + initiatives + `]}}}`
	}
}

func TestUpdatePostsToTheProjectOrTheInitiativeTheNameFinds(t *testing.T) {
	file := filepath.Join(t.TempDir(), "u.md")
	write(t, file, "the week")
	cases := []struct {
		name, projects, initiatives, mutation, idKey, id string
	}{
		{"a project", `{"id":"p-cli","name":"cli"}`, ``, "projectUpdateCreate", "projectId", "p-cli"},
		{"an initiative", ``, `{"id":"i-x","name":"cli"}`, "initiativeUpdateCreate", "initiativeId", "i-x"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			server := newFakeLinear(t, updateServer(c.projects, c.initiatives))
			if _, got := runLinear(t, server, nil, "linear", "update", "cli", "--body-file", file, "--health", "atRisk"); got.code != 0 {
				t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
			}
			sent := mutations(server)
			if len(sent) != 1 || !strings.Contains(sent[0].Query, c.mutation) {
				t.Fatalf("want one %s, sent %v", c.mutation, sent)
			}
			input, _ := sent[0].Variables["input"].(map[string]any)
			if input[c.idKey] != c.id || input["health"] != "atRisk" || input["body"] != "the week" {
				t.Errorf("input %v", input)
			}
		})
	}
}

func TestUpdateRefusesANameItCannotPinDown(t *testing.T) {
	file := filepath.Join(t.TempDir(), "u.md")
	write(t, file, "the week")
	for name, reply := range map[string][2]string{
		"no match":     {``, ``},
		"two matches":  {`{"id":"p1","name":"cli"}`, `{"id":"i1","name":"cli"}`},
		"a bad health": {`{"id":"p1","name":"cli"}`, ``},
	} {
		t.Run(name, func(t *testing.T) {
			server := newFakeLinear(t, updateServer(reply[0], reply[1]))
			health := "onTrack"
			if name == "a bad health" {
				health = "fine"
			}
			_, got := runLinear(t, server, nil, "linear", "update", "cli", "--body-file", file, "--health", health)
			if got.code == 0 {
				t.Errorf("exit 0: %s", got.stdout)
			}
			if n := len(mutations(server)); n != 0 {
				t.Errorf("%d updates went out", n)
			}
		})
	}
}
