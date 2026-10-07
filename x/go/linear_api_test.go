package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// answers the id lookup with uuid-<n> for each FRM-<n>, and anything else with a fixed reply
func apiServer(t *testing.T, reply string) *fakeLinear {
	return newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "x_lookup") {
			var fields []string
			for alias, id := range call.Variables {
				fields = append(fields, fmt.Sprintf(`%q:{"id":"uuid-%s"}`, alias, strings.TrimPrefix(fmt.Sprint(id), "FRM-")))
			}
			return `{"data":{` + strings.Join(fields, ",") + `}}`
		}
		return reply
	})
}

func TestAPIPrintsLinearsReplyAsItCame(t *testing.T) {
	reply := `{"data":{"viewer":{"name":"cclio"}}}`
	server := apiServer(t, reply)
	_, got := runLinear(t, server, nil, "linear", "api", "query { viewer { name } }")
	if got.code != 0 || strings.TrimSpace(got.stdout) != reply {
		t.Errorf("exit %d stdout %q, want linear's reply and nothing else", got.code, got.stdout)
	}
}

func TestAPIEndsOneOnAGraphqlError(t *testing.T) {
	server := apiServer(t, `{"errors":[{"message":"Cannot query field"}],"data":null}`)
	_, got := runLinear(t, server, nil, "linear", "api", "query { nope }")
	if got.code != 1 || !strings.Contains(got.stdout, "Cannot query field") {
		t.Errorf("exit %d stdout %q, want 1 with linear's errors", got.code, got.stdout)
	}
}

func TestAPIRewritesATicketIdWhereAnIdGoes(t *testing.T) {
	server := apiServer(t, `{"data":{"issueArchive":{"success":true}}}`)
	query := `mutation { issueArchive(id: "FRM-1") { success } commentCreate(input: { issueId: "FRM-2", body: "see FRM-3, id: \"FRM-6\"" }) { success } ` +
		`c: commentCreate(input: { issueId: "FRM-2", body: """see id: "FRM-7" here""" }) { success } ` +
		`d: commentCreate(input: { body: """x \""" id: "FRM-8" """, issueId: "FRM-9" }) { success } }`
	_, got := runLinear(t, server, nil, "linear", "api", query, "--vars", `{"issueId":"FRM-4","note":"FRM-5","input":{"parentId":"FRM-10"}}`)
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	calls := server.requests()
	last := calls[len(calls)-1]
	for _, want := range []string{`issueArchive(id: "uuid-1")`, `issueId: "uuid-2"`, `body: "see FRM-3, id: \"FRM-6\""`, `"""see id: "FRM-7" here"""`, `"""x \""" id: "FRM-8" """`, `issueId: "uuid-9"`} {
		if !strings.Contains(last.Query, want) {
			t.Errorf("the sent query misses %s:\n%s", want, last.Query)
		}
	}
	if last.Variables["issueId"] != "uuid-4" {
		t.Errorf("an id variable was not rewritten: %v", last.Variables)
	}
	if nested, _ := last.Variables["input"].(map[string]any); nested["parentId"] != "uuid-10" {
		t.Errorf("a nested id variable was not rewritten: %v", last.Variables["input"])
	}
	if last.Variables["note"] != "FRM-5" {
		t.Errorf("a variable that is not an id was rewritten: %v", last.Variables)
	}
	if len(calls) != 2 {
		t.Errorf("%d requests, want one lookup and the call", len(calls))
	}
}

func TestAPIReadsAnIssueByItsIdentifierInOneRequest(t *testing.T) {
	server := apiServer(t, `{"data":{"issue":{"title":"t"}}}`)
	if _, got := runLinear(t, server, nil, "linear", "api", `query { issue(id: "FRM-1") { title } }`); got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if calls := server.requests(); len(calls) != 1 || !strings.Contains(calls[0].Query, `"FRM-1"`) {
		t.Errorf("%d requests, want the read alone with FRM-1 as written", len(calls))
	}
}

func TestAPITracesTheShapeNeverTheQuery(t *testing.T) {
	server := apiServer(t, `{"data":{"a":{"id":"1"},"comments":{"nodes":[]}}}`)
	_, got := runLinear(t, server, nil, "linear", "api", `query Mine($t: String!) { a: issue(id: "FRM-1") { title } comments(first: 5, filter: { body: { contains: "secret words" } }) { nodes { body } } }`, "--vars", `{"t":"x"}`)
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if !strings.Contains(got.trace, `"x.shape":"query comments,issue"`) {
		t.Errorf("the trace does not carry the shape: %s", got.trace)
	}
	for _, leak := range []string{"secret words", "title", "Mine"} {
		if strings.Contains(got.trace, leak) {
			t.Errorf("the trace holds query text %q: %s", leak, got.trace)
		}
	}
}

func TestSchemaNamesTheLinearRawDoorAndItsIdentity(t *testing.T) {
	got := xIn(t, repo(t), nil, "schema", "linear")
	if got.data["rawDoor"] != "x linear api" || !strings.Contains(fmt.Sprint(got.data["identity"]), "1password") {
		t.Errorf("schema linear: rawDoor %v identity %v", got.data["rawDoor"], got.data["identity"])
	}
}

func TestShapeSeesPastCommentsAndFragments(t *testing.T) {
	cases := map[string]string{
		"# archive the old one\nmutation { issueArchive(id: \"FRM-1\") { success } }": "mutation issueArchive",
		`query { viewer { id } ... on Query { teams { nodes { id } } } ...Rest }`:     "query viewer",
		`{ issue(id: "FRM-1") { title } }`:                                            "query issue",
	}
	for query, want := range cases {
		if got := shapeOf(query); got != want {
			t.Errorf("shapeOf(%q) = %q, want %q", query, got, want)
		}
	}
}

func TestStatsRanksTheShapesTheRawDoorCarried(t *testing.T) {
	state := t.TempDir()
	day := filepath.Join(state, "traces", time.Now().Format(time.DateOnly)+".jsonl")
	line := func(shape string) string {
		return fmt.Sprintf(`{"name":"linear api","duration_ms":5,"x.caller":"cc","error.type":"","x.shape":%q}`+"\n", shape)
	}
	write(t, day, strings.Repeat(line("query issue"), 3)+line("mutation issueArchive")+
		`{"name":"linear read","duration_ms":5,"x.caller":"cc","error.type":""}`+"\n")
	got := xIn(t, repo(t), tracing(state), "stats")
	families, _ := got.data["families"].([]any)
	for _, f := range families {
		if family := f.(map[string]any); family["name"] == "linear" {
			if raw := marshal(family["raw"]); raw != `["query issue ×3","mutation issueArchive ×1"]` {
				t.Errorf("linear's raw = %s", raw)
			}
			return
		}
	}
	t.Errorf("no linear family in %s", marshal(families))
}
