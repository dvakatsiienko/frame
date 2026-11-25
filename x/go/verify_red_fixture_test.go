package main

import (
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

func pairsFile(t *testing.T, lines ...string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "pairs.tsv")
	write(t, path, "# a comment\n\n"+strings.Join(lines, "\n")+"\n")
	return path
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
