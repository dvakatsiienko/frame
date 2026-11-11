package main

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

const dispatchedLine = "🚀 dispatched "

// a 🚀 line's fields: lane, session, base, sixth sense; a line a hand wrote in another shape reads as none
var dispatchLineOf = regexp.MustCompile(`^🚀 dispatched \S+ — (.+?), codie (\S+?)(?:, main:([0-9a-f]+))?(?:, sixth sense (\S+))?$`)

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
	Slices  string           `json:"slices,omitempty"`
	Glide   string           `json:"glide"`
	Window  string           `json:"window"`
}

type dispatchLookup struct {
	Issue struct {
		ID          string                      `json:"id"`
		Identifier  string                      `json:"identifier"`
		Description *string                     `json:"description"`
		State       struct{ Name, Type string } `json:"state"`
		Delegate    *named                      `json:"delegate"`
		Labels      connection[idName]          `json:"labels"`
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
	mark := dispatchNote{quick: flags["quick"] == true, sixthSense: flagString(flags, "sixth-sense")}
	r.Open("as " + actor)
	plan := dispatchPlan{Tickets: []dispatchTicket{}}
	for _, id := range args {
		var found dispatchLookup
		if err := r.Step("read "+id, "its labels, state, delegate and sign", func() (string, error) {
			data, _, err := gql(actor, `query($id: String!) { issue(id: $id) { id identifier description state { name type } delegate { name }
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
		ticket, err := dispatchMarks(id, found, session, lane, mark)
		if err != nil {
			return nil, err
		}
		plan.Tickets = append(plan.Tickets, ticket)
	}
	// outside every checkout: a .scratch/ in the worktree would keep the tree from its decamp at land
	// one dir name with codie's lane plan: the spec's feature, else the lane
	feature := ""
	for _, id := range args {
		of := lane
		if paths, _ := laneSpecSection(mainCheckout(frameRoot()), id); len(paths) > 0 {
			of = filepath.Base(filepath.Dir(paths[0]))
		}
		if feature != "" && of != feature {
			return nil, usageFail(args[0]+" sits in lane spec "+feature+", "+id+" in "+of+": one dispatch is one lane", "x lane dispatch <one lane's ids> --session <sid> --lane <name>")
		}
		feature = of
	}
	if feature != "" {
		plan.Slices = home(filepath.Join(stateDir(), "lanes", feature, "issues")) + "/ — codie's to-tickets slices"
	}
	plan.Glide = "orbit glide, act link, role codie, session " + cmp.Or(session, "<sid>") + " — clio's call, x never calls orbit"
	plan.Window = fiveHourWindow()
	return plan, nil
}

// what the 🚀 line records past its lane and session, x lane landed reads them back
type dispatchNote struct {
	quick      bool
	sixthSense string
}

func dispatchMarks(id string, found dispatchLookup, session, lane string, note dispatchNote) (dispatchTicket, error) {
	issue := found.Issue
	if issue.ID == "" {
		return dispatchTicket{}, &Fail{Msg: id + ": not found", Next: "x linear list --search " + id}
	}
	body := ""
	if issue.Description != nil {
		body = *issue.Description
	}
	_, block, signed := signedBlock(body)
	if note.quick {
		block = body
	}
	labelAt := slices.IndexFunc(issue.Labels.Nodes, func(l idName) bool { return strings.EqualFold(l.Name, "signed") })
	held := heldDispatch(block)
	dispatched := held != ""
	sign, _, _ := bodySign(body)
	switch {
	// a quick lane has no sign to check
	case note.quick:
	case !signed:
		return dispatchTicket{}, &Fail{Refused: true, Msg: id + " carries no ## signed block: a chunk is signed before its dispatch", Next: "x linear read " + id}
	// a 🚀 already written stands: the drift came after the dispatch, and a re-run writes no new mark on it
	case sign != signMatch && !dispatched:
		return dispatchTicket{}, &Fail{Refused: true, Msg: id + "'s sign reads " + sign + ": the body moved since dima signed it, so it is signed again before its dispatch", Next: "x linear list --team " + strings.SplitN(id, "-", 2)[0] + " --label signed"}
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
	if !note.quick {
		mark("label", labelAt >= 0, "signed off")
	}
	if labelAt >= 0 && !note.quick {
		ticket.input["removedLabelIds"] = []string{issue.Labels.Nodes[labelAt].ID}
	}
	// only a ticket not yet started moves; In Review or Done is past the dispatch, never moved back
	unstarted := slices.Contains([]string{"triage", "backlog", "unstarted"}, issue.State.Type)
	mark("state", unstarted, issue.State.Name+" → In Progress")
	if unstarted {
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
	was := dispatchLineOf.FindStringSubmatch(held)
	if was == nil {
		was = make([]string, 5)
	}
	newLane, newSession := cmp.Or(lane, was[1]), cmp.Or(session, was[2])
	base, sixthSense := "", note.sixthSense
	// the same lane under a new session keeps the range and the verifier its line names; another lane starts fresh
	if newLane == was[1] {
		base, sixthSense = was[3], cmp.Or(sixthSense, was[4])
	}
	named := lane != "" || session != "" || note.sixthSense != ""
	if (!dispatched || named) && (newSession == "" || newLane == "") {
		return dispatchTicket{}, usageFail("the 🚀 line names the lane and the session: pass --lane <name> --session <sid>", "x lane dispatch "+id+" --session <sid> --lane <name>")
	}
	write := !dispatched || (named && (newLane != was[1] || newSession != was[2] || sixthSense != was[4]))
	line := held
	if write {
		if note.quick && base == "" {
			repo, err := ticketRepo(id, body)
			if err != nil {
				return dispatchTicket{}, err
			}
			repo = cmp.Or(repo, mainCheckout(frameRoot()))
			// a stale ref lowers the base, and the range then holds other lanes' commits
			_, _ = gitIn(repo, "fetch", "-q", "origin", "main")
			base, err = mustGitIn(repo, "rev-parse", "rev-parse", "--short=7", "origin/main")
			if err != nil {
				return dispatchTicket{}, err
			}
		}
		line = dispatchedLine + time.Now().Format("2006-01-02") + " — " + newLane + ", codie " + newSession
		if base != "" {
			line += ", main:" + base
		}
		if sixthSense != "" {
			line += sixthSenseMark + sixthSense
		}
	}
	mark("🚀 line", write, line)
	if write {
		ticket.input["description"] = withSignLine(body, line)
		if note.quick {
			ticket.input["description"] = aboveStamp(body, line)
		}
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

// a quick ticket has no sign block: the line closes the body, above a trailing run stamp
func aboveStamp(body, line string) string {
	at := strings.LastIndex(body, "⸻")
	if at < 0 {
		return strings.TrimRight(body, "\n") + "\n\n" + line + "\n"
	}
	return strings.TrimRight(body[:at], "\n") + "\n\n" + line + "\n\n" + body[at:]
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
	if path := threadStorePath(); path != "" {
		store, err := readThreadStore(path)
		if err != nil {
			return nil, &Fail{Msg: "the thread store did not read: " + err.Error(), Next: "x thread list"}
		}
		for role, sid := range map[string]string{"codie": flagString(flags, "session"), "sixth-sense": flagString(flags, "sixth-sense")} {
			if sid == "" {
				continue
			}
			if err := threadRoleRefusal(store.Threads, sid, role); err != nil {
				return nil, err
			}
		}
	}
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
	// the threads it names get their record, so a reader asks x by session id and never parses a name
	kind := "side"
	if flags["quick"] == true {
		kind = "quick"
	}
	for role, sid := range map[string]string{"codie": flagString(flags, "session"), "sixth-sense": flagString(flags, "sixth-sense")} {
		if sid == "" {
			continue
		}
		record := thread{SessionID: sid, Role: role, Lane: flagString(flags, "lane"), LaneKind: kind, Ticket: plan.Tickets[0].ID}
		if err := writeThreadRecord(record, time.Now()); err != nil {
			if fail, isFail := errors.AsType[*Fail](err); isFail {
				return nil, fail
			}
			return nil, &Fail{Msg: "the thread record of " + sid + " was not written: " + err.Error(), Next: "x thread list"}
		}
	}
	r.Done("dispatched; left by hand: the glide link", plan.Window)
	return plan, nil
}
