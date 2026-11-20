package main

import "strings"

// the stray works its own lanes (`stray-batch-<n>`, `strays-lane`), so its lane is one of those or none: a ticket's lane (the
// mods lane's, from the brief's spec path) made the siesta's pace read project it against another lane's plan
const strayLanePrefix = "stray"

// ownBatchOnly clears the lane, ticket and coordinator a scope drawing its own unit (the stray's «chores») took from a ticket
func ownBatchOnly(t *thread) {
	if scopeOf(t.Area).Unit == "" || strings.HasPrefix(t.Lane, strayLanePrefix) {
		return
	}
	t.Lane, t.Ticket, t.Coordinator = "", "", ""
}
