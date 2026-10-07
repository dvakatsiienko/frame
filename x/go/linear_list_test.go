package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

const listReply = `{"data":{"issues":{"nodes":[
	{"identifier":"FRM-7","title":"seven","priority":2,"estimate":1,"state":{"name":"Todo","type":"unstarted"},"project":{"name":"cli"},"labels":{"nodes":[{"name":"agent"}]}},
	{"identifier":"FRM-8","title":"eight","priority":3,"estimate":null,"state":{"name":"Todo","type":"unstarted"},"project":null,"labels":{"nodes":[]}}
	],"pageInfo":{"hasNextPage":%s}}}}`

func listAnswer(more string) func(gqlCall) string {
	return func(call gqlCall) string {
		reply := strings.Replace(listReply, "%s", more, 1)
		if strings.Contains(call.Query, "searchIssues") {
			reply = strings.Replace(reply, `"issues"`, `"searchIssues"`, 1)
		}
		return reply
	}
}

func filterOf(t *testing.T, call gqlCall) string {
	t.Helper()
	raw, _ := json.Marshal(call.Variables["filter"])
	return string(raw)
}

func TestListSendsEachNamedFilterInOneRequest(t *testing.T) {
	server := newFakeLinear(t, listAnswer("false"))
	envelope, got := runLinear(t, server, nil, "linear", "list", "--team", "FRM", "--state", "In Progress",
		"--label", "agent,feature", "--project", "cli", "--milestone", "v1")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if n := len(server.requests()); n != 1 {
		t.Fatalf("%d requests, want 1 — names resolve inside the filter", n)
	}
	filter := filterOf(t, server.requests()[0])
	for _, want := range []string{
		`"team":{"key":{"eqIgnoreCase":"FRM"}}`,
		`"state":{"name":{"eqIgnoreCase":"In Progress"}}`,
		`{"labels":{"some":{"name":{"eqIgnoreCase":"agent"}}}}`,
		`{"labels":{"some":{"name":{"eqIgnoreCase":"feature"}}}}`,
		`"project":{"name":{"eqIgnoreCase":"cli"}}`,
		`"projectMilestone":{"name":{"eqIgnoreCase":"v1"}}`,
	} {
		if !strings.Contains(filter, want) {
			t.Errorf("the filter misses %s:\n%s", want, filter)
		}
	}
	rows := tickets(t, envelope)
	if len(rows) != 2 || rows[0]["id"] != "FRM-7" || rows[0]["project"] != "cli" {
		t.Errorf("rows %v", rows)
	}
}

func TestListWithNoStateLeavesClosedTicketsOut(t *testing.T) {
	server := newFakeLinear(t, listAnswer("false"))
	if _, got := runLinear(t, server, nil, "linear", "list"); got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if filter := filterOf(t, server.requests()[0]); !strings.Contains(filter, `"state":{"type":{"nin":["completed","canceled"]}}`) {
		t.Errorf("a bare list does not leave closed tickets out: %s", filter)
	}
}

func TestListSearchSendsTheTerm(t *testing.T) {
	server := newFakeLinear(t, listAnswer("false"))
	envelope, got := runLinear(t, server, nil, "linear", "list", "--search", "keychain cache")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	call := server.requests()[0]
	if !strings.Contains(call.Query, "searchIssues(") || call.Variables["term"] != "keychain cache" {
		t.Errorf("want searchIssues with the term, sent %v\n%s", call.Variables, call.Query)
	}
	if len(tickets(t, envelope)) != 2 {
		t.Errorf("search rows: %s", got.stdout)
	}
}

func TestAnEmptyListNamesTheNameLinearDoesNotKnow(t *testing.T) {
	server := newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "workflowStates") {
			return `{"data":{"state":{"nodes":[]},"label0":{"nodes":[{"id":"l1"}]}}}`
		}
		return `{"data":{"issues":{"nodes":[],"pageInfo":{"hasNextPage":false}}}}`
	})
	envelope, got := runLinear(t, server, nil, "linear", "list", "--state", "Im Progress", "--label", "agent")
	if got.code != 2 || !strings.Contains(fmt.Sprint(envelope["error"]), `no state named "Im Progress"`) {
		t.Errorf("exit %d, want 2 naming the unknown state: %s", got.code, got.stdout)
	}
	if strings.Contains(fmt.Sprint(envelope["error"]), "label") {
		t.Errorf("a known label was reported unknown: %s", envelope["error"])
	}
}

func TestAnEmptyListOfKnownNamesIsJustEmpty(t *testing.T) {
	server := newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "workflowStates") {
			return `{"data":{"state":{"nodes":[{"id":"s1"}]}}}`
		}
		return `{"data":{"issues":{"nodes":[],"pageInfo":{"hasNextPage":false}}}}`
	})
	envelope, got := runLinear(t, server, nil, "linear", "list", "--state", "Canceled")
	if got.code != 0 || fmt.Sprint(envelope["data"].(map[string]any)["count"]) != "0" {
		t.Errorf("exit %d, want an ok empty list: %s", got.code, got.stdout)
	}
}

func TestListMarksACappedPage(t *testing.T) {
	server := newFakeLinear(t, listAnswer("true"))
	envelope, got := runLinear(t, server, nil, "linear", "list", "--team", "FRM")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if data, _ := envelope["data"].(map[string]any); data["capped"] != true {
		t.Errorf("a full page is not marked capped: %s", got.stdout)
	}
}
