package main

import (
	"fmt"
	"os"
	"slices"
	"strings"
)

// the repos whose merges need a reviewer round: the one cold read every tier keeps
func roundGated(repo string) bool {
	if mergeTestEnvOn() {
		return repo == os.Getenv("X_ROUND_REPO")
	}
	return slices.Contains([]string{"dvakatsiienko/bytes", "dvakatsiienko/frame"}, repo)
}

// a run's jobs, as github answers /actions/runs/<id>/jobs
type runJobs struct {
	Jobs []runJob `json:"jobs"`
}

type runJob struct {
	Name       string `json:"name"`
	Conclusion string `json:"conclusion"`
	Steps      []struct {
		Name       string `json:"name"`
		Conclusion string `json:"conclusion"`
	} `json:"steps"`
}

// a run counts as a round only here: a green run can hold a skipped job
func (j runJobs) reviewerFinished() bool {
	return slices.ContainsFunc(j.Jobs, func(job runJob) bool {
		return strings.HasSuffix(job.Name, "reviewer") && job.Conclusion == "success"
	})
}

// the steps that end a round red when the reviewer posted nothing; a findings round ends green (review-round.yml)
var standDownSteps = []string{"A green review means a clean review", "A round with no review is red"}

// a run reaches the head from its history, or by a rebase that kept the code, as a clean carries (dima, o66, o95)
func roundReaches(sha, head, base, ref string) bool {
	if ok(gitIn("", "merge-base", "--is-ancestor", sha, head)) {
		return true
	}
	carries, _ := carried(sha, "the reviewer", head, base, ref)
	return carries
}

// a round is a run of review.yml whose reviewer job itself finished, reaching the head: a green run can hold a
// skipped job, a branch name can be reused, and sixth sense's clean on the head covers the commits after it.
// the server's ?branch= filter once answered 0 over a success (review.go, #116): filtered here instead
func roundCheck(api, repo, n, base, ref, head, author string, dimaOK bool) (mergeCheck, error) {
	c := mergeCheck{Name: "round"}
	switch {
	case !roundGated(repo):
		c.OK, c.Detail = true, "no round asked on "+repo
		return c, nil
	case renovateAuthor(author):
		c.OK, c.Detail = true, "renovate's pr, ci is its review"
		return c, nil
	}
	type run struct {
		ID         int64  `json:"id"`
		HeadBranch string `json:"head_branch"`
		HeadSha    string `json:"head_sha"`
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
	}
	runs, err := ghPages[run](asDima, api+"/actions/workflows/review.yml/runs", "workflow_runs")
	if err != nil {
		return c, err
	}
	if got, _ := gitIn("", "fetch", "-q", "origin", "refs/heads/"+ref); !got.ok {
		c.Detail = "git could not fetch " + ref + " to read the round's history: " + logLine(got.log)
		return c, nil
	}
	stoodDown := false
	for _, r := range runs {
		if r.HeadBranch != ref || r.Status != "completed" || (r.Conclusion != "success" && r.Conclusion != "failure") ||
			!roundReaches(r.HeadSha, head, base, ref) {
			continue
		}
		var answer runJobs
		if _, err := ghFetch(asDima, fmt.Sprintf("%s/actions/runs/%d/jobs", api, r.ID), &answer); err != nil {
			return c, err
		}
		if answer.reviewerFinished() {
			c.OK, c.Detail = true, "the reviewer finished a round on "+short(r.HeadSha)
			return c, nil
		}
		for _, job := range answer.Jobs {
			for _, step := range job.Steps {
				stoodDown = stoodDown || (step.Conclusion == "failure" && slices.Contains(standDownSteps, step.Name))
			}
		}
	}
	switch {
	case stoodDown && dimaOK:
		c.OK, c.Detail = true, "the reviewer stood down on #"+n+", landing on dima's word"
	case stoodDown:
		c.Detail = "the reviewer stood down on #" + n + ", posting nothing, so it holds no round; it lands on dima's word, his prompt or a tick quoting it: x lane merge-auto " + n + " --apply --dima-ok " + n + "; that red can also be a failed read: x lane review " + n
	default:
		c.Detail = "no reviewer round finished in " + ref + "'s history — x lane review " + n
	}
	return c, nil
}
