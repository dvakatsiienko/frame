package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
)

// a pr's review threads as github's graphql answers them: two open inline threads and one resolved
const reviewThreads = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[
	{"id":"PRRT_open1","isResolved":false,"path":"x/go/gh.go","line":42,"originalLine":40,"comments":{"nodes":[{"body":"off by one in the page loop, the last page is read twice","author":{"login":"claude"}}]}},
	{"id":"PRRT_done","isResolved":true,"path":"x/go/gh.go","line":7,"originalLine":7,"comments":{"nodes":[{"body":"settled","author":{"login":"claude"}}]}},
	{"id":"PRRT_open2","isResolved":false,"path":"x/FTR.md","line":null,"originalLine":12,"comments":{"nodes":[{"body":"why?","author":{"login":"dvakatsiienko"}}]}}]}}}}}`

// a github graphql endpoint that answers the threads query and records each reply mutation's variables;
// a pending review is the one thing a reply must never open, so the fake counts any review mutation apart
type reviewGithub struct {
	mu      sync.Mutex
	replies []map[string]any
	reviews int
}

func fakeReviewGithub(t *testing.T) (*httptest.Server, *reviewGithub) {
	t.Helper()
	g := &reviewGithub{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Query     string         `json:"query"`
			Variables map[string]any `json:"variables"`
		}
		raw, _ := io.ReadAll(r.Body)
		if r.Method != http.MethodPost || r.URL.Path != "/graphql" || json.Unmarshal(raw, &req) != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		g.mu.Lock()
		defer g.mu.Unlock()
		switch {
		case strings.Contains(req.Query, "addPullRequestReview(") || strings.Contains(req.Query, "addPullRequestReviewComment"):
			g.reviews++
			_, _ = w.Write([]byte(`{"data":{}}`))
		case strings.Contains(req.Query, "addPullRequestReviewThreadReply"):
			g.replies = append(g.replies, req.Variables)
			_, _ = w.Write([]byte(`{"data":{"addPullRequestReviewThreadReply":{"comment":{"url":"https://github.com/o/r/pull/7#discussion_r9"}}}}`))
		case strings.Contains(req.Query, "reviewThreads"):
			_, _ = w.Write([]byte(reviewThreads))
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(server.Close)
	return server, g
}

func runReview(t *testing.T, server *httptest.Server, argv ...string) asRun {
	t.Helper()
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"})
	return runAs(t, []string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL}, argv...)
}

// exit line 6: only the open threads print, each with its id, file, line and first words
func TestGhReviewCommentsListPrintsOnlyTheOpenThreads(t *testing.T) {
	t.Parallel()
	server, _ := fakeReviewGithub(t)

	got := runReview(t, server, "gh", "pr-review-comments-list", "7", "--repo", "o/r")

	var envelope struct {
		Data struct {
			Threads []reviewThread `json:"threads"`
		} `json:"data"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	threads := envelope.Data.Threads
	if got.code != 0 || len(threads) != 2 {
		t.Fatalf("exit %d, %d threads, want the two open ones:\n%s%s", got.code, len(threads), got.stdout, got.stderr)
	}
	want := []reviewThread{
		{ID: "PRRT_open1", File: "x/go/gh.go", Line: 42, Words: "off by one in the page loop, the last page is read twice", Author: "claude"},
		{ID: "PRRT_open2", File: "x/FTR.md", Line: 12, Words: "why?", Author: "dvakatsiienko", Outdated: true},
	}
	for i, w := range want {
		if threads[i] != w {
			t.Errorf("thread %d: %+v, want %+v", i, threads[i], w)
		}
	}
}

// exit line 7: the reply posts under the thread by its id, the body byte for byte, and opens no pending review
func TestGhReviewCommentsReplyPostsUnderTheThread(t *testing.T) {
	t.Parallel()
	server, g := fakeReviewGithub(t)
	body := t.TempDir() + "/reply.md"
	if err := os.WriteFile(body, []byte("fixed in `abc1234`: the loop stops at the last page\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	got := runReview(t, server, "gh", "pr-review-comments-reply", "PRRT_open1", "--body-file", body)

	g.mu.Lock()
	defer g.mu.Unlock()
	if got.code != 0 || len(g.replies) != 1 || g.reviews != 0 {
		t.Fatalf("exit %d, %d replies, %d review mutations, want one reply and no review:\n%s%s", got.code, len(g.replies), g.reviews, got.stdout, got.stderr)
	}
	if g.replies[0]["thread"] != "PRRT_open1" || g.replies[0]["body"] != "fixed in `abc1234`: the loop stops at the last page\n" {
		t.Fatalf("reply variables %v, want the thread id and the body byte for byte", g.replies[0])
	}
	if !strings.Contains(got.stdout, "discussion_r9") {
		t.Fatalf("want the reply's url in the envelope:\n%s", got.stdout)
	}
}

func TestGhReviewCommentsRefusesBadInputBeforeAnyCall(t *testing.T) {
	t.Parallel()
	for name, argv := range map[string][]string{
		"a list with a branch for the pr":  {"gh", "pr-review-comments-list", "codie/x", "--repo", "o/r"},
		"a reply to a comment's number":    {"gh", "pr-review-comments-reply", "12345", "--body-file", "/dev/null"},
		"a reply with no body file":        {"gh", "pr-review-comments-reply", "PRRT_open1"},
		"a reply whose body file is empty": {"gh", "pr-review-comments-reply", "PRRT_open1", "--body-file", "/dev/null"},
	} {
		t.Run(name, func(t *testing.T) {
			server, g := fakeReviewGithub(t)

			got := runReview(t, server, argv...)

			g.mu.Lock()
			defer g.mu.Unlock()
			if got.code != 2 || len(g.replies) != 0 {
				t.Fatalf("exit %d, %d replies, want a usage exit and nothing posted:\n%s%s", got.code, len(g.replies), got.stdout, got.stderr)
			}
		})
	}
}
