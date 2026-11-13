package main

import (
	"fmt"
	"regexp"
	"strings"
)

const editAfterSign = "the sign line's hash matches neither the sent nor the saved text: an edit after the sign, which a re-stamp never covers"

var listNumber = regexp.MustCompile(`(?m)^([ \t]*)\d+([.)])[ \t]`)

// what a body set read back: the text linear holds, its sign state as `x linear list` reads it (match, drifted, none),
// whether this call re-stamped it, and why the sign still reads drifted
type savedBody struct {
	text      string
	state     string
	restamped bool
	why       string
}

// readBack fetches the body linear saved and reads its sign through the one reader. with restamp, a sign that drifted only by
// linear's cosmetic rewrite gets its newest hash set to the saved text's own, in one more write, then one more read: a
// second drift is reported, never looped. updatedAt follows the last write
func readBack(r *Run, actor, id, sent string, restamp bool, write func(map[string]any) (string, error), updatedAt *string) savedBody {
	var back bodyIssue
	var err error
	r.Wait("reading "+id+" back", func() { back, err = fetchBody(actor, id) })
	if err != nil {
		return savedBody{state: "unread", why: "the saved body did not read: " + err.Error()}
	}
	saved := savedBody{text: deref(back.Description)}
	saved.state = signStateName(saved.text)
	if saved.state != signDrifted {
		return saved
	}
	if state, _, _ := bodySign(sent); state == signDrifted {
		saved.why = editAfterSign
		return saved
	}
	if !restamp {
		saved.why = "linear saved other text than was sent; --restamp-sign re-stamps a fresh sign when the change is cosmetic"
		return saved
	}
	stamped, why := restampedText(sent, saved.text)
	if why != "" {
		saved.why = why
		return saved
	}
	// a peer's edit after the first write is never overwritten by the re-stamp
	if back.UpdatedAt != *updatedAt {
		saved.why = "the ticket changed since the first write (" + *updatedAt + " → " + back.UpdatedAt + "); nothing was re-stamped"
		return saved
	}
	at, err := write(map[string]any{"description": stamped})
	if err != nil {
		saved.why = "the re-stamp write failed: " + err.Error()
		return saved
	}
	*updatedAt = at
	r.Wait("reading "+id+" back", func() { back, err = fetchBody(actor, id) })
	if err != nil {
		return savedBody{text: stamped, state: "unread", restamped: true, why: "the body after the re-stamp did not read: " + err.Error()}
	}
	saved = savedBody{text: deref(back.Description), restamped: true}
	if saved.state = signStateName(saved.text); saved.state == signDrifted {
		saved.why = "linear rewrote the text again after the re-stamp; one re-stamp per call, never looped"
	}
	return saved
}

// the state `x linear list` prints, with a body that holds no sign hash read as none
func signStateName(body string) string {
	if state, _, _ := bodySign(body); state != signNoHash {
		return state
	}
	return "none"
}

// cosmeticForm is a body with linear's save-time rewrites folded away: escapes, link rewrites and list numbers
func cosmeticForm(text string) string {
	return listNumber.ReplaceAllString(asSigned(text), "${1}1${2} ")
}

// restampedText is the saved body with its newest sign hash set to the saved text's own, or why it must not be: the hash
// matched what was sent (no edit came after the sign), and the saved text differs from the sent one only cosmetically
func restampedText(sent, saved string) (stamped, why string) {
	switch state, _, _ := bodySign(sent); state {
	case signNoHash:
		return "", "the file holds no sign hash to re-stamp"
	case signDrifted:
		return "", editAfterSign
	}
	if cosmeticForm(sent) != cosmeticForm(saved) {
		return "", "linear's save changed more than escapes and list numbers: " + linesChanged(cosmeticForm(sent), cosmeticForm(saved))
	}
	return withSignHash(saved, bodySignHash(saved)), ""
}

// the lines each side holds that the other does not, at most three of each
func linesChanged(sent, saved string) string {
	only := func(from, other string) []string {
		held := map[string]int{}
		for line := range strings.Lines(other) {
			held[line]++
		}
		var lines []string
		for line := range strings.Lines(from) {
			if held[line] > 0 {
				held[line]--
			} else if text := strings.TrimSpace(line); text != "" && len(lines) < 3 {
				lines = append(lines, text)
			}
		}
		return lines
	}
	var parts []string
	for _, line := range only(sent, saved) {
		parts = append(parts, "− "+line)
	}
	for _, line := range only(saved, sent) {
		parts = append(parts, "+ "+line)
	}
	return fmt.Sprintf("%d lines differ: %s", len(parts), strings.Join(parts, " | "))
}

// withSignHash sets the hash on the last «· body <hash>» line of the closing ## signed block
func withSignHash(saved, hash string) string {
	all := signedHeading.FindAllStringIndex(saved, -1)
	pos := all[len(all)-1][1]
	end := len(saved)
	if next := nextHeading.FindStringIndex(saved[pos:]); next != nil {
		end = pos + next[0]
	}
	hashAt, offset := []int(nil), pos
	for line := range strings.Lines(saved[pos:end]) {
		if found := signedBodyHash.FindStringSubmatchIndex(line); found != nil {
			hashAt = []int{offset + found[2], offset + found[3]}
		}
		offset += len(line)
	}
	return saved[:hashAt[0]] + hash + saved[hashAt[1]:]
}
