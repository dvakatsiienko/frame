package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
)

// a review thread's graphql node id; the rest feeds carry no resolved state, so the list and the reply use this kind
var threadID = regexp.MustCompile(`^PRRT_[\w-]+$`)

type reviewThread struct {
	ID     string `json:"id"`
	File   string `json:"file"`
	Line   int    `json:"line"`
	Words  string `json:"words"`
	Author string `json:"author"`
	// the thread's line left the diff; Line is where it sat
	Outdated bool `json:"outdated,omitempty"`
}

const threadsQuery = `query($owner: String!, $name: String!, $pr: Int!, $after: String) {
  repository(owner: $owner, name: $name) { pullRequest(number: $pr) { reviewThreads(first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { id isResolved path line originalLine comments(first: 1) { nodes { body author { login } } } }
  } } }
}`

// a reply in a thread posts outright; a review comment would sit in a pending review until submitted
const replyMutation = `mutation($thread: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread, body: $body }) { comment { url } }
}`

/* Verbs */
func ghReviewCommentsList(r *Run, args []string, flags Flags) (any, error) {
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	var n string
	if len(args) > 0 {
		if n = args[0]; !prNumber.MatchString(n) {
			return nil, usageFail(n+" is not a pr number", "x gh pr-review-comments-list [pr number]")
		}
	}
	var threads []reviewThread
	r.Wait("reading the open review threads in "+repo, func() {
		if n == "" {
			if n, err = branchPr(repo); err != nil {
				return
			}
		}
		threads, err = openThreads(repo, n)
	})
	if err != nil {
		return nil, err
	}
	if r.human {
		lines := make([]string, len(threads))
		for i, t := range threads {
			lines[i] = ui.fg.Render(fmt.Sprintf("%s  %s:%d  %s: %s", t.ID, t.File, t.Line, t.Author, t.Words))
		}
		r.Show(lines, 0)
	}
	r.Done(fmt.Sprintf("%d open on #%s", len(threads), n), "x gh pr-review-comments-reply <id> --body-file <file>")
	return ordered{{"repo", repo}, {"pr", n}, {"threads", threads}}, nil
}

func ghReviewCommentsReply(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if !threadID.MatchString(id) {
		return nil, usageFail(id+" is not a review thread id, PRRT_…", "x gh pr-review-comments-list")
	}
	file, _ := flags["body-file"].(string)
	if file == "" {
		return nil, usageFail("the reply needs its words", "x gh pr-review-comments-reply "+id+" --body-file <file>")
	}
	body, err := os.ReadFile(file)
	if err != nil || strings.TrimSpace(string(body)) == "" {
		return nil, usageFail("no reply in "+file, "x gh pr-review-comments-reply "+id+" --body-file <a markdown file>")
	}
	var answer struct {
		AddPullRequestReviewThreadReply struct {
			Comment struct {
				URL string `json:"url"`
			} `json:"comment"`
		} `json:"addPullRequestReviewThreadReply"`
	}
	r.Wait("replying under "+id, func() {
		err = ghGraphQL(replyMutation, map[string]any{"thread": id, "body": string(body)}, &answer)
	})
	if err != nil {
		return nil, err
	}
	link := answer.AddPullRequestReviewThreadReply.Comment.URL
	r.Done("replied: "+link, "x gh pr-review-comments-list")
	return ordered{{"thread", id}, {"url", link}}, nil
}

/* Github */

// the open threads in github's order, each with its first comment's words
func openThreads(repo, n string) ([]reviewThread, error) {
	owner, name, _ := strings.Cut(repo, "/")
	pr, _ := strconv.Atoi(n)
	threads := []reviewThread{}
	vars := map[string]any{"owner": owner, "name": name, "pr": pr}
	for {
		var page struct {
			Repository struct {
				PullRequest *struct {
					ReviewThreads struct {
						PageInfo struct {
							HasNextPage bool   `json:"hasNextPage"`
							EndCursor   string `json:"endCursor"`
						} `json:"pageInfo"`
						Nodes []struct {
							ID           string `json:"id"`
							IsResolved   bool   `json:"isResolved"`
							Path         string `json:"path"`
							Line         *int   `json:"line"`
							OriginalLine *int   `json:"originalLine"`
							Comments     struct {
								Nodes []struct {
									Body   string `json:"body"`
									Author struct {
										Login string `json:"login"`
									} `json:"author"`
								} `json:"nodes"`
							} `json:"comments"`
						} `json:"nodes"`
					} `json:"reviewThreads"`
				} `json:"pullRequest"`
			} `json:"repository"`
		}
		if err := ghGraphQL(threadsQuery, vars, &page); err != nil {
			return nil, err
		}
		if page.Repository.PullRequest == nil {
			return nil, &Fail{Msg: "no pr #" + n + " in " + repo, Next: "x gh pr-review-comments-list <pr number> --repo " + repo}
		}
		got := page.Repository.PullRequest.ReviewThreads
		for _, node := range got.Nodes {
			if node.IsResolved {
				continue
			}
			t := reviewThread{ID: node.ID, File: node.Path, Outdated: node.Line == nil}
			if line := cmp.Or(node.Line, node.OriginalLine); line != nil {
				t.Line = *line
			}
			if len(node.Comments.Nodes) > 0 {
				first := node.Comments.Nodes[0]
				t.Words, t.Author = firstWords(first.Body), first.Author.Login
			}
			threads = append(threads, t)
		}
		if !got.PageInfo.HasNextPage {
			return threads, nil
		}
		vars["after"] = got.PageInfo.EndCursor
	}
}

// a comment's first line, cut at 80 runes
func firstWords(body string) string {
	line, _, _ := strings.Cut(strings.TrimSpace(body), "\n")
	if runes := []rune(line); len(runes) > 80 {
		return string(runes[:79]) + "…"
	}
	return line
}

// the open pr whose head is the cwd's branch
func branchPr(repo string) (string, error) {
	branch, _ := gitIn("", "symbolic-ref", "--quiet", "--short", "HEAD")
	name := strings.TrimSpace(branch.out)
	if !branch.ok || name == "" {
		return "", usageFail("no branch here to find the pr from", "x gh pr-review-comments-list <pr number>")
	}
	owner, _, _ := strings.Cut(repo, "/")
	var open []struct {
		Number int `json:"number"`
	}
	if _, err := ghFetch(asCodie, githubBase()+"/repos/"+repo+"/pulls?state=open&head="+url.QueryEscape(owner+":"+name), &open); err != nil {
		return "", err
	}
	if len(open) == 0 {
		return "", &Fail{Msg: "no open pr from " + name + " in " + repo, Next: "x gh pr-review-comments-list <pr number>"}
	}
	return strconv.Itoa(open[0].Number), nil
}

// one graphql call as the x-codie-cc app; an error github names in the answer fails it
func ghGraphQL(query string, vars map[string]any, into any) error {
	var answer struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if _, _, err := ghSend(asCodie, http.MethodPost, githubBase()+"/graphql", map[string]any{"query": query, "variables": vars}, &answer); err != nil {
		return err
	}
	if len(answer.Errors) > 0 {
		return &Fail{Msg: "github's graphql answered: " + answer.Errors[0].Message, Next: "x as codie -- gh api graphql"}
	}
	if err := json.Unmarshal(answer.Data, into); err != nil {
		return &Fail{Msg: "github's graphql answered data x cannot read", Next: "x as codie -- gh api graphql"}
	}
	return nil
}
