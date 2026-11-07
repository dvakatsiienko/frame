package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"charm.land/lipgloss/v2"
)

// a frame-shaped repo with one mod, and a fake `claude` reading markers the tests plant: PARSE-ERROR in a hooks file
// fails the validator, RED in a test fails that test, NO-IMPORT makes its file fail to load, NO-TESTS makes it run none,
// HALF-DONE in a hooks file fails every test that runs
func modsFixture(t *testing.T) (dir string, env []string) {
	t.Helper()
	dir, _ = filepath.EvalSymlinks(t.TempDir())
	copyFixture(t, seedMods(t), dir)
	bin := t.TempDir()
	write(t, filepath.Join(bin, "claude"), `#!/bin/sh
d="$3"
[ -n "$CLAUDE_CALLS" ] && echo "$2" >> "$CLAUDE_CALLS"
[ "$2" = test ] && [ -n "$CLAUDE_MID_TEST" ] && sh -c "$CLAUDE_MID_TEST"
[ "$2" = test ] && [ -n "$CLAUDE_SAW" ] && cat "$d"/hooks/* >> "$CLAUDE_SAW"
if [ "$2" = validate ]; then
  if grep -q PARSE-ERROR "$d"/hooks/* 2>/dev/null; then echo "  ❯ modules../register.ts: m: does not parse: PARSE-ERROR (line 1)"; echo "✘ Validation failed"; exit 1; fi
  echo "✔ Validation passed"; exit 0
fi
red=0
for f in "$d"/tests/*.test.ts; do
  n=$(basename "$f")
  echo "tests/$n:"
  if grep -q NO-TESTS "$f"; then continue
  elif grep -q HALF-DONE "$d"/hooks/* 2>/dev/null; then echo "(fail) $n imports a half-done hook [1.0ms]"; red=1
  elif grep -q NO-IMPORT "$f"; then echo "(fail) the file did not load"; red=1
  elif grep -q SLOW-ONCE "$f" && [ ! -e "$f.slow" ]; then touch "$f.slow"; echo "(fail) $n timed out [5001.0ms]"; echo "  Error: timed out after 5000 ms"; red=1
  elif grep -q PASS-THEN-SLOW "$f" && [ ! -e "$f.slow" ]; then touch "$f.slow"; echo "(pass) $n first [1.0ms]"; echo "(fail) $n timed out [5001.0ms]"; echo "  Error: timed out after 5000 ms"; red=1
  elif grep -q SLOW-SECOND "$f" && [ -e "$f.ran" ]; then echo "(fail) $n timed out [5001.0ms]"; echo "  Error: timed out after 5000 ms"; red=1
  elif grep -q DIES-QUIET "$f"; then echo "(pass) $n [1.0ms]"; exit 1
  elif grep -q DIES-PARTWAY "$f"; then echo "(fail) $n timed out [5001.0ms]"; echo "  Error: timed out after 5000 ms"; exit 1
  elif grep -q HOOK-THROWS "$f"; then echo "(pass) $n [1.0ms]"; echo "    m's session.start hook was skipped: m: boom"
  elif grep -q RED "$f"; then echo "(fail) $n is red [1.0ms]"; red=1
  else echo "(pass) $n [1.0ms]"; fi
  touch "$f.ran"
done
echo "Ran 2 tests across 2 files."
exit $red
`)
	return dir, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "CLAUDE_JOB_DIR=" + t.TempDir()}
}

func pullCopy(t *testing.T, dir string, env []string, path string) string {
	t.Helper()
	got := xIn(t, dir, env, "mods", "edit", "pull", path)
	copies, _ := got.data["copies"].([]any)
	if got.code != 0 || len(copies) != 1 {
		t.Fatalf("pull %s: exit %d\n%s", path, got.code, got.stdout)
	}
	return copies[0].(string)
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	body, _ := os.ReadFile(path)
	return string(body)
}

const modHooks = modsDir + "m/hooks/register.ts"
const modTestA = modsDir + "m/tests/a.test.ts"
const modTestB = modsDir + "m/tests/b.test.ts"

func TestModsEditPushLandsAGreenEdit(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	write(t, copyA, "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code != 0 || readFile(t, filepath.Join(dir, modTestA)) != "green, edited\n" {
		t.Fatalf("exit %d, file %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

// another writer's half-done edit of the shared overlay stays in scratch, unwritten and still listed
func TestModsEditPushWithPathsLandsOnlyThosePaths(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA, copyB := pullCopy(t, dir, env, modTestA), pullCopy(t, dir, env, modTestB)
	write(t, copyA, "green, edited\n")
	write(t, copyB, "RED half done\n")

	got := xIn(t, dir, env, "mods", "edit", "push", modTestA)

	if got.code != 0 || readFile(t, filepath.Join(dir, modTestA)) != "green, edited\n" || readFile(t, filepath.Join(dir, modTestB)) != "green\n" {
		t.Fatalf("exit %d, a %q, b %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), readFile(t, filepath.Join(dir, modTestB)), got.stdout)
	}
	status := xIn(t, dir, env, "mods", "edit", "status")
	if edited, _ := status.data["edited"].([]any); len(edited) != 1 || edited[0] != modTestB {
		t.Fatalf("status after the push: %v", status.data["edited"])
	}
}

func TestModsEditPushRefusesANamedPathWithNoEdit(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	pullCopy(t, dir, env, modTestB)
	write(t, copyA, "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "push", modTestB)

	if got.code == 0 || readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Fatalf("exit %d, a %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

// a chain runs a test once: push trusts a green `test` only while every byte of the overlay is the one it tested
func TestModsEditPushRunsItsTestOnlyWhenTheBytesMoved(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		after func(t *testing.T, dir, copyA string)
		tests int
	}{
		{"the same bytes run no second test", func(*testing.T, string, string) {}, 1},
		{"an edit since runs it", func(t *testing.T, _, copyA string) { write(t, copyA, "green, edited again\n") }, 2},
		{"a repo file moved since runs it", func(t *testing.T, dir, _ string) { write(t, filepath.Join(dir, modTestB), "green, a peer's\n") }, 2},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := modsFixture(t)
			calls := filepath.Join(t.TempDir(), "calls")
			env = append(env, "CLAUDE_CALLS="+calls)
			copyA := pullCopy(t, dir, env, modTestA)
			write(t, copyA, "green, edited\n")
			if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
				t.Fatalf("test: exit %d\n%s", got.code, got.stdout)
			}
			c.after(t, dir, copyA)

			got := xIn(t, dir, env, "mods", "edit", "push")

			if n := strings.Count(readFile(t, calls), "test\n"); got.code != 0 || n != c.tests {
				t.Fatalf("exit %d, %d test runs, want %d\n%s", got.code, n, c.tests, got.stdout)
			}
		})
	}
}

// a green --only proves one file, so it never stands in for the whole test a push needs
func TestModsEditPushAfterAGreenOnlyRunsTheWholeTest(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA, copyB := pullCopy(t, dir, env, modTestA), pullCopy(t, dir, env, modTestB)
	write(t, copyA, "green, edited\n")
	write(t, copyB, "RED\n")
	if got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA); got.code != 0 {
		t.Fatalf("--only: exit %d\n%s", got.code, got.stdout)
	}

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Fatalf("a push after a green --only skipped the red sibling: exit %d, a %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

func TestModsEditOnlyLeavesAFullGreensStampAlone(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	calls := filepath.Join(t.TempDir(), "calls")
	env = append(env, "CLAUDE_CALLS="+calls)
	write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")
	if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
		t.Fatalf("test: exit %d\n%s", got.code, got.stdout)
	}
	if got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA); got.code != 0 {
		t.Fatalf("--only: exit %d\n%s", got.code, got.stdout)
	}

	got := xIn(t, dir, env, "mods", "edit", "push")

	if n := strings.Count(readFile(t, calls), "test\n"); got.code != 0 || n != 2 {
		t.Fatalf("exit %d, %d test runs, want 2: the full test and --only, none from the push\n%s", got.code, n, got.stdout)
	}
}

// a recorded green would pass the mod's tests at its commit through --skip-tested, on one file's proof
func TestModsEditOnlyRecordsNoGreen(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	state := t.TempDir()
	env = append(env, "X_STATE="+state)
	write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA)

	scratch, _ := xIn(t, dir, env, "mods", "edit", "status").data["scratch"].(string)
	if got.code != 0 || scratch == "" || got.data["gates"] != nil || exists(filepath.Join(state, "gates-green.tsv")) || exists(filepath.Join(scratch, scratchTested)) {
		t.Fatalf("exit %d, scratch %q: a green --only recorded a stamp or a gate green\n%s", got.code, scratch, got.stdout)
	}
}

func TestModsEditTestOnlyRunsThatOneFile(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	calls := filepath.Join(t.TempDir(), "calls")
	env = append(env, "CLAUDE_CALLS="+calls)
	write(t, pullCopy(t, dir, env, modTestB), "RED\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA)

	reports, _ := got.data["mods"].([]any)
	if got.code != 0 || got.data["only"] != modTestA || len(reports) != 1 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	if passed := reports[0].(map[string]any)["passed"]; passed != 1.0 {
		t.Errorf("passed %v, want the one file's 1\n%s", passed, got.stdout)
	}
	if n := strings.Count(readFile(t, calls), "test\n"); n != 1 {
		t.Errorf("%d test runs, want 1", n)
	}
}

func TestModsEditTestOnlyReadsItsPathFromTheRepoRoot(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)

	got := xIn(t, filepath.Join(dir, modsDir, "m/tests"), env, "mods", "edit", "test", "--only", modTestA)

	if got.code != 0 || got.data["only"] != modTestA {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestOnlyRunsATestFileThatLivesOnlyInScratch(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	fresh := modsDir + "m/tests/fresh.test.ts"
	write(t, pullCopy(t, dir, env, fresh), "green\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", fresh)

	if got.code != 0 || got.data["only"] != fresh {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestOnlyRedNamesItsOwnRerun(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "RED\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA)

	if got.code != 1 || got.next != "x mods edit test --only "+modTestA {
		t.Fatalf("exit %d, next %q\n%s", got.code, got.next, got.stdout)
	}
}

func TestModsEditTestOnlyRefusesWhatItCannotRun(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, only string
		code       int
	}{
		{"a file that is no test", modHooks, 2},
		{"a missing test file", modsDir + "m/tests/gone.test.ts", 2},
		{"a dir", modsDir + "m/tests", 2},
		{"a dir named like a test", modsDir + "m/tests/dir.test.ts", 2},
		{"a test file outside a mod", "script/a.test.ts", 2},
		{"a path out of the repo", "../a.test.ts", 2},
		{"a test file that runs no test", modsDir + "m/tests/none.test.ts", 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := modsFixture(t)
			write(t, filepath.Join(dir, modsDir, "m/tests/none.test.ts"), "NO-TESTS\n")
			if strings.HasSuffix(c.only, "dir.test.ts") {
				write(t, filepath.Join(dir, c.only, "keep"), "\n")
			}
			write(t, filepath.Join(dir, "script/a.test.ts"), "green\n")

			got := xIn(t, dir, env, "mods", "edit", "test", "--only", c.only)

			if got.code != c.code || !strings.Contains(got.stdout, c.only) {
				t.Fatalf("exit %d, want %d, the refusal must name %q\n%s", got.code, c.code, c.only, got.stdout)
			}
		})
	}
}

func TestModsEditTestOnlyRefusesAFileDeletedInScratch(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	if err := os.Remove(pullCopy(t, dir, env, modTestA)); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA)

	if got.code != 2 || !strings.Contains(got.stdout, "deleted in scratch") {
		t.Fatalf("exit %d: --only ran main's copy of a deleted file\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestOnlyRefusesBesideAgainst(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA, "--against", "HEAD")

	if got.code != 2 {
		t.Fatalf("exit %d, want the usage exit\n%s", got.code, got.stdout)
	}
}

// xBoth is xIn with stderr kept: the overlay line is read there, ahead of a red's own log
func xBoth(t *testing.T, dir string, env []string, args ...string) (int, string, string) {
	t.Helper()
	c := exec.Command(xbin, args...)
	c.Dir = dir
	c.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	return exitOf(c.Run()), stdout.String(), stderr.String()
}

func TestModsEditHeaderCountsWhatTheOverlayDiffersIn(t *testing.T) {
	t.Parallel()
	added := modsDir + "m/tests/z-added.test.ts"
	cases := []struct {
		name  string
		plant func(t *testing.T, dir string, env []string)
		verb  string
		want  string
	}{
		{"nothing pulled prints no line", func(*testing.T, string, []string) {}, "status", ""},
		{"a pull left as it was prints no line", func(t *testing.T, dir string, env []string) {
			pullCopy(t, dir, env, modTestA)
		}, "status", ""},
		{"main moving past an untouched copy prints no line", func(t *testing.T, dir string, env []string) {
			pullCopy(t, dir, env, modTestA)
			write(t, filepath.Join(dir, modTestA), "green, main moved\n")
		}, "status", ""},
		{"one edit", func(t *testing.T, dir string, env []string) {
			write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")
		}, "status", "overlay 1 path differs: " + modTestA},
		{"one edit on test", func(t *testing.T, dir string, env []string) {
			write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")
		}, "test", "overlay 1 path differs: " + modTestA},
		{"one edit on --only", func(t *testing.T, dir string, env []string) {
			write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")
		}, "test --only " + modTestA, "overlay 1 path differs: " + modTestA},
		{"an added and a deleted path", func(t *testing.T, dir string, env []string) {
			write(t, pullCopy(t, dir, env, added), "green\n")
			if err := os.Remove(pullCopy(t, dir, env, modTestB)); err != nil {
				t.Fatal(err)
			}
		}, "status", "overlay 2 paths differ: " + modTestB + ", " + added},
		{"two edits on test", func(t *testing.T, dir string, env []string) {
			write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")
			write(t, pullCopy(t, dir, env, modTestB), "green, edited\n")
		}, "test", "overlay 2 paths differ: " + modTestA + ", " + modTestB},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := modsFixture(t)
			c.plant(t, dir, env)

			code, stdout, stderr := xBoth(t, dir, env, append([]string{"mods", "edit"}, strings.Fields(c.verb)...)...)

			if code != 0 {
				t.Fatalf("exit %d\n%s\n%s", code, stdout, stderr)
			}
			if c.want == "" && strings.Contains(stderr, "differ") {
				t.Errorf("a clean overlay printed a line:\n%s", stderr)
			}
			if c.want != "" && !strings.Contains(stderr, c.want+"\n") {
				t.Errorf("stderr lacks %q:\n%s", c.want, stderr)
			}
		})
	}
}

// a pull refused on its second path has copied its first with no `.pulled` row: the base alone says it was pulled
func TestModsEditHeaderCountsADeleteAfterARefusedPull(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	if got := xIn(t, dir, env, "mods", "edit", "pull", modTestA, "../out"); got.code == 0 {
		t.Fatalf("the pull took a path outside the repo\n%s", got.stdout)
	}
	scratch, _ := xIn(t, dir, env, "mods", "edit", "status").data["scratch"].(string)
	if err := os.Remove(filepath.Join(scratch, modTestA)); err != nil {
		t.Fatal(err)
	}

	code, stdout, stderr := xBoth(t, dir, env, "mods", "edit", "status")

	if code != 0 || !strings.Contains(stderr, "overlay 1 path differs: "+modTestA+"\n") {
		t.Fatalf("exit %d\n%s\n%s", code, stdout, stderr)
	}
}

// a long path stays inside the frame: a board row never clips itself
func TestModsEditHeaderKeepsItsPathsInsideTheBoard(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	long := modsDir + "m/tests/" + strings.Repeat("a-very-long-name-", 8) + "test.ts"
	write(t, pullCopy(t, dir, env, long), "green\n")
	write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")

	code, stdout, _ := xBoth(t, dir, env, "mods", "edit", "status", "--board")

	if code != 0 || !strings.Contains(stdout, "overlay 2 paths differ") || !strings.Contains(stdout, modTestA) {
		t.Fatalf("exit %d\n%s", code, stdout)
	}
	lines := strings.Split(strings.TrimSpace(stdout), "\n")
	width := lipgloss.Width(lines[0])
	for _, line := range lines {
		if lipgloss.Width(line) != width {
			t.Errorf("a row is %d wide on a %d board: %q", lipgloss.Width(line), width, line)
		}
	}
}

// the 10-18 sighting: a red read as main's while the overlay held another writer's half-done edit of what the test imports
func TestModsEditTestRedNamesTheOverlayBeforeTheRed(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modHooks), "HALF-DONE\n")

	code, _, stderr := xBoth(t, dir, env, "mods", "edit", "test")

	line, red := strings.Index(stderr, "overlay 1 path differs: "+modHooks), strings.Index(stderr, "imports a half-done hook")
	if code == 0 || line < 0 || red < line {
		t.Fatalf("exit %d, overlay line at %d, red at %d\n%s", code, line, red, stderr)
	}
}

func TestModsEditTestRedOnMainPrintsNoOverlayLine(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, filepath.Join(dir, modHooks), "HALF-DONE\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "main is red")

	code, _, stderr := xBoth(t, dir, env, "mods", "edit", "test", "--only", modTestA)

	if code == 0 || strings.Contains(stderr, "differ") || !strings.Contains(stderr, "imports a half-done hook") {
		t.Fatalf("exit %d\n%s", code, stderr)
	}
}

func holdBothQueueSlots(t *testing.T, state string) {
	t.Helper()
	plantLiveHolder(t, state)
	write(t, filepath.Join(state, "gate-queue.long.turn/holder"), readFile(t, filepath.Join(state, "gate-queue.turn/holder")))
}

// a turn would wait out its deadline and run nothing; a one-file run answers at once
func TestModsEditTestOnlyTakesNoQueueTurn(t *testing.T) {
	t.Parallel()
	state, turn := turnOn(t)
	holdBothQueueSlots(t, state)
	dir, env := modsFixture(t)
	env = append(append(env, turn...), "GATE_QUEUE_WAIT=1")

	got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA)

	if got.code != 0 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	if rows := queueRows(t, state); rows != nil {
		t.Errorf("--only logged a turn: %v", rows)
	}
}

func TestModsEditTestCountsARerunFilesPassesOnce(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "PASS-THEN-SLOW\n")

	got := xIn(t, dir, env, "mods", "edit", "test")

	if got.code != 0 || !strings.Contains(got.stdout, `"passed":2`) {
		t.Fatalf("a's first-run pass counted beside its rerun, exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestRunsATimeoutOnlyRedOnceMore(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "SLOW-ONCE\n")

	got := xIn(t, dir, env, "mods", "edit", "test")

	if got.code != 0 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestRunsOnlyTheTimedOutFileAgain(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "SLOW-ONCE\n")
	write(t, pullCopy(t, dir, env, modTestB), "SLOW-SECOND\n")

	got := xIn(t, dir, env, "mods", "edit", "test")

	if got.code != 0 {
		t.Fatalf("a file that passed its run must not be run again, exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestRunsNoSecondTimeWhenTheRunDiedPartway(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "DIES-PARTWAY\n")
	calls := filepath.Join(t.TempDir(), "calls")

	got := xIn(t, dir, append(env, "CLAUDE_CALLS="+calls), "mods", "edit", "test")

	if ran := strings.Count(readFile(t, calls), "test\n"); got.code != 1 || ran != 1 {
		t.Fatalf("files it never reached would read green on a rerun: exit %d, %d test runs\n%s", got.code, ran, got.stdout)
	}
}

func TestModsEditScratchLivesUnderTheStateDirOutsideAJob(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	state := t.TempDir()

	copied := pullCopy(t, dir, append(env, "CLAUDE_JOB_DIR=", "X_STATE="+state), modTestA)

	if !strings.HasPrefix(copied, filepath.Join(state, "x-mods-edit")) {
		t.Fatalf("a restart would lose the edit: scratch at %s", copied)
	}
}

// the second run lands in the push: a save while `test` ran is bytes that run never read
func TestModsEditPushRunsItsTestAfterASaveDuringTheTest(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	calls := filepath.Join(t.TempDir(), "calls")
	copyA := pullCopy(t, dir, env, modTestA)
	write(t, copyA, "green, edited\n")
	mid := append(env[:len(env):len(env)], "CLAUDE_MID_TEST=echo 'green, saved mid-test' > "+copyA)
	if got := xIn(t, dir, mid, "mods", "edit", "test"); got.code != 0 {
		t.Fatalf("test: exit %d\n%s", got.code, got.stdout)
	}

	got := xIn(t, dir, append(env[:len(env):len(env)], "CLAUDE_CALLS="+calls), "mods", "edit", "push")

	if n := strings.Count(readFile(t, calls), "test\n"); got.code != 0 || n != 1 {
		t.Fatalf("exit %d, %d test runs in the push, want 1\n%s", got.code, n, got.stdout)
	}
}

func TestModsEditPushAfterARedTestStillRunsItsTest(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	write(t, copyA, "RED\n")
	xIn(t, dir, env, "mods", "edit", "test")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Fatalf("exit %d, a %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

// exit 1: a red test keeps the edit out of the mod, and test shows the same red
func TestModsEditPushRefusesARedTestAndWritesNothing(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	write(t, copyA, "RED\n")

	pushed := xIn(t, dir, env, "mods", "edit", "push")
	tested := xIn(t, dir, env, "mods", "edit", "test")

	if pushed.code == 0 || !strings.Contains(pushed.stdout, "a.test.ts is red") {
		t.Errorf("push: exit %d, want the red test named\n%s", pushed.code, pushed.stdout)
	}
	if readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Errorf("the red edit reached the mod")
	}
	if tested.code == 0 || !strings.Contains(tested.stdout, "a.test.ts is red") {
		t.Errorf("test: exit %d, want the same red\n%s", tested.code, tested.stdout)
	}
}

// exit 2b: a hooks file that does not parse is refused by the validator before any write, every test green (PK-64)
func TestModsEditPushRefusesAnUnparseableHooksFileBeforeAnyWrite(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyHooks := pullCopy(t, dir, env, modHooks)
	write(t, copyHooks, "export const register = () => { PARSE-ERROR\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || !strings.Contains(got.stdout, "does not parse") {
		t.Errorf("exit %d, want the parse error named\n%s", got.code, got.stdout)
	}
	if !strings.HasPrefix(readFile(t, filepath.Join(dir, modHooks)), "export const register = () => {};") {
		t.Errorf("the unparseable hooks file reached the mod")
	}
}

// exit 2: an unpulled file in scratch, or a target the push cannot write as a file, refuses the whole push
func TestModsEditPushWritesNothingWhenOnePathCannotLand(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, want string
		setup      func(t *testing.T, dir string, env []string)
	}{
		{"an unpulled file in scratch", "was never pulled", func(t *testing.T, dir string, env []string) {
			copyA := pullCopy(t, dir, env, modTestA)
			write(t, filepath.Join(filepath.Dir(copyA), "c.test.ts"), "green\n")
		}},
		{"a target that is a directory", "is a directory", func(t *testing.T, dir string, env []string) {
			copyC := pullCopy(t, dir, env, modsDir+"m/tests/c.test.ts")
			write(t, copyC, "green\n")
			if err := os.MkdirAll(filepath.Join(dir, modsDir, "m/tests/c.test.ts"), 0o755); err != nil {
				t.Fatal(err)
			}
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir, env := modsFixture(t)
			copyA := pullCopy(t, dir, env, modTestA)
			write(t, copyA, "green, edited\n")
			c.setup(t, dir, env)

			got := xIn(t, dir, env, "mods", "edit", "push")

			if got.code == 0 || !strings.Contains(got.stdout, c.want) {
				t.Errorf("exit %d, want %q\n%s", got.code, c.want, got.stdout)
			}
			if readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
				t.Errorf("a.test.ts was written though the push was refused")
			}
		})
	}
}

func TestModsEditPushAddsAnUnpulledFileNamedWithAdd(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	newPath := modsDir + "m/tests/c.test.ts"
	write(t, filepath.Join(filepath.Dir(copyA), "c.test.ts"), "green\n")

	got := xIn(t, dir, env, "mods", "edit", "push", "--add", newPath)

	if got.code != 0 || readFile(t, filepath.Join(dir, newPath)) != "green\n" {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}

// exit 2: a write that fails midway puts back every file written before it
func TestModsEditPushRestoresEveryWrittenFileWhenAWriteFails(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	for _, path := range []string{modTestA, modTestB} {
		write(t, pullCopy(t, dir, env, path), "green, edited\n")
	}
	target := filepath.Join(dir, modTestB)
	if err := os.Chmod(target, 0o444); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(target, 0o644) })

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || !strings.Contains(got.stdout, "restored") {
		t.Errorf("exit %d, want the failed write named\n%s", got.code, got.stdout)
	}
	if a := readFile(t, filepath.Join(dir, modTestA)); a != "green\n" {
		t.Errorf("a.test.ts is %q after the failed push, want it restored", a)
	}
}

func TestModsEditPushRefusesAFileTheRepoChangedSinceThePull(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "green, mine\n")
	write(t, filepath.Join(dir, modTestA), "green, theirs\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || readFile(t, filepath.Join(dir, modTestA)) != "green, theirs\n" {
		t.Errorf("exit %d, file %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

// exit 3: the edited tests run on HEAD's mod; one that errors there is «errored», never «failed», and nothing is written
func TestModsEditTestAgainstHeadNamesFailedApartFromErrored(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "RED on HEAD\n")
	write(t, pullCopy(t, dir, env, modTestB), "NO-IMPORT of a helper HEAD lacks\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--against", "HEAD")

	mods, _ := got.data["mods"].([]any)
	if len(mods) != 1 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	m := mods[0].(map[string]any)
	if !strings.Contains(strings.Join(anyStrings(m["failed"]), ";"), "a.test.ts") ||
		strings.Join(anyStrings(m["errored"]), ";") != "tests/b.test.ts" {
		t.Errorf("failed %v, errored %v", m["failed"], m["errored"])
	}
	if readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Errorf("--against wrote into the mod")
	}
}

func TestModsEditPullRefusesAPathOutsideAMod(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)

	got := xIn(t, dir, env, "mods", "edit", "pull", "readme.txt")

	if got.code != 2 || !strings.Contains(got.stdout, "not under") {
		t.Errorf("exit %d\n%s", got.code, got.stdout)
	}
}

func anyStrings(v any) []string {
	list, _ := v.([]any)
	var out []string
	for _, item := range list {
		out = append(out, item.(string))
	}
	return out
}

// the sample the stash's pnpm mods:test parser (mods/test.ts outcome) is held to as well: both read it the same way
// the kit's own words, caught from a real run; mods/test.ts timedOutFiles reads the same file
func TestTimeoutOnlyReadsTheSharedSample(t *testing.T) {
	t.Parallel()
	raw, err := os.ReadFile("../../home/.claude/plugin-x/mods/plugin-test-timeout.sample.txt")
	if err != nil {
		t.Fatal(err)
	}
	if !timeoutOnly(string(raw)) {
		t.Fatalf("a timed-out row read as a real red:\n%s", raw)
	}
}

func TestTestOutcomeReadsTheSharedSample(t *testing.T) {
	t.Parallel()
	raw, err := os.ReadFile("../../home/.claude/plugin-x/mods/plugin-test.sample.txt")
	if err != nil {
		t.Fatal(err)
	}
	passed, failed, errored := testOutcome(string(raw))
	got := []string{strings.Join(failed, "|"), strings.Join(errored, "|")}
	if passed != 2 || got[0] != "a breaks" || got[1] != "tests/c.test.ts" {
		t.Fatalf("passed %d, failed %q, errored %q", passed, failed, errored)
	}
}
