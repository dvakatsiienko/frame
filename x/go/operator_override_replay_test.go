package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"
)

// frame#129: green and ready, about 1 h 45 behind refusals of his word. the store is the bytes x-mod-guard's
// «his typed phrase writes the store x reads» row asserts. its own file, naming nothing the override added, so
// `x lane verify-tree --revert` can run it on the source of the main before it
func TestOverrideReplaysFrame129(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	store := filepath.Join(t.TempDir(), "operator-override.json")
	write(t, store, `{"prs":{"at":"2026-11-07T14:00:00.000Z","by":"word"}}`)
	w.env = append(w.env, "X_OVERRIDE_STORE="+store)
	var threads []string
	for i := range 7 {
		threads = append(threads, fmt.Sprintf(`{"isResolved":false,"path":"a%d.ts","line":1,"comments":{"nodes":[]}}`, i))
	}
	w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[` + strings.Join(threads, ",") + `]}}}}}`
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"body":"the body"`, `"body":"no sign line"`, 1)

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls: it must land on this first call\n%s", got.code, len(merges), got.stdout)
	}
}
