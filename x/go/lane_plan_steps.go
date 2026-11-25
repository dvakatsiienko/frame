package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// a lane plan's step line, read as the glide card reads it: its ticket is the first id in its text
var (
	planStepLine = regexp.MustCompile(`^- \[([ xX])\] \d+ · (.+?)[ \t\r]*$`)
	stepTicket   = regexp.MustCompile(`\b(?:FRM|BYT)-\d+\b`)
	notGreenlit  = regexp.MustCompile(`(?i)^## not greenlit\b`)
)

var stepTextPast = regexp.MustCompile(`^\s*[:·—–-]?\s+(\S.*)$`)

type planStep struct {
	Done bool `json:"done"`
	// a step under the plan's «## not greenlit» heading: drawn, but no chunk a member is on yet
	Held   bool   `json:"held,omitempty"`
	Text   string `json:"text"`
	Ticket string `json:"ticket,omitempty"`
}

// a lane plan's steps as the glide card draws them: numbered column-0 lines only, the text past a leading id and its
// separator, since the card draws that id as its link
func planStepsOf(plan string) []planStep {
	steps := []planStep{}
	held := false
	for line := range strings.Lines(plan) {
		if notGreenlit.MatchString(line) {
			held = true
		}
		m := planStepLine.FindStringSubmatch(strings.TrimRight(line, "\n"))
		if m == nil {
			continue
		}
		step := planStep{Done: m[1] != " ", Held: held, Text: m[2], Ticket: stepTicket.FindString(m[2])}
		if rest, ok := strings.CutPrefix(m[2], step.Ticket); ok && step.Ticket != "" {
			if past := stepTextPast.FindStringSubmatch(rest); past != nil {
				step.Text = past[1]
			}
		}
		steps = append(steps, step)
	}
	return steps
}

// x-mod-stash's one read of a lane plan, spawned only when the plan file moved: no network, so the card never waits
func lanePlanSteps(r *Run, args []string, _ Flags) (any, error) {
	raw, err := os.ReadFile(args[0])
	if err != nil {
		return nil, &Fail{Msg: "no lane plan at " + home(args[0]), Next: "ls " + quote(filepath.Dir(args[0]))}
	}
	r.Open(home(args[0]))
	steps := planStepsOf(string(raw))
	r.Done(plural(len(steps), "step"), "")
	return map[string]any{"plan": args[0], "steps": steps}, nil
}

// the mark and text of a step belonging to id; a line of another ticket or no step at all answers false
func stepOf(line, id string) (mark, text string, ok bool) {
	m := planStepLine.FindStringSubmatch(line)
	if m == nil || stepTicket.FindString(m[2]) != id {
		return "", "", false
	}
	return m[1], m[2], true
}
