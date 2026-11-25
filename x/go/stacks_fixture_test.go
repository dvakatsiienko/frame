//go:build !nostacks

package main

import (
	"path/filepath"
	"strings"
	"testing"
)

const (
	lowerOpen   = `{"number":7,"state":"open","head":{"ref":"codie/x"}}`
	lowerMerged = `{"number":7,"state":"closed","merged_at":"2026-10-23T10:00:00Z","head":{"ref":"codie/x"}}`
)

// a merge world where #7 (codie/x onto main) is the lower layer, as lower says, and #8 sits on base
func stackedMergeWorld(t *testing.T, base, lower string) *mergeWorld {
	t.Helper()
	w := newMergeWorld(t, "script/foo.ts")
	// the async merge's poll sleeps 2 s a round; the fake clock counts it against the budget without waiting
	w.env = append(w.env, "X_FAKE_SLEEP=1")
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/pulls/8"] = `{"mergeable":true,"mergeable_state":"clean","number":8,"title":"part 2","state":"open","merged":false,"body":"b",
		"head":{"sha":"` + w.head + `","ref":"codie/x-2"},"base":{"ref":"` + base + `"}}`
	w.hub.pages[repoPath+"/pulls"] = `[{"number":9,"state":"open","head":{"ref":"codie/y"}},` + lower + `]`
	w.hub.pages[repoPath+"/pulls/8/files"] = w.hub.pages[repoPath+"/pulls/7/files"]
	return w
}

// a linked stack on github: #7 (codie/x onto main) under #8, both clean, green and threadless; the async
// merge of #8 starts pending and the poll answers merged
func linkedMergeWorld(t *testing.T) *mergeWorld {
	t.Helper()
	w := stackedMergeWorld(t, "codie/x", lowerOpen)
	write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#7:security":"`+w.head+`","o/r#8":"`+w.head+`","o/r#8:security":"`+w.head+`"}`)
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/stacks"] = `[{"number":5,"base":{"ref":"main"},"pull_requests":[
		{"number":7,"state":"open","head":{"ref":"codie/x"}},{"number":8,"state":"open","head":{"ref":"codie/x-2"}}]}]`
	w.hub.pages[repoPath+"/pulls/8/merge-async"] = `{"status":"pending","details":{"uuid":"u1"}}`
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + w.head + `"}}`
	return w
}

// a 2-layer stack on origin whose bottom layer gained a commit after the top was cut; the clone sits on the top
func movedStack(t *testing.T, lowerFile, lowerBody string) string {
	t.Helper()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2")
	gitT(t, clone, "switch", "-q", "codie/FRM-1-a")
	write(t, filepath.Join(clone, lowerFile), lowerBody)
	gitT(t, clone, "add", lowerFile)
	gitT(t, clone, "commit", "-q", "-m", "a fix in the lower layer")
	gitT(t, clone, "push", "-q", "origin", "codie/FRM-1-a")
	gitT(t, clone, "switch", "-q", "codie/FRM-1-a-2")
	return clone
}

func originHead(t *testing.T, clone, branch string) string {
	t.Helper()
	sha, _, _ := strings.Cut(gitT(t, clone, "ls-remote", "origin", "refs/heads/"+branch), "\t")
	return sha
}

// a second clone holding one unpushed commit on the layer, ready to land as the rival push
func rivalClone(t *testing.T, clone, layer string) (dir, sha string) {
	t.Helper()
	origin := gitT(t, clone, "remote", "get-url", "origin")
	dir = filepath.Join(t.TempDir(), "rival")
	gitT(t, filepath.Dir(dir), "clone", "-q", "-b", layer, origin, dir)
	gitT(t, dir, "config", "user.email", "rival@x")
	gitT(t, dir, "config", "user.name", "rival")
	write(t, filepath.Join(dir, "rival.txt"), "the rival's\n")
	gitT(t, dir, "add", "rival.txt")
	gitT(t, dir, "commit", "-q", "-m", "the rival's commit")
	return dir, gitT(t, dir, "rev-parse", "HEAD")
}
