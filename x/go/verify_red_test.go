package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// a git repo holding one runner's fixture: a source the test reads, a test that logs the X_VERIFY it saw
type redFixture struct {
	dir, file, test, anchor, replacement string
	env                                  []string
}

func frameNodeModules(t *testing.T) string {
	t.Helper()
	dir, err := filepath.Abs("../../node_modules")
	if err != nil || !exists(filepath.Join(dir, ".bin/vitest")) {
		t.Fatalf("no vitest under %s: run the tree's install", dir)
	}
	return dir
}

func commitAll(t *testing.T, dir string) {
	t.Helper()
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "fixture")
}

func goRedFixture(t *testing.T) redFixture {
	t.Helper()
	dir := repo(t)
	write(t, filepath.Join(dir, "go.mod"), "module p\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "lib.go"), "package p\n\nconst Limit = 3\n")
	write(t, filepath.Join(dir, "lib_test.go"), `package p

import (
	"os"
	"testing"
)

func TestLimit(t *testing.T) {
	f, _ := os.OpenFile(os.Getenv("VERIFY_LOG"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	f.WriteString(os.Getenv("X_VERIFY") + "\n")
	f.Close()
	if Limit != 3 {
		t.Fatalf("got %d", Limit)
	}
}
`)
	commitAll(t, dir)
	return redFixture{dir: dir, file: "lib.go", test: "lib_test.go", anchor: "Limit = 3", replacement: "Limit = 4"}
}

func vitestRedFixture(t *testing.T) redFixture {
	t.Helper()
	dir := repo(t)
	write(t, filepath.Join(dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(dir, "package.json"), `{"name": "p", "type": "module"}`+"\n")
	if err := os.Symlink(frameNodeModules(t), filepath.Join(dir, "node_modules")); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "lib.js"), "export const limit = 3;\n")
	write(t, filepath.Join(dir, "lib.test.js"), `import { appendFileSync } from "node:fs";
import { expect, test } from "vitest";
import { limit } from "./lib.js";

test("limit is three", () => {
	appendFileSync(process.env.VERIFY_LOG, process.env.X_VERIFY + "\n");
	expect(limit).toBe(3);
});
`)
	commitAll(t, dir)
	return redFixture{dir: dir, file: "lib.js", test: "lib.test.js", anchor: "limit = 3", replacement: "limit = 4"}
}

// claude plugin test faked: it logs X_VERIFY and fails a.test.ts when the hooks hold a mutant
func modRedFixture(t *testing.T) redFixture {
	t.Helper()
	dir, _ := modsFixture(t)
	bin := t.TempDir()
	write(t, filepath.Join(bin, "claude"), `#!/bin/sh
d="$3"
[ "$2" = validate ] && { echo "✔ Validation passed"; exit 0; }
echo "$X_VERIFY" >> "$VERIFY_LOG"
red=0
for f in "$d"/tests/*.test.ts; do
  n=$(basename "$f")
  echo "tests/$n:"
  if [ "$n" = a.test.ts ] && grep -q MUTANT "$d"/hooks/*; then
    echo "(fail) $n reads the hook [1.0ms]"; echo "  AssertionError: expected 1 to be 2"; red=1
  else echo "(pass) $n [1.0ms]"; fi
done
echo "Ran 2 tests across 2 files."
exit $red
`)
	return redFixture{
		dir: dir, file: modsDir + "m/hooks/register.ts", test: modsDir + "m/tests/a.test.ts",
		anchor: "() => {}", replacement: "() => { /* MUTANT */ }",
		env: []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "CLAUDE_JOB_DIR=" + t.TempDir()},
	}
}

func verifyRedIn(t *testing.T, f redFixture, extra []string, args ...string) (ran, string) {
	t.Helper()
	log := filepath.Join(t.TempDir(), "verify.log")
	env := append(append([]string{"VERIFY_LOG=" + log}, f.env...), extra...)
	got := xIn(t, f.dir, env, append([]string{"verify", "red"}, args...)...)
	return got, readOr(log, "")
}

func pairRows(t *testing.T, got ran) []map[string]any {
	t.Helper()
	raw, _ := got.data["pairs"].([]any)
	rows := make([]map[string]any, len(raw))
	for i, row := range raw {
		rows[i], _ = row.(map[string]any)
	}
	return rows
}

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
