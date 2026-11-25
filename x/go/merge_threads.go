package main

import (
	"fmt"
	"net/http"
	"strings"
)

func threadsCheck(repo, n string) (mergeCheck, error) {
	c := mergeCheck{Name: "threads"}
	owner, name, _ := strings.Cut(repo, "/")
	var answer struct {
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
		Data struct {
			Repository struct {
				PullRequest *struct {
					ReviewThreads struct {
						PageInfo struct {
							HasNextPage bool `json:"hasNextPage"`
						} `json:"pageInfo"`
						Nodes []struct {
							IsResolved bool   `json:"isResolved"`
							Path       string `json:"path"`
							Line       *int   `json:"line"`
							Comments   struct {
								Nodes []struct {
									URL string `json:"url"`
								} `json:"nodes"`
							} `json:"comments"`
						} `json:"nodes"`
					} `json:"reviewThreads"`
				} `json:"pullRequest"`
			} `json:"repository"`
		} `json:"data"`
	}
	query := `query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){
reviewThreads(first:100){pageInfo{hasNextPage} nodes{isResolved path line comments(first:1){nodes{url}}}}}}}`
	var number int
	_, _ = fmt.Sscan(n, &number)
	if _, _, err := ghSend(asDima, http.MethodPost, githubBase()+"/graphql", map[string]any{
		"query": query, "variables": map[string]any{"owner": owner, "name": name, "number": number},
	}, &answer); err != nil {
		return c, err
	}
	// github answers a graphql failure with a 200: an error or a missing pr must never read as 0 open threads
	pr := answer.Data.Repository.PullRequest
	if len(answer.Errors) > 0 || pr == nil {
		said := "no pull request in the answer"
		if len(answer.Errors) > 0 {
			said = answer.Errors[0].Message
		}
		return c, &Fail{Msg: "github could not list the review threads of #" + n + ": " + said, Next: "x gh pr " + n}
	}
	if pr.ReviewThreads.PageInfo.HasNextPage {
		c.Detail = "over 100 review threads, more than one read holds"
		return c, nil
	}
	var open []string
	for _, t := range pr.ReviewThreads.Nodes {
		if t.IsResolved {
			continue
		}
		where := t.Path
		if t.Line != nil {
			where = fmt.Sprintf("%s:%d", t.Path, *t.Line)
		}
		if len(t.Comments.Nodes) > 0 {
			where += " " + t.Comments.Nodes[0].URL
		}
		open = append(open, where)
	}
	if len(open) > 0 {
		c.Detail = plural(len(open), "open review thread") + ": " + strings.Join(open, ", ")
		return c, nil
	}
	c.OK, c.Detail = true, "0 open"
	return c, nil
}
