package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
)

type listRow struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	State     string   `json:"state"`
	StateType string   `json:"stateType"`
	Priority  int      `json:"priority"`
	Estimate  *float64 `json:"estimate"`
	Project   string   `json:"project,omitempty"`
	Labels    []string `json:"labels"`
}

const rowFields = `identifier title priority estimate state { name type } project { name } labels(first: 20) { nodes { name } }`

// listFilter is linear's own IssueFilter: every name resolves on linear's side, in the same request
func listFilter(flags Flags) map[string]any {
	filter := map[string]any{}
	named := func(value string) map[string]any {
		return map[string]any{"name": map[string]any{"eqIgnoreCase": value}}
	}
	if team, _ := flags["team"].(string); team != "" {
		filter["team"] = map[string]any{"key": map[string]any{"eqIgnoreCase": team}}
	}
	if state, _ := flags["state"].(string); state != "" {
		filter["state"] = named(state)
	} else if search, _ := flags["search"].(string); search == "" {
		filter["state"] = map[string]any{"type": map[string]any{"nin": []string{"completed", "canceled"}}}
	}
	if project, _ := flags["project"].(string); project != "" {
		filter["project"] = named(project)
	}
	if milestone, _ := flags["milestone"].(string); milestone != "" {
		filter["projectMilestone"] = named(milestone)
	}
	// each label must be on the ticket: one `some` clause per name
	if labels, _ := flags["label"].(string); labels != "" {
		var all []map[string]any
		for label := range strings.SplitSeq(labels, ",") {
			if label = strings.TrimSpace(label); label != "" {
				all = append(all, map[string]any{"labels": map[string]any{"some": named(label)}})
			}
		}
		filter["and"] = all
	}
	return filter
}

func linearList(r *Run, _ []string, flags Flags) (any, error) {
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	vars := map[string]any{"filter": listFilter(flags)}
	field, query := "issues", "query($filter: IssueFilter) { issues(first: 50, filter: $filter) { nodes { "+rowFields+" } pageInfo { hasNextPage } } }"
	if search, _ := flags["search"].(string); search != "" {
		vars["term"] = search
		field, query = "searchIssues", "query($term: String!, $filter: IssueFilter) { searchIssues(term: $term, first: 50, filter: $filter) { nodes { "+rowFields+" } pageInfo { hasNextPage } } }"
	}
	var data map[string]json.RawMessage
	r.Wait("listing as "+actor, func() { data, _, err = gql(actor, query, vars) })
	if err != nil {
		return nil, err
	}
	var page connection[struct {
		Identifier string   `json:"identifier"`
		Title      string   `json:"title"`
		Priority   int      `json:"priority"`
		Estimate   *float64 `json:"estimate"`
		State      struct {
			Name string `json:"name"`
			Type string `json:"type"`
		} `json:"state"`
		Project *named            `json:"project"`
		Labels  connection[named] `json:"labels"`
	}]
	if err := json.Unmarshal(data[field], &page); err != nil {
		return nil, &Fail{Msg: "linear answered no " + field + " list", Next: "x linear api to see the raw reply"}
	}
	rows := make([]listRow, 0, len(page.Nodes))
	for _, node := range page.Nodes {
		row := listRow{ID: node.Identifier, Title: node.Title, State: node.State.Name, StateType: node.State.Type,
			Priority: node.Priority, Estimate: node.Estimate, Labels: []string{}}
		if node.Project != nil {
			row.Project = node.Project.Name
		}
		for _, label := range node.Labels.Nodes {
			row.Labels = append(row.Labels, label.Name)
		}
		rows = append(rows, row)
	}
	capped := page.PageInfo.HasNextPage
	// a typo filters to nothing exactly like a real empty result; only an empty list pays for the check
	if len(rows) == 0 {
		if err := unknownName(actor, flags); err != nil {
			return nil, err
		}
	}
	if r.human {
		r.Page(listBoardOf(rows, capped, actor))
	}
	return ordered{{"actor", actor}, {"capped", capped}, {"count", len(rows)}, {"tickets", rows}}, nil
}

// the root query that finds each kind of name, and the comparator its filter takes
var nameKinds = []struct{ flag, kind, root, field string }{
	{"team", "team", "teams", "key"},
	{"state", "state", "workflowStates", "name"},
	{"project", "project", "projects", "name"},
	{"milestone", "milestone", "projectMilestones", "name"},
}

// unknownName asks linear for every name the flags gave, one alias each, in one request
func unknownName(actor string, flags Flags) error {
	type asked struct{ alias, kind, name string }
	var questions []asked
	var params, fields []string
	vars := map[string]any{}
	ask := func(alias, kind, root, field, name string) {
		questions = append(questions, asked{alias, kind, name})
		params = append(params, "$"+alias+": String!")
		fields = append(fields, fmt.Sprintf("%s: %s(first: 1, filter: { %s: { eqIgnoreCase: $%s } }) { nodes { id } }", alias, root, field, alias))
		vars[alias] = name
	}
	for _, k := range nameKinds {
		if name, _ := flags[k.flag].(string); name != "" {
			ask(k.kind, k.kind, k.root, k.field, name)
		}
	}
	if labels, _ := flags["label"].(string); labels != "" {
		i := 0
		for label := range strings.SplitSeq(labels, ",") {
			if label = strings.TrimSpace(label); label != "" {
				ask(fmt.Sprintf("label%d", i), "label", "issueLabels", "name", label)
				i++
			}
		}
	}
	if questions == nil {
		return nil
	}
	data, _, err := gql(actor, "query("+strings.Join(params, ", ")+") { "+strings.Join(fields, " ")+" }", vars)
	if err != nil {
		return err
	}
	for _, q := range questions {
		var found connection[struct {
			ID string `json:"id"`
		}]
		if json.Unmarshal(data[q.alias], &found) == nil && len(found.Nodes) == 0 {
			return usageFail(fmt.Sprintf("no %s named %q in linear", q.kind, q.name), "x linear list --search <words>")
		}
	}
	return nil
}

func listBoardOf(rows []listRow, capped bool, actor string) frame {
	count := fmt.Sprintf("%d tickets, as %s", len(rows), actor)
	if capped {
		count = fmt.Sprintf("first %d — capped, narrow the filter, as %s", len(rows), actor)
	}
	b := frame{width: frameWidth(), titleLeft: titleOf("linear list"), titleRight: ui.dim.Render(count), padRows: true}
	w := b.inner()
	for _, row := range rows {
		state := stateStyle(row.StateType).Render(fmt.Sprintf("%-12s", clip(row.State, 12)))
		labels := ui.dim.Render(strings.Join(row.Labels, " "))
		head := ui.bold.Render(fmt.Sprintf("%-9s", row.ID)) + " " + state + " "
		room := w - lipgloss.Width(head) - lipgloss.Width(labels) - 2
		b.rows = append(b.rows, head+ui.fg.Render(clip(row.Title, max(room, 10)))+"  "+labels)
	}
	if len(rows) == 0 {
		b.rows = append(b.rows, ui.dim.Render("no tickets match"))
	}
	b.footLeft = ui.dim.Render("read one:") + " " + cmd("x linear read <id>")
	return b
}
