package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// a pull is remembered per ticket and session: where its body went, the updatedAt it was read at and its size
type pull struct {
	File      string `json:"file"`
	UpdatedAt string `json:"updatedAt"`
	Size      int    `json:"size"`
}

var (
	wishNumber = regexp.MustCompile(`W\d+$`)
	wishHome   = regexp.MustCompile(`(?:PK|FRM|BYT)-\d+`)
)

// a session's pull is its own: a peer's pull of the same ticket moves neither my record nor my file
func pullKey(id string) string {
	if session := os.Getenv("CLAUDE_CODE_SESSION_ID"); session != "" {
		return id + "@" + session
	}
	return id
}

func pullFile(id string) string {
	return filepath.Join(stateDir(), "linear", "bodies", os.Getenv("CLAUDE_CODE_SESSION_ID"), id+".md")
}

func pullsPath() string { return filepath.Join(stateDir(), "linear", "pulls.json") }

func readPulls() map[string]pull {
	pulls := map[string]pull{}
	if raw, err := os.ReadFile(pullsPath()); err == nil {
		_ = json.Unmarshal(raw, &pulls)
	}
	return pulls
}

// a pull older than this is no session's live edit: its record goes, and its file when x pulled it to its own dir
const pullKept = 14 * 24 * time.Hour

func savePull(id string, p pull) error {
	pulls := readPulls()
	// the pull being saved is live, however old its file's bytes
	delete(pulls, pullKey(id))
	prunePulls(pulls, time.Now())
	pulls[pullKey(id)] = p
	raw, _ := json.MarshalIndent(pulls, "", "  ")
	if err := os.MkdirAll(filepath.Dir(pullsPath()), 0o755); err != nil {
		return err
	}
	// several sessions write this file: a rename lands it whole, so a peer's read never meets half of it
	whole := fmt.Sprintf("%s.%d", pullsPath(), os.Getpid())
	if err := os.WriteFile(whole, raw, 0o644); err != nil {
		return err
	}
	return os.Rename(whole, pullsPath())
}

// prunePulls drops each record whose file is gone or untouched for pullKept, so a key and a dir per session never pile up;
// a file outside x's own bodies dir (a --to path) is the caller's and stays
func prunePulls(pulls map[string]pull, now time.Time) {
	bodies := filepath.Join(stateDir(), "linear", "bodies") + string(filepath.Separator)
	for key, p := range pulls {
		info, err := os.Stat(p.File)
		if err == nil && now.Sub(info.ModTime()) < pullKept {
			continue
		}
		delete(pulls, key)
		// a `..` never walks out of the bodies dir
		if file := filepath.Clean(p.File); err == nil && strings.HasPrefix(file, bodies) {
			_ = os.Remove(file)
			_ = os.Remove(filepath.Dir(file))
		}
	}
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
		return setBody(r, actor, id, source, flags["shrink"] == true)
	}
	var issue bodyIssue
	r.Wait("pulling "+id+" as "+actor, func() { issue, err = fetchBody(actor, id) })
	if err != nil {
		return nil, err
	}
	to, _ := flags["to"].(string)
	file := cmp.Or(to, pullFile(id))
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
	if err := savePull(id, pull{file, issue.UpdatedAt, len(text)}); err != nil {
		return nil, err
	}
	r.Board(ui.dim.Render("pulled "+id+" → ") + cmd(file) + ui.dim.Render("  edit it, then ") + cmd("x linear body "+id+" --set "+file))
	return ordered{{"actor", actor}, {"file", file}, {"id", id}, {"updatedAt", issue.UpdatedAt}}, nil
}

func setBody(r *Run, actor, id, source string, shrink bool) (any, error) {
	text, err := os.ReadFile(source)
	if err != nil {
		return nil, usageFail("cannot read "+source, "x linear body "+id+" --set <file>")
	}
	if strings.TrimSpace(string(text)) == "" {
		return nil, &Fail{Refused: true, Msg: source + " is empty: a body is never blanked through --set; nothing was written", Next: "x linear body " + id}
	}
	pulled, ok := readPulls()[pullKey(id)]
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
	// the size to hold a set against is the largest since the pull: a record older than its size field reads 0, and a
	// run of sets each just over a fifth of the last would otherwise walk a body down unasked
	held := deref(current.Description)
	largest := max(pulled.Size, len(held))
	if damage := bodyDamage(id, source, held, string(text), largest, shrink); damage != nil {
		return nil, damage
	}
	input := map[string]any{"description": string(text)}
	// a clio writing the body of a ticket no clio holds claims it; one another clio holds stays hers (FRM-572:W1, o77)
	if owner := callerOwnerLabel(); owner != "" {
		var labels struct {
			Issue struct {
				Labels connection[idName] `json:"labels"`
				Team   struct {
					ID string `json:"id"`
				} `json:"team"`
			} `json:"issue"`
			OwnerLabels connection[ownerLabelNode] `json:"ownerLabels"`
		}
		found, _, lookupErr := gql(actor, `query($id: String!, $owner: String!) { issue(id: $id) { labels(first: 100) { nodes { id name } } team { id } }
			ownerLabels: issueLabels(first: 20, filter: { name: { eqIgnoreCase: $owner } }) { nodes { id name team { id } } } }`, map[string]any{"id": id, "owner": owner})
		if lookupErr == nil {
			raw, _ := json.Marshal(found)
			_ = json.Unmarshal(raw, &labels)
			isHeld := slices.ContainsFunc(labels.Issue.Labels.Nodes, func(label idName) bool { return isOwnerLabel(label.Name) })
			if !isHeld {
				adds, removes := ownerDelta(owner, labels.Issue.Labels.Nodes, labels.OwnerLabels.Nodes, labels.Issue.Team.ID)
				mergeOwner(input, adds, removes)
			}
		}
	}
	var data map[string]json.RawMessage
	r.Wait("writing "+id+" as "+actor, func() {
		data, _, err = gql(actor, `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { updatedAt } } }`,
			map[string]any{"id": current.ID, "input": input})
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
	// the write is the new baseline: a second edit of the same file needs no second pull; its size stays the largest.
	// the pull's own file takes the written text too, since ticket-sign.ts stamps that file and a stale one would pass
	// the next set's moved check
	if cache := pullFile(id); cache != source {
		_ = os.WriteFile(cache, text, 0o644)
	}
	kept := source
	if cache := pullFile(id); cache != source && exists(cache) {
		kept = cache
	}
	_ = savePull(id, pull{kept, result.Issue.UpdatedAt, max(largest, len(text))})
	r.Board(ui.ok.Render("✓ ") + ui.fg.Render("wrote "+id+"'s body as "+actor))
	return ordered{{"actor", actor}, {"id", id}, {"updatedAt", result.Issue.UpdatedAt}}, nil
}

func deref(text *string) string {
	if text == nil {
		return ""
	}
	return *text
}

// what a set would damage, read against the body the pull held: most of its size, a W-line, the sign block
func bodyDamage(id, source, held, edit string, pulledSize int, shrink bool) *Fail {
	set := "x linear body " + id + " --set " + source
	if !shrink && len(edit)*5 < pulledSize {
		return &Fail{Refused: true,
			Msg:  fmt.Sprintf("%s holds %d bytes, under a fifth of the %d pulled; nothing was written", source, len(edit), pulledSize),
			Next: set + " --shrink — only when the cut is meant"}
	}
	kept := wishIDs(id, edit)
	if lost := slices.DeleteFunc(wishIDs(id, held), func(n string) bool { return slices.Contains(kept, n) }); len(lost) > 0 {
		return &Fail{Refused: true,
			Msg:  fmt.Sprintf("%s lost %s of %s's wish: a W-line is dima's words, reworded but never dropped; nothing was written", source, strings.Join(lost, ", "), id),
			Next: "x linear body " + id + " --to " + source + ".theirs && diff " + source + " " + source + ".theirs"}
	}
	_, block, signed := signedBlock(held)
	if !signed {
		return nil
	}
	_, edited, _ := signedBlock(edit)
	old, now := nonBlank(block), nonBlank(edited)
	what := ""
	if at := firstLost(old, now); at >= 0 {
		what = "lost or changed «" + old[at] + "»"
	} else if len(now) == len(old) {
		what = "gained no line"
	}
	if what == "" {
		return nil
	}
	return &Fail{Refused: true,
		Msg:  id + " is signed and its ## signed block " + what + ": a change to a signed ticket goes through `ticket-sign.ts changed`, which adds its ✏️ line; nothing was written",
		Next: "x linear read " + id}
}

// a W-line's whole id, the wish it came from and its number: a body quotes other wishes beside its own, and two of
// them share a number; a bare W-line is the ticket's own
func wishIDs(id, body string) []string {
	var ids []string
	for _, line := range wishItem.FindAllString(body, -1) {
		home := cmp.Or(wishHome.FindString(line), id)
		ids = append(ids, home+":"+wishNumber.FindString(line))
	}
	return ids
}

// the first old line the new list does not hold in order, or -1
func firstLost(old, now []string) int {
	at := 0
	for i, line := range old {
		found := slices.Index(now[at:], line)
		if found < 0 {
			return i
		}
		at += found + 1
	}
	return -1
}
