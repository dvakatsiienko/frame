package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"charm.land/lipgloss/v2"
)

// deploy and tracker bots post on every push; their comments are never a reviewer's word
var mutedAuthors = []string{"vercel[bot]", "linear-code[bot]"}

var (
	repoSlug   = regexp.MustCompile(`^[\w.-]+/[\w.-]+$`)
	remoteSlug = regexp.MustCompile(`github\.com[:/]([\w.-]+/[\w.-]+?)(?:\.git)?/?$`)
	nextLink   = regexp.MustCompile(`<([^>]+)>;\s*rel="next"`)
)

// the three places github keeps a pr's comments; the ci reviewer posts to a different one per round
var prFeeds = []struct{ key, title, path string }{
	{"comments", "comments", "/issues/%s/comments"},
	{"reviews", "reviews", "/pulls/%s/reviews"},
	{"reviewComments", "review comments", "/pulls/%s/comments"},
}

type prCheck struct {
	Name  string `json:"name"`
	State string `json:"state"`
	URL   string `json:"url,omitempty"`
}

type prComment struct {
	Author   string `json:"author"`
	At       string `json:"at"`
	Where    string `json:"where,omitempty"`
	Outdated bool   `json:"outdated,omitempty"`
	State    string `json:"state,omitempty"`
	Body     string `json:"body"`
	URL      string `json:"url"`
	at       time.Time
}

type prRead struct {
	repo, pr, title, state, branch, head, read, since string
	checks                                            []prCheck
	feeds                                             [][]prComment
}

func (p prRead) envelope() ordered {
	data := ordered{{"repo", p.repo}, {"pr", p.pr}, {"title", p.title}, {"state", p.state}, {"branch", p.branch},
		{"head", p.head}, {"read", p.read}}
	if p.since != "" {
		data = append(data, kv{"since", p.since})
	}
	data = append(data, kv{"checks", p.checks})
	for i, feed := range prFeeds {
		data = append(data, kv{feed.key, p.feeds[i]})
	}
	return data
}

type ghComment struct {
	User struct {
		Login string `json:"login"`
	} `json:"user"`
	Updated      time.Time `json:"updated_at"`
	Created      time.Time `json:"created_at"`
	Submitted    time.Time `json:"submitted_at"`
	State        string    `json:"state"`
	Body         string    `json:"body"`
	Path         string    `json:"path"`
	Line         *int      `json:"line"`
	OriginalLine *int      `json:"original_line"`
	URL          string    `json:"html_url"`
}

/* Verbs */
func ghPr(r *Run, args []string, flags Flags) (any, error) {
	n := args[0]
	if !prNumber.MatchString(n) {
		return nil, usageFail(n+" is not a pr number", "x gh pr <pr number>")
	}
	var since time.Time
	if raw, _ := flags["since"].(string); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, usageFail("--since "+raw+" is not an RFC 3339 time", "x gh pr "+n+" --since 2026-10-09T15:00:00Z")
		}
		since = parsed
	}
	repo, err := repoOf(flags)
	if err != nil {
		return nil, err
	}
	read := prRead{repo: repo, pr: n, feeds: make([][]prComment, len(prFeeds))}
	if !since.IsZero() {
		read.since = since.UTC().Format(time.RFC3339)
	}
	r.Wait("reading #"+n+" in "+repo, func() {
		base := githubBase() + "/repos/" + repo
		var pr struct {
			Title  string `json:"title"`
			State  string `json:"state"`
			Merged bool   `json:"merged"`
			Head   struct {
				Sha string `json:"sha"`
				Ref string `json:"ref"`
			} `json:"head"`
		}
		var header http.Header
		if header, err = ghFetch(asCodie, base+"/pulls/"+n, &pr); err != nil {
			return
		}
		// github's clock, read before the feeds: the next --since misses nothing posted while they ran
		at, dateErr := http.ParseTime(header.Get("Date"))
		if dateErr != nil {
			at = time.Now()
		}
		read.read = at.UTC().Format(time.RFC3339)
		read.title, read.state, read.branch, read.head = pr.Title, pr.State, pr.Head.Ref, pr.Head.Sha
		if pr.Merged {
			read.state = "merged"
		}
		if read.checks, err = checksOf(asCodie, base, pr.Head.Sha); err != nil {
			return
		}
		for i, feed := range prFeeds {
			var comments []ghComment
			if comments, err = ghPages[ghComment](asCodie, base+fmt.Sprintf(feed.path, n), ""); err != nil {
				return
			}
			read.feeds[i] = commentsOf(comments, since)
		}
	})
	if err != nil {
		return nil, err
	}
	if r.human {
		next := "x gh pr " + n + " --since " + read.read
		if given, _ := flags["repo"].(string); given != "" {
			next += " --repo " + repo
		}
		r.Page(prBoard(read, next))
	}
	return read.envelope(), nil
}

// a comment's time is its last edit: the ci reviewer lands its verdict by editing its «working…» comment
// (atelier #115). github stamps whole seconds, so a comment in the cutoff's own second counts as newer.
// a review with no words and no verdict only wraps its line comments; a pending one is unsent
func commentsOf(comments []ghComment, since time.Time) []prComment {
	out := []prComment{}
	for _, c := range comments {
		at := cmp.Or(c.Updated, c.Created, c.Submitted)
		silent := c.State == "COMMENTED" && strings.TrimSpace(c.Body) == ""
		if at.IsZero() || silent || slices.Contains(mutedAuthors, c.User.Login) || at.Before(since) {
			continue
		}
		where := c.Path
		if line := cmp.Or(c.Line, c.OriginalLine); c.Path != "" && line != nil {
			where = fmt.Sprintf("%s:%d", c.Path, *line)
		}
		out = append(out, prComment{Author: c.User.Login, At: at.UTC().Format(time.RFC3339), Where: where,
			Outdated: c.Path != "" && c.Line == nil, State: c.State, Body: c.Body, URL: c.URL, at: at})
	}
	slices.SortStableFunc(out, func(a, b prComment) int { return b.at.Compare(a.at) })
	return out
}

// github keeps two kinds: check runs (actions, apps) and commit statuses (vercel); the pr page shows both
func checksOf(as, base, sha string) ([]prCheck, error) {
	type run struct {
		Name       string `json:"name"`
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
		URL        string `json:"html_url"`
	}
	type status struct {
		Context string `json:"context"`
		State   string `json:"state"`
		URL     string `json:"target_url"`
	}
	runs, err := ghPages[run](as, base+"/commits/"+sha+"/check-runs", "check_runs")
	if err != nil {
		return nil, err
	}
	statuses, err := ghPages[status](as, base+"/commits/"+sha+"/statuses", "")
	if err != nil {
		return nil, err
	}
	checks := []prCheck{}
	for _, c := range runs {
		state := c.Conclusion
		if c.Status != "completed" {
			state = c.Status
		}
		checks = append(checks, prCheck{c.Name, state, c.URL})
	}
	// the statuses list holds every state a context went through, newest first: the first one counts
	seen := map[string]bool{}
	for _, s := range statuses {
		if !seen[s.Context] {
			seen[s.Context] = true
			checks = append(checks, prCheck{s.Context, s.State, s.URL})
		}
	}
	slices.SortStableFunc(checks, func(a, b prCheck) int { return strings.Compare(a.Name, b.Name) })
	return checks, nil
}

func repoOf(flags Flags) (string, error) {
	if repo, _ := flags["repo"].(string); repo != "" {
		if !repoSlug.MatchString(repo) {
			return "", usageFail(repo+" is not owner/name", "x gh pr <pr number> --repo dvakatsiienko/frame")
		}
		return repo, nil
	}
	if slug := originSlugIn(""); slug != "" {
		return slug, nil
	}
	return "", usageFail("no github origin here to read the repo from", "x gh pr <pr number> --repo <owner/name>")
}

// originSlugIn reads owner/name off dir's origin; an insteadOf rewrite can carry it in the configured url or the rewritten one
func originSlugIn(dir string) string {
	for _, read := range [][]string{{"config", "--get", "remote.origin.url"}, {"remote", "get-url", "origin"}} {
		got, _ := gitIn(dir, read...)
		if match := remoteSlug.FindStringSubmatch(strings.TrimSpace(got.out)); got.ok && match != nil {
			return match[1]
		}
	}
	return ""
}

/* Github */

// dima's own login does what the codie app may not: branch protection (admin), an approve, a merge
const (
	asCodie = "codie"
	asDima  = "dima"
)

// ghPages follows the Link header to the last page; key names the list inside an object page
func ghPages[T any](as, target, key string) ([]T, error) {
	var all []T
	target += "?per_page=100"
	for target != "" {
		var raw json.RawMessage
		header, err := ghFetch(as, target, &raw)
		if err != nil {
			return nil, err
		}
		if key != "" {
			var page map[string]json.RawMessage
			_ = json.Unmarshal(raw, &page)
			raw = page[key]
		}
		var items []T
		if err := json.Unmarshal(raw, &items); err != nil {
			path := strings.TrimPrefix(target, githubBase()+"/")
			return nil, &Fail{Msg: "github answered a page x cannot read at " + path, Next: ghAPINext(as, path)}
		}
		all = append(all, items...)
		target = ""
		if match := nextLink.FindStringSubmatch(header.Get("Link")); match != nil {
			target = match[1]
		}
	}
	return all, nil
}

func ghFetch(as, target string, into any) (http.Header, error) {
	_, header, err := ghSend(as, http.MethodGet, target, nil, into)
	return header, err
}

// ghSend sends one github api request and answers its status too; a body goes as json, a nil into skips the answer
func ghSend(as, method, target string, body, into any) (int, http.Header, error) {
	token, err := githubToken(as)
	if err != nil {
		return 0, nil, err
	}
	var payload io.Reader
	if body != nil {
		encoded, _ := json.Marshal(body)
		payload = bytes.NewReader(encoded)
	}
	req, err := http.NewRequest(method, target, payload)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	path := strings.TrimPrefix(req.URL.Path, "/")
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, nil, &Fail{Msg: "github is unreachable: " + err.Error(), Next: ghAPINext(as, path)}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	switch {
	case resp.StatusCode == http.StatusNotFound && as == asCodie:
		return resp.StatusCode, nil, &Fail{Msg: "github answered 404 for " + path + " — no such pr, or the codie app is not installed on the repo",
			Next: ghAPINext(as, path)}
	case resp.StatusCode >= 300:
		var said struct {
			Message string `json:"message"`
		}
		_ = json.Unmarshal(raw, &said)
		msg := fmt.Sprintf("github answered %d for %s", resp.StatusCode, path)
		if said.Message != "" {
			msg += ": " + said.Message
		}
		return resp.StatusCode, nil, &Fail{Msg: msg, Next: ghAPINext(as, path), Log: nonBlank(string(raw))}
	}
	if into != nil {
		if err := json.Unmarshal(raw, into); err != nil {
			return resp.StatusCode, nil, &Fail{Msg: "github answered json x cannot read at " + path, Next: ghAPINext(as, path)}
		}
	}
	return resp.StatusCode, resp.Header, nil
}

// dima's token is gh's own login, read per call and never cached (keys.go)
func githubToken(as string) (string, error) {
	token, err := tokenFor(as, "gh")
	if err != nil {
		return "", &Fail{Msg: "no gh token for the " + as + " app: " + err.Error(), Next: "x schema as"}
	}
	if token != "" {
		return token, nil
	}
	got, _ := run("", nil, "", "gh", "auth", "token")
	if !got.ok || got.out == "" {
		return "", &Fail{Msg: "gh holds no login to act as dima", Next: "gh auth login", Log: nonBlank(got.log)}
	}
	return got.out, nil
}

func ghAPINext(as, path string) string {
	if as == asCodie {
		return "x as codie -- gh api " + path
	}
	return "gh api " + path
}

/* Board */
func prBoard(p prRead, next string) frame {
	b := frame{width: frameWidth(), titleLeft: titleOf("gh pr"), titleRight: ui.dim.Render("#" + p.pr + " " + p.repo), padRows: true}
	w := b.inner()
	state := ui.dim
	switch p.state {
	case "open":
		state = ui.ok
	case "merged":
		state = lipgloss.NewStyle().Foreground(ui.familyColor("gh"))
	}
	stateText := state.Bold(true).Render("● " + p.state)
	head := ui.bold.Render("#"+p.pr) + "  " + ui.fg.Render(p.title)
	b.rows = append(b.rows, clip(head, w-lipgloss.Width(stateText)-1)+strings.Repeat(" ", max(w-lipgloss.Width(head)-lipgloss.Width(stateText), 1))+stateText)
	b.rows = append(b.rows, ui.dim.Render(clip(p.branch+" at "+short(p.head), w)))

	b.rows = append(b.rows, "", ui.label.Render(fmt.Sprintf("checks (%d)", len(p.checks))))
	if len(p.checks) == 0 {
		b.rows = append(b.rows, "  "+ui.dim.Render("none on the head"))
	}
	for _, c := range p.checks {
		mark := ui.dim
		switch c.State {
		case "success":
			mark = ui.ok
		case "failure", "error", "cancelled", "timed_out", "action_required":
			mark = ui.er
		}
		b.rows = append(b.rows, "  "+mark.Render("●")+" "+ui.fg.Render(clip(c.Name, w-24))+"  "+mark.Render(c.State))
	}

	for i, feed := range prFeeds {
		heading := fmt.Sprintf("%s (%d)", feed.title, len(p.feeds[i]))
		if p.since != "" {
			heading += ", since " + p.since
		}
		b.rows = append(b.rows, "", ui.label.Render(heading))
		if len(p.feeds[i]) == 0 {
			b.rows = append(b.rows, "  "+ui.dim.Render("none"))
		}
		for _, c := range p.feeds[i] {
			meta := []string{c.At}
			if c.State != "" && c.State != "COMMENTED" {
				meta = append(meta, strings.ToLower(strings.ReplaceAll(c.State, "_", " ")))
			}
			if c.Where != "" {
				meta = append(meta, c.Where)
			}
			if c.Outdated {
				meta = append(meta, "outdated")
			}
			b.rows = append(b.rows, "", "  "+ui.bold.Render(c.Author)+"  "+ui.dim.Render(clip(strings.Join(meta, "  "), w-lipgloss.Width(c.Author)-4)))
			if strings.TrimSpace(c.Body) != "" {
				for _, line := range markdown(c.Body, w-2) {
					b.rows = append(b.rows, "  "+line)
				}
			}
		}
	}
	b.footLeft = ui.dim.Render("next poll:") + " " + cmd(next)
	return b
}
