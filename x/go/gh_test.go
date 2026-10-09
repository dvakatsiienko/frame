package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
)

// a github that answers each api path from the map, records the auth it saw, and splits the issue
// comments over two pages so the Link header is followed
func fakeGithub(t *testing.T, pages map[string]string) (*httptest.Server, func() []string) {
	t.Helper()
	var mu sync.Mutex
	var auth []string
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		auth = append(auth, r.Header.Get("Authorization"))
		mu.Unlock()
		key := r.URL.Path
		if r.URL.Query().Get("page") != "" {
			key += "?page=" + r.URL.Query().Get("page")
		} else if _, paged := pages[key+"?page=2"]; paged {
			w.Header().Set("Link", `<`+server.URL+r.URL.Path+`?per_page=100&page=2>; rel="next"`)
		}
		body, ok := pages[key]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	return server, func() []string { mu.Lock(); defer mu.Unlock(); return append([]string(nil), auth...) }
}

const repoPath = "/repos/o/r"

// the colour codes between words; the board styles each markdown run apart
var sgr = regexp.MustCompile("\x1b\\[[0-9;]*m")

func prPages() map[string]string {
	return map[string]string{
		repoPath + "/pulls/7": `{"title":"a pr","state":"open","merged":false,"head":{"sha":"` + headSha + `","ref":"coder/x"}}`,
		repoPath + "/commits/" + headSha + "/check-runs": `{"total_count":2,"check_runs":[
			{"name":"test","status":"completed","conclusion":"failure","html_url":"https://ci/1"},
			{"name":"review","status":"in_progress","conclusion":null,"html_url":"https://ci/2"}]}`,
		repoPath + "/commits/" + headSha + "/statuses": `[
			{"context":"Vercel","state":"success","target_url":"https://v/2"},
			{"context":"Vercel","state":"pending","target_url":"https://v/1"}]`,
		repoPath + "/issues/7/comments": `[
			{"user":{"login":"dvakatsiienko"},"created_at":"2026-10-09T10:00:00Z","body":"first","html_url":"https://c/1"},
			{"user":{"login":"x-reviewer-cc[bot]"},"created_at":"2026-10-09T09:00:00Z","updated_at":"2026-10-09T13:30:00Z","body":"verdict: clean","html_url":"https://c/5"},
			{"user":{"login":"vercel[bot]"},"created_at":"2026-10-09T10:05:00Z","body":"deployed","html_url":"https://c/2"}]`,
		repoPath + "/issues/7/comments?page=2": `[
			{"user":{"login":"claude[bot]"},"created_at":"2026-10-09T12:00:00Z","body":"later","html_url":"https://c/3"},
			{"user":{"login":"linear-code[bot]"},"created_at":"2026-10-09T12:01:00Z","body":"linked","html_url":"https://c/4"}]`,
		repoPath + "/pulls/7/reviews": `[
			{"user":{"login":"claude[bot]"},"submitted_at":"2026-10-09T11:00:00Z","state":"CHANGES_REQUESTED","body":"fix it","html_url":"https://r/1"},
			{"user":{"login":"claude[bot]"},"submitted_at":"2026-10-09T11:30:00Z","state":"COMMENTED","body":"","html_url":"https://r/2"},
			{"user":{"login":"dvakatsiienko"},"state":"PENDING","body":"draft","html_url":"https://r/3"}]`,
		repoPath + "/pulls/7/comments": `[
			{"user":{"login":"claude[bot]"},"created_at":"2026-10-09T11:30:00Z","body":"off by one","path":"x/go/gh.go","line":42,"html_url":"https://l/1"},
			{"user":{"login":"dvakatsiienko"},"created_at":"2026-10-09T13:00:00Z","body":"why?","path":"x/go/gh.go","line":null,"original_line":9,"html_url":"https://l/2"}]`,
	}
}

type prRun struct {
	code   int
	stdout string
	data   struct {
		Repo           string      `json:"repo"`
		Head           string      `json:"head"`
		Read           string      `json:"read"`
		Checks         []prCheck   `json:"checks"`
		Comments       []prComment `json:"comments"`
		Reviews        []prComment `json:"reviews"`
		ReviewComments []prComment `json:"reviewComments"`
	}
}

func runGhPr(t *testing.T, pages map[string]string, env []string, argv ...string) (prRun, []string) {
	t.Helper()
	server, auth := fakeGithub(t, pages)
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-coder:x": farFuture + ":ghs_coder"})
	got := runAs(t, append([]string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL}, env...), append([]string{"gh", "pr"}, argv...)...)
	out := prRun{code: got.code, stdout: got.stdout + got.stderr}
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if json.Unmarshal([]byte(got.stdout), &envelope) == nil && envelope.Data != nil {
		_ = json.Unmarshal(envelope.Data, &out.data)
	}
	return out, auth()
}

func bodies(comments []prComment) string {
	var out []string
	for _, c := range comments {
		out = append(out, c.Body)
	}
	return strings.Join(out, ",")
}

func TestGhPrReadsEveryFeedNewestFirstAsTheCoderApp(t *testing.T) {
	got, auth := runGhPr(t, prPages(), nil, "7", "--repo", "o/r")

	if got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	if b := bodies(got.data.Comments); b != "verdict: clean,later,first" {
		t.Errorf("issue comments %q, want all three across both pages, newest first", b)
	}
	if b := bodies(got.data.Reviews); b != "fix it" {
		t.Errorf("reviews %q, want the one with words", b)
	}
	if b := bodies(got.data.ReviewComments); b != "why?,off by one" {
		t.Errorf("review comments %q", b)
	}
	if where := got.data.ReviewComments[1].Where; where != "x/go/gh.go:42" {
		t.Errorf("where %q, want path:line", where)
	}
	if where := got.data.ReviewComments[0].Where; where != "x/go/gh.go:9" {
		t.Errorf("an outdated comment's where %q, want its original line", where)
	}
	for _, a := range auth {
		if a != "Bearer ghs_coder" {
			t.Fatalf("a request went out as %q, want the coder app", a)
		}
	}
}

func TestGhPrNamesEachCheckByItsLatestState(t *testing.T) {
	got, _ := runGhPr(t, prPages(), nil, "7", "--repo", "o/r")

	want := []prCheck{{"Vercel", "success", "https://v/2"}, {"review", "in_progress", "https://ci/2"}, {"test", "failure", "https://ci/1"}}
	if len(got.data.Checks) != len(want) {
		t.Fatalf("checks %+v, want %+v", got.data.Checks, want)
	}
	for i := range want {
		if got.data.Checks[i] != want[i] {
			t.Errorf("check %d is %+v, want %+v", i, got.data.Checks[i], want[i])
		}
	}
}

func TestGhPrNeverPrintsTheDeployBots(t *testing.T) {
	got, _ := runGhPr(t, prPages(), []string{"CLAUDECODE="}, "7", "--repo", "o/r", "--board")

	if got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	for _, bot := range []string{"vercel[bot]", "linear-code[bot]", "deployed", "linked"} {
		if strings.Contains(got.stdout, bot) {
			t.Errorf("the board prints %q:\n%s", bot, got.stdout)
		}
	}
}

func TestGhPrSinceKeepsOnlyNewerComments(t *testing.T) {
	got, _ := runGhPr(t, prPages(), nil, "7", "--repo", "o/r", "--since", "2026-10-09T11:30:00Z")

	all := bodies(got.data.Comments) + "|" + bodies(got.data.Reviews) + "|" + bodies(got.data.ReviewComments)
	if got.code != 0 || all != "verdict: clean,later||why?" {
		t.Fatalf("exit %d, kept %q, want only what came after 11:30", got.code, all)
	}
}

func TestGhPrSinceCountsAnEditedCommentByItsEdit(t *testing.T) {
	got, _ := runGhPr(t, prPages(), nil, "7", "--repo", "o/r", "--since", "2026-10-09T13:15:00Z")

	if b := bodies(got.data.Comments); got.code != 0 || b != "verdict: clean" {
		t.Fatalf("exit %d, kept %q, want the comment created at 09:00 and edited at 13:30", got.code, b)
	}
}

func TestGhPrPrintsJSONToAnAgentAndTheBoardOnAsk(t *testing.T) {
	cases := []struct {
		name  string
		argv  []string
		board bool
	}{
		{"an agent gets the envelope", nil, false},
		{"--board draws the human view", []string{"--board"}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, _ := runGhPr(t, prPages(), []string{"CLAUDECODE=1"}, append([]string{"7", "--repo", "o/r"}, c.argv...)...)

			isJSON := json.Valid([]byte(strings.TrimSpace(got.stdout)))
			if got.code != 0 || isJSON == c.board {
				t.Fatalf("exit %d, json %v, want board %v:\n%s", got.code, isJSON, c.board, got.stdout)
			}
			if c.board && !strings.Contains(sgr.ReplaceAllString(got.stdout, ""), "off by one") {
				t.Errorf("the board does not show the review comment:\n%s", got.stdout)
			}
		})
	}
}

func TestGhPrRefusesBadInputWithAUsageExit(t *testing.T) {
	cases := map[string][]string{
		"a branch for the pr": {"coder/x", "--repo", "o/r"},
		"a hash-led number":   {"#7", "--repo", "o/r"},
		"a since in prose":    {"7", "--repo", "o/r", "--since", "an hour ago"},
		"a repo with no name": {"7", "--repo", "o"},
		"an unknown flag":     {"7", "--repo", "o/r", "--watch"},
	}
	for name, argv := range cases {
		t.Run(name, func(t *testing.T) {
			got, auth := runGhPr(t, prPages(), nil, argv...)

			if got.code != 2 || len(auth) != 0 {
				t.Fatalf("exit %d after %d requests, want 2 before any:\n%s", got.code, len(auth), got.stdout)
			}
		})
	}
}

func TestGhPrReadsTheRepoFromTheOriginRemote(t *testing.T) {
	for _, remote := range []string{"git@github.com:o/r.git", "https://github.com/o/r"} {
		t.Run(remote, func(t *testing.T) {
			dir := repo(t)
			gitT(t, dir, "remote", "add", "origin", remote)
			server, _ := fakeGithub(t, prPages())
			keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-coder:x": farFuture + ":ghs_coder"})

			got := xIn(t, dir, []string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL}, "gh", "pr", "7")

			if got.code != 0 || got.data["repo"] != "o/r" {
				t.Fatalf("exit %d, repo %v:\n%s", got.code, got.data["repo"], got.stdout)
			}
		})
	}
}

func TestGhPrNamesAMissingPr(t *testing.T) {
	got, _ := runGhPr(t, prPages(), nil, "8", "--repo", "o/r")

	if got.code != 1 || !strings.Contains(got.stdout, "404") {
		t.Fatalf("exit %d, want 1 naming the 404:\n%s", got.code, got.stdout)
	}
}
