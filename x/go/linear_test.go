package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"testing"
)

type gqlCall struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
	Auth      string         `json:"-"`
}

// fakeLinear stands in for linear's graphql endpoint: it records every request and answers through
// the test's own function, so a test asserts what x sent and what it printed
type fakeLinear struct {
	*httptest.Server
	mu    sync.Mutex
	calls []gqlCall
}

func newFakeLinear(t *testing.T, answer func(gqlCall) string) *fakeLinear {
	t.Helper()
	f := &fakeLinear{}
	f.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var call gqlCall
		_ = json.Unmarshal(raw, &call)
		call.Auth = r.Header.Get("Authorization")
		f.mu.Lock()
		f.calls = append(f.calls, call)
		f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, answer(call))
	}))
	t.Cleanup(f.Close)
	return f
}

func (f *fakeLinear) requests() []gqlCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]gqlCall(nil), f.calls...)
}

// every member holds a far-future cached token, so no test mints
func linearKeys(t *testing.T) string {
	return keysFixture(t, map[string]string{
		"op://dev/linear-golden/credential": "lin_api_dima",
		"keychain:x-token-linear-cclio:x":   farFuture + ":tok-cclio",
		"keychain:x-token-linear-coder:x":   farFuture + ":tok-coder",
	})
}

func runLinear(t *testing.T, server *fakeLinear, env []string, argv ...string) (map[string]any, asRun) {
	t.Helper()
	got := runAs(t, append([]string{"X_KEYS=" + linearKeys(t), "X_LINEAR_URL=" + server.URL}, env...), argv...)
	var envelope map[string]any
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return envelope, got
}

type conn struct{ nodes, more string }

func pageOf(nodes ...string) conn { return conn{strings.Join(nodes, ","), "false"} }

func (p conn) json() string {
	return fmt.Sprintf(`{"nodes":[%s],"pageInfo":{"hasNextPage":%s}}`, p.nodes, p.more)
}

type issue struct {
	id, title   string
	labels      conn
	comments    conn
	relations   conn
	inverse     conn
	updatedAt   string
	description string
	stateName   string
}

// the issue as linear answers it: comments and relations only when the query asked for them
func (i issue) json(query string) string {
	labels := i.labels
	if labels.more == "" {
		labels = pageOf(`{"name":"agent"}`)
	}
	extra := ""
	if strings.Contains(query, "comments(") {
		extra += `,"comments":` + orEmpty(i.comments).json()
	}
	if strings.Contains(query, "inverseRelations(") {
		extra += `,"relations":` + orEmpty(i.relations).json() + `,"inverseRelations":` + orEmpty(i.inverse).json()
	}
	return fmt.Sprintf(`{"id":"uuid-%s","identifier":%q,"title":%q,"url":"https://linear.app/x-com/issue/%s","description":%q,
		"priority":2,"estimate":3,"updatedAt":%q,"state":{"name":%q,"type":"started"},"project":{"name":"cli"},
		"projectMilestone":null,"parent":{"identifier":"FRM-14","title":"the cli"},"labels":%s,
		"children":{"nodes":[],"pageInfo":{"hasNextPage":false}}%s}`,
		i.id, i.id, i.title, i.id, i.description, cmpOr(i.updatedAt, "2026-10-07T10:00:00.000Z"), cmpOr(i.stateName, "In Progress"),
		labels.json(), extra)
}

func cmpOr(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func orEmpty(p conn) conn {
	if p.more == "" {
		return pageOf()
	}
	return p
}

// answers a batched read: one alias per variable, each found in `known` or reported missing
func readAnswer(known map[string]issue) func(gqlCall) string {
	return func(call gqlCall) string {
		var data, errs []string
		for alias, id := range call.Variables {
			if found, ok := known[fmt.Sprint(id)]; ok {
				data = append(data, fmt.Sprintf("%q:%s", alias, found.json(call.Query)))
				continue
			}
			data = append(data, fmt.Sprintf("%q:null", alias))
			errs = append(errs, fmt.Sprintf(`{"message":"Entity not found: Issue","path":[%q]}`, alias))
		}
		reply := `{"data":{` + strings.Join(data, ",") + `}`
		if errs != nil {
			reply += `,"errors":[` + strings.Join(errs, ",") + `]`
		}
		return reply + "}"
	}
}

func tickets(t *testing.T, envelope map[string]any) []map[string]any {
	t.Helper()
	data, _ := envelope["data"].(map[string]any)
	list, _ := data["tickets"].([]any)
	var out []map[string]any
	for _, item := range list {
		ticket, _ := item.(map[string]any)
		out = append(out, ticket)
	}
	return out
}

func TestReadBatchesEveryIdIntoOneRequest(t *testing.T) {
	server := newFakeLinear(t, readAnswer(map[string]issue{
		"FRM-1": {id: "FRM-1", title: "first"}, "FRM-2": {id: "FRM-2", title: "second"}, "FRM-3": {id: "FRM-3", title: "third"}}))
	envelope, got := runLinear(t, server, nil, "linear", "read", "FRM-1", "FRM-2", "FRM-3")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if n := len(server.requests()); n != 1 {
		t.Fatalf("x sent %d requests for three ids, want 1", n)
	}
	var titles []string
	for _, ticket := range tickets(t, envelope) {
		titles = append(titles, fmt.Sprint(ticket["title"]))
	}
	if strings.Join(titles, ",") != "first,second,third" {
		t.Errorf("tickets came back as %v, want them in the order asked", titles)
	}
}

func TestReadMarksACappedConnection(t *testing.T) {
	full := conn{`{"name":"a"},{"name":"b"}`, "true"}
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t", labels: full}}))
	envelope, got := runLinear(t, server, nil, "linear", "read", "FRM-1")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	capped, _ := tickets(t, envelope)[0]["capped"].([]any)
	if len(capped) != 1 || capped[0] != "labels" {
		t.Errorf("capped = %v, want [labels]", capped)
	}
}

func TestReadAddsCommentsAndBothRelationSidesOnlyWhenAsked(t *testing.T) {
	answer := readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t",
		comments:  pageOf(`{"body":"later","createdAt":"2026-10-01T17:23:00Z","user":{"name":"Dima"},"botActor":null}`, `{"body":"first","createdAt":"2026-10-01T11:15:00Z","user":null,"botActor":{"name":"cclio"}}`),
		relations: pageOf(`{"type":"blocks","relatedIssue":{"identifier":"FRM-5","title":"five","state":{"name":"Todo"}}}`),
		inverse:   pageOf(`{"type":"blocks","issue":{"identifier":"FRM-4","title":"four","state":{"name":"Todo"}}}`)}})
	server := newFakeLinear(t, answer)
	plain, _ := runLinear(t, server, nil, "linear", "read", "FRM-1")
	if q := server.requests()[0].Query; strings.Contains(q, "comments") || strings.Contains(q, "inverseRelations") {
		t.Errorf("a plain read asked for comments or relations:\n%s", q)
	}
	if _, has := tickets(t, plain)[0]["comments"]; has {
		t.Error("a plain read printed comments")
	}

	_, got := runLinear(t, server, nil, "linear", "read", "--comments", "--relations", "FRM-1")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	var read struct {
		Data struct {
			Tickets []ticket `json:"tickets"`
		} `json:"data"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &read)
	want := ticket{Comments: []note{{"cclio", "2026-10-01", "first"}, {"Dima", "2026-10-01", "later"}},
		Relations: []link{{"blocks", "FRM-5", "five", "Todo"}, {"blocked by", "FRM-4", "four", "Todo"}}}
	if len(read.Data.Tickets) != 1 {
		t.Fatalf("want one ticket: %s", got.stdout)
	}
	if t1 := read.Data.Tickets[0]; !slices.Equal(t1.Comments, want.Comments) || !slices.Equal(t1.Relations, want.Relations) {
		t.Errorf("comments %v relations %v\nwant %v %v", t1.Comments, t1.Relations, want.Comments, want.Relations)
	}
}

func TestReadNamesAnIdLinearCannotFind(t *testing.T) {
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t"}}))
	envelope, got := runLinear(t, server, nil, "linear", "read", "FRM-1", "FRM-999")
	if got.code != 1 || !strings.Contains(fmt.Sprint(envelope["error"]), "FRM-999") || strings.Contains(fmt.Sprint(envelope["error"]), "FRM-1 ") {
		t.Errorf("exit %d, want 1 naming only FRM-999: %s", got.code, got.stdout)
	}
}

func TestReadRefusesAMalformedIdBeforeAnyRequest(t *testing.T) {
	server := newFakeLinear(t, readAnswer(nil))
	for _, bad := range []string{"frm-1", "FRM1", "FRM-1; drop", "-", "FRM-1 FRM-2"} {
		_, got := runLinear(t, server, nil, "linear", "read", bad)
		if got.code != 2 {
			t.Errorf("%q: exit %d, want 2", bad, got.code)
		}
	}
	if n := len(server.requests()); n != 0 {
		t.Errorf("%d requests went out for malformed ids", n)
	}
}

func TestLinearActsAsCclioForAnAgentAndDimaOnHisOwn(t *testing.T) {
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t"}}))
	cases := []struct {
		name string
		env  []string
		argv []string
		auth string
	}{
		{"an agent", []string{"CLAUDECODE=1"}, []string{"linear", "read", "FRM-1"}, "Bearer tok-cclio"},
		{"an agent as coder", []string{"CLAUDECODE=1"}, []string{"linear", "read", "--as", "coder", "FRM-1"}, "Bearer tok-coder"},
		{"a pipe with no agent env", nil, []string{"linear", "read", "FRM-1"}, "Bearer tok-cclio"},
		{"as dima", nil, []string{"linear", "read", "--as", "dima", "FRM-1"}, "lin_api_dima"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			before := len(server.requests())
			_, got := runLinear(t, server, c.env, c.argv...)
			if got.code != 0 {
				t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
			}
			if auth := server.requests()[before].Auth; auth != c.auth {
				t.Errorf("authorization %q, want %q", auth, c.auth)
			}
			if strings.Contains(got.stdout+got.stderr+got.trace, strings.TrimPrefix(c.auth, "Bearer ")) {
				t.Error("the token leaked onto x's output or trace")
			}
		})
	}
}

var ansiCode = regexp.MustCompile(`\x1b\[[0-9;?]*[a-zA-Z]`)

func lineLengths(text string) []int {
	var lengths []int
	for line := range strings.SplitSeq(text, "\n") {
		lengths = append(lengths, len(line))
	}
	return lengths
}

func TestARevokedAppTokenIsMintedAgainOnce(t *testing.T) {
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t"}}))
	graphql := server.Config.Handler
	// linear answers a revoked token with http 401 before any graphql; the oauth mint sits on the same origin
	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/oauth/token":
			_, _ = io.WriteString(w, `{"access_token":"tok-fresh","expires_in":2592000}`)
		case r.Header.Get("Authorization") == "Bearer tok-revoked":
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{"errors":[{"message":"Authentication required"}]}`)
		default:
			graphql.ServeHTTP(w, r)
		}
	})
	keys := keysFixture(t, map[string]string{"keychain:x-token-linear-coder:x": farFuture + ":tok-revoked",
		"keychain:linear-coder-id:coder": "id", "keychain:linear-coder-secret:coder": "secret"})
	got := runAs(t, []string{"X_KEYS=" + keys, "X_LINEAR_URL=" + server.URL}, "linear", "read", "--as", "coder", "FRM-1")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if cache := read(t, keys); !strings.Contains(cache, ":tok-fresh") {
		t.Errorf("the fresh token was not cached: %s", cache)
	}
}

func TestDimasKeyIsNeverCopiedIntoTheKeychain(t *testing.T) {
	for name, status := range map[string]int{"a read": http.StatusOK, "a rejected read": http.StatusUnauthorized} {
		t.Run(name, func(t *testing.T) {
			server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t"}}))
			graphql := server.Config.Handler
			server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if status != http.StatusOK {
					w.WriteHeader(status)
					return
				}
				graphql.ServeHTTP(w, r)
			})
			keys := keysFixture(t, map[string]string{"op://dev/linear-golden/credential": "lin_api_dima"})
			before := read(t, keys)
			runAs(t, []string{"X_KEYS=" + keys, "X_LINEAR_URL=" + server.URL}, "linear", "read", "--as", "dima", "FRM-1")
			if len(server.requests()) == 0 && status == http.StatusOK {
				t.Fatal("no request reached linear")
			}
			if after := read(t, keys); after != before {
				t.Errorf("acting as dima wrote to the key store: %s", after)
			}
		})
	}
}

func TestOnlyDimasOwnTerminalActsAsDima(t *testing.T) {
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "t"}}))
	dir := world(t)
	_, code := runTTY(t, xbin, dir, call{ID: "linear-read-dima", Mode: "tty", Cols: 100,
		Argv: []string{"linear", "read", "FRM-1"},
		Env:  map[string]string{"X_KEYS": linearKeys(t), "X_LINEAR_URL": server.URL, "X_TEST": "1"}})
	if code != 0 || len(server.requests()) != 1 {
		t.Fatalf("exit %d, %d requests", code, len(server.requests()))
	}
	if auth := server.requests()[0].Auth; auth != "lin_api_dima" {
		t.Errorf("a read on dima's terminal went out as %q", auth)
	}
}

func TestReadSavesALinearUploadWithTheAuthItHolds(t *testing.T) {
	var uploadAuth string
	server := newFakeLinear(t, nil)
	// linear's upload urls end in a uuid: the name comes from the link label or the attachment title
	up := func(path string) string { return server.URL + "/uploads/" + path }
	attached := `{"title":"the pr","url":"https://github.com/o/r/pull/1"},{"title":"","url":"` + up("abc/14ec159b") + `"},` +
		`{"title":"../../x.pdf","url":"` + up("def/a1") + `"},{"title":"/etc/passwd","url":"` + up("ghi/b2") + `"},` +
		`{"title":".hidden","url":"` + up("jkl/..%2F..%2Fc3") + `"}`
	server.Config.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/uploads/") {
			uploadAuth = r.Header.Get("Authorization")
			_, _ = io.WriteString(w, "BYTES-"+filepath.Base(r.URL.Path))
			return
		}
		raw, _ := io.ReadAll(r.Body)
		files := ""
		if strings.Contains(string(raw), "attachments(") {
			files = `,"attachments":{"nodes":[` + attached + `],"pageInfo":{"hasNextPage":false}}`
		}
		_, _ = io.WriteString(w, `{"data":{"i0":`+strings.TrimSuffix(issue{id: "FRM-1", title: "t", description: "see [My CV.pdf](" + up("abc/14ec159b") + ")"}.json(""), "}")+files+`}}}`)
	})
	dir := t.TempDir()
	envelope, got := runLinear(t, server, nil, "linear", "read", "--attachments", dir, "FRM-1")
	if got.code != 0 {
		t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
	}
	if uploadAuth != "Bearer tok-cclio" {
		t.Errorf("the download carried %q, want the actor's key", uploadAuth)
	}
	var names []string
	entries, _ := os.ReadDir(dir)
	for _, entry := range entries {
		names = append(names, entry.Name()+"="+read(t, filepath.Join(dir, entry.Name())))
	}
	want := "My CV.pdf=BYTES-14ec159b,hidden=BYTES-c3,passwd=BYTES-b2,x.pdf=BYTES-a1"
	if strings.Join(names, ",") != want {
		t.Errorf("saved %v\nwant %s — each upload once, named by its label or title, inside the dir, the pr link skipped", names, want)
	}
	saved, _ := json.Marshal(envelope["data"].(map[string]any)["saved"])
	if !strings.Contains(string(saved), `"bytes":14`) {
		t.Errorf("the envelope does not list the saved file with its size: %s", saved)
	}
	if strings.Contains(got.stdout+got.stderr, "tok-cclio") {
		t.Error("the key leaked onto x's output")
	}
}

func TestReadDrawsACardOnATerminal(t *testing.T) {
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "the card title", description: "## body heading\n\nbody text"}}))
	dir := world(t)
	out, code := runTTY(t, xbin, dir, call{ID: "linear-read-card", Mode: "tty", Cols: 100, Stdin: "none",
		Argv: []string{"linear", "read", "FRM-1"},
		Env:  map[string]string{"X_KEYS": linearKeys(t), "X_LINEAR_URL": server.URL, "X_TEST": "1"}})
	if code != 0 {
		t.Fatalf("exit %d\n%s", code, out)
	}
	plain := ansiCode.ReplaceAllString(out, "")
	for _, want := range []string{"╭", "the card title", "In Progress", "agent", "body heading", "body text"} {
		if !strings.Contains(plain, want) {
			t.Errorf("the card misses %q:\n%s", want, plain)
		}
	}
	if longest := slices.Max(lineLengths(out)); longest > 600 {
		t.Errorf("a card line holds %d bytes for a 100-col terminal — padding came back", longest)
	}
	if strings.Contains(out, `"verb"`) {
		t.Error("a terminal got the envelope")
	}
}
