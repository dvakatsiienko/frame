package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

const dispatchedLine = "🚀 dispatched "

// one mark a dispatch writes: write when it is missing, set when the ticket already carries it
type dispatchMark struct {
	Mark   string `json:"mark"`
	Status string `json:"status"`
	Detail string `json:"detail"`
}

type dispatchTicket struct {
	ID    string         `json:"id"`
	Marks []dispatchMark `json:"marks"`
	uuid  string
	input map[string]any
}

type dispatchPlan struct {
	Tickets []dispatchTicket `json:"tickets"`
	Glide   string           `json:"glide"`
	Window  string           `json:"window"`
}

type dispatchLookup struct {
	Issue struct {
		ID          string             `json:"id"`
		Identifier  string             `json:"identifier"`
		Description *string            `json:"description"`
		State       named              `json:"state"`
		Delegate    *named             `json:"delegate"`
		Labels      connection[idName] `json:"labels"`
		Team        struct {
			States connection[idName] `json:"states"`
		} `json:"team"`
	} `json:"issue"`
	Users connection[idName] `json:"users"`
}

// dispatchPlanOf reads each ticket and lists the four marks a dispatch writes: the signed label off, In Progress,
// the codie delegate, the 🚀 line closing the sign block. the body above ## signed never changes, so the sign holds
func dispatchPlanOf(r *Run, args []string, flags Flags) (any, error) {
	if err := checkIDs(args, "lane dispatch"); err != nil {
		return nil, err
	}
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	session, lane := flagString(flags, "session"), flagString(flags, "lane")
	r.Open("as " + actor)
	plan := dispatchPlan{Tickets: []dispatchTicket{}}
	for _, id := range args {
		var found dispatchLookup
		if err := r.Step("read "+id, "its labels, state, delegate and sign", func() (string, error) {
			data, _, err := gql(actor, `query($id: String!) { issue(id: $id) { id identifier description state { name } delegate { name }
				labels(first: 100) { nodes { id name } } team { states { nodes { id name } } } }
				users(filter: { name: { eqIgnoreCase: "codie" } }) { nodes { id name } } }`, map[string]any{"id": id})
			if err != nil {
				return "", err
			}
			raw, _ := json.Marshal(data)
			_ = json.Unmarshal(raw, &found)
			return found.Issue.State.Name, nil
		}); err != nil {
			return nil, err
		}
		ticket, err := dispatchMarks(id, found, session, lane)
		if err != nil {
			return nil, err
		}
		plan.Tickets = append(plan.Tickets, ticket)
	}
	plan.Glide = "orbit glide, act link, role codie, session " + cmp.Or(session, "<sid>") + " — clio's call, x never calls orbit"
	plan.Window = fiveHourWindow()
	return plan, nil
}

func dispatchMarks(id string, found dispatchLookup, session, lane string) (dispatchTicket, error) {
	issue := found.Issue
	if issue.ID == "" {
		return dispatchTicket{}, &Fail{Msg: id + ": not found", Next: "x linear list --search " + id}
	}
	body := ""
	if issue.Description != nil {
		body = *issue.Description
	}
	_, block, signed := signedBlock(body)
	labelAt := slices.IndexFunc(issue.Labels.Nodes, func(l idName) bool { return strings.EqualFold(l.Name, "signed") })
	dispatched := strings.Contains(block, dispatchedLine)
	switch {
	case !signed:
		return dispatchTicket{}, &Fail{Refused: true, Msg: id + " carries no ## signed block: a chunk is signed before its dispatch", Next: "x linear read " + id}
	case labelAt < 0 && !dispatched:
		return dispatchTicket{}, &Fail{Refused: true, Msg: id + " carries neither the signed label nor a 🚀 dispatched line: its sign is missing", Next: "x linear read " + id}
	}

	ticket := dispatchTicket{ID: id, uuid: issue.ID, input: map[string]any{}}
	mark := func(name string, missing bool, detail string) {
		status := "set"
		if missing {
			status = "write"
		}
		ticket.Marks = append(ticket.Marks, dispatchMark{name, status, detail})
	}
	mark("label", labelAt >= 0, "signed off")
	if labelAt >= 0 {
		ticket.input["removedLabelIds"] = []string{issue.Labels.Nodes[labelAt].ID}
	}
	inProgress := issue.State.Name == "In Progress"
	mark("state", !inProgress, issue.State.Name+" → In Progress")
	if !inProgress {
		at := slices.IndexFunc(issue.Team.States.Nodes, func(s idName) bool { return s.Name == "In Progress" })
		if at < 0 {
			return dispatchTicket{}, &Fail{Msg: id + "'s team has no In Progress state", Next: "x linear read " + id}
		}
		ticket.input["stateId"] = issue.Team.States.Nodes[at].ID
	}
	delegated := issue.Delegate != nil && issue.Delegate.Name == "codie"
	mark("delegate", !delegated, "codie")
	if !delegated {
		if len(found.Users.Nodes) == 0 {
			return dispatchTicket{}, &Fail{Msg: "linear knows no codie user to delegate to", Next: "x linear api"}
		}
		ticket.input["delegateId"] = found.Users.Nodes[0].ID
	}
	line := dispatchedLine + time.Now().Format("2006-01-02") + " — " + lane + ", codie " + session
	if dispatched {
		for held := range strings.SplitSeq(block, "\n") {
			if strings.Contains(held, dispatchedLine) {
				line = strings.TrimSpace(held)
			}
		}
	}
	mark("🚀 line", !dispatched, line)
	if !dispatched {
		if session == "" || lane == "" {
			return dispatchTicket{}, usageFail("the 🚀 line names the lane and the session: pass --lane <name> --session <sid>", "x lane dispatch "+id+" --session <sid> --lane <name>")
		}
		ticket.input["description"] = withSignLine(body, line)
	}
	return ticket, nil
}

// withSignLine adds line after the last line of the closing ## signed block, above a trailing run stamp
func withSignLine(body, line string) string {
	lines := strings.Split(body, "\n")
	head := slices.IndexFunc(lines, func(l string) bool { return signedHeading.MatchString(l) })
	for i := len(lines) - 1; i > head; i-- {
		if signedHeading.MatchString(lines[i]) {
			head = i
			break
		}
	}
	last := head
	for i := head + 1; i < len(lines); i++ {
		if strings.HasPrefix(lines[i], "## ") || strings.HasPrefix(lines[i], "⸻") {
			break
		}
		if strings.TrimSpace(lines[i]) != "" {
			last = i
		}
	}
	return strings.Join(slices.Insert(lines, last+1, line), "\n")
}

// the 5h line the summon reads, from the window file the statusline writes
func fiveHourWindow() string {
	userHome, _ := os.UserHomeDir()
	raw, err := os.ReadFile(filepath.Join(userHome, ".claude/shelf/cc-usage-window.json"))
	var window struct {
		Limits struct {
			FiveHour struct {
				ResetsAt int64   `json:"resets_at"`
				Used     float64 `json:"used_percentage"`
			} `json:"five_hour"`
		} `json:"rate_limits"`
	}
	if err != nil || json.Unmarshal(raw, &window) != nil || window.Limits.FiveHour.ResetsAt == 0 {
		return "5h window: unread, no ~/.claude/shelf/cc-usage-window.json"
	}
	resets := time.Unix(window.Limits.FiveHour.ResetsAt, 0).Format("15:04")
	return fmt.Sprintf("5h window: %.0f%% used, resets %s", window.Limits.FiveHour.Used, resets)
}

func askDispatch(plan any) string {
	return fmt.Sprintf("dispatch %d ticket(s): write their missing marks?", len(plan.(dispatchPlan).Tickets))
}

func laneDispatch(r *Run, _ []string, flags Flags, planned any) (any, error) {
	plan := planned.(dispatchPlan)
	actor, err := actorOf(flags)
	if err != nil {
		return nil, err
	}
	for _, ticket := range plan.Tickets {
		if len(ticket.input) == 0 {
			continue
		}
		if err := r.Step("write "+ticket.ID, "every missing mark in one update", func() (string, error) {
			data, _, err := gql(actor, "mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }",
				map[string]any{"id": ticket.uuid, "input": ticket.input})
			if err != nil {
				return "", err
			}
			var result struct {
				Success bool `json:"success"`
			}
			if json.Unmarshal(data["issueUpdate"], &result) != nil || !result.Success {
				return "", &Fail{Msg: "linear did not take the dispatch of " + ticket.ID, Next: "x linear read " + ticket.ID}
			}
			return plural(len(ticket.input), "field"), nil
		}); err != nil {
			return nil, err
		}
	}
	r.Done("dispatched; left by hand: the glide link", plan.Window)
	return plan, nil
}
