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

// a test the pr adds; a computed title has no name a runner's output can be matched to
type newTest struct {
	Name, File string
	IsComputed bool
}

// the swapped paths' source on each side, read for what a throw names
type swappedSource struct{ base, head string }

type failedTest struct{ name, file, output string }

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
	namedSymbol = []*regexp.Regexp{
		regexp.MustCompile(`([\w$]+) is not a (?:function|constructor)`),
		regexp.MustCompile(`([\w$]+) is not defined`),
		regexp.MustCompile(`Can't find variable: ([\w$]+)`),
	}
	readField    = regexp.MustCompile(`\(reading '([\w$]+)'\)`)
	evaluateExpr = regexp.MustCompile(`\(evaluating '([\w$.]+)'\)`)
	// a call opens with its optional `.each(rows)`; the title is one of three quotes, each a group since a placeholder can
	// hold the other two and go's regexp has no backreference, or anything else, which only a run knows
	addedJSTest = regexp.MustCompile("(?:^|[^.\\w$])(?:it|test)(?:\\.\\w+)*(?:\\([^()]*\\))?\\(\\s*(?:'((?:[^'\\\\]|\\\\.)+)'|\"((?:[^\"\\\\]|\\\\.)+)\"|`((?:[^`\\\\]|\\\\.)+)`|([^'\"`\\s)][^,\\n]*),)")
	addedGoTest = regexp.MustCompile(`(?m)^func (Test\w+)\(`)
	testFile    = regexp.MustCompile(`(?:\.test\.[cm]?[jt]sx?|\.spec\.[cm]?[jt]sx?|_test\.go)$`)
	// a template's placeholder or an each table's: what a run expands
	titleHole = regexp.MustCompile(`\$\{[^}]*\}?|%[sdifjoO#]|\$\w+`)
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
	for _, m := range addedJSTest.FindAllStringSubmatch(text, -1) {
		if name := m[1] + m[2] + m[3]; name != "" {
			tests = append(tests, newTest{Name: name, File: file})
		} else {
			tests = append(tests, newTest{Name: strings.TrimSpace(m[4]), File: file, IsComputed: true})
		}
	}
	for _, m := range addedGoTest.FindAllStringSubmatch(text, -1) {
		tests = append(tests, newTest{Name: m[1], File: file})
	}
	return tests
}

func readTestOutput(log string) testOutput {
	var read testOutput
	file := ""
	for line := range strings.SplitSeq(ansiColor.ReplaceAllString(log, ""), "\n") {
		if read.load == "" && loadError.MatchString(line) {
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
		if name := failedName(line); name != "" {
			read.ran = true
			failed := failedTest{name: name, file: file}
			if head, _, hasFile := strings.Cut(name, " > "); hasFile {
				failed.file = head
			}
			read.failed = append(read.failed, failed)
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

// a failure holds a new test when its name is that test, a go subtest of it, or a vitest row under a describe, in the
// same file where the runner names one; a title's holes match whatever the run expanded them to
func namesTest(failed failedTest, test newTest) bool {
	if test.IsComputed {
		return false
	}
	if failed.file != "" && test.File != "" && failed.file != test.File && !strings.HasSuffix(test.File, "/"+failed.file) {
		return false
	}
	if titleHole.MatchString(test.Name) {
		parts := titleHole.Split(test.Name, -1)
		for i, part := range parts {
			parts[i] = regexp.QuoteMeta(part)
		}
		return regexp.MustCompile(`^(?:.* > )?` + strings.Join(parts, `.*`) + `$`).MatchString(failed.name)
	}
	return failed.name == test.Name || strings.HasPrefix(failed.name, test.Name+"/") || strings.HasSuffix(failed.name, " > "+test.Name)
}

// a declaration of the symbol, never a mention: `JSON.parse(x)` binds no `parse`
func bindsSymbol(source, symbol string) bool {
	word := regexp.QuoteMeta(symbol)
	return regexp.MustCompile(`(?m)\b(?:function\*?|const|let|var|class|type|interface|enum|func|def)\s+` + word + `\b` +
		`|\b(?:import|export)\s+(?:type\s+)?\{[^}]*\b` + word + `\b` +
		`|\bimport\s+` + word + `\b` +
		`|^\s*(?:(?:async|static|public|private|export)\s+)*` + word + `\s*(?::|=[^=]|\([^)]*\)\s*(?::[^{\n]*)?\{)` +
		`|[{,]\s*` + word + `\s*:`).MatchString(source)
}

// a throw naming a symbol this source lacks proves the test is new, never that it reads the change. a field of an
// undefined names no symbol of its own, so it counts only when head binds what base lacks: `length` stays a real red
func lackedBy(output string, source swappedSource) string {
	for _, shape := range namedSymbol {
		for _, m := range shape.FindAllStringSubmatch(output, -1) {
			if !bindsSymbol(source.base, m[1]) {
				return m[1]
			}
		}
	}
	var fields []string
	for _, m := range readField.FindAllStringSubmatch(output, -1) {
		fields = append(fields, m[1])
	}
	for _, m := range evaluateExpr.FindAllStringSubmatch(output, -1) {
		fields = append(fields, strings.Split(m[1], ".")...)
	}
	for _, field := range fields {
		if bindsSymbol(source.head, field) && !bindsSymbol(source.base, field) {
			return field
		}
	}
	return ""
}

// the run's one verdict and a row per test: red only when every new test is, and a failure no new test claims gets its row
// and no vote
func judgeRun(log string, exitedOK bool, newTests []newTest, source swappedSource) (string, []testRow) {
	read := readTestOutput(log)
	whole := func(verdict, why string) (string, []testRow) {
		rows := []testRow{}
		for _, test := range newTests {
			rows = append(rows, testRow{test.Name, verdict, why})
		}
		if len(rows) == 0 {
			rows = append(rows, testRow{"the run", verdict, why})
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
	case exitedOK && len(read.failed) > 0:
		return whole(verdictFailed, "the command exited 0 while its output names a failed test")
	}
	judged := func(failed failedTest) testRow {
		if hookTimedOut.MatchString(failed.output) {
			return testRow{failed.name, verdictBroken, "it timed out, which a loaded machine does on any source; wait for the load to fall and run it again"}
		}
		if symbol := lackedBy(failed.output, source); symbol != "" {
			return testRow{failed.name, verdictBroken, "it throws on " + symbol + ", which this source lacks"}
		}
		return testRow{Name: failed.name, Verdict: verdictRed}
	}
	var rows []testRow
	claimed := make([]bool, len(read.failed))
	for _, test := range newTests {
		if test.IsComputed {
			rows = append(rows, testRow{test.Name, verdictStillGreen, "a computed title in " + test.File + ": x cannot tell its row, so a literal title is what proves it"})
			continue
		}
		row := testRow{Name: test.Name, Verdict: verdictStillGreen}
		expanded := false
		for i, failed := range read.failed {
			if !namesTest(failed, test) {
				continue
			}
			claimed[i] = true
			if titleHole.MatchString(test.Name) {
				expanded = true
				rows = append(rows, judged(failed))
			} else if got := judged(failed); row.Verdict != verdictBroken {
				// a go subtest prints under its parent: the worst of them stands for the test
				row.Verdict, row.Why = got.Verdict, got.Why
			}
		}
		if !expanded {
			rows = append(rows, row)
		}
	}
	verdict := worstOf(rows)
	for i, failed := range read.failed {
		if !claimed[i] {
			rows = append(rows, judged(failed))
		}
	}
	if len(newTests) == 0 {
		return verdictBroken, append(rows, testRow{"the run", verdictBroken, "the pr's test files add no test x can name, so nothing here is proved new"})
	}
	return verdict, rows
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
