package main

import (
	"cmp"
	"encoding/json"
	"os"
	"path/filepath"
)

// a pull is remembered per ticket: where its body went and the updatedAt it was read at
type pull struct {
	File      string `json:"file"`
	UpdatedAt string `json:"updatedAt"`
}

func pullsPath() string { return filepath.Join(stateDir(), "linear", "pulls.json") }

func readPulls() map[string]pull {
	pulls := map[string]pull{}
	if raw, err := os.ReadFile(pullsPath()); err == nil {
		_ = json.Unmarshal(raw, &pulls)
	}
	return pulls
}

func savePull(id string, p pull) error {
	pulls := readPulls()
	pulls[id] = p
	raw, _ := json.MarshalIndent(pulls, "", "  ")
	if err := os.MkdirAll(filepath.Dir(pullsPath()), 0o755); err != nil {
		return err
	}
	return os.WriteFile(pullsPath(), raw, 0o644)
}

type bodyIssue struct {
	ID          string  `json:"id"`
	Description *string `json:"description"`
	UpdatedAt   string  `json:"updatedAt"`
}

func fetchBody(actor, id string) (bodyIssue, error) {
	data, errs, err := gql(actor, "query($id: String!) { issue(id: $id) { id description updatedAt } }", map[string]any{"id": id})
	if err != nil {
		return bodyIssue{}, err
	}
	var issue bodyIssue
	if json.Unmarshal(data["issue"], &issue) != nil || issue.ID == "" {
		reason := "not found"
		if len(errs) > 0 {
			reason = errs[0].Message
		}
		return bodyIssue{}, &Fail{Msg: id + ": " + reason, Next: "x linear list --search " + id}
	}
	return issue, nil
}

// body pulls a description to a file, or with --set writes the file back — refused when the ticket
// moved since the pull, so a peer's edit or dima's words are never overwritten
func linearBody(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if err := checkIDs(args, "linear body"); err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	if source, _ := flags["set"].(string); source != "" {
		return setBody(r, actor, id, source)
	}
	var issue bodyIssue
	r.Wait("pulling "+id+" as "+actor, func() { issue, err = fetchBody(actor, id) })
	if err != nil {
		return nil, err
	}
	to, _ := flags["to"].(string)
	file := cmp.Or(to, filepath.Join(stateDir(), "linear", "bodies", id+".md"))
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		return nil, usageFail("cannot write "+file+": "+err.Error(), "x linear body "+id+" --to <file>")
	}
	text := ""
	if issue.Description != nil {
		text = *issue.Description
	}
	if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
		return nil, usageFail("cannot write "+file+": "+err.Error(), "x linear body "+id+" --to <file>")
	}
	if err := savePull(id, pull{file, issue.UpdatedAt}); err != nil {
		return nil, err
	}
	r.Board(ui.dim.Render("pulled "+id+" → ") + cmd(file) + ui.dim.Render("  edit it, then ") + cmd("x linear body "+id+" --set "+file))
	return ordered{{"actor", actor}, {"file", file}, {"id", id}, {"updatedAt", issue.UpdatedAt}}, nil
}

func setBody(r *Run, actor, id, source string) (any, error) {
	text, err := os.ReadFile(source)
	if err != nil {
		return nil, usageFail("cannot read "+source, "x linear body "+id+" --set <file>")
	}
	pulled, ok := readPulls()[id]
	if !ok {
		return nil, &Fail{Msg: "no pull of " + id + " to compare against — pull it first", Next: "x linear body " + id, Refused: true}
	}
	var current bodyIssue
	r.Wait("checking "+id, func() { current, err = fetchBody(actor, id) })
	if err != nil {
		return nil, err
	}
	if current.UpdatedAt != pulled.UpdatedAt {
		theirs := source + ".theirs"
		return nil, &Fail{Refused: true,
			Msg:  id + " changed since the pull (" + pulled.UpdatedAt + " → " + current.UpdatedAt + "); nothing was written",
			Next: "x linear body " + id + " --to " + theirs + " && diff " + source + " " + theirs}
	}
	var data map[string]json.RawMessage
	r.Wait("writing "+id+" as "+actor, func() {
		data, _, err = gql(actor, `mutation($id: String!, $description: String!) { issueUpdate(id: $id, input: { description: $description }) { success issue { updatedAt } } }`,
			map[string]any{"id": current.ID, "description": string(text)})
	})
	if err != nil {
		return nil, err
	}
	var result struct {
		Success bool `json:"success"`
		Issue   struct {
			UpdatedAt string `json:"updatedAt"`
		} `json:"issue"`
	}
	if json.Unmarshal(data["issueUpdate"], &result) != nil || !result.Success {
		return nil, &Fail{Msg: "linear did not take the write to " + id, Next: "x linear read " + id}
	}
	// the write is the new baseline: a second edit of the same file needs no second pull
	_ = savePull(id, pull{source, result.Issue.UpdatedAt})
	r.Board(ui.ok.Render("✓ ") + ui.fg.Render("wrote "+id+"'s body as "+actor))
	return ordered{{"actor", actor}, {"id", id}, {"updatedAt", result.Issue.UpdatedAt}}, nil
}
