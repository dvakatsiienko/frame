package main

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"strconv"
	"strings"
)

type idName struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type projectRef struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	Milestones connection[idName] `json:"projectMilestones"`
}

type setLookup struct {
	Issue struct {
		ID         string             `json:"id"`
		Identifier string             `json:"identifier"`
		Priority   int                `json:"priority"`
		Estimate   *float64           `json:"estimate"`
		State      named              `json:"state"`
		Parent     *issueRef          `json:"parent"`
		Delegate   *named             `json:"delegate"`
		Project    *projectRef        `json:"project"`
		Milestone  *named             `json:"projectMilestone"`
		Labels     connection[idName] `json:"labels"`
		Team       struct {
			ID     string             `json:"id"`
			States connection[idName] `json:"states"`
		} `json:"team"`
	} `json:"issue"`
	Labels connection[struct {
		idName
		Team *struct {
			ID string `json:"id"`
		} `json:"team"`
	}] `json:"labels"`
	Parent   *struct{ ID, Identifier string } `json:"parent"`
	Projects connection[projectRef]           `json:"projects"`
	Users    connection[idName]               `json:"users"`
}

func splitNames(value any) []string {
	text, _ := value.(string)
	var names []string
	for name := range strings.SplitSeq(text, ",") {
		if name = strings.TrimSpace(name); name != "" {
			names = append(names, name)
		}
	}
	return names
}

func pickByName(options []idName, name, kind string) (idName, error) {
	for _, option := range options {
		if strings.EqualFold(option.Name, name) {
			return option, nil
		}
	}
	var valid []string
	for _, option := range options {
		valid = append(valid, option.Name)
	}
	return idName{}, &Fail{Refused: true, Msg: fmt.Sprintf("no %s named %q — the %ss are: %s", kind, name, kind, strings.Join(valid, ", ")),
		Next: "x linear set <id> --" + kind + " <one of them>"}
}

var setFields = []string{"state", "priority", "estimate", "parent", "project", "milestone", "delegate", "add-label", "remove-label"}

// set lands every named field as one issueUpdate; names resolve in one lookup, labels as current + adds − removes
func linearSet(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if err := checkIDs(args, "linear set"); err != nil {
		return nil, err
	}
	given := map[string]string{}
	for _, field := range setFields {
		if value, _ := flags[field].(string); value != "" {
			given[field] = value
		}
	}
	if len(given) == 0 {
		return nil, usageFail("nothing to set — name a field: --"+strings.Join(setFields, ", --"), "x linear set --help")
	}
	if parent := given["parent"]; parent != "" {
		if err := checkIDs([]string{parent}, "linear set"); err != nil {
			return nil, err
		}
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}

	params := []string{"$id: String!"}
	fields := []string{`issue(id: $id) { id identifier priority estimate state { name } parent { identifier title state { name } } delegate { name }
		project { id name projectMilestones { nodes { id name } } } projectMilestone { name }
		team { id states { nodes { id name } } } labels(first: 100) { nodes { id name } } }`}
	vars := map[string]any{"id": id}
	if adds := splitNames(given["add-label"]); adds != nil {
		var or []map[string]any
		for _, name := range adds {
			or = append(or, map[string]any{"name": map[string]any{"eqIgnoreCase": name}})
		}
		params, vars["labels"] = append(params, "$labels: IssueLabelFilter"), map[string]any{"or": or}
		fields = append(fields, "labels: issueLabels(first: 100, filter: $labels) { nodes { id name team { id } } }")
	}
	if given["parent"] != "" {
		params, vars["parent"] = append(params, "$parent: String!"), given["parent"]
		fields = append(fields, "parent: issue(id: $parent) { id identifier }")
	}
	if given["project"] != "" {
		params, vars["project"] = append(params, "$project: String!"), given["project"]
		fields = append(fields, "projects(first: 5, filter: { name: { eqIgnoreCase: $project } }) { nodes { id name projectMilestones { nodes { id name } } } }")
	}
	if given["delegate"] != "" {
		params, vars["delegate"] = append(params, "$delegate: String!"), given["delegate"]
		fields = append(fields, "users(filter: { name: { eqIgnoreCase: $delegate } }) { nodes { id name } }")
	}

	var data map[string]json.RawMessage
	r.Wait("resolving "+id, func() {
		data, _, err = gql(actor, "query("+strings.Join(params, ", ")+") {\n"+strings.Join(fields, "\n")+"\n}", vars)
	})
	if err != nil {
		return nil, err
	}
	var found setLookup
	raw, _ := json.Marshal(data)
	_ = json.Unmarshal(raw, &found)
	issue := found.Issue
	if issue.ID == "" {
		return nil, &Fail{Msg: id + ": not found", Next: "x linear list --search " + id}
	}

	input := map[string]any{}
	var changes []string
	change := func(field, old, new string) { changes = append(changes, field+": "+orDash(old)+" → "+new) }
	if name := given["state"]; name != "" {
		state, err := pickByName(issue.Team.States.Nodes, name, "state")
		if err != nil {
			return nil, err
		}
		input["stateId"] = state.ID
		change("state", issue.State.Name, state.Name)
	}
	for _, field := range []string{"priority", "estimate"} {
		if value := given[field]; value != "" {
			number, err := strconv.ParseFloat(value, 64)
			if err != nil || number < 0 || field == "priority" && (number > 4 || number != float64(int(number))) {
				return nil, usageFail(fmt.Sprintf("--%s takes a number%s, not %q", field, map[string]string{"priority": " 0–4"}[field], value), "x linear set --help")
			}
			input[field] = number
			old := strconv.Itoa(issue.Priority)
			if field == "estimate" {
				old = ""
				if issue.Estimate != nil {
					old = strconv.FormatFloat(*issue.Estimate, 'g', -1, 64)
				}
			}
			change(field, old, value)
		}
	}
	if given["parent"] != "" {
		if found.Parent == nil || found.Parent.ID == "" {
			return nil, &Fail{Refused: true, Msg: "no ticket " + given["parent"] + " to be the parent", Next: "x linear list --search " + given["parent"]}
		}
		input["parentId"] = found.Parent.ID
		old := ""
		if issue.Parent != nil {
			old = issue.Parent.Identifier
		}
		change("parent", old, found.Parent.Identifier)
	}
	project := issue.Project
	if name := given["project"]; name != "" {
		var options []idName
		for _, p := range found.Projects.Nodes {
			options = append(options, idName{p.ID, p.Name})
		}
		chosen, err := pickByName(options, name, "project")
		if err != nil {
			return nil, err
		}
		project = &found.Projects.Nodes[slices.IndexFunc(found.Projects.Nodes, func(p projectRef) bool { return p.ID == chosen.ID })]
		input["projectId"] = project.ID
		old := ""
		if issue.Project != nil {
			old = issue.Project.Name
		}
		change("project", old, project.Name)
	}
	if name := given["milestone"]; name != "" {
		if project == nil {
			return nil, &Fail{Refused: true, Msg: id + " has no project, so no milestone — add --project", Next: "x linear set " + id + " --project <name> --milestone " + name}
		}
		milestone, err := pickByName(project.Milestones.Nodes, name, "milestone")
		if err != nil {
			return nil, err
		}
		input["projectMilestoneId"] = milestone.ID
		old := ""
		if issue.Milestone != nil {
			old = issue.Milestone.Name
		}
		change("milestone", old, milestone.Name)
	}
	if name := given["delegate"]; name != "" {
		user, err := pickByName(found.Users.Nodes, name, "delegate")
		if err != nil {
			return nil, err
		}
		input["delegateId"] = user.ID
		old := ""
		if issue.Delegate != nil {
			old = issue.Delegate.Name
		}
		change("delegate", old, user.Name)
	}
	if given["add-label"] != "" || given["remove-label"] != "" {
		delta, added, removed, err := labelDelta(issue.Labels.Nodes, found, issue.Team.ID, splitNames(given["add-label"]), splitNames(given["remove-label"]))
		if err != nil {
			return nil, err
		}
		maps.Copy(input, delta)
		for _, name := range added {
			changes = append(changes, "label: + "+name)
		}
		for _, name := range removed {
			changes = append(changes, "label: − "+name)
		}
	}

	r.Wait("writing "+id+" as "+actor, func() {
		data, _, err = gql(actor, "mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }",
			map[string]any{"id": issue.ID, "input": input})
	})
	if err != nil {
		return nil, err
	}
	var result struct {
		Success bool `json:"success"`
	}
	if json.Unmarshal(data["issueUpdate"], &result) != nil || !result.Success {
		return nil, &Fail{Msg: "linear did not take the update to " + id, Next: "x linear read " + id}
	}
	if r.human {
		lines := []string{ui.ok.Render("✓ ") + ui.fg.Render("set "+id+" as "+actor)}
		for _, c := range changes {
			lines = append(lines, "  "+ui.dim.Render(c))
		}
		r.Board(strings.Join(lines, "\n"))
	}
	return ordered{{"actor", actor}, {"changes", changes}, {"id", id}}, nil
}

func orDash(value string) string {
	if value == "" {
		return "—"
	}
	return value
}

// labelDelta sends linear only what changes (addedLabelIds, removedLabelIds), so a label another writer
// adds between x's read and its write survives (dima, 2026-10-07). an add takes the ticket team's label
// first, else the workspace one; a remove names a label the ticket carries
func labelDelta(current []idName, found setLookup, teamID string, adds, removes []string) (map[string]any, []string, []string, error) {
	addIDs, removeIDs := []string{}, []string{}
	var removed []string
	for _, name := range removes {
		i := slices.IndexFunc(current, func(label idName) bool { return strings.EqualFold(name, label.Name) })
		if i < 0 {
			var carried []string
			for _, label := range current {
				carried = append(carried, label.Name)
			}
			return nil, nil, nil, &Fail{Refused: true, Msg: fmt.Sprintf("the ticket has no label %q — it carries %s", name, strings.Join(carried, ", ")),
				Next: "x linear set <id> --remove-label <one of them>"}
		}
		removed = append(removed, current[i].Name)
		removeIDs = append(removeIDs, current[i].ID)
	}
	var added []string
	for _, name := range adds {
		chosen := ""
		for _, label := range found.Labels.Nodes {
			if !strings.EqualFold(label.Name, name) {
				continue
			}
			if label.Team != nil && label.Team.ID == teamID {
				chosen = label.ID
				break
			}
			if label.Team == nil && chosen == "" {
				chosen = label.ID
			}
		}
		if chosen == "" {
			return nil, nil, nil, &Fail{Refused: true, Msg: fmt.Sprintf("no label named %q on this ticket's team or the workspace", name),
				Next: "x linear api 'query { issueLabels(first: 250) { nodes { name } } }'"}
		}
		if !slices.ContainsFunc(current, func(label idName) bool { return label.ID == chosen }) && !slices.Contains(addIDs, chosen) {
			addIDs = append(addIDs, chosen)
			added = append(added, name)
		}
	}
	return map[string]any{"addedLabelIds": addIDs, "removedLabelIds": removeIDs}, added, removed, nil
}
