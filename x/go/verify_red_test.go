package main

import (
	"crypto/sha256"
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
	// the trailing slash marks a tool dir to the reads list test, never a repo file
	dir, err := filepath.Abs("../../node_modules/")
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
	real := frameNodeModules(t)
	f := vitestFixtureOn(t, func(modules string) {
		entries, err := os.ReadDir(real)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(modules, 0o755); err != nil {
			t.Fatal(err)
		}
		for _, entry := range entries {
			if err := os.Symlink(filepath.Join(real, entry.Name()), filepath.Join(modules, entry.Name())); err != nil {
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

// ported from red-proof's suite: a mod's red base names the failed test; its first mutant ran beside it, so two runs and no more
func TestVerifyRedRefusesAModsRedBase(t *testing.T) {
	t.Parallel()
	f := modRedFixture(t)
	write(t, filepath.Join(f.dir, f.file), "export const register = () => { /* MUTANT */ };\n")
	commitAll(t, f.dir)

	got, log := verifyRedIn(t, f, nil, f.file, "/* MUTANT */", "", f.test)

	if got.code != 1 || !strings.Contains(got.stdout, "a.test.ts reads the hook") || strings.Count(log, "\n") != 2 {
		t.Fatalf("exit %d, %d runs, want a refusal naming the failed test after the clean run and the mutant beside it:\n%s", got.code, strings.Count(log, "\n"), got.stdout)
	}
}

// exit line 9, the want line: a test whose code runs the real paid-lane script, and a typo, through one pairs round: the paid call
// is skipped on every run, the typo reads broken, and no script was written by hand
func TestVerifyRedNeverPaysAndReadsATypoBroken(t *testing.T) {
	t.Parallel()
	f := vitestRedFixture(t)
	lanes, err := filepath.Abs("../../script/research-lanes.sh")
	if err != nil {
		t.Fatal(err)
	}
	spent := filepath.Join(t.TempDir(), "spent")
	write(t, filepath.Join(f.dir, "script/research-lanes.sh"), readOr(lanes, ""))
	write(t, filepath.Join(f.dir, "script/op-run.sh"), "#!/bin/sh\necho \"$3\" >> "+spent+"\n")
	write(t, filepath.Join(f.dir, "brief.md"), "the question\n")
	write(t, filepath.Join(f.dir, "lib.js"), "import { spawnSync } from \"node:child_process\";\n\nexport const limit = 3;\nexport const lanes = () => spawnSync(\"sh\", [\"script/research-lanes.sh\", \"brief.md\"], { encoding: \"utf8\" }).status;\n")
	write(t, filepath.Join(f.dir, "lib.test.js"), "import { expect, test } from \"vitest\";\nimport { lanes, limit } from \"./lib.js\";\n\ntest(\"the lanes run and the limit is three\", () => {\n\tlanes();\n\texpect(limit).toBe(3);\n});\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, "--pairs", pairsFile(t, "limit = 3;\tlimit = 4;", "limit = 3;\tlimit = 3;;(("), f.test)

	verdicts := []string{}
	for _, row := range pairRows(t, got) {
		verdicts = append(verdicts, row["verdict"].(string))
	}
	if got.code != 1 || strings.Join(verdicts, ",") != "red,broken" {
		t.Fatalf("exit %d, verdicts %v, want red, broken and exit 1:\n%s", got.code, verdicts, got.stdout)
	}
	if calls := readOr(spent, ""); calls != "" {
		t.Fatalf("a verify run paid for lanes:\n%s", calls)
	}
}

// a go module whose test runs the source only through a binary its TestMain builds, as x's own suite does
func childBuildFixture(t *testing.T) redFixture {
	t.Helper()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.go"), "package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Print(3) }\n")
	write(t, filepath.Join(f.dir, "lib_test.go"), `package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

var bin string

func TestMain(m *testing.M) {
	dir, _ := os.MkdirTemp("", "child-")
	bin = filepath.Join(dir, "p")
	if out, err := exec.Command("go", "build", "-o", bin, ".").CombinedOutput(); err != nil {
		panic(string(out))
	}
	os.Exit(m.Run())
}

func TestPrintsThree(t *testing.T) {
	if out, _ := exec.Command(bin).Output(); string(out) != "3" {
		t.Fatalf("printed %q", out)
	}
}

func TestPrintsSomething(t *testing.T) {
	if out, _ := exec.Command(bin).Output(); string(out) != "3" {
		t.Fatalf("printed %q", out)
	}
}
`)
	commitAll(t, f.dir)
	return redFixture{dir: f.dir, file: "lib.go", test: "lib_test.go", anchor: "fmt.Print(3)", replacement: "fmt.Print(4)"}
}

// exit line 10: a mutant only a TestMain's child build runs reads red, the run stops at its first failure
func TestVerifyRedReachesATestMainsChildBuild(t *testing.T) {
	t.Parallel()
	f := childBuildFixture(t)

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	rows := pairRows(t, got)
	if got.code != 0 || len(rows) != 1 || rows[0]["verdict"] != verdictRed {
		t.Fatalf("exit %d, pairs %v, want red through the child build:\n%s", got.code, rows, got.stdout)
	}
	if tests, _ := rows[0]["tests"].([]any); len(tests) != 1 {
		t.Fatalf("the row names %v, want one test: -failfast stops at the first", tests)
	}
}

// exit line 10: a pairs round takes the gate queue's long slot itself, once for the whole round
func TestVerifyRedPairsTakeTheLongSlot(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	root := t.TempDir()
	calls := filepath.Join(t.TempDir(), "calls")
	write(t, filepath.Join(root, "script/gate-queue.sh"), "#!/bin/sh\necho \"$1\" >> "+calls+"\nshift\nGATE_QUEUE_HELD=long exec \"$@\"\n")
	pairs := pairsFile(t, "Limit = 3\tLimit = 4", "Limit = 3\tLimit = 5")

	got, _ := verifyRedIn(t, f, []string{"X_FRAME_ROOT=" + root}, f.file, "--pairs", pairs, f.test)

	if got.code != 0 || len(pairRows(t, got)) != 2 {
		t.Fatalf("exit %d, want both pairs red inside the slot:\n%s", got.code, got.stdout)
	}
	if read := readOr(calls, ""); read != "--long\n" {
		t.Fatalf("the queue heard %q, want one turn on the long slot", read)
	}
}

// review round: a link into the repo, a workspace package's in node_modules or an absolute one, reads the copy's mutant
func TestVerifyRedFollowsLinksIntoTheCopy(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		link func(t *testing.T, dir string) (target, imported string)
	}{
		{"a workspace package in node_modules", func(t *testing.T, dir string) (string, string) {
			write(t, filepath.Join(dir, "pkg/package.json"), `{"name": "pkg", "type": "module"}`+"\n")
			if err := os.Symlink("../pkg", filepath.Join(dir, "node_modules/pkg")); err != nil {
				t.Fatal(err)
			}
			return "pkg/lib.js", "pkg/lib.js"
		}},
		{"an absolute link", func(t *testing.T, dir string) (string, string) {
			if err := os.Symlink(filepath.Join(dir, "src"), filepath.Join(dir, "linked")); err != nil {
				t.Fatal(err)
			}
			return "src/lib.js", "./linked/lib.js"
		}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := vitestRedFixture(t)
			target, imported := c.link(t, f.dir)
			write(t, filepath.Join(f.dir, target), "export const limit = 3;\n")
			write(t, filepath.Join(f.dir, "lib.test.js"), "import { expect, test } from \"vitest\";\nimport { limit } from \""+imported+"\";\n\ntest(\"limit is three\", () => {\n\texpect(limit).toBe(3);\n});\n")
			commitAll(t, f.dir)

			got, _ := verifyRedIn(t, f, nil, target, "limit = 3", "limit = 4", f.test)

			if got.code != 0 || got.data["verdict"] != verdictRed {
				t.Fatalf("exit %d, data %v, want the link to read the copy's mutant:\n%s", got.code, got.data, got.stdout)
			}
		})
	}
}

// review round: the git-crypt set never reaches the copy, a non-ascii path and an untracked one included
func TestVerifyRedLeavesTheGitCryptSetOutOfTheCopy(t *testing.T) {
	t.Parallel()
	f := vitestRedFixture(t)
	write(t, filepath.Join(f.dir, ".gitattributes"), "secret.txt filter=git-crypt\nсекрет.txt filter=git-crypt\nnew.txt filter=git-crypt\n")
	for _, name := range []string{"secret.txt", "секрет.txt"} {
		write(t, filepath.Join(f.dir, name), "plain text\n")
	}
	write(t, filepath.Join(f.dir, "lib.test.js"), "import { existsSync } from \"node:fs\";\nimport { expect, test } from \"vitest\";\nimport { limit } from \"./lib.js\";\n\ntest(\"no plain text and the limit is three\", () => {\n\texpect([\"secret.txt\", \"секрет.txt\", \"new.txt\"].filter((name) => existsSync(name))).toEqual([]);\n\texpect(limit).toBe(3);\n});\n")
	commitAll(t, f.dir)
	write(t, filepath.Join(f.dir, "new.txt"), "plain text\n")

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red with no git-crypt file in the copy:\n%s", got.code, got.data, got.stdout)
	}
}

// exit line 1, dima's o82: a throw from the mutated code is the mutant doing its job, so it reads red
func TestVerifyRedReadsAThrowFromTheMutantRed(t *testing.T) {
	t.Parallel()
	f := vitestRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.js"), "export const limit = () => 3;\n")
	write(t, filepath.Join(f.dir, "lib.test.js"), "import { expect, test } from \"vitest\";\nimport { limit } from \"./lib.js\";\n\ntest(\"limit is three\", () => {\n\texpect(limit()).toBe(3);\n});\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, "() => 3", "() => { throw new Error(\"boom\"); }", f.test)

	if rows := pairRows(t, got); got.code != 0 || len(rows) != 1 || rows[0]["verdict"] != verdictRed || rows[0]["why"] != "it threw" {
		t.Fatalf("exit %d, pairs %v, want red, it threw:\n%s", got.code, rows, got.stdout)
	}
}

// review round: a go test reads a data file at runtime, which an overlay never reaches, so the mutant runs in the copy
func TestVerifyRedMutatesAFileAGoTestReadsAtRuntime(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "limit.txt"), "3\n")
	write(t, filepath.Join(f.dir, "lib_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestLimit(t *testing.T) {\n\tif body, _ := os.ReadFile(\"limit.txt\"); string(body) != \"3\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, "limit.txt", "3", "4", f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red on a file read at runtime:\n%s", got.code, got.data, got.stdout)
	}
}

// a mod's clean run and its first mutant share nothing, so they run side by side: each run waits up to 5 s for the other to start
func TestVerifyRedRunsAModsCleanRunBesideItsFirstMutant(t *testing.T) {
	t.Parallel()
	f := modRedFixture(t)
	bin := strings.TrimPrefix(strings.SplitN(f.env[0], ":", 2)[0], "PATH=")
	write(t, filepath.Join(bin, "claude"), `#!/bin/sh
d="$3"
[ "$2" = validate ] && { echo "✔ Validation passed"; exit 0; }
echo start >> "$VERIFY_LOG"
i=0
while [ "$(grep -c start "$VERIFY_LOG")" -lt 2 ] && [ $i -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
echo end >> "$VERIFY_LOG"
echo "tests/a.test.ts:"
if grep -q MUTANT "$d"/hooks/*; then echo "(fail) a.test.ts reads the hook [1.0ms]"; echo "  AssertionError: expected 1 to be 2"; exit 1; fi
echo "(pass) a.test.ts [1.0ms]"; echo "Ran 1 tests across 1 files."
`)

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed || log != "start\nstart\nend\nend\n" {
		t.Fatalf("exit %d, data %v, the runs logged %q, want red off two runs that overlapped:\n%s", got.code, got.data, log, got.stdout)
	}
}

// a root file a go module in a subdir reads, as x/go reads lefthook.yaml from the repo root: the test runs from its own module
func TestVerifyRedMutatesARootFileAGoModuleBelowReads(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "hook.yaml"), "count: 1\n")
	write(t, filepath.Join(dir, "sub/go.mod"), "module p\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "sub/hook_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestHook(t *testing.T) {\n\tif body, _ := os.ReadFile(\"../hook.yaml\"); string(body) != \"count: 1\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, dir)

	got, _ := verifyRedIn(t, redFixture{dir: dir}, nil, "hook.yaml", "count: 1", "count: 2", "sub/hook_test.go")

	if rows := pairRows(t, got); got.code != 0 || got.data["verdict"] != verdictRed || len(rows) != 1 || !strings.Contains(fmt.Sprint(rows[0]["tests"]), "TestHook") {
		t.Fatalf("exit %d, data %v, want red naming TestHook from a clean run green in the tree:\n%s", got.code, got.data, got.stdout)
	}
}

// the package manager guard covers a pnpm command alone: a go test whose own fixture runs pnpm reads its clean run green
func TestVerifyRedLeavesAGoTestsOwnPnpmCallAlone(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "hook.yaml"), "count: 1\n")
	write(t, filepath.Join(dir, "sub/go.mod"), "module p\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "sub/hook_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"os/exec\"\n\t\"testing\"\n)\n\nfunc TestHook(t *testing.T) {\n\tif out, err := exec.Command(\"pnpm\", \"--version\").CombinedOutput(); err != nil {\n\t\tt.Fatalf(\"pnpm: %v %s\", err, out)\n\t}\n\tif body, _ := os.ReadFile(\"../hook.yaml\"); string(body) != \"count: 1\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, dir)

	got, _ := verifyRedIn(t, redFixture{dir: dir}, nil, "hook.yaml", "count: 1", "count: 2", "sub/hook_test.go")

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red from a clean run whose test ran pnpm itself:\n%s", got.code, got.data, got.stdout)
	}
}

// review round: a timeout proves nothing, a load can cause it; a vitest name that matches nothing refuses
func TestVerifyRedReadsATimeoutBrokenAndANoMatchRefused(t *testing.T) {
	t.Parallel()
	f := vitestRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.test.js"), "import { expect, test } from \"vitest\";\nimport { limit } from \"./lib.js\";\n\ntest(\"limit is three\", async () => {\n\tif (limit !== 3) await new Promise((done) => setTimeout(done, 5000));\n\texpect(limit).toBe(3);\n}, 200);\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)
	if rows := pairRows(t, got); got.code != 1 || len(rows) != 1 || rows[0]["verdict"] != verdictBroken {
		t.Fatalf("exit %d, pairs %v, want a timeout broken:\n%s", got.code, rows, got.stdout)
	}

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test, "--run", "no such name")
	if got.code != 1 || !strings.Contains(got.stdout, "ran no test") || log != "" {
		t.Fatalf("exit %d, want a refusal of a run that matched no test:\n%s", got.code, got.stdout)
	}
}

// round 2: a type error worded like one the clean file has still counts; a file no tsconfig includes says it went unchecked
func TestVerifyRedCountsTypeErrorsAndNamesAnUncheckedFile(t *testing.T) {
	t.Parallel()
	f := typedRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.ts"), "export const limit: number = 3;\nexport const bad: number = \"x\" as unknown as string;\n")
	commitAll(t, f.dir)
	got, _ := verifyRedIn(t, f, nil, f.file, "limit: number = 3", "limit: number = \"x\" as unknown as string", f.test)
	if rows := pairRows(t, got); got.code != 1 || len(rows) != 1 || rows[0]["verdict"] != verdictBroken {
		t.Fatalf("exit %d, pairs %v, want the second same-worded error broken:\n%s", got.code, rows, got.stdout)
	}

	g := typedRedFixture(t)
	write(t, filepath.Join(g.dir, "tsconfig.json"), `{"compilerOptions": {"strict": true, "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "target": "es2022", "allowImportingTsExtensions": true, "types": []}, "include": ["src/**/*.ts"]}`+"\n")
	write(t, filepath.Join(g.dir, "src/keep.ts"), "export {};\n")
	commitAll(t, g.dir)
	got, _ = verifyRedIn(t, g, nil, g.file, "limit: number = 3", "limit: string = 3", g.test)
	if rows := pairRows(t, got); len(rows) != 1 || !strings.Contains(fmt.Sprint(rows[0]["why"]), "unchecked") {
		t.Fatalf("pairs %v, want the row to say no tsconfig checks lib.ts:\n%s", rows, got.stdout)
	}
}

// ci review: a dependency's file of the same name in the program never stands in for the file itself
func TestVerifyRedNeverTakesADependencysFileForTheMutated(t *testing.T) {
	t.Parallel()
	f := typedRedFixture(t)
	write(t, filepath.Join(f.dir, "tsconfig.json"), `{"compilerOptions": {"strict": true, "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "target": "es2022", "allowImportingTsExtensions": true, "types": []}, "include": ["src/**/*.ts"]}`+"\n")
	write(t, filepath.Join(f.dir, "src/keep.ts"), "import { other } from \"pkg/lib.ts\";\nexport const kept = other;\n")
	write(t, filepath.Join(f.dir, "deps/pkg/package.json"), `{"name": "pkg", "type": "module"}`+"\n")
	write(t, filepath.Join(f.dir, "deps/pkg/lib.ts"), "export const other = 1;\n")
	if err := os.Symlink(filepath.Join(f.dir, "deps/pkg"), filepath.Join(f.dir, "node_modules/pkg")); err != nil {
		t.Fatal(err)
	}
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, "limit: number = 3", "limit: string = 3", f.test)

	if rows := pairRows(t, got); len(rows) != 1 || !strings.Contains(fmt.Sprint(rows[0]["why"]), "unchecked") {
		t.Fatalf("pairs %v, want the row to say no tsconfig checks lib.ts:\n%s", rows, got.stdout)
	}
}

// round 2: a dash command reads a runtime file and a flag's absolute value from the copy
func TestVerifyRedRunsADashCommandOnTheCopy(t *testing.T) {
	t.Parallel()
	g := goRedFixture(t)
	write(t, filepath.Join(g.dir, "limit.txt"), "3\n")
	write(t, filepath.Join(g.dir, "lib_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestLimit(t *testing.T) {\n\tif body, _ := os.ReadFile(\"limit.txt\"); string(body) != \"3\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, g.dir)
	if got, _ := verifyRedIn(t, g, nil, "limit.txt", "3", "4", "--", "go", "test", "-v", "."); got.code != 0 {
		t.Fatalf("a runtime file through -- go test: exit %d, want red:\n%s", got.code, got.stdout)
	}

	v := vitestRedFixture(t)
	if got, _ := verifyRedIn(t, v, nil, v.file, v.anchor, v.replacement, "--", "vitest", "run", "--root="+v.dir, "lib.test.js"); got.code != 0 {
		t.Fatalf("a --root=<abs> flag: exit %d, want red, its value read in the copy:\n%s", got.code, got.stdout)
	}
}

// review round: a go tree reached through a symlinked dir still reads the mutant
func TestVerifyRedOverlaysThroughASymlinkedDir(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	link := filepath.Join(t.TempDir(), "link")
	if err := os.Symlink(f.dir, link); err != nil {
		t.Fatal(err)
	}
	f.dir = link

	got, _ := verifyRedIn(t, f, []string{"PWD=" + link}, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red through the link:\n%s", got.code, got.data, got.stdout)
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
func cutAt(t *testing.T, f redFixture, env []string, lines int, cut syscall.Signal, args ...string) {
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
	_ = syscall.Kill(-c.Process.Pid, cut)
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
			env := []string{"VERIFY_LOG=" + log, "HANG_MARKER=" + marker, "X_STATE=" + t.TempDir(), "TMPDIR=" + t.TempDir()}
			args := []string{f.file, "--pairs", pairs, f.test}
			before, _ := os.Stat(filepath.Join(f.dir, f.file))
			cutAt(t, f, env, 3, syscall.SIGKILL, args...)
			// red-proof's kill left its mutant in the file; this run never wrote it
			if after, _ := os.Stat(filepath.Join(f.dir, f.file)); !after.ModTime().Equal(before.ModTime()) || readOr(filepath.Join(f.dir, f.file), "") != "package p\n\nconst Limit = 3\n" {
				t.Fatalf("the kill left %s changed", f.file)
			}
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

// every entry's size, mode, mtime, link target and content hash under the roots, links not followed; git's own dir is git's, so it stays out
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
				target, _ := os.Readlink(path)
				var hash [sha256.Size]byte
				if info.Mode().IsRegular() {
					body, _ := os.ReadFile(path)
					hash = sha256.Sum256(body)
				}
				seen[path] = fmt.Sprintf("%d %v %d →%s %x", info.Size(), info.Mode(), info.ModTime().UnixNano(), target, hash[:6])
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

// a repo whose node_modules is its own, as a pnpm install leaves it: a shim at the root and in one workspace package, pnpm's state
// files and run records, one store entry, and a git hook, plus a shim that is a link, as npm leaves one, and a package whose .bin is a link to the
// root's; relink.sh does to the tree it runs in what an install does, then reads the mutated file
func shimsFixture(t *testing.T) (redFixture, []string) {
	t.Helper()
	dir := repo(t)
	write(t, filepath.Join(dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(dir, "lib.js"), "export const limit = 3;\n")
	for _, modules := range []string{"node_modules", "pkg/node_modules"} {
		// as pnpm's shim does, it finds its package from the dir it really sits in
		write(t, filepath.Join(dir, modules, ".bin/tool"), "#!/bin/sh\nexec node \"$(cd \"$(dirname \"$0\")\" && pwd -P)/../tool/index.js\"\n")
	}
	// the two state files and the dir of run records pnpm keeps beside them
	for _, state := range []string{".modules.yaml", ".pnpm-workspace-state-v1.json", ".pnpm-task-run-state-v1/latest.json"} {
		write(t, filepath.Join(dir, "node_modules", state), "state\n")
	}
	write(t, filepath.Join(dir, "node_modules/.pnpm/tool@1.0.0/node_modules/tool/index.js"), "console.log('tool');\n")
	if err := os.Symlink(".pnpm/tool@1.0.0/node_modules/tool", filepath.Join(dir, "node_modules/tool")); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "hoisted/node_modules/.modules.yaml"), "state\n")
	for link, target := range map[string]string{"node_modules/.bin/linked": "../tool/index.js", "hoisted/node_modules/.bin": "../../node_modules/.bin"} {
		if err := os.Symlink(target, filepath.Join(dir, link)); err != nil {
			t.Fatal(err)
		}
	}
	// a tripwire: the copy's repo starts with no hooks, so only a command that reaches out of the copy could write one
	hooks := filepath.Join(dir, ".git", "hooks")
	write(t, filepath.Join(hooks, "pre-commit"), "#!/bin/sh\nexec node_modules/.bin/tool\n")
	write(t, filepath.Join(dir, "relink.sh"), `[ -e node_modules/.bin/added ] || [ -L node_modules/.bin/linked ] || echo "the link shim reached the copy as a file" >> "$VERIFY_LOG"
[ -e node_modules/.bin/added ] || hoisted/node_modules/.bin/tool > /dev/null 2>&1 || echo "the shim behind a linked .bin lost its package" >> "$VERIFY_LOG"
for modules in node_modules pkg/node_modules hoisted/node_modules; do
	for shim in "$modules"/.bin/*; do
		[ ! -L "$shim" ] || rm "$shim"
		printf '#!/bin/sh\nexec node "%s"\n' "$PWD/$modules/tool/index.js" > "$shim"
	done
	echo added > "$modules/.bin/added"
done
mkdir -p node_modules/.pnpm-task-run-state-v1
for state in .modules.yaml .pnpm-workspace-state-v1.json .pnpm-task-run-state-v1/latest.json .pnpm-task-run-state-v1/run.finished; do
	echo "$PWD" > "node_modules/$state"
done
echo "$PWD" >> "$VERIFY_LOG"
[ -z "$HANG" ] || sleep 60
grep -q 'limit = 3' lib.js
`)
	commitAll(t, dir)
	f := redFixture{dir: dir, file: "lib.js", anchor: "limit = 3", replacement: "limit = 4"}
	return f, []string{filepath.Join(dir, "node_modules"), filepath.Join(dir, "pkg/node_modules"), filepath.Join(dir, "hoisted/node_modules"), hooks}
}

// FRM-554: a command that rewrites the shims and pnpm's state, as the install behind a `pnpm exec` does, writes the copy's own; the
// real ones keep their bytes whether the run finishes or is cut mid-command, since nothing repairs the real tree after a run
func TestVerifyRedKeepsTheRealShimsFromACommandThatRelinksThem(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		cut  syscall.Signal
	}{
		{"a finished run", 0},
		{"a run cut by an interrupt", syscall.SIGINT},
		{"a run cut by a kill", syscall.SIGKILL},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f, watched := shimsFixture(t)
			log := filepath.Join(t.TempDir(), "verify.log")
			args := []string{f.file, f.anchor, f.replacement, "--", "sh", "relink.sh"}
			before := treeWrites(t, watched...)

			if c.cut == 0 {
				got := xIn(t, f.dir, []string{"VERIFY_LOG=" + log}, append([]string{"verify", "red"}, args...)...)
				if got.data["verdict"] != verdictFailed {
					t.Fatalf("data %v, want the mutant's run read failed:\n%s", got.data, got.stdout)
				}
			} else {
				// a kill skips x's own cleanup, so the copy it leaves dies with the test
				cutAt(t, f, []string{"VERIFY_LOG=" + log, "HANG=1", "X_STATE=" + t.TempDir(), "TMPDIR=" + t.TempDir()}, 1, c.cut, args...)
			}

			if ran := readOr(log, ""); ran == "" || strings.Contains(ran, f.dir+"\n") || strings.Contains(ran, "shim") {
				t.Fatalf("the command logged %q, want a run in the copy, its link shim a link and its linked .bin's shim running, and none in the real tree", ran)
			}
			wantNoWrites(t, before, treeWrites(t, watched...))
		})
	}
}

func wantNoWrites(t *testing.T, before, after map[string]string) {
	t.Helper()
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
}

// the go fixture as a pnpm workspace with no dependency but its own package, installed by the real pnpm, offline, from a planted
// lockfile: the shim pnpm wrote runs the go test. autoDedupe is frame's setting, which no lockfile records, so pnpm installs
// again before every run and exec
func pnpmWorkspaceFixture(t *testing.T) (redFixture, []string) {
	t.Helper()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(f.dir, "package.json"), `{"name": "p", "private": true, "scripts": {"limit": "limit-test"}, "devDependencies": {"runner": "workspace:*"}}`+"\n")
	write(t, filepath.Join(f.dir, "pnpm-workspace.yaml"), "packages:\n  - runner\nautoDedupe: true\n")
	write(t, filepath.Join(f.dir, "pnpm-lock.yaml"), `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    devDependencies:
      runner:
        specifier: workspace:*
        version: link:runner

  runner: {}
`)
	write(t, filepath.Join(f.dir, "runner/package.json"), `{"name": "runner", "version": "1.0.0", "bin": {"limit-test": "limit-test.sh"}}`+"\n")
	write(t, filepath.Join(f.dir, "runner/limit-test.sh"), "#!/bin/sh\nexec go test -v .\n")
	install := exec.Command("pnpm", "install", "--offline", "--frozen-lockfile")
	install.Dir, install.Env = f.dir, cleanEnv()
	if out, err := install.CombinedOutput(); err != nil {
		t.Fatalf("pnpm install in the fixture: %v\n%s", err, out)
	}
	commitAll(t, f.dir)
	return f, []string{filepath.Join(f.dir, "node_modules"), filepath.Join(f.dir, ".git", "hooks")}
}

// FRM-554: pnpm in the copy runs the command and installs nothing, so the store the copy shares with the real tree is never relinked
func TestVerifyRedRunsAPnpmCommandWithNoInstall(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		env     []string
		command []string
	}{
		{"the caller's env leaves the setting alone", nil, []string{"pnpm", "exec", "limit-test"}},
		{"the caller's env asks for the install, in the spelling pnpm puts first", []string{"PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=install"}, []string{"pnpm", "exec", "limit-test"}},
		{"a word after the subcommand that names a store write", nil, []string{"pnpm", "exec", "limit-test", "install"}},
		{"a script through run", nil, []string{"pnpm", "run", "limit"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f, watched := pnpmWorkspaceFixture(t)
			before := treeWrites(t, watched...)

			got, log := verifyRedIn(t, f, c.env, append([]string{f.file, f.anchor, f.replacement, "--"}, c.command...)...)

			if got.code != 0 || got.data["verdict"] != verdictRed || log != "1\n1\n" {
				t.Fatalf("exit %d, data %v, the test logged %q, want red off a clean and a mutated run:\n%s", got.code, got.data, log, got.stdout)
			}
			wantNoWrites(t, before, treeWrites(t, watched...))
		})
	}
}

// FRM-554: the copy shares the store, so a pnpm command that may write it would write the real tree's: any but a plain run as
// pnpm's first word refuses before any run
func TestVerifyRedRefusesAPnpmCommandThatWritesTheStore(t *testing.T) {
	t.Parallel()
	f, watched := shimsFixture(t)
	before := treeWrites(t, watched...)
	for _, command := range [][]string{
		{"pnpm", "install"}, {"pnpm", "i"}, {"pnpm", "add", "left-pad"}, {"pnpm", "remove", "tool"}, {"pnpm", "rm", "tool"},
		{"pnpm", "uni", "tool"}, {"pnpm", "update"}, {"pnpm", "up"}, {"pnpm", "dedupe"}, {"pnpm", "ci"},
		// the subcommand behind pnpm's own flags, a flag's value before it, and pnpm by its path or in another case
		{"pnpm", "--frozen-lockfile", "install"}, {"pnpm", "--filter", "pkg", "add", "left-pad"}, {"pnpm", "-C", ".", "install"},
		{"/opt/homebrew/bin/pnpm", "install"}, {"PNPM", "install"},
		// a write behind a prefix subcommand, a bare pnpm, which installs, and a flag's value that reads as a run
		{"pnpm", "m", "install"}, {"pnpm", "recursive", "install"}, {"pnpm", "with", "12.16.1", "install"}, {"pnpm"},
		{"pnpm", "--filter", "exec", "install"},
		// what installs or builds under another name, and a bin by pnpm's shorthand, which no read can tell from one
		{"pnpm", "pipeline"}, {"pnpm", "deploy", "out"}, {"pnpm", "approve-builds"}, {"pnpm", "vitest", "run"},
		// a package manager behind a run, behind a launcher, or as one word of a shell line
		{"pnpm", "exec", "pnpm", "install"}, {"pnpm", "exec", "npm", "i"}, {"env", "X=1", "pnpm", "install"},
		{"corepack", "pnpm", "install"}, {"npx", "pnpm", "install"}, {"sh", "-c", "pnpm install"}, {"pnpm", "exec", "sh", "-c", "pnpm install"},
		// a shell word glued to its neighbour by an operator or a quote
		{"sh", "-c", "true;pnpm install"}, {"bash", "-c", "cd .&&pnpm i"}, {"sh", "-c", "echo $(npm i)"}, {"sh", "-c", `"pnpm" i`},
	} {
		got, log := verifyRedIn(t, f, nil, append([]string{f.file, f.anchor, f.replacement, "--"}, command...)...)

		if got.code != 2 || !strings.Contains(got.stdout, "node_modules/.pnpm") || log != "" {
			t.Errorf("%v: exit %d, the command logged %q, want a usage refusal naming the store and no run:\n%s", command, got.code, log, got.stdout)
		}
	}
	wantNoWrites(t, before, treeWrites(t, watched...))
}

// a script behind a plain `pnpm run` is read by no argv check, so a package manager it calls is refused as it runs
func TestVerifyRedRefusesAPackageManagerAScriptCalls(t *testing.T) {
	t.Parallel()
	f, watched := pnpmWorkspaceFixture(t)
	write(t, filepath.Join(f.dir, "package.json"), `{"name": "p", "private": true, "scripts": {"limit": "pnpm i && limit-test"}, "devDependencies": {"runner": "workspace:*"}}`+"\n")
	commitAll(t, f.dir)
	before := treeWrites(t, watched...)

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, "--", "pnpm", "run", "limit")

	if got.code != 1 || got.data["verdict"] != nil || log != "" || !strings.Contains(got.stdout, "may write the store") {
		t.Fatalf("exit %d, data %v, the test logged %q, want the script's pnpm i refused before the test ran:\n%s", got.code, got.data, log, got.stdout)
	}
	wantNoWrites(t, before, treeWrites(t, watched...))
}

// a shell line no word read can take apart still meets the shim: any command after -- runs with the guard first on PATH
func TestVerifyRedRefusesAPackageManagerAShellLineHides(t *testing.T) {
	t.Parallel()
	f, watched := pnpmWorkspaceFixture(t)
	before := treeWrites(t, watched...)

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, "--", "sh", "-c", `pn""pm i && limit-test`)

	if got.code != 1 || log != "" || !strings.Contains(got.stdout, "may write the store") {
		t.Fatalf("exit %d, the test logged %q, want the hidden pnpm i refused before the test ran:\n%s", got.code, log, got.stdout)
	}
	wantNoWrites(t, before, treeWrites(t, watched...))
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

// FRM-572 exit 11: the copy carries a repo at the tree's HEAD, so a test that runs git, as x/go's lefthook.yaml readers do,
// reads its clean run green and its swap red
func TestVerifyRedRunsATestThatRunsGitOnTheCopy(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "hook.yaml"), "count: 1\n")
	write(t, filepath.Join(dir, "sub/go.mod"), "module p\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "sub/hook_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"os/exec\"\n\t\"testing\"\n)\n\nfunc TestHook(t *testing.T) {\n\tif out, err := exec.Command(\"git\", \"ls-files\", \"--error-unmatch\", \"../hook.yaml\").CombinedOutput(); err != nil {\n\t\tt.Fatalf(\"git: %v %s\", err, out)\n\t}\n\tif body, _ := os.ReadFile(\"../hook.yaml\"); string(body) != \"count: 1\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, dir)

	got, _ := verifyRedIn(t, redFixture{dir: dir}, nil, "hook.yaml", "count: 1", "count: 2", "sub/hook_test.go")

	if rows := pairRows(t, got); got.code != 0 || got.data["verdict"] != verdictRed || len(rows) != 1 {
		t.Fatalf("exit %d, data %v, want a green clean run and a red swap:\n%s", got.code, got.data, got.stdout)
	}
}
