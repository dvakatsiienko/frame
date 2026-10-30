package main

import (
	"crypto/sha256"
	"fmt"
	"os"
	"regexp"
	"strings"
)

var (
	ticketOfBranch = regexp.MustCompile(`^(?:codie|coder)/([A-Z]+-\d+)(?:-|$)`) // read-both: coder/ before the 10-29 rename
	ticketOfBody   = regexp.MustCompile(`(?m)^- ticket: ([A-Z]+-\d+)\s*$`)
	signedHeading  = regexp.MustCompile(`(?m)^## signed\s*$`)
	nextHeading    = regexp.MustCompile(`(?m)^## `)
	signedBodyHash = regexp.MustCompile(`· body ([0-9a-f]{8})\s*$`)
	preApproved    = regexp.MustCompile(`(?m)^merge: pre-approved\s*$`)
	lastSign       = regexp.MustCompile(`(?m)^✍️ (?:re-)?signed\b`)
	cancelled      = regexp.MustCompile(`(?m)^🚫 cancelled\b`)
	resignPending  = regexp.MustCompile(`(?m)^✍️ re-sign pending\b`)
)

// what a chunk's sign says about a self-edit; held lets it merge without dima's word
type chunkSign struct {
	held   bool
	detail string
}

// the sign lives in linear, never the pr: a pr body is codie's to write
func signOf(pr pullHead, signs map[string]chunkSign) (chunkSign, error) {
	ticket := ""
	if m := ticketOfBranch.FindStringSubmatch(pr.Head.Ref); m != nil {
		ticket = m[1]
	} else if m := ticketOfBody.FindStringSubmatch(pr.Body); m != nil {
		ticket = m[1]
	}
	if ticket == "" {
		return chunkSign{detail: "no ticket on " + pr.Head.Ref + " or in the pr body, so no sign to read"}, nil
	}
	if sign, read := signs[ticket]; read {
		return sign, nil
	}
	actor, err := actorOf(Flags{})
	if err != nil {
		return chunkSign{}, err
	}
	issue, err := fetchBody(actor, ticket)
	if err != nil {
		return chunkSign{}, err
	}
	body := ""
	if issue.Description != nil {
		body = *issue.Description
	}
	sign := readSign(ticket, body)
	signs[ticket] = sign
	return sign, nil
}

// the self-edit's wait, "" when the pr edits no self path or its chunk's sign pre-approved it
func (d *mergeDecision) selfWait(pr pullHead, self []string) (string, error) {
	if len(self) == 0 {
		return "", nil
	}
	// his word on the pr merged covers every layer under it: a stack lands whole
	if d.dimaOK {
		d.Sign = "dima's word on #" + d.PR + ", typed (--dima-ok)"
		return "", nil
	}
	sign, err := signOf(pr, d.signs)
	if err != nil {
		return "", err
	}
	if sign.held {
		d.Sign = sign.detail
		return "", nil
	}
	return "self-edit, needs dima's word — " + strings.Join(self, ", ") + "; " + sign.detail +
		"; once his own prompt names #" + d.PR + ": x lane merge-auto " + d.PR + " --apply --dima-ok " + d.PR, nil
}

// what a ticket's last body hash says about the body above its sign block
const (
	signMatch   = "match"
	signDrifted = "drifted"
	signNoHash  = "no hash"
)

var (
	// a markdown link linear writes over a bare id or url after the write
	linkRewrite = regexp.MustCompile(`\[([^\]\n]+)\]\(([^)\s]+)\)`)
	bareID      = regexp.MustCompile(`^(?:FRM|BYT|PK)-\d+$`)
	angleURL    = regexp.MustCompile(`<(https?://[^>\s]+)>`)
)

// signedBlock splits a body at the ## signed block that closes it: an earlier heading sits in a quote or a fence
func signedBlock(body string) (above, block string, ok bool) {
	all := signedHeading.FindAllStringIndex(body, -1)
	if all == nil {
		return "", "", false
	}
	at := all[len(all)-1]
	block = body[at[1]:]
	if next := nextHeading.FindStringIndex(block); next != nil {
		block = block[:next[0]]
	}
	return body[:at[0]], block, true
}

// asSigned folds linear's link rewrite back to the bare text and trims trailing blank lines to the one blank
// line every live sign hashed over (measured 2026-10-30: 12 of 12 stored hashes end in "\n\n")
func asSigned(above string) string {
	folded := linkRewrite.ReplaceAllStringFunc(above, func(link string) string {
		m := linkRewrite.FindStringSubmatch(link)
		if bareID.MatchString(m[1]) || m[1] == m[2] {
			return m[1]
		}
		return link
	})
	folded = angleURL.ReplaceAllString(folded, "$1")
	if trimmed := strings.TrimRight(folded, "\n"); trimmed != "" {
		return trimmed + "\n\n"
	}
	return folded
}

func shortHash(text string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(text)))[:8] }

// bodySign reads the last «· body <hash>» line of the closing sign block against the body above it. the sign holds
// on the raw body's hash (how every stored hash was written) or the normalized one; now is the raw body's
func bodySign(body string) (state, stored, now string) {
	above, block, ok := signedBlock(body)
	if !ok {
		return signNoHash, "", ""
	}
	for line := range strings.Lines(block) {
		if m := signedBodyHash.FindStringSubmatch(line); m != nil {
			stored = m[1]
		}
	}
	now = shortHash(above)
	switch {
	case stored == "":
		return signNoHash, "", now
	case stored == now || stored == shortHash(asSigned(above)):
		return signMatch, stored, now
	}
	return signDrifted, stored, now
}

// the hash covers the body through the newline before ## signed, first 8 hex of its sha256, as clio signs it;
// the last «· body <hash>» line in the block is the one that holds
func readSign(ticket, body string) chunkSign {
	_, block, ok := signedBlock(body)
	if !ok {
		return chunkSign{detail: ticket + " carries no ## signed block"}
	}
	// a pre-approval belongs to the sign above it: a re-sign without one voids an older one
	since := block
	if signs := lastSign.FindAllStringIndex(block, -1); signs != nil {
		since = block[signs[len(signs)-1][0]:]
	}
	// a cancel after the last sign voids it; a later re-sign starts `since` past the cancel
	if cancelled.MatchString(since) {
		return chunkSign{detail: ticket + "'s last sign was cancelled (a 🚫 cancelled line follows it): re-sign it"}
	}
	// a scope moved after the sign blocks the chunk until his re-sign (pm body.md)
	if resignPending.MatchString(since) {
		return chunkSign{detail: ticket + "'s last sign waits for a re-sign (a ✍️ re-sign pending line follows it)"}
	}
	if !preApproved.MatchString(since) {
		return chunkSign{detail: ticket + "'s last sign holds no merge: pre-approved"}
	}
	state, last, now := bodySign(body)
	switch {
	case state == signNoHash:
		return chunkSign{detail: ticket + "'s sign names no body hash"}
	case state == signDrifted:
		return chunkSign{detail: fmt.Sprintf("%s's body changed after its last signed line (body %s, now %s): re-sign it", ticket, last, now)}
	case isDevBuild():
		return chunkSign{detail: ticket + " pre-approved, but this merge-auto is a dev build: a self-edit merges only through main's build, run from the main checkout"}
	}
	return chunkSign{held: true, detail: ticket + " pre-approved at the sign, body " + now}
}

// a pr that edits merge-auto must never be gated by its own code: the shim's stamp, and x/go as the binary's tree
// holds it read against origin/main, a git failure counting as dev. a pr head's binary can drop this check, so
// the merge runs from the main checkout; under X_TEST the override stands in, and X_TEST holds no real key
func isDevBuild() bool {
	if os.Getenv("X_TEST") != "" {
		if forced, set := os.LookupEnv("X_DEV_BUILD"); set {
			return forced != ""
		}
	}
	if devBuild != "" {
		return true
	}
	got, _ := gitIn(sourceDir(), "diff", "--quiet", "origin/main", "--", ".")
	return !got.ok
}
