package main

import (
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
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

// node_modules as pnpm leaves it, a real dir of links into the store
func vitestRedFixture(t *testing.T) redFixture {
	t.Helper()
	f := vitestFixtureOn(t, func(modules string) {
		entries, err := os.ReadDir(frameNodeModules(t))
		if err != nil {
			t.Fatal(err)
		}
		for _, entry := range entries {
			if err := os.MkdirAll(modules, 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(filepath.Join(frameNodeModules(t), entry.Name()), filepath.Join(modules, entry.Name())); err != nil {
				t.Fatal(err)
			}
		}
	})
	return f
}

// node_modules as one link to another tree's
func vitestLinkedFixture(t *testing.T) redFixture {
	t.Helper()
	return vitestFixtureOn(t, func(modules string) {
		if err := os.Symlink(frameNodeModules(t), modules); err != nil {
			t.Fatal(err)
		}
	})
}

func vitestFixtureOn(t *testing.T, plant func(modules string)) redFixture {
	t.Helper()
	dir := repo(t)
	write(t, filepath.Join(dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(dir, "package.json"), `{"name": "p", "type": "module"}`+"\n")
	plant(filepath.Join(dir, "node_modules"))
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
if [ "$2" = validate ]; then
  grep -q PARSE-ERROR "$d"/hooks/* && { echo "  ❯ modules../register.ts: m: does not parse: PARSE-ERROR (line 1)"; echo "✘ Validation failed"; exit 1; }
  echo "✔ Validation passed"; exit 0
fi
echo "$X_VERIFY" >> "$VERIFY_LOG"
red=0
for f in "$d"/tests/*.test.ts; do
  n=$(basename "$f")
  echo "tests/$n:"
  if grep -q LOAD-BREAK "$d"/hooks/*; then
    echo "(fail) $n reads the hook [1.0ms]"; echo "  AssertionError: expected 1 to be 2"; echo "(fail) the file did not load"
    red=1
  elif grep -q QUOTES-LOAD "$d"/hooks/*; then
    echo "(fail) $n names the load error [1.0ms]"; echo "  AssertionError: expected 'ok' to be 'did not load'"; red=1
  elif [ "$n" = a.test.ts ] && grep -q MUTANT "$d"/hooks/*; then
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

// a typed vitest fixture: the test reads the value, tsc reads the type, so a type-only swap passes the test alone
func typedRedFixture(t *testing.T) redFixture {
	t.Helper()
	f := vitestRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.ts"), "export const limit: number = 3;\n")
	write(t, filepath.Join(f.dir, "lib.test.ts"), "import { expect, test } from \"vitest\";\nimport { limit } from \"./lib.ts\";\n\ntest(\"limit is three\", () => {\n\texpect(limit).toBe(3);\n});\n")
	write(t, filepath.Join(f.dir, "tsconfig.json"), `{"compilerOptions": {"strict": true, "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "target": "es2022", "allowImportingTsExtensions": true, "types": []}, "include": ["*.ts"]}`+"\n")
	commitAll(t, f.dir)
	return redFixture{dir: f.dir, file: "lib.ts", test: "lib.test.ts"}
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

// a repo already red on tsc still proves: only a type error the mutant adds is broken, wherever the swap moves the old ones
func TestVerifyRedReadsPastTheCleanRunsTypeErrors(t *testing.T) {
	t.Parallel()
	f := typedRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.ts"), "export const limit: number = 3;\nexport const bad: string = 1;\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, "limit: number = 3;", "limit: number = 4;\n", f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red:\n%s", got.code, got.data, got.stdout)
	}
}

func pairsFile(t *testing.T, lines ...string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "pairs.tsv")
	write(t, path, "# a comment\n\n"+strings.Join(lines, "\n")+"\n")
	return path
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
}

// exit lines 7 and 12: a mod with two hooks, one named test; the runner's load error reads broken whatever it reddened, while
// an assertion that quotes a load word is a real red, the one red-proof read as «did not load»
func TestVerifyRedReadsAModsLoadErrorApartFromARed(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, replacement, verdict string
		code                       int
		tests                      []string
	}{
		{"one named test went red", "() => { /* MUTANT */ }", verdictRed, 0, []string{"a.test.ts reads the hook"}},
		{"a load error beside a failed assertion", "() => { /* LOAD-BREAK */ }", verdictBroken, 1, nil},
		{"an assertion quoting a load word", "() => { /* QUOTES-LOAD */ }", verdictRed, 0, []string{"a.test.ts names the load error"}},
		{"a hook that does not parse", "() => { PARSE-ERROR }", verdictBroken, 1, nil},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := modRedFixture(t)
			write(t, filepath.Join(f.dir, modsDir, "m/hooks/second.ts"), "export const second = () => {};\n")
			commitAll(t, f.dir)

			got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, c.replacement, f.test)

			rows := pairRows(t, got)
			if got.code != c.code || len(rows) != 1 || rows[0]["verdict"] != c.verdict {
				t.Fatalf("exit %d, pairs %v, want %s and exit %d:\n%s", got.code, rows, c.verdict, c.code, got.stdout)
			}
			var tests []string
			named, _ := rows[0]["tests"].([]any)
			for _, test := range named {
				tests = append(tests, test.(string))
			}
			if strings.Join(tests, ",") != strings.Join(c.tests, ",") {
				t.Fatalf("the row names %v, want %v: only the named test file runs", tests, c.tests)
			}
		})
	}
}

// exit line 12: a go assertion whose message holds a load word reads red, though -v prints it apart from its row
func TestVerifyRedReadsAGoFailureQuotingALoadWordRed(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "lib_test.go"), "package p\n\nimport \"testing\"\n\nfunc TestLimit(t *testing.T) {\n\tt.Parallel()\n\tt.Run(\"sub\", func(t *testing.T) {\n\t\tt.Parallel()\n\t\tif Limit != 3 {\n\t\t\tt.Fatalf(\"got %d: the file did not load\", Limit)\n\t\t}\n\t})\n}\n\nfunc TestOther(t *testing.T) { t.Parallel() }\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red:\n%s", got.code, got.data, got.stdout)
	}
}

// a go fixture whose second mutant hangs once, so a run can be cut there; each test run logs one line
func cutRedFixture(t *testing.T) (redFixture, string) {
	t.Helper()
	f := goRedFixture(t)
	marker := filepath.Join(t.TempDir(), "hung")
	write(t, filepath.Join(f.dir, "lib_test.go"), `package p

import (
	"os"
	"testing"
	"time"
)

func TestLimit(t *testing.T) {
	f, _ := os.OpenFile(os.Getenv("VERIFY_LOG"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	f.WriteString("ran\n")
	f.Close()
	if _, err := os.Stat(os.Getenv("HANG_MARKER")); Limit == 5 && err != nil {
		os.WriteFile(os.Getenv("HANG_MARKER"), nil, 0o644)
		time.Sleep(time.Minute)
	}
	if Limit != 3 {
		t.Fatalf("got %d", Limit)
	}
}
`)
	commitAll(t, f.dir)
	return f, marker
}

// x killed with its children once the log holds `lines` runs: the cut a timeout makes
func cutAt(t *testing.T, f redFixture, env []string, lines int, args ...string) {
	t.Helper()
	c := exec.Command(xbin, append([]string{"verify", "red"}, args...)...)
	c.Dir, c.Env = f.dir, append(append(append(cleanEnv(), "X_TEST=1"), f.env...), env...)
	c.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := c.Start(); err != nil {
		t.Fatal(err)
	}
	log := strings.TrimPrefix(env[0], "VERIFY_LOG=")
	deadline := time.Now().Add(time.Minute)
	for strings.Count(readOr(log, ""), "\n") < lines && time.Now().Before(deadline) {
		time.Sleep(50 * time.Millisecond)
	}
	_ = syscall.Kill(-c.Process.Pid, syscall.SIGKILL)
	_ = c.Wait()
	if got := strings.Count(readOr(log, ""), "\n"); got != lines {
		t.Fatalf("the cut run logged %d runs, want %d", got, lines)
	}
}

// exit line 5: a cut run resumes from its first unfinished pair; a change to its inputs or the tree starts over, and a finished
// run leaves nothing to replay
func TestVerifyRedResumesACutRun(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		change func(f redFixture, pairs string)
		runs   int
	}{
		{"the same inputs", func(redFixture, string) {}, 2},
		{"the pairs file changed", func(_ redFixture, pairs string) {
			body := readOr(pairs, "")
			write(t, pairs, body+"Limit = 3\tLimit = 7\n")
		}, 5},
		{"the tree gained an uncommitted file", func(f redFixture, _ string) { write(t, filepath.Join(f.dir, "notes.txt"), "new\n") }, 4},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f, marker := cutRedFixture(t)
			pairs := pairsFile(t, "Limit = 3\tLimit = 4", "Limit = 3\tLimit = 5", "Limit = 3\tLimit = 6")
			log := filepath.Join(t.TempDir(), "verify.log")
			env := []string{"VERIFY_LOG=" + log, "HANG_MARKER=" + marker, "X_STATE=" + t.TempDir()}
			args := []string{f.file, "--pairs", pairs, f.test}
			cutAt(t, f, env, 3, args...)
			c.change(f, pairs)

			got := xIn(t, f.dir, append(f.env, env...), append([]string{"verify", "red"}, args...)...)

			if got.code != 0 || got.data["verdict"] != verdictRed {
				t.Fatalf("exit %d, data %v, want red:\n%s", got.code, got.data, got.stdout)
			}
			if runs := strings.Count(readOr(log, ""), "\n") - 3; runs != c.runs {
				t.Fatalf("the second run ran the test %d times, want %d", runs, c.runs)
			}
			if again := xIn(t, f.dir, append(f.env, env...), append([]string{"verify", "red"}, args...)...); strings.Count(readOr(log, ""), "\n")-3-c.runs != len(pairRows(t, again))+1 {
				t.Fatalf("a run after a finished one replayed saved pairs: the log reads\n%s", readOr(log, ""))
			}
		})
	}
}

// every file's size, mode and mtime under the roots, links not followed; git's own dir is git's, so it stays out
func treeWrites(t *testing.T, roots ...string) map[string]string {
	t.Helper()
	seen := map[string]string{}
	for _, root := range roots {
		_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if entry.IsDir() && entry.Name() == ".git" {
				return filepath.SkipDir
			}
			if info, err := os.Lstat(path); err == nil {
				seen[path] = fmt.Sprintf("%d %v %d", info.Size(), info.Mode(), info.ModTime().UnixNano())
			}
			return nil
		})
	}
	return seen
}

// exit line 6: neither the clean run nor a mutant writes the real tree, the caches a runner keeps in node_modules included
func TestVerifyRedWritesNothingInTheRealTree(t *testing.T) {
	t.Parallel()
	modules := frameNodeModules(t)
	for _, c := range []struct {
		name    string
		fixture func(*testing.T) redFixture
		caches  []string
	}{
		{"go test", goRedFixture, nil},
		{"a mod's test", modRedFixture, nil},
		{"vitest", vitestRedFixture, []string{".vite", ".vite-temp", ".vitest-cache"}},
		{"vitest on a linked node_modules", vitestLinkedFixture, []string{".vite", ".vite-temp", ".vitest-cache"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := c.fixture(t)
			watched := []string{f.dir}
			for _, cache := range c.caches {
				watched = append(watched, filepath.Join(modules, cache))
			}
			before := treeWrites(t, watched...)
			nodeModules, _ := os.Lstat(modules)

			got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

			if got.code != 0 {
				t.Fatalf("exit %d, want red:\n%s", got.code, got.stdout)
			}
			after := treeWrites(t, watched...)
			for path, was := range before {
				if after[path] != was {
					t.Errorf("%s changed: %s → %s", path, was, after[path])
				}
			}
			for path := range after {
				if _, ok := before[path]; !ok {
					t.Errorf("%s appeared", path)
				}
			}
			if now, _ := os.Lstat(modules); c.caches != nil && !now.ModTime().Equal(nodeModules.ModTime()) {
				t.Errorf("%s gained or lost an entry", modules)
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
