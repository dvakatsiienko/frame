package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/term"
)

var ticketShape = regexp.MustCompile(`^[A-Z]+-\d+$`)

// an agent acts as the cclio app, dima on his own terminal as himself; --as names anyone else
func actorOf(flags Flags) (string, error) {
	if named, _ := flags["as"].(string); named != "" {
		if !slices.Contains(members, named) {
			return "", usageFail("no member "+named+" — --as takes "+strings.Join(members, ", "), "x linear --help")
		}
		return named, nil
	}
	// only dima's own terminal acts as dima: a launchd job, a hook or cw's Desktop Commander has no tty
	if os.Getenv("CLAUDECODE") == "" && os.Getenv("AI_AGENT") == "" && term.IsTerminal(os.Stdin.Fd()) {
		return "dima", nil
	}
	return "cclio", nil
}

type gqlError struct {
	Message string `json:"message"`
	Path    []any  `json:"path"`
}

// gql sends one graphql request as the actor; a transport or auth failure is an external Fail, a
// graphql error comes back beside whatever data linear still answered
func gql(actor, query string, vars map[string]any) (map[string]json.RawMessage, []gqlError, error) {
	raw, status, err := post(actor, query, vars)
	if status == http.StatusUnauthorized {
		forget(actor, "linear")
		raw, status, err = post(actor, query, vars)
	}
	if err != nil {
		return nil, nil, err
	}
	var reply struct {
		Data   map[string]json.RawMessage `json:"data"`
		Errors []gqlError                 `json:"errors"`
	}
	if err := json.Unmarshal(raw, &reply); err != nil || status >= 500 || status == http.StatusUnauthorized {
		return nil, nil, &Fail{Msg: fmt.Sprintf("linear answered %d with no graphql reply", status), Next: "x as " + actor + " -- linear api 'query { viewer { name } }'"}
	}
	if reply.Data == nil && len(reply.Errors) > 0 && len(reply.Errors[0].Path) == 0 {
		return nil, nil, &Fail{Msg: "linear: " + reply.Errors[0].Message, Next: "x schema linear"}
	}
	return reply.Data, reply.Errors, nil
}

func post(actor, query string, vars map[string]any) ([]byte, int, error) {
	token, err := tokenFor(actor, "linear")
	if err != nil {
		return nil, 0, &Fail{Msg: "no linear token for " + actor + ": " + err.Error(), Next: "x schema as"}
	}
	traced.Actor = actor
	body, _ := json.Marshal(map[string]any{"query": query, "variables": vars})
	req, _ := http.NewRequest(http.MethodPost, linearBase()+"/graphql", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	authorize(req, token)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, &Fail{Msg: "linear did not answer: " + err.Error(), Next: "retry; linear's status page: https://linearstatus.com"}
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return raw, resp.StatusCode, nil
}

// a personal key goes bare, an oauth app token as a bearer
func authorize(req *http.Request, token string) {
	if strings.HasPrefix(token, "lin_api_") {
		req.Header.Set("Authorization", token)
	} else {
		req.Header.Set("Authorization", "Bearer "+token)
	}
}

/* read */

const issueFields = `identifier title url description priority estimate updatedAt
  state { name type } project { name } projectMilestone { name } parent { identifier title }
  labels(first: 50) { nodes { name } pageInfo { hasNextPage } }
  children(first: 50) { nodes { identifier title state { name } } pageInfo { hasNextPage } }`

const commentFields = `comments(first: 100) { nodes { body createdAt user { name } botActor { name } } pageInfo { hasNextPage } }`

const relationFields = `relations(first: 50) { nodes { type relatedIssue { identifier title state { name } } } pageInfo { hasNextPage } }
  inverseRelations(first: 50) { nodes { type issue { identifier title state { name } } } pageInfo { hasNextPage } }`

type connection[T any] struct {
	Nodes    []T `json:"nodes"`
	PageInfo struct {
		HasNextPage bool `json:"hasNextPage"`
	} `json:"pageInfo"`
}

type named struct {
	Name string `json:"name"`
}

type issueRef struct {
	Identifier string `json:"identifier"`
	Title      string `json:"title"`
	State      named  `json:"state"`
}

type rawIssue struct {
	Identifier  string   `json:"identifier"`
	Title       string   `json:"title"`
	URL         string   `json:"url"`
	Description *string  `json:"description"`
	Priority    int      `json:"priority"`
	Estimate    *float64 `json:"estimate"`
	UpdatedAt   string   `json:"updatedAt"`
	State       struct {
		Name string `json:"name"`
		Type string `json:"type"`
	} `json:"state"`
	Project   *named                `json:"project"`
	Milestone *named                `json:"projectMilestone"`
	Parent    *issueRef             `json:"parent"`
	Labels    connection[named]     `json:"labels"`
	Children  connection[issueRef]  `json:"children"`
	Comments  *connection[rawNote]  `json:"comments"`
	Relations *connection[relation] `json:"relations"`
	Inverse   *connection[inverse]  `json:"inverseRelations"`
	Files     *connection[struct {
		Title string `json:"title"`
		URL   string `json:"url"`
	}] `json:"attachments"`
}

type rawNote struct {
	Body      string `json:"body"`
	CreatedAt string `json:"createdAt"`
	User      *named `json:"user"`
	Bot       *named `json:"botActor"`
}

type relation struct {
	Type    string   `json:"type"`
	Related issueRef `json:"relatedIssue"`
}

type inverse struct {
	Type  string   `json:"type"`
	Issue issueRef `json:"issue"`
}

// the inverse side reads «X blocks me», so its verb flips for the reader
var inverseType = map[string]string{"blocks": "blocked by", "duplicate": "duplicated by", "related": "related"}

type ticketRef struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	State string `json:"state,omitempty"`
}

type note struct {
	Author string `json:"author"`
	At     string `json:"at"`
	Body   string `json:"body"`
}

type link struct {
	Type  string `json:"type"`
	ID    string `json:"id"`
	Title string `json:"title"`
	State string `json:"state"`
}

// a ticket as x prints it: names, never ids; a connection that hit its page size is listed in capped
type ticket struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	URL         string      `json:"url"`
	State       string      `json:"state"`
	StateType   string      `json:"stateType"`
	Priority    int         `json:"priority"`
	Estimate    *float64    `json:"estimate"`
	Project     string      `json:"project,omitempty"`
	Milestone   string      `json:"milestone,omitempty"`
	Parent      *ticketRef  `json:"parent,omitempty"`
	Labels      []string    `json:"labels"`
	Children    []ticketRef `json:"children"`
	Description string      `json:"description"`
	UpdatedAt   string      `json:"updatedAt"`
	Comments    []note      `json:"comments,omitempty"`
	Relations   []link      `json:"relations,omitempty"`
	Capped      []string    `json:"capped,omitempty"`
}

func (raw rawIssue) ticket() ticket {
	t := ticket{ID: raw.Identifier, Title: raw.Title, URL: raw.URL, State: raw.State.Name, StateType: raw.State.Type,
		Priority: raw.Priority, Estimate: raw.Estimate, UpdatedAt: raw.UpdatedAt, Labels: []string{}, Children: []ticketRef{}}
	if raw.Description != nil {
		t.Description = *raw.Description
	}
	if raw.Project != nil {
		t.Project = raw.Project.Name
	}
	if raw.Milestone != nil {
		t.Milestone = raw.Milestone.Name
	}
	if raw.Parent != nil {
		t.Parent = &ticketRef{ID: raw.Parent.Identifier, Title: raw.Parent.Title}
	}
	capped := func(name string, more bool) {
		if more {
			t.Capped = append(t.Capped, name)
		}
	}
	for _, label := range raw.Labels.Nodes {
		t.Labels = append(t.Labels, label.Name)
	}
	capped("labels", raw.Labels.PageInfo.HasNextPage)
	for _, child := range raw.Children.Nodes {
		t.Children = append(t.Children, ticketRef{child.Identifier, child.Title, child.State.Name})
	}
	capped("children", raw.Children.PageInfo.HasNextPage)
	if raw.Comments != nil {
		t.Comments = []note{}
		// linear answers newest first; the order comes from the full timestamp, the print keeps the day
		nodes := slices.SortedStableFunc(slices.Values(raw.Comments.Nodes), func(a, b rawNote) int { return strings.Compare(a.CreatedAt, b.CreatedAt) })
		for _, c := range nodes {
			author := "unknown"
			if c.User != nil {
				author = c.User.Name
			} else if c.Bot != nil {
				author = c.Bot.Name
			}
			t.Comments = append(t.Comments, note{author, c.CreatedAt[:min(10, len(c.CreatedAt))], c.Body})
		}
		capped("comments", raw.Comments.PageInfo.HasNextPage)
	}
	if raw.Relations != nil && raw.Inverse != nil {
		t.Relations = []link{}
		for _, r := range raw.Relations.Nodes {
			t.Relations = append(t.Relations, link{r.Type, r.Related.Identifier, r.Related.Title, r.Related.State.Name})
		}
		for _, r := range raw.Inverse.Nodes {
			t.Relations = append(t.Relations, link{cmp.Or(inverseType[r.Type], r.Type+" (inverse)"), r.Issue.Identifier, r.Issue.Title, r.Issue.State.Name})
		}
		capped("relations", raw.Relations.PageInfo.HasNextPage)
		capped("inverse relations", raw.Inverse.PageInfo.HasNextPage)
	}
	return t
}

func checkIDs(ids []string, verb string) error {
	for _, id := range ids {
		if !ticketShape.MatchString(id) {
			return usageFail(fmt.Sprintf("%q is not a ticket id — FRM-N or BYT-N", id), "x "+verb+" --help")
		}
	}
	return nil
}

// fetchIssues reads every id in one request, one alias each, in the order asked
func fetchIssues(actor string, ids []string, extra string) ([]rawIssue, error) {
	var params, fields []string
	vars := map[string]any{}
	for i, id := range ids {
		alias := "i" + strconv.Itoa(i)
		params = append(params, "$"+alias+": String!")
		fields = append(fields, alias+": issue(id: $"+alias+") { "+issueFields+" "+extra+" }")
		vars[alias] = id
	}
	query := "query(" + strings.Join(params, ", ") + ") {\n" + strings.Join(fields, "\n") + "\n}"
	data, errs, err := gql(actor, query, vars)
	if err != nil {
		return nil, err
	}
	var missing []string
	issues := make([]rawIssue, 0, len(ids))
	for i, id := range ids {
		raw := data["i"+strconv.Itoa(i)]
		var issue rawIssue
		if len(raw) == 0 || string(raw) == "null" || json.Unmarshal(raw, &issue) != nil {
			missing = append(missing, id)
			continue
		}
		issues = append(issues, issue)
	}
	if missing != nil {
		reason := "not found"
		if len(errs) > 0 {
			reason = errs[0].Message
		}
		return nil, &Fail{Msg: strings.Join(missing, ", ") + ": " + reason, Next: "x linear list --search " + missing[0]}
	}
	return issues, nil
}

func linearRead(r *Run, args []string, flags Flags) (any, error) {
	if err := checkIDs(args, "linear read"); err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	extra := ""
	if flags["comments"] == true {
		extra += commentFields
	}
	if flags["relations"] == true {
		extra += " " + relationFields
	}
	dir, _ := flags["attachments"].(string)
	if dir != "" {
		extra += " attachments(first: 50) { nodes { title url } pageInfo { hasNextPage } }"
	}
	var issues []rawIssue
	var saved []savedFile
	r.Wait(fmt.Sprintf("reading %s as %s", strings.Join(args, " "), actor), func() {
		if issues, err = fetchIssues(actor, args, extra); err == nil && dir != "" {
			saved, err = saveUploads(actor, issues, dir)
		}
	})
	if err != nil {
		return nil, err
	}
	read := make([]ticket, len(issues))
	for i, issue := range issues {
		read[i] = issue.ticket()
	}
	if r.human {
		r.Page(cards(read, actor))
	}
	data := ordered{{"actor", actor}, {"tickets", read}}
	if dir != "" {
		data = append(data, kv{"saved", saved})
	}
	return data, nil
}

/* attachments */

type savedFile struct {
	Ticket string `json:"ticket"`
	File   string `json:"file"`
	Bytes  int64  `json:"bytes"`
}

// a linear upload is a file behind the actor's auth, linked from the body or attached; an attachment
// that links a pr or a page is not one. `<api origin>/uploads` is where the test server serves them
func uploadsOf(issue rawIssue) []upload {
	host := `(?:https://uploads\.linear\.app|` + regexp.QuoteMeta(linearBase()+"/uploads") + `)/[^\s)"'>\]]+`
	labelled := regexp.MustCompile(`\[([^\]]*)\]\((` + host + `)\)`)
	bare := regexp.MustCompile(host)
	var found []upload
	add := func(link, label string) {
		for i := range found {
			if found[i].url == link {
				found[i].label = cmp.Or(found[i].label, label)
				return
			}
		}
		found = append(found, upload{link, label})
	}
	description := ""
	if issue.Description != nil {
		description = *issue.Description
	}
	for _, m := range labelled.FindAllStringSubmatch(description, -1) {
		add(m[2], m[1])
	}
	for _, link := range bare.FindAllString(description, -1) {
		add(link, "")
	}
	if issue.Files != nil {
		for _, file := range issue.Files.Nodes {
			if bare.MatchString(file.URL) && bare.FindString(file.URL) == file.URL {
				add(file.URL, file.Title)
			}
		}
	}
	return found
}

type upload struct{ url, label string }

func saveUploads(actor string, issues []rawIssue, dir string) ([]savedFile, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, usageFail("cannot make "+dir+": "+err.Error(), "x linear read --attachments <dir> <id>")
	}
	token, err := tokenFor(actor, "linear")
	if err != nil {
		return nil, &Fail{Msg: "no linear token for " + actor + ": " + err.Error(), Next: "x schema as"}
	}
	saved := []savedFile{}
	for _, issue := range issues {
		for _, file := range uploadsOf(issue) {
			name := fileNameOf(file, dir)
			size, err := download(file.url, token, filepath.Join(dir, name))
			if err != nil {
				return nil, &Fail{Msg: issue.Identifier + ": " + err.Error(), Next: "retry; the file stays on the ticket"}
			}
			saved = append(saved, savedFile{issue.Identifier, filepath.Join(dir, name), size})
		}
	}
	return saved, nil
}

// the url's last segment, unescaped and stripped of anything that walks out of dir; a taken name gets -2, -3
func fileNameOf(file upload, dir string) string {
	base := file.url[strings.LastIndex(file.url, "/")+1:]
	if unescaped, err := url.PathUnescape(base); err == nil {
		base = unescaped
	}
	base = cmp.Or(safeName(file.label), safeName(base), "attachment")
	name, ext := strings.TrimSuffix(base, filepath.Ext(base)), filepath.Ext(base)
	for n := 1; ; n++ {
		candidate := base
		if n > 1 {
			candidate = fmt.Sprintf("%s-%d%s", name, n, ext)
		}
		if _, err := os.Stat(filepath.Join(dir, candidate)); os.IsNotExist(err) {
			return candidate
		}
	}
}

// a title or a url segment as a plain file name: no dir part, no leading dot, nothing that walks out
func safeName(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	name = strings.TrimLeft(strings.TrimSpace(name), ".")
	if name == "/" {
		return ""
	}
	return name
}

func download(link, token, path string) (int64, error) {
	req, err := http.NewRequest(http.MethodGet, link, nil)
	if err != nil {
		return 0, err
	}
	authorize(req, token)
	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("%s did not answer", req.URL.Host)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return 0, fmt.Errorf("%s answered %d", req.URL.Host, resp.StatusCode)
	}
	file, err := os.Create(path)
	if err != nil {
		return 0, err
	}
	size, err := io.Copy(file, resp.Body)
	return size, errors.Join(err, file.Close())
}

/* the card */

func stateStyle(stateType string) lipgloss.Style {
	switch stateType {
	case "completed":
		return ui.ok
	case "canceled":
		return ui.er
	case "started":
		return lipgloss.NewStyle().Foreground(ui.familyColor("linear"))
	}
	return ui.dim
}

func labelChip(name string) string {
	return lipgloss.NewStyle().Foreground(ui.p.fg).Background(ui.p.line).Padding(0, 1).Render(name)
}

func cards(read []ticket, actor string) frame {
	var ids []string
	for _, t := range read {
		ids = append(ids, t.ID)
	}
	b := frame{width: frameWidth(), titleLeft: titleOf("linear read"), titleRight: ui.dim.Render(strings.Join(ids, " ") + ", as " + actor), padRows: true}
	w := b.inner()
	for i, t := range read {
		if i > 0 {
			b.rows = append(b.rows, "", ui.line.Render(strings.Repeat("─", w)), "")
		}
		state := stateStyle(t.StateType).Bold(true).Render("● " + t.State)
		head := ui.bold.Render(t.ID) + "  " + ui.fg.Render(t.Title)
		gap := max(w-lipgloss.Width(head)-lipgloss.Width(state), 1)
		b.rows = append(b.rows, clip(head, w-lipgloss.Width(state)-1)+strings.Repeat(" ", gap)+state)

		meta := []string{fmt.Sprintf("p%d", t.Priority)}
		if t.Estimate != nil {
			meta = append(meta, fmt.Sprintf("e%g", *t.Estimate))
		}
		for _, part := range []string{t.Project, t.Milestone} {
			if part != "" {
				meta = append(meta, part)
			}
		}
		if t.Parent != nil {
			meta = append(meta, "↑ "+t.Parent.ID+" "+t.Parent.Title)
		}
		b.rows = append(b.rows, ui.dim.Render(clip(strings.Join(meta, "  "), w)))
		if len(t.Labels) > 0 {
			var chips []string
			for _, label := range t.Labels {
				chips = append(chips, labelChip(label))
			}
			b.rows = append(b.rows, "", strings.Join(chips, " ")+cappedMark(t, "labels"))
		}
		b.rows = append(b.rows, "")
		b.rows = append(b.rows, markdown(cmp.Or(t.Description, "_no description_"), w)...)
		if len(t.Children) > 0 {
			b.rows = append(b.rows, "", ui.label.Render("children")+cappedMark(t, "children"))
			for _, c := range t.Children {
				b.rows = append(b.rows, "  "+ui.bold.Render(c.ID)+"  "+ui.fg.Render(clip(c.Title, w-30))+"  "+ui.dim.Render(c.State))
			}
		}
		if len(t.Relations) > 0 {
			b.rows = append(b.rows, "", ui.label.Render("relations")+cappedMark(t, "relations")+cappedMark(t, "inverse relations"))
			for _, l := range t.Relations {
				b.rows = append(b.rows, "  "+ui.dim.Render(fmt.Sprintf("%-14s", l.Type))+ui.bold.Render(l.ID)+"  "+ui.fg.Render(clip(l.Title, w-40))+"  "+ui.dim.Render(l.State))
			}
		}
		if t.Comments != nil {
			b.rows = append(b.rows, "", ui.label.Render(fmt.Sprintf("comments (%d)", len(t.Comments)))+cappedMark(t, "comments"))
			for _, c := range t.Comments {
				b.rows = append(b.rows, "", ui.bold.Render(c.Author)+"  "+ui.dim.Render(c.At))
				b.rows = append(b.rows, markdown(c.Body, w)...)
			}
		}
	}
	b.footLeft = ui.dim.Render("raw json:") + " " + cmd("x linear read --json "+strings.Join(ids, " "))
	return b
}

func cappedMark(t ticket, name string) string {
	if slices.Contains(t.Capped, name) {
		return "  " + ui.er.Render("⚠️ capped")
	}
	return ""
}
