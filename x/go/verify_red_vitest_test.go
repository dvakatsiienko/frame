package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
