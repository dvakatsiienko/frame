package main

import (
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

type prCheck struct {
	Name  string `json:"name"`
	State string `json:"state"`
	URL   string `json:"url,omitempty"`
}

type prComment struct {
	Author string `json:"author"`
	At     string `json:"at"`
	Where  string `json:"where,omitempty"`
	State  string `json:"state,omitempty"`
	Body   string `json:"body"`
	URL    string `json:"url"`
	at     time.Time
}

type ghUser struct {
	Login string `json:"login"`
}

type ghNote struct {
	User         ghUser    `json:"user"`
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
	// taken before the reads, so a comment posted while they run is still newer than the next --since
	read := time.Now().UTC().Format(time.RFC3339)
	var pr struct {
		Title  string `json:"title"`
		State  string `json:"state"`
		Merged bool   `json:"merged"`
		Head   struct {
			Sha string `json:"sha"`
			Ref string `json:"ref"`
		} `json:"head"`
	}
	var checks []prCheck
	var feeds [3][]prComment
	r.Wait("reading #"+n+" in "+repo, func() {
		base := "/repos/" + repo
		if err = ghGet(base+"/pulls/"+n, &pr); err != nil {
			return
		}
		if checks, err = checksOf(base, pr.Head.Sha); err != nil {
			return
		}
		for i, path := range []string{base + "/issues/" + n + "/comments", base + "/pulls/" + n + "/reviews", base + "/pulls/" + n + "/comments"} {
			var notes []ghNote
			if notes, err = ghPages[ghNote](path, ""); err != nil {
				return
			}
			feeds[i] = commentsOf(notes, since)
		}
	})
	if err != nil {
		return nil, err
	}
	state := pr.State
	if pr.Merged {
		state = "merged"
	}
	data := ordered{{"repo", repo}, {"pr", n}, {"title", pr.Title}, {"state", state}, {"branch", pr.Head.Ref},
		{"head", pr.Head.Sha}, {"read", read}}
	if !since.IsZero() {
		data = append(data, kv{"since", since.UTC().Format(time.RFC3339)})
	}
	data = append(data, kv{"checks", checks}, kv{"comments", feeds[0]}, kv{"reviews", feeds[1]}, kv{"reviewComments", feeds[2]})
	if r.human {
		next := "x gh pr " + n + " --since " + read
		if flags["repo"] != "" {
			next += " --repo " + repo
		}
		r.Page(prBoard(data, checks, feeds, next))
	}
	return data, nil
}

// a comment's time is its last edit: the ci reviewer lands its verdict by editing its «working…» comment
// (atelier #115). a review with no words and no verdict only wraps its line comments; a pending one is unsent
func commentsOf(notes []ghNote, since time.Time) []prComment {
	out := []prComment{}
	for _, note := range notes {
		at := note.Updated
		for _, t := range []time.Time{note.Created, note.Submitted} {
			if at.IsZero() {
				at = t
			}
		}
		silent := note.State == "COMMENTED" && strings.TrimSpace(note.Body) == ""
		if at.IsZero() || silent || slices.Contains(mutedAuthors, note.User.Login) || !at.After(since) {
			continue
		}
		where := ""
		if line := cmp.Or(note.Line, note.OriginalLine); note.Path != "" && line != nil {
			where = fmt.Sprintf("%s:%d", note.Path, *line)
		} else if note.Path != "" {
			where = note.Path
		}
		out = append(out, prComment{Author: note.User.Login, At: at.UTC().Format(time.RFC3339), Where: where,
			State: note.State, Body: note.Body, URL: note.URL, at: at})
	}
	slices.SortStableFunc(out, func(a, b prComment) int { return b.at.Compare(a.at) })
	return out
}

// github keeps two kinds: check runs (actions, apps) and commit statuses (vercel); the pr page shows both
func checksOf(base, sha string) ([]prCheck, error) {
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
	runs, err := ghPages[run](base+"/commits/"+sha+"/check-runs", "check_runs")
	if err != nil {
		return nil, err
	}
	statuses, err := ghPages[status](base+"/commits/"+sha+"/statuses", "")
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
	got, _ := gitIn("", "remote", "get-url", "origin")
	if match := remoteSlug.FindStringSubmatch(strings.TrimSpace(got.out)); got.ok && match != nil {
		return match[1], nil
	}
	return "", usageFail("no github origin here to read the repo from", "x gh pr <pr number> --repo <owner/name>")
}

/* Github */

// ghGet reads one github api path as the x-coder-cc app, the identity every lane call on github wears
func ghGet(path string, into any) error {
	_, err := ghFetch(githubBase()+path, into)
	return err
}

// ghPages follows the Link header to the last page; key names the list inside an object page
func ghPages[T any](path, key string) ([]T, error) {
	var all []T
	target := githubBase() + path + "?per_page=100"
	for target != "" {
		var raw json.RawMessage
		next, err := ghFetch(target, &raw)
		if err != nil {
			return nil, err
		}
		if key != "" {
			var page map[string]json.RawMessage
			if err := json.Unmarshal(raw, &page); err != nil {
				return nil, &Fail{Msg: "github answered a page x cannot read at " + path, Next: "x as coder -- gh api " + strings.TrimPrefix(path, "/")}
			}
			raw = page[key]
		}
		var items []T
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, &Fail{Msg: "github answered a page x cannot read at " + path, Next: "x as coder -- gh api " + strings.TrimPrefix(path, "/")}
		}
		all = append(all, items...)
		target = next
	}
	return all, nil
}

func ghFetch(target string, into any) (next string, err error) {
	token, err := tokenFor("coder", "gh")
	if err != nil {
		return "", &Fail{Msg: "no gh token for the coder app: " + err.Error(), Next: "x schema as"}
	}
	req, err := http.NewRequest(http.MethodGet, target, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", &Fail{Msg: "github is unreachable: " + err.Error(), Next: "x gh pr again once the network is back"}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	path := strings.TrimPrefix(req.URL.Path, "/")
	switch {
	case resp.StatusCode == http.StatusNotFound:
		return "", &Fail{Msg: "github answered 404 for " + path + " — no such pr, or the coder app is not installed on the repo",
			Next: "x as coder -- gh api " + path}
	case resp.StatusCode >= 300:
		return "", &Fail{Msg: fmt.Sprintf("github answered %d for %s", resp.StatusCode, path), Next: "x as coder -- gh api " + path,
			Log: nonBlank(string(raw))}
	}
	if err := json.Unmarshal(raw, into); err != nil {
		return "", &Fail{Msg: "github answered json x cannot read at " + path, Next: "x as coder -- gh api " + path}
	}
	if match := nextLink.FindStringSubmatch(resp.Header.Get("Link")); match != nil {
		next = match[1]
	}
	return next, nil
}

/* Board */
func prBoard(data ordered, checks []prCheck, feeds [3][]prComment, next string) frame {
	field := func(key string) string {
		for _, f := range data {
			if f.key == key {
				s, _ := f.value.(string)
				return s
			}
		}
		return ""
	}
	n := field("pr")
	b := frame{width: frameWidth(), titleLeft: titleOf("gh pr"), titleRight: ui.dim.Render("#" + n + " " + field("repo")), padRows: true}
	w := b.inner()
	state := ui.dim
	switch field("state") {
	case "open":
		state = ui.ok
	case "merged":
		state = lipgloss.NewStyle().Foreground(ui.familyColor("gh"))
	}
	stateText := state.Bold(true).Render("● " + field("state"))
	head := ui.bold.Render("#"+n) + "  " + ui.fg.Render(field("title"))
	b.rows = append(b.rows, clip(head, w-lipgloss.Width(stateText)-1)+strings.Repeat(" ", max(w-lipgloss.Width(head)-lipgloss.Width(stateText), 1))+stateText)
	b.rows = append(b.rows, ui.dim.Render(clip(field("branch")+" at "+short(field("head")), w)))

	b.rows = append(b.rows, "", ui.label.Render(fmt.Sprintf("checks (%d)", len(checks))))
	if len(checks) == 0 {
		b.rows = append(b.rows, "  "+ui.dim.Render("none on the head"))
	}
	for _, c := range checks {
		mark := ui.dim
		switch c.State {
		case "success":
			mark = ui.ok
		case "failure", "error", "cancelled", "timed_out", "action_required":
			mark = ui.er
		}
		b.rows = append(b.rows, "  "+mark.Render("●")+" "+ui.fg.Render(clip(c.Name, w-24))+"  "+mark.Render(c.State))
	}

	since := field("since")
	for i, title := range []string{"comments", "reviews", "review comments"} {
		heading := fmt.Sprintf("%s (%d)", title, len(feeds[i]))
		if since != "" {
			heading += ", since " + since
		}
		b.rows = append(b.rows, "", ui.label.Render(heading))
		if len(feeds[i]) == 0 {
			b.rows = append(b.rows, "  "+ui.dim.Render("none"))
		}
		for _, c := range feeds[i] {
			meta := []string{c.At}
			if c.State != "" && c.State != "COMMENTED" {
				meta = append(meta, strings.ToLower(strings.ReplaceAll(c.State, "_", " ")))
			}
			if c.Where != "" {
				meta = append(meta, c.Where)
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
