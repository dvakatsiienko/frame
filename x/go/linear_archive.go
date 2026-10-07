package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// archive retires closed tickets nobody touched for --days. linear's own auto-archive waits for the
// project to close, and ours never close; the free plan caps non-archived tickets at 250, closed included

type archivePlan struct {
	Days    int      `json:"days"`
	Tickets []string `json:"tickets"`
	More    bool     `json:"more"`
	ids     []string
}

func archivePlanOf(r *Run, _ []string, flags Flags) (any, error) {
	days := 14
	if value, _ := flags["days"].(string); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 1 {
			return nil, usageFail("--days is a whole number of days, not "+value, "x linear archive --days 14")
		}
		days = n
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	filter := map[string]any{"state": map[string]any{"type": map[string]any{"in": []string{"completed", "canceled"}}},
		"updatedAt": map[string]any{"lt": fmt.Sprintf("-P%dD", days)}}
	r.Open("as " + actor)
	var page connection[struct{ ID, Identifier string }]
	if err := r.Step("find", fmt.Sprintf("closed tickets untouched for %d days", days), func() (string, error) {
		data, _, err := gql(actor, "query($filter: IssueFilter) { issues(first: 250, filter: $filter) { nodes { id identifier } pageInfo { hasNextPage } } }",
			map[string]any{"filter": filter})
		if err != nil {
			return "", err
		}
		_ = json.Unmarshal(data["issues"], &page)
		return plural(len(page.Nodes), "ticket"), nil
	}); err != nil {
		return nil, err
	}
	plan := archivePlan{Days: days, Tickets: []string{}, More: page.PageInfo.HasNextPage}
	for _, issue := range page.Nodes {
		plan.Tickets = append(plan.Tickets, issue.Identifier)
		plan.ids = append(plan.ids, issue.ID)
	}
	return plan, nil
}

func askArchive(plan any) string {
	p := plan.(archivePlan)
	return fmt.Sprintf("archive %d closed tickets untouched for %d days?", len(p.Tickets), p.Days)
}

func archiveApply(r *Run, _ []string, flags Flags, planned any) (any, error) {
	plan := planned.(archivePlan)
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	archived, failed := []string{}, []string{}
	if len(plan.ids) > 0 {
		var params, fields []string
		vars := map[string]any{}
		for i, id := range plan.ids {
			alias := "a" + strconv.Itoa(i)
			params = append(params, "$"+alias+": String!")
			fields = append(fields, alias+": issueArchive(id: $"+alias+") { success }")
			vars[alias] = id
		}
		var data map[string]json.RawMessage
		if err := r.Step("archive", "one request for all of them", func() (string, error) {
			data, _, err = gql(actor, "mutation("+strings.Join(params, ", ")+") { "+strings.Join(fields, " ")+" }", vars)
			return plural(len(plan.ids), "ticket"), err
		}); err != nil {
			return nil, err
		}
		for i, ticket := range plan.Tickets {
			var result struct {
				Success bool `json:"success"`
			}
			if json.Unmarshal(data["a"+strconv.Itoa(i)], &result) == nil && result.Success {
				archived = append(archived, ticket)
			} else {
				failed = append(failed, ticket)
			}
		}
	}
	line := fmt.Sprintf("archived %d of %d closed tickets older than %d days, as %s", len(archived), len(plan.Tickets), plan.Days, actor)
	if plan.More {
		line += " — more remain, run again"
	}
	r.Done(line, "")
	if len(failed) > 0 {
		return nil, &Fail{Msg: "linear refused to archive " + strings.Join(failed, ", "), Next: "x linear read " + failed[0]}
	}
	return ordered{{"actor", actor}, {"archived", archived}, {"days", plan.Days}, {"more", plan.More}}, nil
}
