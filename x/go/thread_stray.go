package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// the stray works its own lanes (`stray-batch-<n>`, `strays-lane`), so its lane is one of those: a ticket's lane (the mods
// lane's, from the brief's spec path) made the siesta's pace read project it against another lane's plan
const strayLanePrefix = "stray"

var strayBatch = regexp.MustCompile(`^stray-batch-(\d+)$`)

// ownBatchOnly gives a scope drawing its own unit (the stray's «chores») the lane of its newest batch, in place of a ticket's
// lane it took from a brief; the ticket and coordinator that came with that lane go too, and no batch plan yet leaves no lane
func ownBatchOnly(t *thread) {
	if scopeOf(t.Area).Unit == "" || strings.HasPrefix(t.Lane, strayLanePrefix) {
		return
	}
	t.Lane, t.Ticket, t.Coordinator = newestStrayBatch(), "", ""
}

// newestStrayBatch is the highest `stray-batch-<n>` dir under the state's lanes: the plan of the batch in hand
func newestStrayBatch() string {
	entries, _ := os.ReadDir(filepath.Join(stateDir(), "lanes"))
	newest, name := -1, ""
	for _, entry := range entries {
		if m := strayBatch.FindStringSubmatch(entry.Name()); m != nil && entry.IsDir() {
			if n, _ := strconv.Atoi(m[1]); n > newest {
				newest, name = n, entry.Name()
			}
		}
	}
	return name
}
