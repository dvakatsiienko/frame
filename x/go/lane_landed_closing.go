package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const closingWords = "reviewed and closed"

// a trailing note in parens still reads as the closer: «reviewed and closed (round 2)»
var closingStep = regexp.MustCompile(`\b(?:reviewed and closed|closes)(?:\s+\(.*\))?$`)

// the plans of a ticket's specs, live first, then the first holding a step of the ticket: a stale spec may sort ahead
func lanePlanOf(frame, id string) (path string, lines []string) {
	specs, _ := laneSpecSection(frame, id)
	if found := archivedSpec(frame, id); found != "" {
		specs = append(specs, found)
	}
	for _, spec := range specs {
		candidate := filepath.Join(stateDir(), "lanes", filepath.Base(filepath.Dir(spec)), "lane-plan.md")
		raw, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		split := strings.Split(string(raw), "\n")
		for _, line := range split {
			if _, _, ok := stepOf(line, id); ok {
				return candidate, split
			}
		}
	}
	return "", nil
}

// the chunk's closing slice, -1 for none: its last step, when that ends in a closing word, so a second round's own line
// is read, not the first round's, and a build line that happens to end so never is
func closingIndex(lines []string, id string) int {
	at := -1
	for i, l := range lines {
		if _, _, ok := stepOf(l, id); ok {
			at = i
		}
	}
	if at >= 0 {
		if _, text, _ := stepOf(lines[at], id); !closingStep.MatchString(text) {
			return -1
		}
	}
	return at
}

// an open closing-shaped step ahead of the closer: the card stays on it, so the closer's tick alone would not move it
func openCloserBefore(lines []string, id string, at int) string {
	for _, l := range lines[:at] {
		if mark, text, ok := stepOf(l, id); ok && mark == " " && closingStep.MatchString(text) {
			return text
		}
	}
	return ""
}

// closingLine reads the slice that holds a chunk on the glide card while its reviews run; has is false when no
// lane plan names the chunk, and open names the plan while the slice waits for --apply
func closingLine(frame, id string) (line landedLine, open string, has bool) {
	path, lines := lanePlanOf(frame, id)
	if path == "" {
		return line, "", false
	}
	line = landedLine{name: "closing"}
	at := closingIndex(lines, id)
	if at < 0 {
		line.detail = home(path) + " holds no closing slice for " + id
		line.fix = "end " + id + "'s slices in " + home(path) + " with «- [ ] NN · " + id + " " + closingWords + "»"
		return line, "", true
	}
	mark, _, _ := stepOf(lines[at], id)
	isOpen := mark == " "
	if earlier := openCloserBefore(lines, id, at); earlier != "" {
		line.detail = "«" + earlier + "» sits open ahead of " + id + "'s closing slice in " + home(path)
		line.fix = "tick or reword that line, the glide card stays on it"
		if isOpen {
			return line, path, true
		}
		return line, "", true
	}
	if !isOpen {
		line.ok, line.detail = true, id+"'s closing slice is ticked"
		return line, "", true
	}
	line.detail, line.fix = id+"'s closing slice is open in "+home(path), "x lane landed "+id+" --apply"
	return line, path, true
}

// tickClosing marks the one closing line and leaves every other byte as it was
func tickClosing(path, id string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	lines := strings.Split(string(raw), "\n")
	if at := closingIndex(lines, id); at >= 0 {
		lines[at] = strings.Replace(lines[at], "- [ ]", "- [x]", 1)
	}
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0o644)
}
