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

func TestCommitRunsTheCitedDocsTestAloneForAMemoryEdit(t *testing.T) {
	t.Parallel()
	for _, path := range []string{"home/.claude/rules/a.md", "_clio/memory/a.md", "_crow/AGENTS.md"} {
		t.Run(path, func(t *testing.T) {
			t.Parallel()
			dir, env, goCalls := commitJobWorld(t, "cited-docs", "1")
			before := gitT(t, dir, "rev-parse", "HEAD")
			write(t, filepath.Join(dir, path), "docs/research/a.md\n")

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

func TestCommitRunsNoCitedDocsTestOffTheMemoryDirs(t *testing.T) {
	t.Parallel()
	for _, path := range []string{"docs/a.md", "home/.claude/a.ts", "_clio/pocket/a.md", "_clio/gazette/a.md", "_clio/.scratch/a.md"} {
		t.Run(path, func(t *testing.T) {
			t.Parallel()
			dir, env, goCalls := commitJobWorld(t, "cited-docs", "1")
			write(t, filepath.Join(dir, path), "a\n")

			code := commitThrough(t, "git commit", dir, env, path)

			if got := goCalls(); code != 0 || got != "" {
				t.Errorf("exit %d, go ran %q, want the commit to land with no go run", code, got)
			}
		})
	}
}

// a pocket write beside a memory edit still runs it
func TestCommitRunsTheCitedDocsTestBesideAPocketWrite(t *testing.T) {
	t.Parallel()
	dir, env, goCalls := commitJobWorld(t, "cited-docs", "0")
	write(t, filepath.Join(dir, "_clio/pocket/a.md"), "a\n")
	gitT(t, dir, "add", "_clio/pocket/a.md")
	write(t, filepath.Join(dir, "_clio/memory/a.md"), "a\n")

	if code := commitThrough(t, "git commit", dir, env, "_clio/memory/a.md"); code != 0 {
		t.Fatalf("exit %d, want a green test to let it land", code)
	}
	if got := goCalls(); !citedDocsRun(got) {
		t.Errorf("go ran %q, want the one test", got)
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
