package main

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
)

var relationKinds = []string{"blocks", "related", "duplicate"}

// link creates one relation per target in one request; linear takes FRM-N where an id goes
func linearLink(r *Run, args []string, flags Flags) (any, error) {
	from, kind, targets := args[0], args[1], args[2:]
	if !slices.Contains(relationKinds, kind) {
		return nil, usageFail(fmt.Sprintf("no relation %q — x linear link takes %s", kind, strings.Join(relationKinds, ", ")), "x linear link --help")
	}
	if len(targets) == 0 {
		return nil, usageFail("no target ticket after "+kind, "x linear link --help")
	}
	if err := checkIDs(append([]string{from}, targets...), "linear link"); err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	var params, fields []string
	vars := map[string]any{}
	for i, target := range targets {
		alias := "r" + strconv.Itoa(i)
		params = append(params, "$"+alias+": IssueRelationCreateInput!")
		fields = append(fields, alias+": issueRelationCreate(input: $"+alias+") { success }")
		vars[alias] = map[string]any{"issueId": from, "relatedIssueId": target, "type": kind}
	}
	var data map[string]json.RawMessage
	var errs []gqlError
	r.Wait("linking "+from+" as "+actor, func() {
		data, errs, err = gql(actor, "mutation("+strings.Join(params, ", ")+") { "+strings.Join(fields, " ")+" }", vars)
	})
	if err != nil {
		return nil, err
	}
	var failed []string
	for i, target := range targets {
		var result struct {
			Success bool `json:"success"`
		}
		if json.Unmarshal(data["r"+strconv.Itoa(i)], &result) != nil || !result.Success {
			failed = append(failed, target)
		}
	}
	if failed != nil {
		reason := "linear refused"
		if len(errs) > 0 {
			reason = errs[0].Message
		}
		return nil, &Fail{Msg: fmt.Sprintf("%s %s %s: %s", from, kind, strings.Join(failed, ", "), reason), Next: "x linear read --relations " + from}
	}
	r.Board(ui.ok.Render("✓ ") + ui.fg.Render(fmt.Sprintf("%s %s %s, as %s", from, kind, strings.Join(targets, " "), actor)))
	return ordered{{"actor", actor}, {"from", from}, {"kind", kind}, {"targets", targets}}, nil
}

func readBodyFile(flags Flags, verb string) (string, error) {
	path, _ := flags["body-file"].(string)
	if path == "" {
		return "", usageFail("--body-file is required", "x "+verb+" --help")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return "", usageFail("cannot read "+path, "x "+verb+" --help")
	}
	if strings.TrimSpace(string(raw)) == "" {
		return "", usageFail(path+" is empty", "x "+verb+" --help")
	}
	return string(raw), nil
}

func linearComment(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if err := checkIDs(args, "linear comment"); err != nil {
		return nil, err
	}
	body, err := readBodyFile(flags, "linear comment")
	if err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	var data map[string]json.RawMessage
	r.Wait("commenting on "+id+" as "+actor, func() {
		data, _, err = gql(actor, "mutation($issue: String!, $body: String!) { commentCreate(input: { issueId: $issue, body: $body }) { success comment { url } } }",
			map[string]any{"issue": id, "body": body})
	})
	if err != nil {
		return nil, err
	}
	var result struct {
		Success bool `json:"success"`
		Comment struct {
			URL string `json:"url"`
		} `json:"comment"`
	}
	if json.Unmarshal(data["commentCreate"], &result) != nil || !result.Success {
		return nil, &Fail{Msg: "linear did not take the comment on " + id, Next: "x linear read --comments " + id}
	}
	r.Board(ui.ok.Render("✓ ") + ui.fg.Render("commented on "+id+" as "+actor+"  ") + ui.dim.Render(result.Comment.URL))
	return ordered{{"actor", actor}, {"id", id}, {"url", result.Comment.URL}}, nil
}

var healths = []string{"onTrack", "atRisk", "offTrack"}

// update posts a project or initiative update; the name must find exactly one of either
func linearUpdate(r *Run, args []string, flags Flags) (any, error) {
	name := args[0]
	health, _ := flags["health"].(string)
	if !slices.Contains(healths, health) {
		return nil, usageFail(fmt.Sprintf("--health takes %s, not %q", strings.Join(healths, ", "), health), "x linear update --help")
	}
	body, err := readBodyFile(flags, "linear update")
	if err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	// projects are read alone first: an app actor without `initiative:read` (cclio) fails the whole
	// query the moment it names initiatives, so a project update never asks for them
	kind, mutation, idKey := "project", "projectUpdateCreate", "projectId"
	target, err := findNamed(r, actor, "projects", name)
	if err == nil && len(target) == 0 {
		kind, mutation, idKey = "initiative", "initiativeUpdateCreate", "initiativeId"
		if target, err = findNamed(r, actor, "initiatives", name); err != nil {
			// a mistyped project name must not read as a permission problem
			return nil, &Fail{Refused: true, Msg: fmt.Sprintf("no project named %q, and %s cannot read initiatives (%v)", name, actor, err),
				Next: "x linear api 'query { projects { nodes { name } } }'"}
		}
	}
	if err != nil {
		return nil, err
	}
	switch len(target) {
	case 0:
		return nil, &Fail{Refused: true, Msg: fmt.Sprintf("no project or initiative named %q", name), Next: "x linear api 'query { projects { nodes { name } } }'"}
	case 1:
	default:
		return nil, &Fail{Refused: true, Msg: fmt.Sprintf("%q names %d %ss — x will not guess", name, len(target), kind), Next: "x linear api with the update mutation and the id"}
	}
	var data map[string]json.RawMessage
	field := strings.TrimSuffix(mutation, "Create")
	r.Wait("posting the "+kind+" update as "+actor, func() {
		data, _, err = gql(actor, fmt.Sprintf("mutation($input: %sInput!) { %s(input: $input) { success %s { url } } }", strings.ToUpper(mutation[:1])+mutation[1:], mutation, field),
			map[string]any{"input": map[string]any{idKey: target[0].ID, "body": body, "health": health}})
	})
	if err != nil {
		return nil, err
	}
	var result map[string]json.RawMessage
	var success bool
	if json.Unmarshal(data[mutation], &result) == nil {
		_ = json.Unmarshal(result["success"], &success)
	}
	if !success {
		return nil, &Fail{Msg: "linear did not take the " + kind + " update", Next: "x linear api to see the raw reply"}
	}
	var posted struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(result[field], &posted)
	r.Board(ui.ok.Render("✓ ") + ui.fg.Render(fmt.Sprintf("%s update on %s (%s), as %s  ", kind, target[0].Name, health, actor)) + ui.dim.Render(posted.URL))
	return ordered{{"actor", actor}, {"health", health}, {"kind", kind}, {"name", target[0].Name}, {"url", posted.URL}}, nil
}

func findNamed(r *Run, actor, field, name string) ([]idName, error) {
	var data map[string]json.RawMessage
	var err error
	r.Wait("finding "+name+" among "+field, func() {
		data, _, err = gql(actor, fmt.Sprintf(`query($name: String!) { %s(first: 2, filter: { name: { eqIgnoreCase: $name } }) { nodes { id name } } }`, field),
			map[string]any{"name": name})
	})
	var found connection[idName]
	if err == nil {
		_ = json.Unmarshal(data[field], &found)
	}
	return found.Nodes, err
}
