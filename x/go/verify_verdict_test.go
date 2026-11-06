package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// the output blocks are real runs: vitest 5.0.5, claude plugin test, go test
const (
	wordsVitestRed = ` ❯ a.test.ts (3 tests | 2 failed) 4ms
   ❯ group (3)
     × asserts 3ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  a.test.ts > group > asserts
AssertionError: expected 1 to be 2 // Object.is equality
⎯⎯⎯[1/2]⎯

 FAIL  a.test.ts > group > calls a lacked export
TypeError: lacked is not a function
 ❯ a.test.ts:5:52

 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
`
	wordsVitestLoad = ` ❯ b.test.ts (0 test)
⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  b.test.ts [ b.test.ts ]
Error: Cannot find module './gone.ts' imported from b.test.ts
 Test Files  1 failed (1)
      Tests  no tests
`
	wordsVitestSuiteThrow = ` FAIL  b.test.ts [ b.test.ts ]
TypeError: read is not a function
      Tests  no tests
`
	wordsVitestNone = "No test files found, exiting with code 1\nfilter: none.test.ts\n"
	wordsPluginRed  = `tests/zz.test.ts:
(fail) zz asserts [2.11ms]
  AssertionError: expect(received).toBe()
(fail) zz calls a lacked export [0.15ms]
  TypeError: lib.lacked is not a function. (In 'lib.lacked()', 'lib.lacked' is undefined)
(fail) zz reads a lacked variable [0.10ms]
  ReferenceError: lackedVar is not defined

 24 pass
 3 fail
Ran 27 tests across 3 files. [5.55s]
`
	wordsPluginLoad = `tests/zy.test.ts:
(fail) the file did not load
  Export named 'lackedNamed' not found in module 'hooks/zzlib.ts'.
`
	wordsGoRed = `--- FAIL: TestNew (0.00s)
    --- FAIL: TestNew/a_case (0.00s)
        x_test.go:9: got 1
FAIL
FAIL	x	0.2s
`
	wordsGoBuild = "# x [x.test]\n./x_test.go:3:2: undefined: helper\nFAIL\tx [build failed]\n"
	wordsGoNone  = "ok  \tx\t0.1s [no tests to run]\n"
)

func TestJudgeRunReadsEachRunnersWords(t *testing.T) {
	t.Parallel()
	const source = "export const present = 1;\nexport const data = JSON.parse('1');\nfunction base() {}\n"
	const headSource = source + "export const CONFIG = { field: 1 };\n"
	cases := []struct {
		name     string
		log      string
		exitedOK bool
		newTests []string
		verdict  string
		rows     map[string]string
	}{
		{"vitest: a row under a describe, a lacked export", wordsVitestRed, false, []string{"asserts", "calls a lacked export"}, verdictBroken,
			map[string]string{"asserts": verdictRed, "calls a lacked export": verdictBroken}},
		{"vitest: a new test that passed", wordsVitestRed, false, []string{"asserts", "holds"}, verdictStillGreen,
			map[string]string{"asserts": verdictRed, "holds": verdictStillGreen}},
		{"vitest: a missing module", wordsVitestLoad, false, []string{"never"}, verdictBroken, map[string]string{"never": verdictBroken}},
		{"vitest: a suite that threw reads no test as red, with no new name to hold it", wordsVitestSuiteThrow, false, nil, verdictBroken, nil},
		{"vitest: no test file", wordsVitestNone, false, []string{"never"}, verdictBroken, map[string]string{"never": verdictBroken}},
		{"plugin test: a dotted name and a variable", wordsPluginRed, false, []string{"zz asserts", "zz calls a lacked export", "zz reads a lacked variable"}, verdictBroken,
			map[string]string{"zz asserts": verdictRed, "zz calls a lacked export": verdictBroken, "zz reads a lacked variable": verdictBroken}},
		{"plugin test: a file that did not load", wordsPluginLoad, false, []string{"zy"}, verdictBroken, map[string]string{"zy": verdictBroken}},
		{"mods:test: a failing row and its tally", "x-mod-a:\ntests/a.test.ts:\n(fail) a row\n\nmods:test: red in x-mod-a, 3 pass, 1 fail\n", false, []string{"a row"}, verdictRed,
			map[string]string{"a row": verdictRed}},
		{"mods:test: a green tally leaves the new test still green", "mods:test: 1 mods green, 3 pass, 0 fail\n", true, []string{"a row"}, verdictStillGreen,
			map[string]string{"a row": verdictStillGreen}},
		{"mods:test: no tally", "mods:test: red in x-mod-a (no tally), 0 pass, 0 fail\n", false, []string{"a row"}, verdictBroken, map[string]string{"a row": verdictBroken}},
		{"go: a parent and its subtest", wordsGoRed, false, []string{"TestNew"}, verdictRed, map[string]string{"TestNew": verdictRed}},
		{"go: a build break", wordsGoBuild, false, []string{"TestNew"}, verdictBroken, map[string]string{"TestNew": verdictBroken}},
		{"go: no test matched", wordsGoNone, true, []string{"TestNew"}, verdictBroken, map[string]string{"TestNew": verdictBroken}},
		{"a test edited in place adds no name, so it proves nothing alone", wordsGoRed, false, nil, verdictBroken, map[string]string{"TestNew": verdictRed, "TestNew/a_case": verdictRed}},
		{"a name that only starts the same is another test", wordsGoRed, false, []string{"TestNewer"}, verdictStillGreen, map[string]string{"TestNewer": verdictStillGreen}},
		{"plugin test: a timeout is load, no proof", "(fail) slow [5002.31ms]\n  Error: timed out after 5000 ms\n(fail) fast [1.0ms]\n  AssertionError: no\nRan 2 tests across 1 file.\n", false, []string{"slow", "fast"}, verdictBroken,
			map[string]string{"slow": verdictBroken, "fast": verdictRed}},
		{"vitest: a timeout is load, no proof", " FAIL  a.test.ts > slow\nError: Test timed out in 5000ms.\n", false, []string{"slow"}, verdictBroken, map[string]string{"slow": verdictBroken}},
		{"a template name holds each row it expanded to", "(fail) a door: gh pr merge 12\n  AssertionError: no\n(fail) a door: x as codie\n  AssertionError: no\n(fail) other row\n  AssertionError: no\n", false, []string{"a door: ${typed}", "no hint: ${typed}"}, verdictStillGreen,
			map[string]string{"a door: gh pr merge 12": verdictRed, "a door: x as codie": verdictRed, "no hint: ${typed}": verdictStillGreen, "other row": verdictRed}},
		{"a load word in a passing title", "(pass) names a file that did not load\n(fail) one\n  AssertionError: no\nRan 2 tests across 1 file.\n", false, []string{"one"}, verdictRed, map[string]string{"one": verdictRed}},
		{"a load word in a failing title", "(fail) names a file that did not load\n  AssertionError: no\n", false, []string{"names a file that did not load"}, verdictRed, map[string]string{"names a file that did not load": verdictRed}},
		{"a plugin title holding the vitest arrow", "tests/w.test.ts:\n(fail) a > after a write\n  AssertionError: no\n", false, []string{"a > after a write"}, verdictRed, map[string]string{"a > after a write": verdictRed}},
		{"a destructure of a field only head binds", " FAIL  a.test.ts > one\nTypeError: Cannot destructure property 'field' of 'lib.CONFIG' as it is undefined.\n", false, []string{"one"}, verdictBroken, map[string]string{"one": verdictBroken}},
		{"an iteration of a name only head binds", " FAIL  a.test.ts > one\nTypeError: lib.CONFIG is not iterable\n", false, []string{"one"}, verdictBroken, map[string]string{"one": verdictBroken}},
		{"a call vite rewrote", " FAIL  a.test.ts > one\nTypeError: (0 , __vi_import_0__.parse) is not a function\n", false, []string{"one"}, verdictBroken, map[string]string{"one": verdictBroken}},
		{"a test that throws from json parse is a red", " FAIL  a.test.ts > one\nSyntaxError: Unexpected token o in JSON at position 1\n", false, []string{"one"}, verdictRed, map[string]string{"one": verdictRed}},
		{"color codes around a row", "\x1b[31m FAIL  a.test.ts > one\x1b[39m\n", false, []string{"one"}, verdictRed, map[string]string{"one": verdictRed}},
		{"an empty run that exits 0", "", true, []string{"a"}, verdictBroken, map[string]string{"a": verdictBroken}},
		{"an empty run that exits red", "", false, []string{"a"}, verdictFailed, map[string]string{"a": verdictFailed}},
		{"a tally and a red exit, nothing named", "Ran 3 tests across 1 file. [1ms]\n", false, []string{"a"}, verdictFailed, map[string]string{"a": verdictFailed}},
		{"no new test and a green run", "ok  \tx\t0.1s\n", true, nil, verdictBroken, nil},
		{"an old test red beside no new test is no proof", "(fail) old row\n  AssertionError: no\nRan 2 tests across 1 file.\n", false, nil, verdictBroken, map[string]string{"old row": verdictRed}},
		{"an old test red beside a green new test is no proof", "(fail) old row\n  AssertionError: no\n", false, []string{"new row"}, verdictStillGreen,
			map[string]string{"old row": verdictRed, "new row": verdictStillGreen}},
		{"an old test's break does not outvote a red new test", "(fail) old row\n  Error: timed out after 5000 ms\n(fail) new row\n  AssertionError: no\n", false, []string{"new row"}, verdictRed,
			map[string]string{"old row": verdictBroken, "new row": verdictRed}},
		{"a failed row on a command that exited 0", "--- FAIL: TestNew (0.00s)\n", true, []string{"TestNew"}, verdictFailed, map[string]string{"TestNew": verdictFailed}},
		{"a word only the source's calls hold is lacked", " FAIL  a.test.ts > one\nTypeError: parse is not a function\n", false, []string{"one"}, verdictBroken, map[string]string{"one": verdictBroken}},
		{"a function the source binds is a real red", " FAIL  a.test.ts > one\nTypeError: base is not a function\n", false, []string{"one"}, verdictRed, map[string]string{"one": verdictRed}},
		{"a field only head binds", " FAIL  a.test.ts > one\nTypeError: Cannot read properties of undefined (reading 'field')\n", false, []string{"one"}, verdictBroken, map[string]string{"one": verdictBroken}},
		{"a field neither side binds is a real red", " FAIL  a.test.ts > one\nTypeError: Cannot read properties of undefined (reading 'length')\n", false, []string{"one"}, verdictRed, map[string]string{"one": verdictRed}},
		{"javascriptcore's words for a field only head binds", "(fail) one\n  TypeError: undefined is not an object (evaluating 'lib.CONFIG.field')\n", false, []string{"one"}, verdictBroken, map[string]string{"one": verdictBroken}},
		{"an each title's hole matches its row", " FAIL  a.test.ts > green each 1\nAssertionError: no\n", false, []string{"green each %s"}, verdictStillGreen, map[string]string{"a.test.ts > green each 1": verdictRed, "green each %s": verdictStillGreen}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			verdict, rows := judgeRun(c.log, c.exitedOK, namedAnywhere(c.newTests), swappedSource{source, headSource})

			if verdict != c.verdict {
				t.Errorf("the run reads %q, want %q: %+v", verdict, c.verdict, rows)
			}
			got := map[string]string{}
			for _, row := range rows {
				got[row.Name] = row.Verdict
			}
			for name, want := range c.rows {
				if got[name] != want {
					t.Errorf("%q reads %q, want %q: %+v", name, got[name], want, rows)
				}
			}
		})
	}
}

// the sample both other readers of claude plugin test's words are held to (`mods/plugin-test.sample.txt`)
func TestJudgeRunReadsThePluginTestSample(t *testing.T) {
	t.Parallel()
	raw, err := os.ReadFile("../../home/.claude/plugin-x/mods/plugin-test.sample.txt")
	if err != nil {
		t.Fatal(err)
	}

	verdict, rows := judgeRun(string(raw), false, namedAnywhere([]string{"a breaks"}), swappedSource{})

	if verdict != verdictBroken || !strings.Contains(rows[0].Why, "did not load") {
		t.Fatalf("the sample holds a file that did not load: %s, %+v", verdict, rows)
	}
}

func namedAnywhere(names []string) []newTest {
	tests := make([]newTest, len(names))
	for i, name := range names {
		tests[i] = newTest{Name: name}
	}
	return tests
}

func TestJudgeRunReadsGoCasesAndTables(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, log string
		test      newTest
		want      string
	}{
		{"a go case that failed", "--- FAIL: TestOld (0.00s)\n    --- FAIL: TestOld/new_case (0.00s)\nFAIL\n", newTest{Name: "new case", File: "a_test.go"}, verdictRed},
		{"a go case that passed", "--- FAIL: TestOld (0.00s)\n    --- FAIL: TestOld/other (0.00s)\nFAIL\n", newTest{Name: "new case", File: "a_test.go"}, verdictStillGreen},
		{"a suite method that failed", "--- FAIL: TestSuite (0.00s)\n    --- FAIL: TestSuite/TestMethod (0.00s)\nFAIL\n", newTest{Name: "TestMethod", File: "a_test.go"}, verdictRed},
		{"a js title is no go case", " FAIL  a.test.ts > dir/name\nAssertionError: no\n", newTest{Name: "name", File: "a.test.ts"}, verdictStillGreen},
		{"a table with no hole in its title", " FAIL  a.test.ts > rows\nAssertionError: no\n", newTest{Name: "rows", File: "a.test.ts", IsTable: true}, verdictStillGreen},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			verdict, rows := judgeRun(c.log, false, []newTest{c.test}, swappedSource{})

			if verdict != c.want {
				t.Fatalf("reads %q, want %q: %+v", verdict, c.want, rows)
			}
		})
	}
}

// the same title in two files: a failure holds only the test in its own file
func TestJudgeRunTellsTwoFilesApart(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, log, file, want string
	}{
		{"vitest, another file", " FAIL  old.test.ts > handles empty\nAssertionError: no\n", "new.test.ts", verdictStillGreen},
		{"vitest, its file", " FAIL  lib/new.test.ts > group > handles empty\nAssertionError: no\n", "script/lib/new.test.ts", verdictRed},
		{"plugin test, another file", "tests/old.test.ts:\n(fail) handles empty\n  AssertionError: no\n", "mods/m/tests/new.test.ts", verdictStillGreen},
		{"plugin test, its file", "tests/new.test.ts:\n(fail) handles empty\n  AssertionError: no\n", "mods/m/tests/new.test.ts", verdictRed},
		{"a suffix that is no path segment", " FAIL  new.test.ts > handles empty\nAssertionError: no\n", "renew.test.ts", verdictStillGreen},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			verdict, rows := judgeRun(c.log, false, []newTest{{Name: "handles empty", File: c.file}}, swappedSource{})

			if verdict != c.want {
				t.Fatalf("reads %q, want %q: %+v", verdict, c.want, rows)
			}
		})
	}
}

func TestAddedTestNamesReadsEachShape(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, added string
		want        []string
		computed    []string
	}{
		{"a plain name", "    it('a plain name', () => {", []string{"a plain name"}, nil},
		{"a double quote holding an apostrophe", `test("head's red", () => {`, []string{"head's red"}, nil},
		{"a template with a quote in its hole", "    test(`a door: ${typed.split(' ')[0]}`, () => {", []string{"a door: ${typed.split(' ')[0]}"}, nil},
		{"an escaped quote", `    it.only('it\'s escaped', () => {`, []string{`it's escaped`}, nil},
		{"each with a table", "it.each([1])('green each %s', (n) => {", []string{"green each %s"}, nil},
		{"a title on its own line", "it(\n  'green multiline',\n  () => {", []string{"green multiline"}, nil},
		{"after a loop on one line", "for (const n of ['a']) { it('in a loop', () => {}); }", []string{"in a loop"}, nil},
		{"a computed title", "for (const n of ['a']) { it(n + ' green', () => {}); }", nil, []string{"n + ' green'"}},
		{"a variable title", "test(title, () => {", nil, []string{"title"}},
		{"two on one line", "it('one', f); it('two', f);", []string{"one", "two"}, nil},
		{"a go test", "func TestNewOne(t *testing.T) {", []string{"TestNewOne"}, nil},
		{"a go helper", "func helper(t *testing.T) {", nil, nil},
		{"a go suite method", "func (s *S) TestMethod(t *testing.T) {", []string{"TestMethod"}, nil},
		{"a go case", `	t.Run("new case", func(t *testing.T) {`, []string{"new case"}, nil},
		{"a go case with a computed name", "	t.Run(c.name, func(t *testing.T) {", nil, nil},
		{"a tagged each table", "it.each`a | b`('rows $a', f);", []string{"rows $a"}, nil},
		{"a go call named test", `test(t, "x")`, nil, nil},
		{"a js helper named test", "function test(name, fn) {", nil, nil},
		{"a regex's test method", "expect(/a/.test('abc')).toBe(true);", nil, nil},
		{"a commented test", "// it('gone', f);", nil, nil},
		{"a word ending in it", "submit('x');", nil, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			var names, computed []string
			file := "a.test.ts"
			if strings.Contains(c.name, "go ") {
				file = "a_test.go"
			}
			for _, test := range addedTestNames(c.added, file) {
				if test.IsComputed {
					computed = append(computed, test.Name)
				} else {
					names = append(names, test.Name)
				}
			}

			if strings.Join(names, "|") != strings.Join(c.want, "|") || strings.Join(computed, "|") != strings.Join(c.computed, "|") {
				t.Fatalf("read %q and computed %q, want %q and %q", names, computed, c.want, c.computed)
			}
		})
	}
}

func TestReleaseKeepsAClaimNamingFiles(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		claim treeClaim
		kept  bool
	}{
		{"a clean run", treeClaim{Pid: 1}, false},
		{"a failed restore", treeClaim{Pid: 1, Files: []string{"gone.txt"}}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			path := filepath.Join(t.TempDir(), "claim.json")
			raw, _ := json.Marshal(c.claim)
			write(t, path, string(raw))

			releaseClaim(path)

			if exists(path) != c.kept {
				t.Fatalf("the claim exists %v, want %v", exists(path), c.kept)
			}
		})
	}
}

func TestAComputedTitleNeverProves(t *testing.T) {
	t.Parallel()

	verdict, rows := judgeRun(" FAIL  a.test.ts > real\nAssertionError: no\n", false, []newTest{{Name: "real"}, {Name: "title", IsComputed: true}}, swappedSource{})

	if verdict != verdictStillGreen || len(rows) != 2 || !strings.Contains(rows[1].Why, "computed") {
		t.Fatalf("reads %q: %+v, want a row naming the computed title", verdict, rows)
	}
}

func TestUsageNamesTheDash(t *testing.T) {
	t.Parallel()
	for _, verb := range verbs {
		if verb.Name == "lane verify-tree" && !strings.Contains(verb.Usage, "[-- <command…>]") {
			t.Fatalf("usage reads %q", verb.Usage)
		}
	}
}

func TestNewTestNamesReadsTheAddedLines(t *testing.T) {
	t.Parallel()
	main, head, _ := revertWorld(t)
	fork := gitT(t, main, "merge-base", "main", head)
	cases := []struct {
		name    string
		swapped []string
		want    string
	}{
		{"a test file outside the swap", nil, "TestNewOne TestNewTwo"},
		{"a test file inside the swap", []string{"probe_test.go"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var names []string
			for _, test := range newTestNames(main, fork, head, c.swapped) {
				names = append(names, test.Name)
			}
			got := strings.Join(names, " ")

			if got != c.want {
				t.Fatalf("read %q, want %q", got, c.want)
			}
		})
	}
}
