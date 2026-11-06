package main

import (
	"regexp"
	"slices"
	"strings"
)

// the proof words: red, still green, broken, failed (GLOSSARY.md)
const (
	verdictRed        = "red"
	verdictStillGreen = "still green"
	verdictBroken     = "broken"
	verdictFailed     = "failed"
)

type testRow struct {
	Name    string `json:"name"`
	Verdict string `json:"verdict"`
	Why     string `json:"why,omitempty"`
}

type failedTest struct{ name, output string }

// one run's output as the runners word it: claude plugin test, pnpm mods:test, go test, vitest
type testOutput struct {
	failed []failedTest
	// a line that says the tests never loaded, whatever they would have read
	load string
	// a runner's own words say a test ran
	ran bool
	// a runner's own words say none did
	none bool
}

var (
	failedRow = []*regexp.Regexp{regexp.MustCompile(`^\(fail\) (.+?)(?: \[[\d.]+ms\])?$`), regexp.MustCompile(`^\s*--- FAIL: (\S+)`), regexp.MustCompile(`^ FAIL  (.+?)\s*$`)}
	passedRow = regexp.MustCompile(`^\(pass\) |^\s*--- PASS: | ✓ `)
	// the last alternative is vitest's row for a suite that threw before any test ran
	loadError   = regexp.MustCompile(`SyntaxError|did not load|Cannot find module|Cannot find package|ERR_MODULE_NOT_FOUND|Failed to load|Transform failed|\[setup failed\]|\[build failed\]|hook was skipped: |^ FAIL  .* \[ .* \]$`)
	goPackageOK = regexp.MustCompile(`^ok\s+\S+\s+\S+`)
	testsRan    = regexp.MustCompile(`^\s*Tests\s+.*\d+ (?:passed|failed)|^Ran [1-9]\d* tests? across|^mods:test: .*, (?:[1-9]\d* pass, \d+ fail|\d+ pass, [1-9]\d* fail)`)
	testsNone   = regexp.MustCompile(`no tests to run|no test files|No test files found|^Ran 0 tests|^mods:test: .*, 0 pass, 0 fail|^\s*Tests\s+no tests`)
	// node's words and javascriptcore's, which claude plugin test runs on
	lackedSymbol = []*regexp.Regexp{
		regexp.MustCompile(`([\w$]+) is not a (?:function|constructor)`),
		regexp.MustCompile(`([\w$]+) is not defined`),
		regexp.MustCompile(`Can't find variable: ([\w$]+)`),
	}
	addedTestName = []*regexp.Regexp{
		regexp.MustCompile("^\\+\\s*(?:it|test)(?:\\.\\w+)*\\(\\s*['\"`]((?:[^'\"`\\\\]|\\\\.)+)['\"`]"),
		regexp.MustCompile(`^\+func (Test\w+)\(`),
	}
	testFile = regexp.MustCompile(`(?:\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|_test\.go)$`)
)

func readTestOutput(log string) testOutput {
	var read testOutput
	for line := range strings.SplitSeq(ansiColor.ReplaceAllString(log, ""), "\n") {
		if read.load == "" && loadError.MatchString(line) {
			read.load = strings.TrimSpace(line)
		}
		if testsNone.MatchString(line) {
			read.none = true
		} else if testsRan.MatchString(line) || goPackageOK.MatchString(line) {
			read.ran = true
		}
		if name := failedName(line); name != "" {
			read.ran = true
			read.failed = append(read.failed, failedTest{name: name})
			continue
		}
		if passedRow.MatchString(line) {
			read.ran = true
		}
		if n := len(read.failed); n > 0 {
			read.failed[n-1].output += line + "\n"
		}
	}
	return read
}

func failedName(line string) string {
	for _, row := range failedRow {
		if m := row.FindStringSubmatch(line); m != nil {
			return m[1]
		}
	}
	return ""
}

// a failure's name holds a new test's when it is that test, a go subtest of it, or a vitest row under a describe
func namesTest(failed, name string) bool {
	return failed == name || strings.HasPrefix(failed, name+"/") || strings.HasSuffix(failed, " > "+name)
}

// a throw naming a symbol this source lacks proves the test is new, never that it reads the change
func lackedBy(output string, has func(string) bool) string {
	for _, shape := range lackedSymbol {
		for _, m := range shape.FindAllStringSubmatch(output, -1) {
			if !has(m[1]) {
				return m[1]
			}
		}
	}
	return ""
}

// the run's one verdict and a row per test; red only when every row is
func judgeRun(log string, exitedOK bool, newTests []string, sourceHas func(string) bool) (string, []testRow) {
	read := readTestOutput(log)
	whole := func(verdict, why string) (string, []testRow) {
		names := slices.Clone(newTests)
		if len(names) == 0 {
			names = []string{"the run"}
		}
		rows := make([]testRow, len(names))
		for i, name := range names {
			rows[i] = testRow{name, verdict, why}
		}
		return verdict, rows
	}
	switch {
	case read.load != "":
		return whole(verdictBroken, read.load)
	case read.none && !read.ran:
		return whole(verdictBroken, "0 tests ran")
	case !read.ran && exitedOK:
		return whole(verdictBroken, "the output names no test that ran")
	case !exitedOK && len(read.failed) == 0:
		return whole(verdictFailed, "the command failed and its output names no failed test")
	}
	judged := func(failed failedTest) testRow {
		if symbol := lackedBy(failed.output, sourceHas); symbol != "" {
			return testRow{failed.name, verdictBroken, "it throws on " + symbol + ", which this source lacks"}
		}
		return testRow{Name: failed.name, Verdict: verdictRed}
	}
	var rows []testRow
	claimed := make([]bool, len(read.failed))
	for _, name := range newTests {
		row := testRow{Name: name, Verdict: verdictStillGreen}
		for i, failed := range read.failed {
			if namesTest(failed.name, name) {
				claimed[i] = true
				// a go subtest prints under its parent: the worst of them stands for the test
				if got := judged(failed); row.Verdict != verdictBroken {
					row.Verdict, row.Why = got.Verdict, got.Why
				}
			}
		}
		rows = append(rows, row)
	}
	// a test edited in place adds no name; its failure still gets a row
	for i, failed := range read.failed {
		if !claimed[i] {
			rows = append(rows, judged(failed))
		}
	}
	return worstOf(rows), rows
}

func worstOf(rows []testRow) string {
	worst := verdictStillGreen
	if len(rows) > 0 {
		worst = verdictRed
	}
	for _, row := range rows {
		if row.Verdict == verdictBroken {
			return verdictBroken
		}
		if row.Verdict == verdictStillGreen {
			worst = verdictStillGreen
		}
	}
	return worst
}
