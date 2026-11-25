package main

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
)

const sixthSenseMark = ", sixth sense "

// what the last 🚀 line of a ticket's body recorded; a line a ↩️ leads below it took the dispatch back
type dispatchRead struct {
	base          string
	hasSixthSense bool
}

// the 🚀 line in force, "" when none is or one was taken back; a ↩️ inside a sentence only names one
func heldDispatch(text string) string {
	at := strings.LastIndex(text, dispatchedLine)
	if at < 0 || takenBackOf.MatchString(text[at:]) {
		return ""
	}
	line, _, _ := strings.Cut(text[at:], "\n")
	return strings.TrimSpace(line)
}

func dispatchOf(body string) dispatchRead {
	line := heldDispatch(body)
	read := dispatchRead{hasSixthSense: strings.Contains(line, sixthSenseMark)}
	if m := dispatchBaseOf.FindStringSubmatch(line); m != nil {
		read.base = m[1]
	}
	return read
}

var (
	dispatchBaseOf = regexp.MustCompile(`, main:([0-9a-f]{7,40})\b`)
	takenBackOf    = regexp.MustCompile(`(?m)^[\s>*-]*↩️`)
	verifiedOf     = regexp.MustCompile(`\bverified\b[*:\s]+([0-9a-f]{7,40})\b`)
)

// a quick lane's commits carry no ticket line (x:cmt), and main interleaves lanes: merged counts the verified tip and
// the commits under it whose step line names this ticket; while a named sixth sense has not said verified the lane is
// mid-verify, and --apply refuses on this line
func quickMerged(repo, id, base string, issue landedRead) ([]string, landedLine) {
	merged := landedLine{name: "merged", fix: "wait for sixth sense's clean, its verified: <sha> comment on " + id}
	verified := ""
	for _, c := range issue.Comments.Nodes {
		if m := verifiedOf.FindStringSubmatch(c.Body); m != nil {
			verified = m[1]
		}
	}
	if verified == "" && dispatchOf(issue.Description).hasSixthSense {
		merged.detail = id + " is mid-verify: the dispatch named a sixth sense and no comment says verified"
		return nil, merged
	}
	// with no sixth sense only codie's done comment bounds the range: past it, another lane's commit would read this one's
	if verified == "" {
		merged.detail, merged.fix = "no verified sha and no look card on "+id+": the lane may still be working", "wait for codie's done comment on "+id
		if issue.hasLookCard() {
			merged.detail, merged.fix = "the done comment on "+id+" names no verified: sha, so the range past main:"+short(base)+" is open", "add verified: <head sha> to the done comment on "+id
		}
		return nil, merged
	}
	tip := verified
	merged.fix = "land " + id + "'s commits on main"
	if !ok(gitIn(repo, "merge-base", "--is-ancestor", tip, "origin/main")) {
		merged.detail = short(tip) + " is not on origin/main"
		return nil, merged
	}
	got, _ := gitIn(repo, "log", base+".."+tip, "--format=%h %s")
	named, _ := gitIn(repo, "log", base+".."+tip, "-E", "--grep=^"+stepLinePrefix+id+"([^0-9]|$)", "--format=%h %s")
	var commits []string
	others := 0
	if got.ok && got.out != "" {
		stepped := strings.Split(named.out, "\n")
		for i, row := range strings.Split(got.out, "\n") {
			// the log opens on the verified tip, which the comment itself names as the lane's
			if i == 0 || slices.Contains(stepped, row) {
				commits = append(commits, row)
			} else {
				others++
			}
		}
	}
	merged.ok, merged.detail = len(commits) > 0, plural(len(commits), "commit")+" from main:"+short(base)+" to "+short(tip)
	if others > 0 {
		merged.detail += fmt.Sprintf(", not counted: %d name no step of %s", others, id)
	}
	return commits, merged
}
