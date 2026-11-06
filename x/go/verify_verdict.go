package main

import (
	"regexp"
	"slices"
	"strings"
)

// the proof words: red, still green, broken, failed, red on head, unread (GLOSSARY.md)
const (
	verdictRed        = "red"
	verdictStillGreen = "still green"
	verdictBroken     = "broken"
	verdictFailed     = "failed"
	verdictRedOnHead  = "red on head"
	verdictUnread     = "unread"
)

type testRow struct {
	Name    string `json:"name"`
	Verdict string `json:"verdict"`
	Why     string `json:"why,omitempty"`
}

// a test the pr adds. IsUnread: no name a runner's output can be matched to, Why says what stands in the way.
// IsTable: one title for many rows, of which x sees only the ones that failed. OldTitles: what its file held at the fork, so a
// placeholder title never claims an old test's row
type newTest struct {
	Name, File, Why   string
	IsUnread, IsTable bool
	OldTitles         []newTest
}

type failedTest struct {
	name, file, output string
	isGo, isVitest     bool
}

// one run's output as the runners word it: claude plugin test, pnpm mods:test, go test, vitest
type testOutput struct {
	failed []failedTest
	// a line that says the tests never loaded, whatever they would have read
	load string
	// a runner's own words say a test ran
	ran bool
	// a runner's own words say none did
	none bool
	// the rows a runner printed as passed; go and vitest's default reporter print few or none
	passed []failedTest
}

var (
	goFailedRow     = regexp.MustCompile(`^\s*--- FAIL: (\S+)`)
	vitestFailedRow = regexp.MustCompile(`^ FAIL  (.+?)\s*$`)
	failedRow       = []*regexp.Regexp{regexp.MustCompile(`^\(fail\) (.+?)(?: \[[\d.]+ms\])?$`), goFailedRow, vitestFailedRow}
	passedRows      = []*regexp.Regexp{regexp.MustCompile(`^\(pass\) (.+?)(?: \[[\d.]+ms\])?$`), regexp.MustCompile(`^\s*--- PASS: (\S+)`), regexp.MustCompile(`(?:^|\s)✓ (.+?)(?: \d+(?:\.\d+)?m?s)?\s*$`)}
	// the last alternative is vitest's row for a suite that threw before any test ran
	loadError   = regexp.MustCompile(`SyntaxError|did not load|Cannot find module|Cannot find package|ERR_MODULE_NOT_FOUND|Failed to load|Transform failed|\[setup failed\]|\[build failed\]|hook was skipped: |^ FAIL  .* \[ .* \]$`)
	goPackageOK = regexp.MustCompile(`^ok\s+\S+\s+\S+`)
	testsRan    = regexp.MustCompile(`^\s*Tests\s+.*\d+ (?:passed|failed)|^Ran [1-9]\d* tests? across|^mods:test: .*, (?:[1-9]\d* pass, \d+ fail|\d+ pass, [1-9]\d* fail)`)
	testsNone   = regexp.MustCompile(`no tests to run|no test files|No test files found|^Ran 0 tests|^mods:test: .*, 0 pass, 0 fail|^\s*Tests\s+no tests`)
	// vitest's and claude plugin test's words for a failed expect, at a line's start so a throw's own message cannot claim them
	assertionWord = regexp.MustCompile(`(?m)^\s*(?:AssertionError\b|Error: Snapshot .* mismatched)`)
	goPanic       = regexp.MustCompile(`(?m)^\s*panic: `)
	// a call opens with its optional `.each(rows)`; the title is one of three quotes, each a group since a placeholder can
	// hold the other two and go's regexp has no backreference, or anything else, which only a run knows
	addedJSTest = regexp.MustCompile("(?:^|[^.\\w$])(?:it|test)((?:\\.\\w+)*)(?:\\([^()]*\\)|`[^`]*`)?\\(\\s*(?:'((?:[^'\\\\]|\\\\.)+)'|\"((?:[^\"\\\\]|\\\\.)+)\"|`((?:[^`\\\\]|\\\\.)+)`|([^'\"`\\s)][^,\\n]*),)")
	addedGoTest = regexp.MustCompile(`(?m)^func (?:\([^)]*\) )?(Test\w+)\(`)
	addedGoCase = regexp.MustCompile(`\bt\.Run\(\s*"([^"]+)"`)
	// a helper a test file declares under a runner's name is no test
	declaredRunner = regexp.MustCompile(`\bfunction\s+(?:it|test)\b`)
	titleEscape    = regexp.MustCompile("\\\\(['\"`])")
	testFile       = regexp.MustCompile(`(?:\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|_test\.go)$`)
	// what a run expands: a template's placeholder anywhere, `%s` and `$name` only in an each table, so `costs $5` stays a title
	templateHole = regexp.MustCompile(`\$\{[^}]*\}?`)
	tableHole    = regexp.MustCompile(`\$\{[^}]*\}?|%[sdifjoO#]|\$\w+`)
)

func addedTestNames(added, file string) []newTest {
	var kept []string
	for line := range strings.SplitSeq(added, "\n") {
		if trimmed := strings.TrimSpace(line); !strings.HasPrefix(trimmed, "//") && !strings.HasPrefix(trimmed, "*") {
			kept = append(kept, line)
		}
	}
	text := strings.Join(kept, "\n")
	var tests []newTest
	if strings.HasSuffix(file, ".go") {
		for _, shape := range []*regexp.Regexp{addedGoTest, addedGoCase} {
			for _, m := range shape.FindAllStringSubmatch(text, -1) {
				tests = append(tests, newTest{Name: m[1], File: file})
			}
		}
		return tests
	}
	for _, m := range addedJSTest.FindAllStringSubmatch(declaredRunner.ReplaceAllString(text, ""), -1) {
		if name := m[2] + m[3] + m[4]; name != "" {
			isTable := strings.Contains(m[1], ".each") || strings.Contains(m[1], ".for")
			tests = append(tests, newTest{Name: titleEscape.ReplaceAllString(name, "$1"), File: file, IsTable: isTable})
		} else {
			tests = append(tests, newTest{Name: strings.TrimSpace(m[5]), File: file, IsUnread: true, Why: "a computed title: x cannot tell its row"})
		}
	}
	return tests
}

func readTestOutput(log string) testOutput {
	var read testOutput
	file := ""
	for line := range strings.SplitSeq(ansiColor.ReplaceAllString(log, ""), "\n") {
		// a title holding a load word is a test's name, never the runner's report; the two rows below are the runner's
		name := failedName(line)
		passedName := firstRowName(passedRows, line)
		isTitle := passedName != "" || (name != "" && name != "the file did not load" && !strings.Contains(name, " [ "))
		// a test that throws from JSON.parse is its own row, never a suite that did not load
		if read.load == "" && !isTitle && loadError.MatchString(line) && !strings.Contains(line, "JSON") {
			read.load = strings.TrimSpace(line)
		}
		if testsNone.MatchString(line) {
			read.none = true
		} else if testsRan.MatchString(line) || goPackageOK.MatchString(line) {
			read.ran = true
		}
		if m := testFileLine.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
			file = m[1]
			continue
		}
		if name != "" {
			read.ran = true
			failed := rowIn(name, file)
			failed.isGo, failed.isVitest = goFailedRow.MatchString(line), vitestFailedRow.MatchString(line)
			read.failed = append(read.failed, failed)
			continue
		}
		if passedName != "" {
			read.ran = true
			read.passed = append(read.passed, rowIn(passedName, file))
		}
		if n := len(read.failed); n > 0 {
			read.failed[n-1].output += line + "\n"
		}
	}
	// vitest prints one error under every row a same-worded failure holds, so an each table's rows share the last one's words
	for i := len(read.failed) - 2; i >= 0; i-- {
		if read.failed[i].isVitest && read.failed[i].output == "" {
			read.failed[i].output = read.failed[i+1].output
		}
	}
	return read
}

func rowIn(name, file string) failedTest {
	if head, _, hasFile := strings.Cut(name, " > "); hasFile && testFile.MatchString(head) {
		file = head
	}
	return failedTest{name: name, file: file}
}

func failedName(line string) string { return firstRowName(failedRow, line) }

func firstRowName(rows []*regexp.Regexp, line string) string {
	for _, row := range rows {
		if m := row.FindStringSubmatch(line); m != nil {
			return m[1]
		}
	}
	return ""
}

// a title split at what a run expands; one part means it holds no hole
func titleParts(test newTest) []string {
	if test.IsTable {
		return tableHole.Split(test.Name, -1)
	}
	return templateHole.Split(test.Name, -1)
}

// a failure holds a new test when its name is that test, a go subtest of it, or a vitest row under a describe, in the
// same file where the runner names one; a title's holes match whatever the run expanded them to, and a title of holes alone
// would match every row of its file, so it matches none
func namesTest(failed failedTest, test newTest) bool {
	if test.IsUnread {
		return false
	}
	if failed.file != "" && test.File != "" && failed.file != test.File && !strings.HasSuffix(test.File, "/"+failed.file) {
		return false
	}
	if parts := titleParts(test); len(parts) > 1 {
		if strings.TrimSpace(strings.Join(parts, "")) == "" || slices.ContainsFunc(test.OldTitles, func(old newTest) bool { return namesTest(failed, old) }) {
			return false
		}
		for i, part := range parts {
			parts[i] = regexp.QuoteMeta(part)
		}
		return regexp.MustCompile(`^(?:.* > )?` + strings.Join(parts, `.*`) + `$`).MatchString(failed.name)
	}
	if failed.name == test.Name || strings.HasPrefix(failed.name, test.Name+"/") || strings.HasSuffix(failed.name, " > "+test.Name) {
		return true
	}
	// a go case or a suite method prints under its parent, its spaces as underscores
	return strings.HasSuffix(test.File, ".go") && strings.Contains(failed.name+"/", "/"+strings.ReplaceAll(test.Name, " ", "_")+"/")
}

// go has no throw but a panic; a js row holds an assertion only by the runner's own word, so a row in no words reads as a throw
func failedOnAssertion(failed failedTest) bool {
	if failed.isGo {
		return !goPanic.MatchString(failed.output)
	}
	return assertionWord.MatchString(failed.output)
}

func timedOutRow(name string) testRow {
	return testRow{name, verdictBroken, "it timed out, which a loaded machine does on any source; wait for the load to fall and run it again"}
}

func judgedOnBase(failed failedTest) testRow {
	switch {
	case hookTimedOut.MatchString(failed.output):
		return timedOutRow(failed.name)
	case !failedOnAssertion(failed):
		return testRow{failed.name, verdictBroken, "it threw, which any source can do: " + firstErrorOf(failed.output)}
	}
	return testRow{Name: failed.name, Verdict: verdictRed}
}

func firstErrorOf(output string) string {
	for line := range strings.SplitSeq(output, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return "its output names no assertion"
}

// a run whose output answers for every test at once: nothing in it reads one test's row
func wholeRunVerdict(read testOutput, exitedOK bool) (verdict, why string) {
	switch {
	case read.load != "":
		return verdictBroken, read.load
	case read.none && !read.ran:
		return verdictBroken, "0 tests ran"
	case !read.ran && exitedOK:
		return verdictBroken, "the output names no test that ran"
	case !exitedOK && len(read.failed) == 0:
		return verdictFailed, "the command failed and its output names no failed test"
	case exitedOK && len(read.failed) > 0:
		return verdictFailed, "the command exited 0 while its output names a failed test"
	}
	return "", ""
}

func wholeRunRows(newTests []newTest, verdict, why string) []testRow {
	rows := []testRow{}
	for _, test := range newTests {
		rows = append(rows, testRow{test.Name, verdict, why})
	}
	if len(rows) == 0 {
		rows = append(rows, testRow{"the run", verdict, why})
	}
	return rows
}

// base's run read against head's: a row is red when it failed on an assertion on base and did not fail on head. only a new
// test votes, and the run reads red when at least one voted and every vote is red
func judgeRun(log string, exitedOK bool, newTests []newTest, head testOutput) (string, []testRow) {
	read := readTestOutput(log)
	if verdict, why := wholeRunVerdict(read, exitedOK); verdict != "" {
		return verdict, wholeRunRows(newTests, verdict, why)
	}
	const redOnHeadWhy = "it fails on head too, so this source is not what fails it"
	// a failure on head can stop the run however it was asked to (a config, an env, an exit), so no row there no longer says passed
	unreached := testRow{Verdict: verdictBroken, Why: "head failed elsewhere and no line says this test passed there, so the run may never have reached it"}
	reachedOnHead := func(isIt func(failedTest) bool) bool {
		return len(head.failed) == 0 || slices.ContainsFunc(head.passed, isIt)
	}
	votes, rest := []testRow{}, []testRow{}
	claimed := make([]bool, len(read.failed))
	for _, test := range newTests {
		if test.IsUnread {
			rest = append(rest, testRow{test.Name, verdictUnread, test.Why})
			continue
		}
		isExpanded := test.IsTable || len(titleParts(test)) > 1
		row := testRow{Name: test.Name, Verdict: verdictStillGreen}
		// an expanded row's name can vary between runs, so any head row of its title stands against all of them
		onHead := slices.IndexFunc(head.failed, func(failed failedTest) bool { return namesTest(failed, test) })
		for i, failed := range read.failed {
			if !namesTest(failed, test) {
				continue
			}
			claimed[i] = true
			got := judgedOnBase(failed)
			switch {
			case !isExpanded:
				// a go subtest prints under its parent: the worst of them stands for the test
				if row.Verdict != verdictBroken {
					row.Verdict, row.Why = got.Verdict, got.Why
				}
			case onHead < 0 && got.Verdict == verdictRed && !reachedOnHead(func(passed failedTest) bool { return passed.name == failed.name }):
				unreached.Name = failed.name
				votes = append(votes, unreached)
			case onHead < 0:
				votes = append(votes, got)
			case hookTimedOut.MatchString(head.failed[onHead].output):
				votes = append(votes, timedOutRow(failed.name))
			default:
				rest = append(rest, testRow{failed.name, verdictRedOnHead, redOnHeadWhy})
			}
		}
		if isExpanded {
			rest = append(rest, testRow{test.Name, verdictUnread, "a title with a placeholder: x sees the rows that failed, never the ones that passed"})
			continue
		}
		switch {
		case onHead < 0 && row.Verdict == verdictRed && !reachedOnHead(func(passed failedTest) bool { return namesTest(passed, test) }):
			unreached.Name = test.Name
			votes = append(votes, unreached)
		case onHead < 0:
			votes = append(votes, row)
		case hookTimedOut.MatchString(head.failed[onHead].output):
			votes = append(votes, timedOutRow(test.Name))
		default:
			rest = append(rest, testRow{test.Name, verdictRedOnHead, redOnHeadWhy})
		}
	}
	for i, failed := range read.failed {
		switch {
		case claimed[i]:
		case slices.ContainsFunc(head.failed, func(onHead failedTest) bool { return onHead.name == failed.name }):
			rest = append(rest, testRow{failed.name, verdictRedOnHead, redOnHeadWhy})
		default:
			rest = append(rest, judgedOnBase(failed))
		}
	}
	if len(votes) == 0 {
		why := "no new test here went red that x can read, so nothing is proved"
		if len(newTests) == 0 {
			why = "the pr's test files add no test x can name, so nothing here is proved new"
		}
		return verdictBroken, append(rest, testRow{"the run", verdictBroken, why})
	}
	return worstOf(votes), append(votes, rest...)
}

func worstOf(rows []testRow) string {
	verdicts := make([]string, len(rows))
	for i, row := range rows {
		verdicts[i] = row.Verdict
	}
	switch {
	case slices.Contains(verdicts, verdictBroken):
		return verdictBroken
	case slices.Contains(verdicts, verdictStillGreen):
		return verdictStillGreen
	}
	return verdictRed
}
