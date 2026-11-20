package main

import (
	"bytes"
	"os"
	"os/exec"
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

const modHook = modsDir + "m/hooks/register.ts"

// the files each `claude plugin test` launch of the fake saw, one count a launch, in order
func launchedFiles(t *testing.T, calls string) string {
	t.Helper()
	return strings.Join(strings.Fields(readFile(t, calls+".files")), ",")
}

// the load fix (FRM-662, dima's o37): the whole suite runs at the head of the range only; each earlier commit runs just the test files
// its own diff touches, and one that touches none is skipped and said
func TestModsEditTestRangeRunsTheWholeSuiteAtTheHeadOnly(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	calls := filepath.Join(t.TempDir(), "calls")
	env = append(env, "CLAUDE_CALLS="+calls)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	skipped := commitFile(t, dir, modHook, "export const register = () => 1;\n")
	middle := commitFile(t, dir, modTestA, "green, edited\n")
	head := commitFile(t, dir, modTestB, "green, edited too\n")

	out, errs, code := xStderr(t, dir, env, "mods", "edit", "test", "--range", base+"..HEAD", "--json")

	if files := launchedFiles(t, calls); code != 0 || files != "1,2" {
		t.Errorf("exit %d, test launches saw %q files, want 1,2: the middle commit's one file, then the whole suite at the head\n%s\n%s", code, files, out, errs)
	}
	for _, want := range []string{skipped + ": m: skipped, no test file touched", middle + ": m: 1 pass (only tests/a.test.ts)", head + ": m: 2 pass"} {
		if !strings.Contains(errs, want) {
			t.Errorf("want %q in\n%s", want, errs)
		}
	}
}

// a hooks file names its test: hooks/<name>.ts runs tests/<name>.test.ts, wherever the test sits under the mod
func TestModsEditTestRangeRunsTheTestAHooksFileNames(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	calls := filepath.Join(t.TempDir(), "calls")
	env = append(env, "CLAUDE_CALLS="+calls)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	commitFile(t, dir, modsDir+"m/hooks/a.ts", "export const a = 1;\n")
	commitFile(t, dir, modsDir+"m/hooks/rules/b.tsx", "export const b = 1;\n")
	commitFile(t, dir, "readme.txt", "head touches no mod\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--range", base+"..HEAD")

	if files := launchedFiles(t, calls); got.code != 0 || files != "1,1,2" {
		t.Errorf("exit %d, launches saw %q files, want 1,1,2: a.ts runs a.test.ts, rules/b.tsx runs b.test.ts, the whole suite at the head\n%s", got.code, files, got.stdout)
	}
}

// a red file at an earlier commit still names that commit
func TestModsEditTestRangeNamesARedEarlierCommitFromItsFiles(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
	red := commitFile(t, dir, modTestA, "RED\n")
	commitFile(t, dir, modTestA, "green again\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--range", base+"..HEAD")

	if got.code != 1 || !strings.Contains(got.stdout, red+": m: 1 failed") {
		t.Errorf("exit %d, want the red earlier commit %s named\n%s", got.code, red, got.stdout)
	}
}

// every whole suite takes the machine-wide long turn, a file-only run never does, and a wait says who holds it: the queue here is a
// fake that logs its argv and prints the line the real one prints
func TestModsEditTestTakesTheLongTurnForAWholeSuiteOnly(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		args  func(base string) []string
		turns int
	}{
		{"a range: the head only", func(base string) []string { return []string{"--range", base + "..HEAD"} }, 1},
		{"the overlay run", func(string) []string { return nil }, 1},
		{"one test file", func(string) []string { return []string{"--only", modTestA} }, 0},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := modsFixture(t)
			base := strings.TrimSpace(gitT(t, dir, "rev-parse", "HEAD"))
			commitFile(t, dir, modTestA, "green, edited\n")
			commitFile(t, dir, modTestB, "green, edited too\n")
			turns := filepath.Join(t.TempDir(), "turns")
			write(t, filepath.Join(dir, "script/gate-queue.sh"), "#!/bin/sh\necho \"$*\" >> "+turns+"\necho 'gate-queue: waiting 30s, holder: x lane commit other.txt' >&2\n[ \"$1\" = --long ] && shift\nexec \"$@\"\n")
			env = append(env, "X_FRAME_ROOT="+dir, "X_STATE="+t.TempDir())
			if len(c.args(base)) == 0 {
				write(t, pullCopy(t, dir, env, modTestA), "green, pulled\n")
			}
			if c.args(base) != nil && c.args(base)[0] == "--only" {
				write(t, pullCopy(t, dir, env, modTestA), "green, pulled\n")
			}

			out, errs, code := xStderr(t, dir, env, append([]string{"mods", "edit", "test"}, c.args(base)...)...)

			queued := strings.Count(readFile0(turns), "--long claude plugin test")
			if code != 0 || queued != c.turns {
				t.Errorf("exit %d, %d whole suites took the long turn, want %d:\n%s\n%s", code, queued, c.turns, out, errs)
			}
			if c.turns > 0 && !strings.Contains(errs, "gate-queue: waiting 30s, holder: x lane commit other.txt") {
				t.Errorf("the wait line, who holds the turn, did not reach stderr (turns log %q):\n%s", readFile0(turns), errs)
			}
		})
	}
}

func readFile0(path string) string {
	body, _ := os.ReadFile(path)
	return string(body)
}

// x with stderr kept apart: stdout, stderr and the exit code
func xStderr(t *testing.T, dir string, env []string, args ...string) (string, string, int) {
	t.Helper()
	c := exec.Command(xbin, args...)
	c.Dir = dir
	c.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	code := exitOf(c.Run())
	return stdout.String(), stderr.String(), code
}
