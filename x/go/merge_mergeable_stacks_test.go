//go:build !nostacks

package main

import "testing"

// exit line 1: an upper layer's conflict is with the layer under it, so its door is the restack, never a merge of main
func TestMergeAutoNamesTheRestackForAConflictOnAnUpperLayer(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.mergeableIs("8", "false", "dirty")

	assertMergeableWait(t, w, "8", "x lane restack --apply")
}
