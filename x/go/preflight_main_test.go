package main

import (
	"strings"
	"testing"
)

// a verb main already has is a finding only on a line that claims to add it
func TestPreflightFlagsAVerbOnMainOnlyWhereTheLineClaimsToAddIt(t *testing.T) {
	cases := []struct {
		name, line string
		flagged    bool
	}{
		{"adds", "1. adds `x lane unlock` for a locked tree", true},
		{"a new verb", "1. a new verb `x lane unlock` for a locked tree", true},
		{"introduces", "1. `x lane unlock` is what this ticket introduces", true},
		{"a plain mention as a tool", "1. `x lane unlock` prints ok", false},
		{"a word that only contains add", "1. `x lane unlock` reads the address", false},
		{"a claim far from the verb", "1. `x lane unlock` prints ok after the ticket body is read, and a long clause later the page adds a row", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, got := runPreflight(t, exitSection(c.line), "FRM-1")

			if flagged := strings.Contains(got.stdout, "is already a verb on main"); flagged != c.flagged {
				t.Errorf("flagged = %v, exit %d\n%s", flagged, got.code, got.stdout)
			}
		})
	}
}
