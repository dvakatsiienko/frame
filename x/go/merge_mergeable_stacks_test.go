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

// review round: a stack's bottom layer is fixed by the restack too, so merging it alone never names merge-main
func TestMergeAutoNamesTheRestackForAConflictOnTheBottomLayer(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.mergeableIs("7", "false", "dirty")

	assertMergeableWait(t, w, "7", "#7 conflicts with main → x lane restack --apply")
}
