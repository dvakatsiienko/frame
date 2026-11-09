//go:build !nostacks

package main

import "testing"

// exit line 5: a lower layer's conflict holds the whole stack, named as the other checks name a layer, with the restack door
func TestMergeAutoNamesALowerLayersConflictAndTheRestack(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7"] = withMergeable(w.hub.pages[repoPath+"/pulls/7"], "false", "dirty")
	w.hub.mu.Unlock()

	assertMergeableWait(t, w, "8", "#7 (coder/x) — mergeable: #7 conflicts")
	assertMergeableWait(t, w, "8", "x lane restack --apply")
}
