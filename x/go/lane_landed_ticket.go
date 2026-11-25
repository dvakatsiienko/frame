package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

var wishItem = regexp.MustCompile(`(?m)^\s*(?:[*-]\s+(?:\[?(?:PK|FRM|BYT)-\d+\]?(?:\([^)\s]*\))?:)?|\[?(?:PK|FRM|BYT)-\d+\]?(?:\([^)\s]*\))?:)W\d+\b`)

var (
	habitsHead = regexp.MustCompile(`(?m)^## 🪢 habits[ \t]*$`)
	habitItem  = regexp.MustCompile(`(?m)^[-*] \[([ xX])\] (.+?)[ \t\r]*$`)
)

// a ticket's `## 🪢 habits` lines, each a habit the lane must leave in place, red while one is unticked; nil when the body
// holds none (FRM-505's exit 6)
func habitsLine(body, id string) *landedLine {
	at := habitsHead.FindStringIndex(body)
	if at == nil {
		return nil
	}
	section := body[at[1]:]
	if next := nextHeading.FindStringIndex(section); next != nil {
		section = section[:next[0]]
	}
	var open []string
	items := habitItem.FindAllStringSubmatch(section, -1)
	for _, item := range items {
		if item[1] == " " {
			open = append(open, "«"+item[2]+"»")
		}
	}
	switch {
	case len(items) == 0:
		return nil
	case len(open) > 0:
		return &landedLine{name: "habits", detail: "unticked: " + strings.Join(open, ", "), fix: "tick each habit line in " + id + "'s body once it holds"}
	}
	return &landedLine{name: "habits", ok: true, detail: plural(len(items), "habit line") + " ticked"}
}

// a ticket another open one still blocks is not freed
func freedTickets(issue landedRead, id string) []string {
	closed := func(state string) bool { return state == "completed" || state == "canceled" }
	var freed []string
	for _, relation := range issue.Relations.Nodes {
		blocked := relation.RelatedIssue
		if relation.Type != "blocks" || closed(blocked.State.Type) {
			continue
		}
		if !slices.ContainsFunc(blocked.InverseRelations.Nodes, func(by blockerRelation) bool {
			return by.Type == "blocks" && by.Issue.Identifier != id && !closed(by.Issue.State.Type)
		}) {
			freed = append(freed, blocked.Identifier)
		}
	}
	return freed
}

const (
	lookSentLine = "👀 look sent "
)

func (r landedRead) hasLookCard() bool {
	return slices.ContainsFunc(r.Comments.Nodes, func(c struct{ Body string }) bool { return isLookCard(c.Body) })
}

var (
	lookSentOf     = regexp.MustCompile(`(?m)^` + lookSentLine + `\d{4}-\d{2}-\d{2}`)
	ticketRepoLine = regexp.MustCompile(`(?m)^repo:\s*(\S+)\s*$`)
)

// where a ticket's repo: line points, else its team's repo; "" for a frame ticket with no line, a refusal when the
// checkout is not on this mac
func ticketRepo(id, body string) (string, error) {
	name := ""
	if m := ticketRepoLine.FindStringSubmatch(body); m != nil {
		name = m[1]
	} else if strings.HasPrefix(id, "BYT-") {
		name = "bytes"
	} else if strings.HasPrefix(id, "FRM-") {
		name = "frame"
	}
	switch name {
	case "":
		return "", nil
	case "frame":
		return mainCheckout(frameRoot()), nil
	}
	userHome, _ := os.UserHomeDir()
	path := filepath.Join(userHome, "projects", name)
	if !exists(path) {
		return "", usageFail("the ticket's repo: "+name+" has no checkout at "+home(path), "x lane landed <ticket> --repo <path>")
	}
	return path, nil
}

// the look card's two fields every done report carries, each a «- **field**:» line (crew-codie how-you-work.md)
var lookFields = []*regexp.Regexp{regexp.MustCompile(`(?im)^\W*proven\W*:`), regexp.MustCompile(`(?im)^\W*not checked\W*:`)}

func isLookCard(body string) bool {
	return !slices.ContainsFunc(lookFields, func(field *regexp.Regexp) bool { return !field.MatchString(body) })
}

type milestoneIssue struct {
	State struct{ Type string }
}

type landedRead struct {
	Description      string
	Comments         connection[struct{ Body string }]
	ProjectMilestone *struct {
		Issues connection[milestoneIssue]
	}
	Relations connection[struct {
		Type         string
		RelatedIssue struct {
			Identifier       string
			State            struct{ Type string }
			InverseRelations connection[blockerRelation]
		}
	}]
}

type blockerRelation struct {
	Type  string
	Issue struct {
		Identifier string
		State      struct{ Type string }
	}
}

func landedIssue(flags Flags, id string) (landedRead, error) {
	actor, err := actorOf(flags)
	if err != nil {
		return landedRead{}, err
	}
	data, _, err := gql(actor, `query($id: String!) { issue(id: $id) { description comments(first: 100) { nodes { body } }
		relations(first: 50) { nodes { type relatedIssue { identifier state { type } inverseRelations(first: 50) { nodes { type issue { identifier state { type } } } } } } }
		projectMilestone { issues(first: 100) { nodes { state { type } } } } } }`, map[string]any{"id": id})
	if err != nil {
		return landedRead{}, err
	}
	var read landedRead
	if raw, found := data["issue"]; !found || string(raw) == "null" || json.Unmarshal(raw, &read) != nil {
		return landedRead{}, &Fail{Msg: "linear sent no issue " + id, Next: "x linear read " + id}
	}
	return read, nil
}
