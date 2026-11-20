package main

import "regexp"

// the stray works its own batches, so its lane is a `stray-batch-<n>` or none: a ticket's lane (the mods lane's, from the
// brief's spec path) made the siesta's pace read project it against another lane's plan
var strayBatch = regexp.MustCompile(`^stray-batch-\d+$`)

// ownBatchOnly clears the lane, ticket and coordinator a scope drawing its own unit (the stray's «chores») took from a ticket
func ownBatchOnly(t *thread) {
	if scopeOf(t.Area).Unit == "" || strayBatch.MatchString(t.Lane) {
		return
	}
	t.Lane, t.Ticket, t.Coordinator = "", "", ""
}
