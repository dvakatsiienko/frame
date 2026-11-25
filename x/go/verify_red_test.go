package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// exit line 1: clean and mutated through one harness, each carrying X_VERIFY=1, the real file untouched
func TestVerifyRedReadsAMutantRedPerRunner(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		fixture func(*testing.T) redFixture
	}{
		{"go test", goRedFixture},
		{"vitest", vitestRedFixture},
		{"claude plugin test", modRedFixture},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := c.fixture(t)
			before := readOr(filepath.Join(f.dir, f.file), "gone")

			got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

			if got.code != 0 || got.data["verdict"] != verdictRed {
				t.Fatalf("exit %d, data %v, want red:\n%s", got.code, got.data, got.stdout)
			}
			if rows := pairRows(t, got); len(rows) != 1 || rows[0]["verdict"] != verdictRed {
				t.Fatalf("pairs %v, want one red", rows)
			}
			if log != "1\n1\n" {
				t.Fatalf("the runs saw X_VERIFY %q, want 1 on the clean run and the mutated one", log)
			}
			if after := readOr(filepath.Join(f.dir, f.file), "gone"); after != before {
				t.Fatalf("%s reads %q after the run, want it untouched", f.file, after)
			}
			if status := gitT(t, f.dir, "status", "--porcelain"); status != "" {
				t.Fatalf("the tree changed:\n%s", status)
			}
		})
	}
}

// exit line 3: a swap that breaks the build, or only the types, reads broken and exits non-zero
func TestVerifyRedReadsABuildOrTypeBreakBroken(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, anchor, replacement, says string
		fixture                         func(*testing.T) redFixture
	}{
		{"a go compile error", "Limit = 3", "Limit = ", "build failed", goRedFixture},
		{"a type-only ts break", "limit: number = 3", "limit: string = 3", "TS2322", typedRedFixture},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := c.fixture(t)

			got, _ := verifyRedIn(t, f, nil, f.file, c.anchor, c.replacement, f.test)

			rows := pairRows(t, got)
			if got.code != 1 || len(rows) != 1 || rows[0]["verdict"] != verdictBroken {
				t.Fatalf("exit %d, pairs %v, want one broken and exit 1:\n%s", got.code, rows, got.stdout)
			}
			if why, _ := rows[0]["why"].(string); !strings.Contains(why, c.says) {
				t.Fatalf("why %q, want it naming %q", why, c.says)
			}
		})
	}
}

// exit line 4: a row per pair in order, the tests it reddened named; the exit is 0 only when every pair is red
func TestVerifyRedPairsPrintARowEach(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "other.go"), "package p\n\nconst Other = 1\n\nconst Limit2 = Limit + Other\n")
	commitAll(t, f.dir)
	write(t, filepath.Join(f.dir, "lib.go"), "package p\n\nconst Limit = 3\n\nconst Spare = 1\n")
	commitAll(t, f.dir)
	pairs := pairsFile(t, "Limit = 3\tLimit = 4", "Spare = 1\tSpare = 2", "Limit = 3\tLimit = ")

	for _, board := range []bool{false, true} {
		args := []string{f.file, "--pairs", pairs, f.test}
		if board {
			args = append(args, "--board")
		}
		got, _ := verifyRedIn(t, f, nil, args...)

		if board {
			for _, label := range []string{"«Limit = 3»", "«Spare = 1»", "TestLimit"} {
				if !strings.Contains(got.stdout, label) {
					t.Fatalf("the board names no %s:\n%s", label, got.stdout)
				}
			}
			continue
		}
		rows := pairRows(t, got)
		verdicts := []string{}
		for _, row := range rows {
			verdicts = append(verdicts, row["verdict"].(string))
		}
		if got.code != 1 || strings.Join(verdicts, ",") != "red,still green,broken" {
			t.Fatalf("exit %d, verdicts %v, want red, still green, broken and exit 1:\n%s", got.code, verdicts, got.stdout)
		}
		if tests, _ := rows[0]["tests"].([]any); len(tests) != 1 || tests[0] != "TestLimit" {
			t.Fatalf("the red row names %v, want TestLimit", rows[0]["tests"])
		}
	}
}

// exit line 4: a command after -- runs with the same mutation; one x cannot read reads failed when it fails, never red
func TestVerifyRedRunsACommandAfterTheDash(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		fixture func(*testing.T) redFixture
		command []string
		verdict string
		code    int
	}{
		{"go test through the overlay", goRedFixture, []string{"go", "test", "."}, verdictRed, 0},
		{"an opaque command in the copy", vitestRedFixture, []string{"sh", "-c", "grep -q 'limit = 3' lib.js"}, verdictFailed, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := c.fixture(t)

			got, _ := verifyRedIn(t, f, nil, append([]string{f.file, f.anchor, f.replacement, "--"}, c.command...)...)

			if got.code != c.code || got.data["verdict"] != c.verdict {
				t.Fatalf("exit %d, data %v, want %s and exit %d:\n%s", got.code, got.data, c.verdict, c.code, got.stdout)
			}
		})
	}
}

// ported from red-proof's suite: an anchor keeps its leading tabs, as go is indented, since the last tab splits a pair
func TestVerifyRedTakesAnAnchorOpeningOnATab(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.go"), "package p\n\nconst (\n\tLimit = 3\n)\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, "--pairs", pairsFile(t, "\tLimit = 3\tLimit = 4"), f.test)

	if rows := pairRows(t, got); got.code != 0 || len(rows) != 1 || rows[0]["pair"] != "«Limit = 3»" {
		t.Fatalf("exit %d, pairs %v, want one red pair on the tabbed anchor:\n%s", got.code, rows, got.stdout)
	}
}

// a mutant the test does not read stays green, and the exit says no proof
func TestVerifyRedReadsAnUnreadLineStillGreen(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "other.go"), "package p\n\nconst Other = 1\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, "other.go", "Other = 1", "Other = 2", f.test)

	if got.code != 1 || got.data["verdict"] != verdictStillGreen {
		t.Fatalf("exit %d, data %v, want still green and exit 1:\n%s", got.code, got.data, got.stdout)
	}
	if !strings.Contains(got.next, "x verify red") {
		t.Fatalf("next %q, want a way forward", got.next)
	}
}
