package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

const revertPR = "https://github.com/o/r/pull/8"

// main holds src.txt, gone.txt and the secret; pr 8 changes the first and the third, drops gone.txt, adds added.txt and two go tests
func revertWorld(t *testing.T) (main, head, tree string) {
	t.Helper()
	main, _ = verifyWorld(t)
	write(t, filepath.Join(main, "src.txt"), "base\n")
	write(t, filepath.Join(main, "gone.txt"), "only on base\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "base's source")
	gitT(t, main, "push", "-q", "origin", "main")
	gitT(t, main, "switch", "-q", "-c", "coder/y")
	write(t, filepath.Join(main, "src.txt"), "head\n")
	write(t, filepath.Join(main, "secret.txt"), "head's plaintext\n")
	write(t, filepath.Join(main, "added.txt"), "the pr's\n")
	write(t, filepath.Join(main, "probe_test.go"), "package p\n\nfunc TestNewOne(t *testing.T) {}\n\nfunc TestNewTwo(t *testing.T) {}\n")
	gitT(t, main, "rm", "-q", "gone.txt")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "the pr")
	head = gitT(t, main, "rev-parse", "HEAD")
	gitT(t, main, "push", "-q", "origin", "HEAD:refs/pull/8/head")
	gitT(t, main, "switch", "-q", "main")
	gitT(t, main, "branch", "-q", "-D", "coder/y")
	return main, head, filepath.Join(main, ".claude/worktrees/verify-pr-8")
}

func readOr(path, missing string) string {
	body, err := os.ReadFile(path)
	if err != nil {
		return missing
	}
	return string(body)
}

// head's content back and git's own compare clean: the proof the ticket names
func assertHeadBack(t *testing.T, tree string) {
	t.Helper()
	if got := readOr(filepath.Join(tree, "src.txt"), "gone"); got != "head\n" {
		t.Errorf("src.txt reads %q, want head's", got)
	}
	if got := readOr(filepath.Join(tree, "secret.txt"), "gone"); got != "head's plaintext\n" {
		t.Errorf("secret.txt reads %q, want head's plaintext", got)
	}
	if got := readOr(filepath.Join(tree, "added.txt"), "gone"); got != "the pr's\n" {
		t.Errorf("added.txt reads %q, want the pr's", got)
	}
	if exists(filepath.Join(tree, "gone.txt")) {
		t.Error("gone.txt survived, head has none")
	}
	if status := gitT(t, tree, "status", "--porcelain", "--untracked-files=no"); status != "" {
		t.Errorf("the tree differs from head:\n%s", status)
	}
}

func revert(t *testing.T, main string, command ...string) ran {
	t.Helper()
	args := append([]string{"lane", "verify-tree", revertPR, "--revert", "main", "src.txt", "secret.txt", "added.txt", "gone.txt", "--"}, command...)
	return xIn(t, main, nil, args...)
}

// a run on head's source passes; what follows it runs on base's only
const greenOnHead = "grep -q '^head$' src.txt && { echo 'ok  \tp\t0.1s'; exit 0; }; "

// a command green on head, printing go test's words for each row on base
func goPrints(lines ...string) []string {
	script := greenOnHead
	for _, line := range lines {
		script += "echo '" + line + "'; "
	}
	return []string{"sh", "-c", script + "exit 1"}
}

func TestRevertHoldsTheMergeBaseContentForTheRun(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	seen := filepath.Join(t.TempDir(), "seen")
	// main moves past the pr's fork: the base is the merge-base, never main's tip
	write(t, filepath.Join(main, "src.txt"), "main moved on\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "main moves")
	gitT(t, main, "push", "-q", "origin", "main")

	got := revert(t, main, "sh", "-c", greenOnHead+`cat src.txt secret.txt gone.txt > `+seen+`; test -e added.txt && echo added >> `+seen+`; echo '--- FAIL: TestNewOne (0.00s)'; echo '--- FAIL: TestNewTwo (0.00s)'; exit 1`)

	if want, read := "base\nplaintext\nonly on base\n", readOr(seen, "the command never ran"); read != want {
		t.Fatalf("the command read %q, want %q (added.txt gone):\n%s", read, want, got.stdout)
	}
	assertHeadBack(t, tree)
}

// a local main behind origin would fork the base too early: the base is read from origin
func TestRevertReadsTheBaseFromOriginOverAStaleLocalBranch(t *testing.T) {
	t.Parallel()
	main, _ := verifyWorld(t)
	write(t, filepath.Join(main, "src.txt"), "local main stops here\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "the commit local main keeps")
	write(t, filepath.Join(main, "src.txt"), "origin's main\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "the commit only origin keeps")
	gitT(t, main, "push", "-q", "origin", "main")
	gitT(t, main, "switch", "-q", "-c", "coder/y")
	write(t, filepath.Join(main, "src.txt"), "head\n")
	write(t, filepath.Join(main, "probe_test.go"), "package p\n\nfunc TestNewOne(t *testing.T) {}\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "the pr")
	gitT(t, main, "push", "-q", "origin", "HEAD:refs/pull/8/head")
	gitT(t, main, "switch", "-q", "main")
	gitT(t, main, "branch", "-q", "-D", "coder/y")
	gitT(t, main, "reset", "-q", "--hard", "HEAD~1")
	seen := filepath.Join(t.TempDir(), "seen")

	got := xIn(t, main, nil, "lane", "verify-tree", revertPR, "--revert", "main", "src.txt", "--", "sh", "-c", greenOnHead+"cat src.txt > "+seen+"; echo '--- FAIL: TestNewOne (0.00s)'; exit 1")

	if read := readOr(seen, "the command never ran"); got.code != 0 || read != "origin's main\n" {
		t.Fatalf("exit %d, the command read %q, want origin's main:\n%s", got.code, read, got.stdout)
	}
}

func TestRevertRefusesBeforeAnySwap(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	seen := filepath.Join(t.TempDir(), "seen")
	command := []string{"--", "sh", "-c", "touch " + seen}
	base := []string{"lane", "verify-tree", revertPR}
	cases := []struct {
		name string
		args []string
		code int
		says string
	}{
		{"a path in neither", []string{"--revert", "main", "src.txt", "nowhere.txt"}, 1, "nowhere.txt"},
		{"a case variant", []string{"--revert", "main", "SRC.txt"}, 1, "SRC.txt"},
		{"the whole tree", []string{"--revert", "main", "."}, 2, "."},
		{"outside the tree", []string{"--revert", "main", "../secret"}, 2, "../secret"},
		{"an absolute path", []string{"--revert", "main", "/etc/hosts"}, 2, "/etc/hosts"},
		{"a base that is no commit", []string{"--revert", "nope", "src.txt"}, 2, "nope"},
		{"a base like a flag", []string{"--revert=-x", "src.txt"}, 2, "-x"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			args := append(append(slices.Clone(base), c.args...), command...)

			got := xIn(t, main, nil, args...)

			if got.code != c.code || !strings.Contains(got.stdout, c.says) {
				t.Fatalf("exit %d, want %d naming %q:\n%s", got.code, c.code, c.says, got.stdout)
			}
			if exists(seen) {
				t.Fatal("the command ran")
			}
			if exists(tree) {
				assertHeadBack(t, tree)
			}
		})
	}
}

func TestAPlainRunDrawsNoRevertStepAsNotRun(t *testing.T) {
	t.Parallel()
	main, _, _ := revertWorld(t)

	got := xIn(t, main, nil, "lane", "verify-tree", revertPR, "--board")

	for _, step := range []string{"test-head", "swap", "test-base", "restore"} {
		if got.code != 0 || strings.Contains(got.stdout, step) {
			t.Fatalf("exit %d, the board draws %s:\n%s", got.code, step, got.stdout)
		}
	}
}

func TestVerifyTreeArgsOutsideRevertExitUsage(t *testing.T) {
	t.Parallel()
	main, _, _ := revertWorld(t)
	cases := map[string][]string{
		"a stray arg":                     {revertPR, "src.txt"},
		"a command with no flag":          {revertPR, "--", "true"},
		"paths with no command":           {revertPR, "--revert", "main", "src.txt"},
		"a dash with no command":          {revertPR, "--revert", "main", "src.txt", "--"},
		"a command with no paths":         {revertPR, "--revert", "main", "--", "true"},
		"the flag beside a stack":         {revertPR, "--stack", "--revert", "main", "src.txt", "--", "true"},
		"a bare dash in the head's place": {"--", revertPR},
	}
	for name, args := range cases {
		t.Run(name, func(t *testing.T) {
			got := xIn(t, main, nil, append([]string{"lane", "verify-tree"}, args...)...)

			if got.code != 2 {
				t.Fatalf("exit %d, want 2:\n%s", got.code, got.stdout)
			}
		})
	}
}

func TestRevertOnAHeadAlreadyOnItsBaseRefuses(t *testing.T) {
	t.Parallel()
	main, _, _ := revertWorld(t)
	onMain := gitT(t, main, "rev-parse", "HEAD")

	got := xIn(t, main, nil, "lane", "verify-tree", "main:"+short(onMain), "--revert", "main", "src.txt", "--", "true")

	if got.code != 2 || !strings.Contains(got.stdout, "nothing to revert") {
		t.Fatalf("exit %d, want 2 saying nothing to revert:\n%s", got.code, got.stdout)
	}
}

// exit line 3: proven red by removing the deferred restore
func TestRevertBringsHeadBackWhateverTheCommandDid(t *testing.T) {
	t.Parallel()
	cases := map[string][]string{
		"a failing command":  {"sh", "-c", greenOnHead + "exit 3"},
		"a killed command":   {"sh", "-c", greenOnHead + "kill -9 $$"},
		"a missing command":  {"/nowhere/at/all"},
		"a passing command":  {"sh", "-c", greenOnHead + "true"},
		"one that edits src": {"sh", "-c", greenOnHead + "echo mine > src.txt; exit 1"},
		"one that drops src": {"sh", "-c", greenOnHead + "mv src.txt src.old; exit 1"},
	}
	for name, command := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			main, _, tree := revertWorld(t)

			got := revert(t, main, command...)

			assertHeadBack(t, tree)
			if got.code == 0 {
				t.Errorf("exit 0, want no proof from %v:\n%s", command, got.stdout)
			}
			if !exists(tree) {
				t.Fatal("no tree")
			}
		})
	}
}

// a tracked file the command changed past the named paths stays, and the porcelain compare names it
func TestRevertNamesATrackedFileTheCommandChanged(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)

	got := revert(t, main, "sh", "-c", greenOnHead+"echo changed > readme.txt; echo '--- FAIL: TestNewOne (0.00s)'; echo '--- FAIL: TestNewTwo (0.00s)'; exit 1")

	if got.code == 0 || !strings.Contains(got.stdout, "readme.txt") {
		t.Fatalf("exit %d, want a failure naming readme.txt:\n%s", got.code, got.stdout)
	}
	if body := readOr(filepath.Join(tree, "readme.txt"), ""); body != "changed\n" {
		t.Errorf("readme.txt reads %q, the verb must not touch what it was not told to", body)
	}
}

// a head run that writes a tracked file refuses before the swap, which would wipe the write
func TestRevertRefusesAHeadRunThatChangedATrackedFile(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	seen := filepath.Join(t.TempDir(), "seen")

	got := revert(t, main, "sh", "-c", "cat src.txt >> "+seen+"; echo changed > readme.txt; echo 'ok  \tp\t0.1s'")

	if got.code == 0 || !strings.Contains(got.stdout, "readme.txt") {
		t.Fatalf("exit %d, want a failure naming readme.txt:\n%s", got.code, got.stdout)
	}
	if read := readOr(seen, ""); read != "head\n" {
		t.Fatalf("the command read %q, want one run on head's content", read)
	}
	if body := readOr(filepath.Join(tree, "readme.txt"), ""); body != "changed\n" {
		t.Errorf("readme.txt reads %q, the verb must not touch what it was not told to", body)
	}
}

// exit line 2: a head that cannot load proves nothing, so base's source never swaps in
func TestRevertOnAHeadThatCannotLoadNeverSwaps(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	seen := filepath.Join(t.TempDir(), "seen")

	got := revert(t, main, "sh", "-c", "cat src.txt >> "+seen+"; echo '(fail) the file did not load'; exit 1")

	if read := readOr(seen, ""); read != "head\n" {
		t.Fatalf("the command read %q, want one run on head's content", read)
	}
	if rows := rowsOf(t, got); got.code == 0 || rows[""] != "broken" || rows["TestNewOne"] != "broken" {
		t.Fatalf("exit %d, rows %v, want broken:\n%s", got.code, rows, got.stdout)
	}
	assertHeadBack(t, tree)
}

func rowsOf(t *testing.T, got ran) map[string]string {
	t.Helper()
	var envelope map[string]any
	if err := json.Unmarshal([]byte(got.stdout), &envelope); err != nil {
		t.Fatalf("no envelope: %v\n%s", err, got.stdout)
	}
	data, _ := envelope["data"].(map[string]any)
	if data == nil {
		t.Fatalf("no data:\n%s", got.stdout)
	}
	rows := map[string]string{}
	tests, _ := data["tests"].([]any)
	for _, row := range tests {
		m := row.(map[string]any)
		rows[m["name"].(string)] = m["verdict"].(string)
	}
	rows[""] = fmt.Sprint(data["verdict"])
	return rows
}

// exit line 2: each new test named, and only an all-red run exits 0
func TestRevertNamesEachNewTest(t *testing.T) {
	t.Parallel()
	const failOne, failTwo = "--- FAIL: TestNewOne (0.00s)", "--- FAIL: TestNewTwo (0.00s)"
	cases := []struct {
		name    string
		command []string
		code    int
		want    map[string]string
	}{
		{"both red", goPrints(failOne, "    probe_test.go:3: got 1", failTwo, "FAIL"), 0,
			map[string]string{"": "red", "TestNewOne": "red", "TestNewTwo": "red"}},
		{"one still green", goPrints(failOne, "FAIL"), 1,
			map[string]string{"": "still green", "TestNewOne": "red", "TestNewTwo": "still green"}},
		{"a build break", goPrints("# p", "./probe_test.go:3: undefined: helper", "FAIL\tp [build failed]"), 1,
			map[string]string{"": "broken", "TestNewOne": "broken", "TestNewTwo": "broken"}},
		{"a load break", goPrints("tests/a.test.ts:", "(fail) the file did not load", "  cannot import"), 1,
			map[string]string{"": "broken", "TestNewOne": "broken", "TestNewTwo": "broken"}},
		{"no test ran", []string{"sh", "-c", "echo 'ok  \tp\t0.1s [no tests to run]'"}, 1,
			map[string]string{"": "broken", "TestNewOne": "broken", "TestNewTwo": "broken"}},
		{"a panic on base", goPrints(failOne, "panic: boom", failTwo, "FAIL"), 1,
			map[string]string{"": "broken", "TestNewOne": "broken", "TestNewTwo": "red"}},
		{"one red on head too, the other passed there", []string{"sh", "-c", "echo '" + failOne + "'; grep -q '^head$' src.txt && { echo '--- PASS: TestNewTwo (0.00s)'; exit 1; }; echo '" + failTwo + "'; exit 1"}, 1,
			map[string]string{"": "red on head", "TestNewOne": "red on head", "TestNewTwo": "red"}},
		{"one red on head too, the other in no line there", []string{"sh", "-c", "echo '" + failOne + "'; grep -q '^head$' src.txt && exit 1; echo '" + failTwo + "'; exit 1"}, 1,
			map[string]string{"": "broken", "TestNewOne": "red on head", "TestNewTwo": "broken"}},
		{"both red on head too", []string{"sh", "-c", "echo '" + failOne + "'; echo '" + failTwo + "'; exit 1"}, 1,
			map[string]string{"": "red on head", "TestNewOne": "red on head", "TestNewTwo": "red on head"}},
		{"an opaque red", []string{"sh", "-c", "echo nope; exit 1"}, 1,
			map[string]string{"": "failed", "TestNewOne": "failed", "TestNewTwo": "failed"}},
		{"an opaque green", []string{"sh", "-c", "echo fine"}, 1,
			map[string]string{"": "broken", "TestNewOne": "broken", "TestNewTwo": "broken"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			main, _, tree := revertWorld(t)

			got := revert(t, main, c.command...)

			if got.code != c.code {
				t.Fatalf("exit %d, want %d:\n%s", got.code, c.code, got.stdout)
			}
			rows := rowsOf(t, got)
			for name, verdict := range c.want {
				if rows[name] != verdict {
					t.Errorf("%q reads %q, want %q:\n%s", name, rows[name], verdict, got.stdout)
				}
			}
			assertHeadBack(t, tree)
		})
	}
}

// a child left running with the output open cannot hold the tree on base's source until it dies
func TestRevertDoesNotWaitOutABackgroundChild(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	started := time.Now()

	got := revert(t, main, "sh", "-c", "sleep 25 & "+greenOnHead+"echo '--- FAIL: TestNewOne (0.00s)'; echo '--- FAIL: TestNewTwo (0.00s)'; exit 1")

	if elapsed := time.Since(started); got.code != 0 || elapsed > 20*time.Second {
		t.Fatalf("exit %d after %s, want the proof in under 20 s:\n%s", got.code, elapsed, got.stdout)
	}
	assertHeadBack(t, tree)
}

// exit line 7: each run goes through the queue's long slot, and the queue's own words read as no test's
func TestRevertTakesTheLongSlot(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	root := t.TempDir()
	calls := filepath.Join(t.TempDir(), "calls")
	write(t, filepath.Join(root, "script/gate-queue.sh"), "#!/bin/sh\necho \"$1\" >> "+calls+"\nshift\necho 'gate-queue: waiting 30s, holder: (fail) the file did not load' >&2\nexec \"$@\"\n")
	if err := os.Chmod(filepath.Join(root, "script/gate-queue.sh"), 0o755); err != nil {
		t.Fatal(err)
	}
	command := goPrints("--- FAIL: TestNewOne (0.00s)", "--- FAIL: TestNewTwo (0.00s)", "FAIL")
	args := append([]string{"lane", "verify-tree", revertPR, "--revert", "main", "src.txt", "secret.txt", "added.txt", "gone.txt", "--"}, command...)

	got := xIn(t, main, []string{"X_FRAME_ROOT=" + root}, args...)

	if got.code != 0 {
		t.Fatalf("exit %d, want the queue's words read as no test's:\n%s", got.code, got.stdout)
	}
	if read := readOr(calls, ""); read != "--long\n--long\n" {
		t.Fatalf("the queue heard %q, want two runs on the long slot", read)
	}
	assertHeadBack(t, tree)
}

// exit line 7: a real go package in place of `pnpm mods:test`
func TestRevertReadsARealGoPackage(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, test string
		code       int
		verdict    string
		oldTest    string
		newRow     string
	}{
		{name: "a skip on head that fails on base", test: "func TestNew(t *testing.T) {\n\tif Limit == 3 {\n\t\tt.Skip(\"not here\")\n\t}\n\tt.Fatal(\"no\")\n}\n", code: 1, verdict: "broken", newRow: "unread"},
		{name: "an old test red on head beside a new test", test: "func TestNew(t *testing.T) {\n\tif Limit != 3 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n", code: 0, verdict: "red", oldTest: "func TestOld(t *testing.T) {\n\tif Limit == 3 {\n\t\tt.Fatal(\"old broke\")\n\t}\n}\n"},
		{name: "an assertion on base", test: "func TestNew(t *testing.T) {\n\tif Limit != 3 {\n\t\tt.Fatalf(\"got %d\", Limit)\n\t}\n}\n", code: 0, verdict: "red"},
		{name: "a test that reads nothing", test: "func TestNew(t *testing.T) {}\n", code: 1, verdict: "still green"},
		{name: "a panic on base", test: "func TestNew(t *testing.T) {\n\tif Limit != 3 {\n\t\tpanic(\"boom\")\n\t}\n}\n", code: 1, verdict: "broken"},
		{name: "a symbol base lacks", test: "func TestNew(t *testing.T) {\n\tif Added != 1 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n", code: 1, verdict: "broken"},
		{name: "red on head too", test: "func TestNew(t *testing.T) {\n\tt.Fatal(\"always\")\n}\n", code: 1, verdict: "red on head"},
		{name: "a panic on head may stop the tests after it", test: "func TestAFirst(t *testing.T) {\n\tif Limit == 3 {\n\t\tpanic(\"boom\")\n\t}\n}\n\nfunc TestZNew(t *testing.T) {\n\tif Limit != 3 {\n\t\tt.Fatal(\"no\")\n\t}\n}\n", code: 1, verdict: "broken"},
		{name: "a subtest named on head", test: "func TestNew(t *testing.T) {\n\tt.Run(\"sub\", func(t *testing.T) {\n\t\tif Limit != 3 {\n\t\t\tt.Fatal(\"no\")\n\t\t}\n\t})\n}\n", code: 0, verdict: "red"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			main, _ := verifyWorld(t)
			write(t, filepath.Join(main, "go.mod"), "module p\n\ngo 1.24\n")
			write(t, filepath.Join(main, "lib.go"), "package p\n\nconst Limit = 1\n")
			if c.oldTest != "" {
				write(t, filepath.Join(main, "old_test.go"), "package p\n\nimport \"testing\"\n\n"+c.oldTest)
			}
			gitT(t, main, "add", ".")
			gitT(t, main, "commit", "-q", "-m", "base")
			gitT(t, main, "push", "-q", "origin", "main")
			gitT(t, main, "switch", "-q", "-c", "coder/y")
			write(t, filepath.Join(main, "lib.go"), "package p\n\nconst Limit = 3\nconst Added = 1\n")
			write(t, filepath.Join(main, "lib_test.go"), "package p\n\nimport \"testing\"\n\n"+c.test)
			gitT(t, main, "add", ".")
			gitT(t, main, "commit", "-q", "-m", "the pr")
			gitT(t, main, "push", "-q", "origin", "HEAD:refs/pull/8/head")
			gitT(t, main, "switch", "-q", "main")
			gitT(t, main, "branch", "-q", "-D", "coder/y")

			got := xIn(t, main, nil, "lane", "verify-tree", revertPR, "--revert", "main", "lib.go", "--", "go", "test", "-count=1", "./...")

			rows := rowsOf(t, got)
			if got.code != c.code || rows[""] != c.verdict {
				t.Fatalf("exit %d, rows %v, want %d and %s:\n%s", got.code, rows, c.code, c.verdict, got.stdout)
			}
			if c.newRow != "" && rows["TestNew"] != c.newRow {
				t.Fatalf("rows %v, want TestNew %s:\n%s", rows, c.newRow, got.stdout)
			}
			tree := filepath.Join(main, ".claude/worktrees/verify-pr-8")
			if body := readOr(filepath.Join(tree, "lib.go"), ""); !strings.Contains(body, "Limit = 3") {
				t.Fatalf("lib.go reads %q, want head's", body)
			}
		})
	}
}

func TestGoTestGetsItsPassAndSkipLines(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name          string
		command, want []string
	}{
		{"a bare go test", []string{"go", "test", "./..."}, []string{"go", "test", "-v", "./..."}},
		{"go by its path", []string{"/opt/go/bin/go", "test"}, []string{"/opt/go/bin/go", "test", "-v"}},
		{"already verbose", []string{"go", "test", "-v", "./..."}, []string{"go", "test", "-v", "./..."}},
		{"verbose by the binary's flag", []string{"go", "test", "-test.v", "./..."}, []string{"go", "test", "-test.v", "./..."}},
		{"json output", []string{"go", "test", "-json", "./..."}, []string{"go", "test", "-json", "./..."}},
		{"another go verb", []string{"go", "vet", "./..."}, []string{"go", "vet", "./..."}},
		{"go alone", []string{"go"}, []string{"go"}},
		{"a shell around it", []string{"sh", "-c", "go test"}, []string{"sh", "-c", "go test"}},
		{"a script around it", []string{"pnpm", "x-go:test"}, []string{"pnpm", "x-go:test"}},
		{"another tool's test verb", []string{"pnpm", "test"}, []string{"pnpm", "test"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := withGoTestLines(c.command); !slices.Equal(got, c.want) {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
}

// exit line 4: x itself dies mid-swap, so nothing deferred runs and the marker is all that is left
func killedMidSwap(t *testing.T, main string) (tree string) {
	t.Helper()
	dir := t.TempDir()
	started, pidFile := filepath.Join(dir, "started"), filepath.Join(dir, "child.pid")
	c := exec.Command(xbin, "lane", "verify-tree", revertPR, "--revert", "main", "src.txt", "secret.txt", "added.txt", "gone.txt", "--",
		"sh", "-c", greenOnHead+"echo $$ > "+pidFile+"; touch "+started+"; exec sleep 60")
	c.Dir = main
	c.Env = append(cleanEnv(), "X_TEST=1")
	if err := c.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if body, err := os.ReadFile(pidFile); err == nil {
			if pid, err := strconv.Atoi(strings.TrimSpace(string(body))); err == nil {
				if child, err := os.FindProcess(pid); err == nil {
					_ = child.Kill()
				}
			}
		}
	})
	until := time.Now().Add(60 * time.Second)
	for !exists(started) {
		if time.Now().After(until) {
			_ = c.Process.Kill()
			t.Fatal("the command never started")
		}
		time.Sleep(20 * time.Millisecond)
	}
	tree = filepath.Join(main, ".claude/worktrees/verify-pr-8")

	// a second run while the first is alive must not swap under it
	beside := xIn(t, main, nil, "lane", "verify-tree", revertPR)
	if beside.code == 0 || readOr(filepath.Join(tree, "src.txt"), "") != "base\n" {
		t.Fatalf("a run beside a live swap: exit %d, src.txt %q, want a refusal and base's content:\n%s", beside.code, readOr(filepath.Join(tree, "src.txt"), ""), beside.stdout)
	}

	if err := c.Process.Kill(); err != nil {
		t.Fatal(err)
	}
	_ = c.Wait()
	if got := readOr(filepath.Join(tree, "src.txt"), ""); got != "base\n" {
		t.Fatalf("control: after the kill src.txt reads %q, want base's: the kill must land mid-swap", got)
	}
	return tree
}

func TestAKilledRevertRestoresOnTheNextRun(t *testing.T) {
	t.Parallel()
	main, head, _ := revertWorld(t)
	tree := killedMidSwap(t, main)

	got := xIn(t, main, nil, "lane", "verify-tree", revertPR)

	if got.code != 0 || gitT(t, tree, "rev-parse", "HEAD") != head {
		t.Fatalf("exit %d, want the tree back on head:\n%s", got.code, got.stdout)
	}
	assertHeadBack(t, tree)
}

func TestAKilledRevertRestoresBeforeTheNextRevert(t *testing.T) {
	t.Parallel()
	main, _, _ := revertWorld(t)
	tree := killedMidSwap(t, main)
	seen := filepath.Join(t.TempDir(), "seen")

	got := revert(t, main, "sh", "-c", greenOnHead+"cat src.txt > "+seen+"; echo '--- FAIL: TestNewOne (0.00s)'; echo '--- FAIL: TestNewTwo (0.00s)'; exit 1")

	if got.code != 0 || readOr(seen, "") != "base\n" {
		t.Fatalf("exit %d, the second run read %q, want a clean swap:\n%s", got.code, readOr(seen, ""), got.stdout)
	}
	assertHeadBack(t, tree)
}

func TestAKilledRevertRefusesAFileHoldingNeitherSide(t *testing.T) {
	t.Parallel()
	main, _, _ := revertWorld(t)
	tree := killedMidSwap(t, main)
	write(t, filepath.Join(tree, "src.txt"), "a probe's edit\n")

	got := xIn(t, main, nil, "lane", "verify-tree", revertPR)

	if got.code == 0 || !strings.Contains(got.stdout, "src.txt") {
		t.Fatalf("exit %d, want a refusal naming src.txt:\n%s", got.code, got.stdout)
	}
	if body := readOr(filepath.Join(tree, "src.txt"), ""); body != "a probe's edit\n" {
		t.Errorf("src.txt reads %q, the edit must stay", body)
	}

	// put back by hand, the next run finishes the restore
	write(t, filepath.Join(tree, "src.txt"), "head\n")
	if again := xIn(t, main, nil, "lane", "verify-tree", revertPR); again.code != 0 {
		t.Fatalf("exit %d after the file went back:\n%s", again.code, again.stdout)
	}
	assertHeadBack(t, tree)
}

// base holds a file where head holds a dir: the swap would delete what a probe left in that dir
func TestRevertRefusesToDeleteAnUntrackedFile(t *testing.T) {
	t.Parallel()
	main, _ := verifyWorld(t)
	write(t, filepath.Join(main, "thing"), "file\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "base")
	gitT(t, main, "push", "-q", "origin", "main")
	gitT(t, main, "switch", "-q", "-c", "coder/y")
	gitT(t, main, "rm", "-q", "thing")
	write(t, filepath.Join(main, "thing/a.txt"), "in a dir\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "the pr")
	gitT(t, main, "push", "-q", "origin", "HEAD:refs/pull/8/head")
	gitT(t, main, "switch", "-q", "main")
	gitT(t, main, "branch", "-q", "-D", "coder/y")
	if got := xIn(t, main, nil, "lane", "verify-tree", revertPR); got.code != 0 {
		t.Fatalf("control: %s", got.stdout)
	}
	tree := filepath.Join(main, ".claude/worktrees/verify-pr-8")
	write(t, filepath.Join(tree, "thing/untracked"), "a probe's\n")
	seen := filepath.Join(t.TempDir(), "seen")

	got := xIn(t, main, nil, "lane", "verify-tree", revertPR, "--revert", "main", "thing", "--", "sh", "-c", "touch "+seen)

	if got.code == 0 || !strings.Contains(got.stdout, "thing/untracked") || exists(seen) {
		t.Fatalf("exit %d, the command ran %v, want a refusal naming the file:\n%s", got.code, exists(seen), got.stdout)
	}
	if body := readOr(filepath.Join(tree, "thing/untracked"), "gone"); body != "a probe's\n" {
		t.Fatalf("the probe's file reads %q", body)
	}
}

// head dropped gone.txt and a probe left its own there: the swap would overwrite it, the restore remove it
func TestRevertRefusesToOverwriteAFileOnABaseOnlyPath(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	if got := xIn(t, main, nil, "lane", "verify-tree", revertPR); got.code != 0 {
		t.Fatalf("control: %s", got.stdout)
	}
	write(t, filepath.Join(tree, "gone.txt"), "a probe's\n")

	got := revert(t, main, "true")

	if got.code == 0 || !strings.Contains(got.stdout, "gone.txt") {
		t.Fatalf("exit %d, want a refusal naming gone.txt:\n%s", got.code, got.stdout)
	}
	if body := readOr(filepath.Join(tree, "gone.txt"), "gone"); body != "a probe's\n" {
		t.Fatalf("the probe's file reads %q", body)
	}
}

// head adds TestLoad in pkg a while pkg b already holds one: go's output cannot tell whose red it is
func TestAGoNameInTwoPackagesNeverProves(t *testing.T) {
	t.Parallel()
	main := repo(t)
	write(t, filepath.Join(main, "b/b_test.go"), "package b\n\nfunc TestLoad(t *testing.T) {}\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "base")
	fork := gitT(t, main, "rev-parse", "HEAD")
	write(t, filepath.Join(main, "a/a_test.go"), "package a\n\nfunc TestLoad(t *testing.T) {}\n\nfunc TestAlone(t *testing.T) {}\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "head")

	tests := newTestNames(main, fork, gitT(t, main, "rev-parse", "HEAD"), nil)

	got := map[string]bool{}
	for _, test := range tests {
		got[test.Name] = test.IsUnread
	}
	if unmatched, seen := got["TestLoad"]; !seen || !unmatched {
		t.Errorf("TestLoad reads %+v, want it unmatched", tests)
	}
	if unmatched, seen := got["TestAlone"]; !seen || unmatched {
		t.Errorf("TestAlone reads %+v, want it matched", tests)
	}
}

// a real diff's shapes: a spaced path, a line that prints like a header, a call line edited in place
func TestNewTestNamesReadsARealDiff(t *testing.T) {
	t.Parallel()
	main := repo(t)
	write(t, filepath.Join(main, "edited.test.ts"), "it('old', () => {\n});\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "base")
	fork := gitT(t, main, "rev-parse", "HEAD")
	write(t, filepath.Join(main, "edited.test.ts"), "it('old', async () => {\n});\n")
	write(t, filepath.Join(main, "my file.test.ts"), "it('in a spaced path', f);\n")
	write(t, filepath.Join(main, "plus.test.ts"), "++ count;\nit('after a plus line', f);\n")
	write(t, filepath.Join(main, "café.test.ts"), "it('in a non-ascii path', f);\n")
	gitT(t, main, "add", ".")
	gitT(t, main, "commit", "-q", "-m", "head")

	var names []string
	for _, test := range newTestNames(main, fork, gitT(t, main, "rev-parse", "HEAD"), nil) {
		names = append(names, test.Name)
	}

	slices.Sort(names)
	if want := "after a plus line|in a non-ascii path|in a spaced path"; strings.Join(names, "|") != want {
		t.Fatalf("read %q, want %q", strings.Join(names, "|"), want)
	}
}

// a tracked link under a named dir: a kill must leave the next run able to restore it
func TestAKilledRevertRestoresPastASymlink(t *testing.T) {
	t.Parallel()
	for name, target := range map[string]string{"a link to a file": "../tgt.txt", "a link to a dir": "../tgtdir", "a dangling link": "../nowhere"} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			main, _ := verifyWorld(t)
			write(t, filepath.Join(main, "tgt.txt"), "t\n")
			write(t, filepath.Join(main, "tgtdir/f"), "f\n")
			write(t, filepath.Join(main, "d/src.txt"), "base\n")
			if err := os.Symlink(target, filepath.Join(main, "d/link")); err != nil {
				t.Fatal(err)
			}
			gitT(t, main, "add", ".")
			gitT(t, main, "commit", "-q", "-m", "base")
			gitT(t, main, "push", "-q", "origin", "main")
			gitT(t, main, "switch", "-q", "-c", "coder/y")
			write(t, filepath.Join(main, "d/src.txt"), "head\n")
			gitT(t, main, "add", ".")
			gitT(t, main, "commit", "-q", "-m", "the pr")
			gitT(t, main, "push", "-q", "origin", "HEAD:refs/pull/8/head")
			gitT(t, main, "switch", "-q", "main")
			gitT(t, main, "branch", "-q", "-D", "coder/y")
			tree := filepath.Join(main, ".claude/worktrees/verify-pr-8")
			started := filepath.Join(t.TempDir(), "started")
			c := exec.Command(xbin, "lane", "verify-tree", revertPR, "--revert", "main", "d", "--", "sh", "-c", "grep -q '^head$' d/src.txt && { echo 'ok  \tp\t0.1s'; exit 0; }; touch "+started+"; exec sleep 3")
			c.Dir, c.Env = main, append(cleanEnv(), "X_TEST=1")
			if err := c.Start(); err != nil {
				t.Fatal(err)
			}
			for until := time.Now().Add(60 * time.Second); !exists(started) && time.Now().Before(until); {
				time.Sleep(20 * time.Millisecond)
			}
			_ = c.Process.Kill()
			_ = c.Wait()
			if got := readOr(filepath.Join(tree, "d/src.txt"), ""); got != "base\n" {
				t.Fatalf("control: after the kill src.txt reads %q", got)
			}

			got := xIn(t, main, nil, "lane", "verify-tree", revertPR)

			if got.code != 0 || readOr(filepath.Join(tree, "d/src.txt"), "") != "head\n" {
				t.Fatalf("exit %d, src.txt %q, want head's:\n%s", got.code, readOr(filepath.Join(tree, "d/src.txt"), ""), got.stdout)
			}
		})
	}
}

// two runs started together: one claims the tree, the other refuses, and the winner reads base's content throughout
func TestTwoRevertsNeverShareATree(t *testing.T) {
	t.Parallel()
	main, _, tree := revertWorld(t)
	if got := xIn(t, main, nil, "lane", "verify-tree", revertPR); got.code != 0 {
		t.Fatalf("control: %s", got.stdout)
	}
	dir := t.TempDir()
	results := make(chan ran, 2)
	for i := range 2 {
		log := filepath.Join(dir, fmt.Sprint("log", i))
		go func() {
			results <- revert(t, main, "sh", "-c", greenOnHead+"for s in 1 2 3 4 5 6; do cat src.txt >> "+log+"; sleep 0.5; done; echo '--- FAIL: TestNewOne (0.00s)'; echo '--- FAIL: TestNewTwo (0.00s)'; exit 1")
		}()
	}
	first, second := <-results, <-results

	if (first.code == 0) == (second.code == 0) {
		t.Fatalf("exits %d and %d, want one proof and one refusal:\n%s\n%s", first.code, second.code, first.stdout, second.stdout)
	}
	refused := first
	if first.code == 0 {
		refused = second
	}
	if !strings.Contains(refused.stdout, "holds") {
		t.Errorf("the refusal names no holder:\n%s", refused.stdout)
	}
	for i := range 2 {
		for line := range strings.SplitSeq(strings.TrimSpace(readOr(filepath.Join(dir, fmt.Sprint("log", i)), "")), "\n") {
			if line != "" && line != "base" {
				t.Errorf("run %d read %q mid-run", i, line)
			}
		}
	}
	assertHeadBack(t, tree)
}
