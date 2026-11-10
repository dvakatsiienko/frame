package main

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
)

// a ticket as the order reads it: linear keeps one float per ticket, and a team's manual order is that float, ascending
type placedIssue struct {
	ID         string  `json:"id"`
	Identifier string  `json:"identifier"`
	SortOrder  float64 `json:"sortOrder"`
	Team       struct {
		ID string `json:"id"`
	} `json:"team"`
}

const (
	orderPage  = 250
	orderPages = 40
)

func plainNumber(n float64) string { return strconv.FormatFloat(n, 'f', -1, 64) }

// orderBeside answers the sort order that lands a ticket right after or before another: halfway to that one's
// neighbour, read from the team's own manual order, the moving ticket left out; at an end of the order, one step past it.
// linear has no filter on the sort order, so the order is walked a page at a time until the neighbour is read
func orderBeside(r *Run, actor, team, moving string, beside placedIssue, side string) (float64, error) {
	var prev *placedIssue
	found, cursor := false, ""
	for range orderPages {
		var page struct {
			Issues struct {
				Nodes    []placedIssue `json:"nodes"`
				PageInfo struct {
					HasNextPage bool   `json:"hasNextPage"`
					EndCursor   string `json:"endCursor"`
				} `json:"pageInfo"`
			} `json:"issues"`
		}
		var data map[string]json.RawMessage
		var err error
		vars := map[string]any{"team": team, "first": orderPage}
		if cursor != "" {
			vars["after"] = cursor
		}
		r.Wait("reading the order beside "+beside.Identifier, func() {
			data, _, err = gql(actor, `query($team: ID!, $first: Int!, $after: String) { issues(first: $first, after: $after,
				filter: { team: { id: { eq: $team } } }, sort: [{ manual: { order: Ascending } }]) {
				nodes { id identifier sortOrder } pageInfo { hasNextPage endCursor } } }`, vars)
		})
		if err != nil {
			return 0, err
		}
		raw, _ := json.Marshal(data)
		_ = json.Unmarshal(raw, &page)
		for i, row := range page.Issues.Nodes {
			switch {
			case row.Identifier == moving:
			case found:
				return halfway(beside, row)
			case row.Identifier != beside.Identifier:
				prev = &page.Issues.Nodes[i]
			case side == "before" && prev != nil:
				return halfway(*prev, row)
			case side == "before":
				return row.SortOrder - 1, nil
			default:
				found, beside = true, row
			}
		}
		if !page.Issues.PageInfo.HasNextPage {
			break
		}
		cursor = page.Issues.PageInfo.EndCursor
	}
	if found {
		return beside.SortOrder + 1, nil
	}
	return 0, &Fail{Msg: beside.Identifier + " is not in its team's manual order, so no place beside it was read; nothing was written", Next: "x linear read " + beside.Identifier}
}

// two neighbours tied on their sort order, or a gap a float can no longer split, leave no place between them: a write
// there would land on one of them and print a move that did not happen
func halfway(above, below placedIssue) (float64, error) {
	middle := (above.SortOrder + below.SortOrder) / 2
	if middle == above.SortOrder || middle == below.SortOrder {
		return 0, &Fail{Refused: true,
			Msg:  fmt.Sprintf("%s and %s hold sort orders with no number left between them (%s, %s); nothing was written", above.Identifier, below.Identifier, plainNumber(above.SortOrder), plainNumber(below.SortOrder)),
			Next: "x linear read " + above.Identifier + " " + below.Identifier}
	}
	return middle, nil
}

// unlink removes relations `x linear link` made: each is found on the ticket first, and one missing writes nothing
func linearUnlink(r *Run, args []string, flags Flags) (any, error) {
	from, kind, targets := args[0], args[1], args[2:]
	if !slices.Contains(relationKinds, kind) {
		return nil, usageFail(fmt.Sprintf("no relation %q — x linear unlink takes %s", kind, strings.Join(relationKinds, ", ")), "x linear unlink --help")
	}
	if len(targets) == 0 {
		return nil, usageFail("no target ticket after "+kind, "x linear unlink --help")
	}
	if err := checkIDs(append([]string{from}, targets...), "linear unlink"); err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	type end struct {
		Identifier string `json:"identifier"`
	}
	var found struct {
		Issue *struct {
			ID        string `json:"id"`
			Relations connection[struct {
				ID      string `json:"id"`
				Type    string `json:"type"`
				Related end    `json:"relatedIssue"`
			}] `json:"relations"`
			Inverse connection[struct {
				ID    string `json:"id"`
				Type  string `json:"type"`
				Issue end    `json:"issue"`
			}] `json:"inverseRelations"`
		} `json:"issue"`
	}
	var data map[string]json.RawMessage
	r.Wait("reading "+from+"'s relations", func() {
		data, _, err = gql(actor, `query($id: String!) { issue(id: $id) { id
			relations(first: 250) { nodes { id type relatedIssue { identifier } } }
			inverseRelations(first: 250) { nodes { id type issue { identifier } } } } }`, map[string]any{"id": from})
	})
	if err != nil {
		return nil, err
	}
	raw, _ := json.Marshal(data)
	_ = json.Unmarshal(raw, &found)
	if found.Issue == nil || found.Issue.ID == "" {
		return nil, &Fail{Msg: from + ": not found", Next: "x linear list --search " + from}
	}
	var params, fields, changes, missing []string
	vars := map[string]any{}
	// a target named twice is one relation: two deletes of it would fail the second and leave the first done
	for at, target := range targets {
		if slices.Contains(targets[:at], target) {
			continue
		}
		relation := ""
		for _, held := range found.Issue.Relations.Nodes {
			if held.Type == kind && strings.EqualFold(held.Related.Identifier, target) {
				relation = held.ID
			}
		}
		// related has no direction: linear keeps it on whichever ticket the link started from
		for _, held := range found.Issue.Inverse.Nodes {
			if kind == "related" && held.Type == kind && strings.EqualFold(held.Issue.Identifier, target) {
				relation = held.ID
			}
		}
		if relation == "" {
			missing = append(missing, target)
			continue
		}
		alias := "r" + strconv.Itoa(len(params))
		params, vars[alias] = append(params, "$"+alias+": String!"), relation
		fields = append(fields, alias+": issueRelationDelete(id: $"+alias+") { success }")
		changes = append(changes, kind+": "+target+" → —")
	}
	if missing != nil {
		return nil, &Fail{Refused: true, Msg: fmt.Sprintf("%s holds no %s link to %s; nothing was removed", from, kind, strings.Join(missing, ", ")), Next: "x linear read --relations " + from}
	}
	var errs []gqlError
	r.Wait("unlinking "+from+" as "+actor, func() {
		data, errs, err = gql(actor, "mutation("+strings.Join(params, ", ")+") { "+strings.Join(fields, " ")+" }", vars)
	})
	if err != nil {
		return nil, err
	}
	for i := range params {
		var result struct {
			Success bool `json:"success"`
		}
		if json.Unmarshal(data["r"+strconv.Itoa(i)], &result) != nil || !result.Success {
			reason := "linear refused"
			if len(errs) > 0 {
				reason = errs[0].Message
			}
			return nil, &Fail{Msg: fmt.Sprintf("%s %s: %s", from, changes[i], reason), Next: "x linear read --relations " + from}
		}
	}
	r.Board(ui.ok.Render("✓ ") + ui.fg.Render(fmt.Sprintf("%s no longer %s %s, as %s", from, kind, strings.Join(targets, " "), actor)))
	return ordered{{"actor", actor}, {"changes", changes}, {"from", from}, {"kind", kind}, {"targets", targets}}, nil
}
