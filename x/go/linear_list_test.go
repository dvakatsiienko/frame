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
	t.Parallel()
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
	t.Parallel()
	server := newFakeLinear(t, listAnswer("false"))
	if _, got := runLinear(t, server, nil, "linear", "list"); got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if filter := filterOf(t, server.requests()[0]); !strings.Contains(filter, `"state":{"type":{"nin":["completed","canceled"]}}`) {
		t.Errorf("a bare list does not leave closed tickets out: %s", filter)
	}
}

func TestListSearchSendsTheTerm(t *testing.T) {
	t.Parallel()
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
	t.Parallel()
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
	t.Parallel()
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

func TestTheSignedListReadsEachSignAgainstItsBody(t *testing.T) {
	t.Parallel()
	signedAs := "lane: side\n\nsee FRM-12, PK-3 and https://e.com/a\n\n"
	linked := "lane: side\n\nsee [FRM-12](https://linear.app/x-com/issue/FRM-12/s) and [https://e.com/b](https://e.com/b)\n\n"
	cases := []struct{ id, body, want string }{
		{"FRM-1", signedBody("lane: side\n\nedited after the sign\n\n", "", signedAs), signDrifted},
		{"FRM-2", signedBody("lane: side\n\nsee [FRM-12](https://linear.app/x-com/issue/FRM-12/s), [PK-3](https://linear.app/x-com/issue/PK-3) and <https://e.com/a>\n\n", "", signedAs), signMatch},
		{"FRM-3", signedBody(signedAs+"\n\n", "", signedAs), signMatch},
		{"FRM-4", signedBody(linked, "", linked), signMatch},
		{"FRM-5", signedAs + "## signed\n\n✍️ signed 2026-10-23 — no hash line\n", signNoHash},
		{"FRM-6", signedAs, signNoHash},
		{"FRM-7", signedBody("lane: side\n\nsee [FRM-12](https://evil.example/x), PK-3 and https://e.com/a\n\n", "", signedAs), signDrifted},
		{"FRM-8", signedBody("lane: side\n\nsee [[FRM-12](https://linear.app/x-com/issue/FRM-12)] here\n\n", "", "lane: side\n\nsee [FRM-12] here\n\n"), signMatch},
		{"FRM-10", signedBody("lane: side\n\nsee [FRM-12](https://linear.app/evil/issue/FRM-12), PK-3 and https://e.com/a\n\n", "", signedAs), signDrifted},
		{"FRM-9", signedBody("lane: side\n\nsee [FRM-12](https://linear.app/x-com/issue/FRM-13/s), PK-3 and https://e.com/a\n\n", "", signedAs), signDrifted},
	}
	var nodes []string
	for _, c := range cases {
		description, _ := json.Marshal(c.body)
		nodes = append(nodes, `{"identifier":"`+c.id+`","title":"t","priority":3,"estimate":null,"description":`+string(description)+
			`,"state":{"name":"Todo","type":"unstarted"},"project":null,"labels":{"nodes":[{"name":"signed"}]}}`)
	}
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issues":{"nodes":[` + strings.Join(nodes, ",") + `],"pageInfo":{"hasNextPage":false}}}}`
	})

	envelope, got := runLinear(t, server, nil, "linear", "list", "--team", "FRM", "--label", "signed")

	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	rows := tickets(t, envelope)
	if len(rows) != len(cases) {
		t.Fatalf("%d rows, want %d:\n%s", len(rows), len(cases), got.stdout)
	}
	for i, c := range cases {
		t.Run(c.id, func(t *testing.T) {
			if rows[i]["sign"] != c.want {
				t.Errorf("sign %v, want %q", rows[i]["sign"], c.want)
			}
		})
	}
}

func TestAListWithoutTheSignedLabelCarriesNoSign(t *testing.T) {
	t.Parallel()
	server := newFakeLinear(t, listAnswer("false"))
	envelope, _ := runLinear(t, server, nil, "linear", "list", "--team", "FRM")
	if call := server.requests()[0]; strings.Contains(call.Query, "description") {
		t.Errorf("a plain list fetched bodies:\n%s", call.Query)
	}
	if _, has := tickets(t, envelope)[0]["sign"]; has {
		t.Errorf("a plain list row carries a sign: %v", tickets(t, envelope)[0])
	}
}

func TestListMarksACappedPage(t *testing.T) {
	t.Parallel()
	server := newFakeLinear(t, listAnswer("true"))
	envelope, got := runLinear(t, server, nil, "linear", "list", "--team", "FRM")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if data, _ := envelope["data"].(map[string]any); data["capped"] != true {
		t.Errorf("a full page is not marked capped: %s", got.stdout)
	}
}
