package main

import (
	"path/filepath"
	"strings"
	"testing"
)

const citedDocsTest = "TestMergeAutoReadsEveryCitedDocAsMemory"

func citedDocsRun(calls string) bool {
	return calls == "test -trimpath -count=1 -run ^"+citedDocsTest+"$ ."
}

func TestCommitRunsTheCitedDocsTestAloneForANewCite(t *testing.T) {
	t.Parallel()
	for _, path := range []string{"home/.claude/rules/a.md", "_clio/memory/a.md", "_crow/AGENTS.md", "_clio/script/a.ts"} {
		t.Run(path, func(t *testing.T) {
			t.Parallel()
			dir, env, goCalls := commitJobWorld(t, "cited-docs", "1")
			before := gitT(t, dir, "rev-parse", "HEAD")
			write(t, filepath.Join(dir, path), "see docs/research/a.md\n")

			code := commitThrough(t, "git commit", dir, env, path)

			if code == 0 || gitT(t, dir, "rev-parse", "HEAD") != before {
				t.Errorf("exit %d: a red test must refuse the commit", code)
			}
			if got := goCalls(); !citedDocsRun(got) {
				t.Errorf("go ran %q, want the one test", got)
			}
		})
	}
}

func TestCommitRunsNoCitedDocsTestWithoutANewCite(t *testing.T) {
	t.Parallel()
	cite := "see docs/test-drive/a.md\n"
	for path, body := range map[string]string{
		"home/.claude/rules/plain.md": "a rule\n",
		"_clio/memory/plain.md":       "a docs/knowledge/a.md line\n",
		"docs/a.md":                   cite,
		"_clio/pocket/a.md":           cite,
		"_clio/gazette/a.md":          cite,
		"_clio/.scratch/a.md":         cite,
	} {
		t.Run(path, func(t *testing.T) {
			t.Parallel()
			dir, env, goCalls := commitJobWorld(t, "cited-docs", "1")
			write(t, filepath.Join(dir, path), body)

			code := commitThrough(t, "git commit", dir, env, path)

			if got := goCalls(); code != 0 || got != "" {
				t.Errorf("exit %d, go ran %q, want the commit to land with no go run", code, got)
			}
		})
	}
}

// the cite is old and the edit is beside it, or the cite goes: neither adds one
func TestCommitRunsNoCitedDocsTestForAnOldCite(t *testing.T) {
	t.Parallel()
	for name, body := range map[string]string{"an edit beside it": "a new line\nsee docs/research/a.md\n", "a cite taken out": "no cite\n"} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			dir, env, goCalls := commitJobWorld(t, "cited-docs", "1")
			path := "_clio/memory/a.md"
			write(t, filepath.Join(dir, path), "see docs/research/a.md\n")
			gitT(t, dir, "add", path)
			gitT(t, dir, "commit", "-q", "--no-verify", "-m", "old cite")
			write(t, filepath.Join(dir, path), body)

			code := commitThrough(t, "git commit", dir, env, path)

			if got := goCalls(); code != 0 || got != "" {
				t.Errorf("exit %d, go ran %q, want no go run", code, got)
			}
		})
	}
}

// go test exits 0 on a -run that matches nothing, so a renamed test would leave the job hollow
func TestTheCitedDocsJobNamesATestThatExists(t *testing.T) {
	t.Parallel()
	if !strings.Contains(commitJob(t, "cited-docs"), `"^`+citedDocsTest+`$"`) {
		t.Error("the job runs another test")
	}
	if !strings.Contains(readFile(t, "merge_cited_test.go"), "func "+citedDocsTest+"(t *testing.T)") {
		t.Errorf("merge_cited_test.go holds no %s", citedDocsTest)
	}
}
