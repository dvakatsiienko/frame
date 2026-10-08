package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// the bytes review lane: the label starts a round, a successful review.yml run on the branch is one round,
// two rounds per pr, and past them dima's approval publishes review:clean (bytes .github/workflows)
const (
	reviewLabel = "🤖 review:requested"
	reviewCap   = 2
)

var prNumber = regexp.MustCompile(`^\d+$`)

type prHead struct {
	Title       string  `json:"title"`
	HeadRefName string  `json:"headRefName"`
	HeadRefOid  string  `json:"headRefOid"`
	Labels      []label `json:"labels"`
}

type label struct {
	Name string `json:"name"`
}

type reviewRun struct {
	RunNumber  int    `json:"run_number"`
	HeadBranch string `json:"head_branch"`
	HeadSha    string `json:"head_sha"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
}

/* Verbs */
func laneReview(r *Run, args []string, _ Flags) (any, error) {
	n := args[0]
	if !prNumber.MatchString(n) {
		return nil, usageFail(n+" is not a pr number", "x lane review <pr number>")
	}
	r.Open("#" + n)
	var pr prHead
	if err := r.Step("pr", "reading the pr head", func() (string, error) {
		var err error
		pr, err = readPR(n)
		return pr.HeadRefName + " at " + short(pr.HeadRefOid), err
	}); err != nil {
		return nil, err
	}
	head := pr.HeadRefOid

	var rounds []reviewRun
	running, hasLane := false, true
	if err := r.Step("rounds", "counting the review rounds", func() (string, error) {
		all, found, err := reviewRuns(pr.HeadRefName)
		if err != nil || !found {
			hasLane = false
			return "no review.yml in this repo", err
		}
		for _, run := range all {
			switch {
			case run.Status != "completed" && run.HeadSha == head:
				running = true
			case run.Conclusion == "success":
				rounds = append(rounds, run)
			}
		}
		slices.SortFunc(rounds, func(a, b reviewRun) int { return a.RunNumber - b.RunNumber })
		detail := fmt.Sprintf("%d of %d", len(rounds), reviewCap)
		if len(rounds) > 0 {
			detail += ", the last judged " + short(rounds[len(rounds)-1].HeadSha)
		}
		return detail, nil
	}); err != nil {
		return nil, err
	}

	judged := ""
	if len(rounds) > 0 {
		judged = rounds[len(rounds)-1].HeadSha
	}
	data := func(review string) ordered {
		return ordered{{"pr", n}, {"branch", pr.HeadRefName}, {"head", head}, {"judged", judged},
			{"rounds", len(rounds)}, {"cap", reviewCap}, {"review", review}}
	}
	switch {
	case !hasLane:
		r.skip("request")
		r.Done("no review lane here, nothing to judge", "")
		return data("no lane"), nil
	case running:
		r.skip("request")
		r.Done("a round is running on "+short(head), "")
		return data("running"), nil
	case judged == head:
		r.skip("request")
		r.Done("ok: the verdict judged the head "+short(head), "")
		return data("current"), nil
	case len(rounds) >= reviewCap:
		return nil, &Fail{Refused: true,
			Msg: fmt.Sprintf("%d review rounds ran on %s, the last judged %s, the head is %s — a third round is dima's: he approves #%s on github, and review-approved.yml publishes review:clean on the head he approved",
				len(rounds), pr.HeadRefName, short(judged), short(head), n),
			Next: "ask cclio to relay: dima approves #" + n}
	}

	if err := r.Step("request", "re-labelling "+reviewLabel, func() (string, error) {
		// a label already on the pr fires no event: only a fresh add starts a round
		if slices.Contains(pr.Labels, label{reviewLabel}) {
			if err := ghCoderOK("pr", "edit", n, "--remove-label", reviewLabel); err != nil {
				return "", err
			}
		}
		if err := ghCoderOK("pr", "edit", n, "--add-label", reviewLabel); err != nil {
			return "", err
		}
		return fmt.Sprintf("round %d of %d on %s", len(rounds)+1, reviewCap, short(head)), nil
	}); err != nil {
		return nil, err
	}
	verdict := "no verdict yet"
	if judged != "" {
		verdict = "the last verdict judged " + short(judged)
	}
	r.Done(fmt.Sprintf("review requested on %s; %s", short(head), verdict), "x lane review "+n)
	return data("requested"), nil
}

func prBodyPlan(r *Run, args []string, _ Flags) (any, error) {
	n, file := args[0], args[1]
	if !prNumber.MatchString(n) {
		return nil, usageFail(n+" is not a pr number", "x lane pr-body <pr number> <body-file>")
	}
	body, err := os.ReadFile(file)
	if err != nil {
		return nil, usageFail("no body file at "+file, "x lane pr-body "+n+" <body-file>")
	}
	r.Open("#" + n)
	var pr prHead
	if err := r.Step("plan", "reading the pr the number names", func() (string, error) {
		var err error
		pr, err = readPR(n)
		return fmt.Sprintf("%s (%s) ← %s, %s", pr.Title, pr.HeadRefName, filepath.Base(file), plural(strings.Count(string(body), "\n"), "line")), err
	}); err != nil {
		return nil, err
	}
	abs, _ := filepath.Abs(file)
	return ordered{{"pr", n}, {"title", pr.Title}, {"branch", pr.HeadRefName}, {"file", abs}}, nil
}

func askPRBody(plan any) string {
	fields := plan.(ordered)
	return fmt.Sprintf("write %s as the body of #%s «%s»?", filepath.Base(fields[3].value.(string)), fields[0].value, fields[1].value)
}

func prBody(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	n, file := fields[0].value.(string), fields[3].value.(string)
	if err := r.Step("write", "gh pr edit as x-coder-cc", func() (string, error) {
		return "#" + n, ghCoderOK("pr", "edit", n, "--body-file", file)
	}); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the body back", func() (string, error) {
		want, err := os.ReadFile(file)
		if err != nil {
			return "", err
		}
		got, err := ghCoder("pr", "view", n, "--json", "body", "--jq", ".body")
		if err != nil {
			return "", err
		}
		if normal(got.out) != normal(string(want)) {
			return "", &Fail{Msg: "the body on #" + n + " differs from " + home(file), Next: "gh pr view " + n + " --json body"}
		}
		return "the body on #" + n + " matches " + filepath.Base(file), nil
	}); err != nil {
		return nil, err
	}
	r.Done("#"+n+" holds "+filepath.Base(file), "")
	return ordered{{"pr", n}, {"title", fields[1].value}, {"file", file}}, nil
}

/* Github */
func readPR(n string) (prHead, error) {
	got, err := ghCoder("pr", "view", n, "--json", "title,headRefName,headRefOid,labels")
	if err != nil {
		return prHead{}, err
	}
	var pr prHead
	if json.Unmarshal([]byte(got.out), &pr) != nil || pr.HeadRefOid == "" {
		return prHead{}, &Fail{Msg: "gh pr view " + n + " answered no head", Next: "gh pr view " + n, Log: nonBlank(got.log)}
	}
	return pr, nil
}

// every run of review.yml, filtered on the client: the server's ?branch= answered 0 over a success (#116);
// found is false when the repo has no review lane at all
func reviewRuns(branch string) ([]reviewRun, bool, error) {
	got, _ := ghRaw("api", "--paginate", "repos/{owner}/{repo}/actions/workflows/review.yml/runs?per_page=100", "--jq", ".workflow_runs[]")
	if !got.ok {
		if strings.Contains(got.log, "Not Found") || strings.Contains(got.log, "404") {
			return nil, false, nil
		}
		return nil, false, &Fail{Msg: "gh could not list the review runs — its output is above", Next: "gh run list --workflow review.yml", Log: nonBlank(got.log)}
	}
	var runs []reviewRun
	decoder := json.NewDecoder(strings.NewReader(got.out))
	for {
		var run reviewRun
		if err := decoder.Decode(&run); err == io.EOF {
			break
		} else if err != nil {
			return nil, true, &Fail{Msg: "gh answered runs x cannot read: " + err.Error(), Next: "gh run list --workflow review.yml"}
		}
		if run.HeadBranch == branch {
			runs = append(runs, run)
		}
	}
	return runs, true, nil
}

// ghCoder runs gh as the x-coder-cc app, the identity every lane write on github wears
func ghCoder(args ...string) (result, error) {
	got, err := ghRaw(args...)
	if err == nil && !got.ok {
		return got, &Fail{Msg: "gh " + strings.Join(args[:min(2, len(args))], " ") + " failed — its output is above", Next: "gh auth status", Log: nonBlank(got.log)}
	}
	return got, err
}

func ghCoderOK(args ...string) error { _, err := ghCoder(args...); return err }

// ghRaw leaves a failed gh in the result, for a caller that reads its words
func ghRaw(args ...string) (result, error) {
	token, err := tokenFor("coder", "gh")
	if err != nil {
		return result{}, &Fail{Msg: "no gh token for the coder app: " + err.Error(), Next: "x schema as"}
	}
	got, _ := run("", []string{"GH_TOKEN=" + token}, "", "gh", args...)
	return got, nil
}

func normal(text string) string { return strings.TrimSpace(strings.ReplaceAll(text, "\r\n", "\n")) }
