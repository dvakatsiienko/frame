package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// a lane spec whose FRM-1 exit lines start on line 9, in a repo holding a package.json and the files named
func preflightResolve(t *testing.T, exits string, env ...string) (asRun, string) {
	t.Helper()
	dir := preflightRepo(t)
	write(t, filepath.Join(dir, "package.json"), `{"scripts":{"retired-names:check":"node check.ts","plant":"touch planted-by-pnpm"}}`)
	write(t, filepath.Join(dir, "script/real.sh"), "#!/bin/sh\n")
	write(t, filepath.Join(dir, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — this chunk\n\n### exit lines\n\n"+exits)
	raw, _ := json.Marshal("## want\n\na thing\n")
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-9","description":` + string(raw) + `,"updatedAt":"2026-10-09T00:00:00.000Z"}}}`
	})
	_, got := runLinear(t, server, env, "brief", "preflight", "FRM-1", "--repo", dir)
	return got, dir
}

// a command head the line names but the machine lacks: PATH holds only the git preflight itself needs
func TestPreflightRedsACommandHeadMissingFromPath(t *testing.T) {
	t.Parallel()
	bin := t.TempDir()
	gitPath, err := exec.LookPath("git")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(gitPath, filepath.Join(bin, "git")); err != nil {
		t.Fatal(err)
	}
	got, _ := preflightResolve(t, "1. given a tree, when `jq . docs/shipped.md` runs, then it exits 0\n", "PATH="+bin)

	if got.code == 0 || !strings.Contains(got.stdout, "line 7: command jq") {
		t.Errorf("exit %d, want line 7 naming jq off the PATH:\n%s", got.code, got.stdout)
	}
}

func TestPreflightRedsAnExitLineWhoseCommandCannotRun(t *testing.T) {
	t.Parallel()
	got, _ := preflightResolve(t, ""+
		"1. given a tree, when `pnpm no-such-script` runs, then it exits 0\n"+
		"2. given a tree, when `node script/gone.ts` runs, then it exits 0\n"+
		"3. given a tree, when `x lane unlock --nope` runs, then it exits 0\n"+
		"4. given a tree, when `script/missing.sh` runs, then it exits 0\n"+
		"5. given a tree, when `x lane unlock` runs, then it exits 0\n"+
		"6. given a tree, when `node script/gone_file.ts` and `go test x/go/nope_test.go` run, then they exit 0\n")

	for _, want := range []string{"line 7: script pnpm no-such-script", "line 8: path script/gone.ts", "line 9: flag --nope",
		"line 10: path script/missing.sh", "line 12: path script/gone_file.ts", "line 12: path x/go/nope_test.go", "6 problems"} {
		if got.code == 0 || !strings.Contains(got.stdout, want) {
			t.Errorf("exit %d, want %q in\n%s", got.code, want, got.stdout)
		}
	}
}

func TestPreflightPassesAnExitLineWhoseCommandsResolve(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, exits string }{
		{"every command resolves", "1. given a tree, when `pnpm retired-names:check` and `git grep -n 'a|b' docs/` and `go test ./...` and `script/real.sh` run, then they exit 0\n"},
		{"a (new) verb", "1. given `x brief summon` (new), when `x brief summon brief.md` runs, then it exits 0\n"},
		{"value spans only", "1. given a body, when the list reads it, then its sign reads `match`, `## signed` holds `merge: pre-approved` and `spec:`\n"},
		{"names a brief holds, not commands", "1. given a brief naming `Explore.md`, `/clear`, `scratch/foo` and `docs/nope.md`, when `x lane unlock` runs, then it exits 0\n"},
		{"a placeholder argument", "1. given a ticket, when `node script/real.sh <id>` runs, then it exits 0\n"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got, _ := preflightResolve(t, c.exits); got.code != 0 {
				t.Errorf("exit %d, want 0:\n%s", got.code, got.stdout)
			}
		})
	}
}

// preflight resolves, it never runs: an unattended preflight must not write
func TestPreflightNeverRunsAnExitLineCommand(t *testing.T) {
	t.Parallel()
	got, dir := preflightResolve(t, ""+
		"1. given a tree, when `pnpm plant` runs, then it exits 0\n"+
		"2. given a tree, when `node -e \"require('fs').writeFileSync('planted-by-node','')\"` runs, then it exits 0\n")

	if got.code != 0 {
		t.Fatalf("exit %d, want the plants to resolve:\n%s", got.code, got.stdout)
	}
	for _, planted := range []string{"planted-by-pnpm", "planted-by-node"} {
		if exists(filepath.Join(dir, planted)) {
			t.Errorf("%s appeared: preflight ran an exit-line command", planted)
		}
	}
}
