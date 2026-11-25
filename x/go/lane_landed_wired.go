package main

import (
	"regexp"
	"slices"
	"strconv"
	"strings"
)

var (
	worthSection  = regexp.MustCompile(`(?s)## ⚖️ worth it\n(.*?)(\n## |\z)`)
	newVerbLine   = regexp.MustCompile(`(?mi)^[\s*\d.-]*new verbs?\**:\**[ \t]*(.*)$`)
	newVerbQuoted = regexp.MustCompile("`([^`]+)`")
	newVerbSplit  = regexp.MustCompile(`,| and `)
)

// the x verbs a ticket's `new verb: <name>` lines name, and the names no verb answers to; prose guesses nothing.
// a line's first name and any spelled `x <verb>` must answer; past those a comma may open prose. a backticked name is
// the verb and its flags whole, a bare one may run on into a sentence, so `x stats dayly` reds and x stats dayly reads stats
func newVerbsOf(body string) (verbs, nameless []string) {
	section := worthSection.FindStringSubmatch(body)
	if section == nil {
		return nil, nil
	}
	read := func(name string, first, whole bool) {
		name = strings.TrimSpace(name)
		words := strings.Fields(strings.TrimPrefix(name, "x "))
		verb, depth, found := findVerb(words)
		if flag := slices.IndexFunc(words, func(w string) bool { return strings.HasPrefix(w, "-") }); whole && flag >= 0 {
			words = words[:flag]
		}
		switch {
		case found && (!whole || depth == len(words)):
			if !slices.Contains(verbs, verb.Name) {
				verbs = append(verbs, verb.Name)
			}
		case first || strings.HasPrefix(name, "x "):
			nameless = append(nameless, name)
		}
	}
	for _, m := range newVerbLine.FindAllStringSubmatch(section[1], -1) {
		named, _, _ := strings.Cut(strings.ReplaceAll(m[1], "*", ""), "—")
		opening := strings.Fields(named)
		if len(opening) == 0 || strings.Trim(strings.ToLower(opening[0]), ".,:;()`") == "none" {
			continue
		}
		for i, piece := range newVerbSplit.Split(named, -1) {
			// a backticked flag is prose about the verb, never a name
			var quoted []string
			for _, q := range newVerbQuoted.FindAllStringSubmatch(piece, -1) {
				if !strings.HasPrefix(q[1], "-") {
					quoted = append(quoted, q[1])
				}
			}
			if len(quoted) == 0 {
				read(strings.ReplaceAll(piece, "`", ""), i == 0, false)
			}
			for j, name := range quoted {
				read(name, i == 0 && j == 0, true)
			}
		}
	}
	return verbs, nameless
}

// a new verb is measured at its milestone's close, the merge is too early to say: no ticket left open, this one included, is the close
func wiredLine(verb string, issue landedRead) landedLine {
	line := landedLine{name: "wired", ok: true, detail: "wired: unmeasured yet"}
	milestone := issue.ProjectMilestone
	if milestone == nil || slices.ContainsFunc(milestone.Issues.Nodes, func(n milestoneIssue) bool {
		return n.State.Type != "completed" && n.State.Type != "canceled"
	}) {
		return line
	}
	calls := verbCalls(verb, wiredDays)
	line.ok = calls > 0
	line.detail = plural(calls, "call") + " of x " + verb + " in " + strconv.Itoa(wiredDays) + " days"
	line.fix = "back to Todo with the ↩️ awaited call of x " + verb
	return line
}

const wiredDays = 30
