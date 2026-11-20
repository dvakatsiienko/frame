package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// a commit of the fixture repo that changes one file, its short sha back
func commitFile(t *testing.T, dir, path, body string) string {
	t.Helper()
	write(t, filepath.Join(dir, path), body)
	commitAll(t, dir)
	return strings.TrimSpace(gitT(t, dir, "rev-parse", "--short=7", "HEAD"))
}

// the suite runs on each commit's own bytes, a commit touching no mod is skipped, and the working tree is never read
func TestModsEditTestRangeRunsEachModCommitOnItsOwnBytes(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	first := commitFile(t, dir, modTestA, "green, edited\n")
	commitFile(t, dir, "readme.txt", "two\n")
	second := commitFile(t, dir, modTestB, "green, edited too\n")
	write(t, filepath.Join(dir, modTestB), "RED, a dirty tree\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--range", base+"..HEAD")

	commits, _ := got.data["commits"].([]any)
	if got.code != 0 || len(commits) != 2 {
		t.Fatalf("exit %d, %d commits, want the two that touch the mod\n%s", got.code, len(commits), got.stdout)
	}
	for i, want := range []string{first, second} {
		row, _ := commits[i].(map[string]any)
		if sha, _ := row["sha"].(string); sha != want {
			t.Errorf("commit %d is %q, want %q, in order", i, sha, want)
		}
	}
}

// a red commit does not stop the walk: one run names every commit that is red, a type error included (the engine's types ride along)
func TestModsEditTestRangeNamesEveryRedCommit(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	planEngineTypes(t, dir)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	red := commitFile(t, dir, modTestA, "RED\n")
	green := commitFile(t, dir, modTestA, "green again\n")
	alsoRed := commitFile(t, dir, modTestB, "TYPE-ERROR\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--range", base+".."+alsoRed)

	if got.code != 1 {
		t.Fatalf("exit %d, want 1\n%s", got.code, got.stdout)
	}
	if !strings.Contains(got.stdout, red+": m: 1 failed (a.test.ts is red)") || !strings.Contains(got.stdout, alsoRed+": m: typecheck: tests/a.test.ts(1,8): error TS2307") {
		t.Errorf("want both red commits named with their rows\n%s", got.stdout)
	}
	if strings.Contains(got.stdout, green+":") {
		t.Errorf("the green commit %s is named as red\n%s", green, got.stdout)
	}
}

// a range that runs nothing proves nothing, so it is refused; a range or a flag mix x cannot read is a usage exit
func TestModsEditTestRangeRefusesWhatItCannotRun(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		args []string
		code int
	}{
		{"a range of no commit", []string{"--range", "HEAD..HEAD"}, 1},
		{"a range with no two ends", []string{"--range", "HEAD"}, 2},
		{"a three-dot range", []string{"--range", "HEAD~1...HEAD"}, 2},
		{"a base that reads as an option", []string{"--range=--all..HEAD"}, 2},
		{"a head that reads as an option", []string{"--range=HEAD..--all"}, 2},
		{"beside --only", []string{"--range", "HEAD~1..HEAD", "--only", modTestA}, 2},
		{"beside --against", []string{"--range", "HEAD~1..HEAD", "--against", "HEAD"}, 2},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := modsFixture(t)
			commitFile(t, dir, modTestA, "green, edited\n")

			got := xIn(t, dir, env, append([]string{"mods", "edit", "test"}, c.args...)...)

			if got.code != c.code {
				t.Fatalf("exit %d, want %d\n%s", got.code, c.code, got.stdout)
			}
		})
	}
}

// a commit that deletes the whole mod leaves nothing to test at it, and the walk goes on
func TestModsEditTestRangeSkipsACommitThatDeletedTheMod(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	first := commitFile(t, dir, modTestA, "green, edited\n")
	gitT(t, dir, "rm", "-rq", modsDir+"m")
	gitT(t, dir, "commit", "-q", "-m", "the mod goes")

	got := xIn(t, dir, env, "mods", "edit", "test", "--range", base+"..HEAD")

	commits, _ := got.data["commits"].([]any)
	if got.code != 0 || len(commits) != 1 {
		t.Fatalf("exit %d, commits %v, want only %s\n%s", got.code, commits, first, got.stdout)
	}
	if row, _ := commits[0].(map[string]any); row["sha"] != first {
		t.Fatalf("commit %v, want %s", row["sha"], first)
	}
}

// a merge commit is a commit of the range: its first-parent diff names the mod, so it runs
func TestModsEditTestRangeRunsAMergeCommit(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	gitT(t, dir, "checkout", "-q", "-b", "side")
	commitFile(t, dir, modTestA, "green, on the side\n")
	gitT(t, dir, "checkout", "-q", "main")
	commitFile(t, dir, modTestB, "green, on main\n")
	gitT(t, dir, "merge", "-q", "--no-ff", "-m", "the side lands", "side")
	merge := strings.TrimSpace(gitT(t, dir, "rev-parse", "--short=7", "HEAD"))

	got := xIn(t, dir, env, "mods", "edit", "test", "--range", base+"..HEAD")

	if got.code != 0 || !strings.Contains(got.stdout, `"sha":"`+merge+`"`) {
		t.Fatalf("exit %d, want the merge %s among the commits run\n%s", got.code, merge, got.stdout)
	}
}
