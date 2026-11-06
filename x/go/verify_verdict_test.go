package main

import (
	"os"
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
	holds := func(symbol string) bool { return symbol != "lacked" && symbol != "lackedVar" && symbol != "read" }
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
		{"vitest: a new test that passed", wordsVitestRed, false, []string{"asserts", "holds"}, verdictBroken,
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
		{"a test edited in place adds no name", wordsGoRed, false, nil, verdictRed, map[string]string{"TestNew": verdictRed, "TestNew/a_case": verdictRed}},
		{"a name that only starts the same is another test", wordsGoRed, false, []string{"TestNewer"}, verdictStillGreen, map[string]string{"TestNewer": verdictStillGreen}},
		{"color codes around a row", "\x1b[31m FAIL  a.test.ts > one\x1b[39m\n", false, []string{"one"}, verdictRed, map[string]string{"one": verdictRed}},
		{"an empty run that exits 0", "", true, []string{"a"}, verdictBroken, map[string]string{"a": verdictBroken}},
		{"an empty run that exits red", "", false, []string{"a"}, verdictFailed, map[string]string{"a": verdictFailed}},
		{"a tally and a red exit, nothing named", "Ran 3 tests across 1 file. [1ms]\n", false, []string{"a"}, verdictFailed, map[string]string{"a": verdictFailed}},
		{"no new test and a green run", "ok  \tx\t0.1s\n", true, nil, verdictStillGreen, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()

			verdict, rows := judgeRun(c.log, c.exitedOK, c.newTests, holds)

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

	verdict, rows := judgeRun(string(raw), false, []string{"a breaks"}, func(string) bool { return true })

	if verdict != verdictBroken || !strings.Contains(rows[0].Why, "did not load") {
		t.Fatalf("the sample holds a file that did not load: %s, %+v", verdict, rows)
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
			got := strings.Join(newTestNames(main, fork, head, c.swapped), " ")

			if got != c.want {
				t.Fatalf("read %q, want %q", got, c.want)
			}
		})
	}
}
