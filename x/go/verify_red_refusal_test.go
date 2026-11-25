package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// exit line 2: a red clean run, an anchor not found exactly once, or a clean run of no test refuse before any mutant runs
func TestVerifyRedRefusesBeforeAnyMutant(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, anchor, run, says string
		breakClean, twice       bool
		code, runs              int
	}{
		{name: "a red clean run", anchor: "Limit = 3", breakClean: true, code: 1, runs: 1, says: "TestLimit"},
		{name: "an anchor not found", anchor: "Limit = 9", code: 2, says: "found 0 times"},
		{name: "an anchor found twice", anchor: "= 3", twice: true, code: 2, says: "found 2 times"},
		{name: "a clean run of no test", anchor: "Limit = 3", run: "TestNone", code: 1, says: "ran no test"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := goRedFixture(t)
			if c.breakClean {
				write(t, filepath.Join(f.dir, "lib_test.go"), strings.Replace(readOr(filepath.Join(f.dir, "lib_test.go"), ""), "Limit != 3", "Limit != 5", 1))
			}
			if c.twice {
				write(t, filepath.Join(f.dir, "lib.go"), "package p\n\nconst Limit = 3\n\nconst Other = 3\n")
			}
			args := []string{f.file, c.anchor, "Limit = 4", f.test}
			if c.run != "" {
				args = append(args, "--run", c.run)
			}

			got, log := verifyRedIn(t, f, nil, args...)

			if got.code != c.code || !strings.Contains(got.stdout, c.says) {
				t.Fatalf("exit %d, want %d naming %q:\n%s", got.code, c.code, c.says, got.stdout)
			}
			if runs := strings.Count(log, "\n"); runs != c.runs {
				t.Fatalf("the test ran %d times, want %d: no mutant after a refusal", runs, c.runs)
			}
		})
	}
}

// review round: a cwd outside the repo would run the command on the real tree, so it refuses
func TestVerifyRedRefusesACwdOutsideTheRepo(t *testing.T) {
	t.Parallel()
	f := vitestRedFixture(t)
	outside := t.TempDir()

	got := xIn(t, outside, []string{"VERIFY_LOG=" + filepath.Join(outside, "log")}, "verify", "red", filepath.Join(f.dir, f.file), f.anchor, f.replacement, filepath.Join(f.dir, f.test))

	if got.code != 2 || !strings.Contains(got.stdout, "outside") {
		t.Fatalf("exit %d, want a usage refusal naming the cwd outside the repo:\n%s", got.code, got.stdout)
	}
}

// a form with nothing to run, or both a test and a command, exits 2
func TestVerifyRedArgsOutsideItsFormsExitUsage(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	pairs := pairsFile(t, "Limit = 3\tLimit = 4")
	for _, args := range [][]string{
		{f.file, "--pairs", pairs},
		{f.file, f.anchor, f.replacement},
		{f.file, f.anchor, f.replacement, f.test, "--", "go", "test", "."},
		{f.file, "--pairs", pairsFile(t, "no tab here"), f.test},
		{f.file, f.anchor, f.replacement, "--"},
	} {
		if got, _ := verifyRedIn(t, f, nil, args...); got.code != 2 {
			t.Fatalf("%v: exit %d, want 2:\n%s", args, got.code, got.stdout)
		}
	}
	// a mod's run is its one test file, so a name it cannot pass on refuses before any run
	m := modRedFixture(t)
	if got, _ := verifyRedIn(t, m, nil, m.file, m.anchor, m.replacement, m.test, "--run", "a name"); got.code != 2 {
		t.Fatalf("--run on a mod: exit %d, want 2:\n%s", got.code, got.stdout)
	}
}
