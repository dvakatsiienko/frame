package main

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// frame's own pre-commit go job behind a stub go that logs its args; the door is `x lane commit` or a plain git commit through lefthook
func xGoReadsWorld(t *testing.T, goExit string) (dir string, env []string, goCalls func() string) {
	t.Helper()
	gates, err := readHookGates("../..", "pre-commit")
	if err != nil {
		t.Fatal(err)
	}
	var job string
	for _, g := range gates {
		if g.name == "x-go-reads" {
			job = g.run
		}
	}
	if job == "" {
		t.Fatal("frame's lefthook.yaml holds no x-go-reads job")
	}
	dir, env = gateFixture(t, "pre-commit:\n  commands:\n    x-go-reads:\n      run: '"+strings.ReplaceAll(job, "'", "''")+"'\n")
	write(t, filepath.Join(dir, "x/go/go.mod"), "module x\n\ngo 1.21\n")
	write(t, filepath.Join(dir, "script/test-cpu-budget.tsv"), "x-go\t99999\t2026-11-09\tfixture\n")
	lefthook, err := filepath.Abs("../../node_modules/.bin/lefthook")
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexec "+lefthook+" run pre-commit --no-auto-install \"$@\"\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "--no-verify", "-m", "go job")
	bin, calls := t.TempDir(), filepath.Join(t.TempDir(), "go-calls")
	write(t, filepath.Join(bin, "go"), "#!/bin/sh\necho \"$*\" >> "+calls+"\nexit "+goExit+"\n")
	return dir, append(env, "PATH="+bin+":"+envValue(cleanEnv(), "PATH")), func() string {
		return strings.TrimSpace(readOr(calls, ""))
	}
}

// one go call, the whole module, -count=1; the budget script adds its own -parallel
func uncachedWholeRun(calls string) bool {
	return !strings.Contains(calls, "\n") && strings.HasPrefix(calls, "test -count=1 ./...")
}

func commitThrough(t *testing.T, door, dir string, env []string, path string) int {
	t.Helper()
	if door == "lane commit" {
		return xIn(t, dir, env, "lane", "commit", message(t), "--", path).code
	}
	gitT(t, dir, "add", "--", path)
	c := exec.Command("git", "commit", "-q", "-m", "fixture commit")
	c.Dir = dir
	c.Env = append(cleanEnv(), env...)
	out, err := c.CombinedOutput()
	if err == nil {
		return 0
	}
	t.Logf("git commit: %s", out)
	return 1
}

func TestCommitRunsXGoTestsUncachedWhenAPathTheyReadIsStaged(t *testing.T) {
	t.Parallel()
	// x lane commit on main runs its own ci job for a staged .ts, so the .ts row rides the plain door
	doors := map[string][]string{
		"lane commit": {"script/gate-queue.sh", "script/lib/a.sh"},
		"git commit":  {"script/gate-queue.sh", "script/lib/a.sh", modsDir + "test.ts"},
	}
	for door, paths := range doors {
		for _, path := range paths {
			t.Run(door+" "+path, func(t *testing.T) {
				t.Parallel()
				dir, env, goCalls := xGoReadsWorld(t, "1")
				before := gitT(t, dir, "rev-parse", "HEAD")
				write(t, filepath.Join(dir, path), "# a change x/go's tests read\n")

				code := commitThrough(t, door, dir, env, path)

				if code == 0 || gitT(t, dir, "rev-parse", "HEAD") != before {
					t.Errorf("exit %d: a red go run must refuse the commit", code)
				}
				if got := goCalls(); !uncachedWholeRun(got) {
					t.Errorf("go ran %q, want one uncached run of the whole module", got)
				}
			})
		}
	}
}

func TestCommitRunsXGoTestsForAPathTheListGains(t *testing.T) {
	t.Parallel()
	dir, env, goCalls := xGoReadsWorld(t, "0")
	write(t, filepath.Join(dir, xGoReadsFile), readFile(t, filepath.Join(dir, xGoReadsFile))+"docs/read.md\n")
	gitT(t, dir, "add", xGoReadsFile)
	gitT(t, dir, "commit", "-q", "--no-verify", "-m", "list")
	write(t, filepath.Join(dir, "docs/read.md"), "a\n")

	if code := commitThrough(t, "lane commit", dir, env, "docs/read.md"); code != 0 {
		t.Fatalf("exit %d, want a green go run to let it land", code)
	}
	if got := goCalls(); !uncachedWholeRun(got) {
		t.Errorf("go ran %q, want the job to read the list", got)
	}
}

func TestCommitRunsNoXGoTestsForAPathOffTheList(t *testing.T) {
	t.Parallel()
	dir, env, goCalls := xGoReadsWorld(t, "1")
	write(t, filepath.Join(dir, "docs/other.md"), "a\n")

	if code := commitThrough(t, "lane commit", dir, env, "docs/other.md"); code != 0 {
		t.Fatalf("exit %d, want the commit to land with no go run", code)
	}
	if got := goCalls(); got != "" {
		t.Errorf("go ran %q, want none", got)
	}
}
