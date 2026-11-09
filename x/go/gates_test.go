package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

const modAgents = modsDir + "m/AGENTS.md"

// every path outside x/go its tests read, one list the commit hook reads too
const xGoReadsFile = "script/lib/x-go-reads.txt"

func xGoReads(t *testing.T) []string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("../..", xGoReadsFile))
	if err != nil {
		t.Fatal(err)
	}
	var paths []string
	for line := range strings.Lines(string(raw)) {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			paths = append(paths, line)
		}
	}
	return paths
}

// a ../.. read that names no literal path: the shapes known, each keyed by its file so an exemption covers only its own line,
// and the path each reads ("" reads the whole repo, one level only, or a path off the list itself)
type outsideReadShape struct{ file, shape string }

var outsideReadShapes = map[outsideReadShape]string{
	{"gate_turn_test.go", `"../../" + gateQueueScript`}:       gateQueueScript,
	{"gates_test.go", `readHookGates("../..",`}:               "lefthook.yaml",
	{"x_go_reads_test.go", `readHookGates("../..",`}:          "lefthook.yaml",
	{"as_test.go", `filepath.Abs("../..")`}:                   "",
	{"replaces_test.go", `filepath.Abs("../..")`}:             "",
	{"gates_test.go", `filepath.Join("../..", xGoReadsFile)`}: xGoReadsFile,
	{"gates_test.go", `filepath.Join("../..", path)`}:         "",
}

var outsideLiteral = regexp.MustCompile(`"\.\./\.\./([^"]+)"`)

func TestXGoReadsNamesEveryPathItsTestsRead(t *testing.T) {
	t.Parallel()
	listed := xGoReads(t)
	files, err := filepath.Glob("*_test.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		for n, line := range strings.Split(string(raw), "\n") {
			if !strings.Contains(line, `"../..`) || strings.Contains(line, "MustCompile") || strings.HasPrefix(strings.TrimSpace(line), `{"`) {
				continue
			}
			var reads []string
			for _, m := range outsideLiteral.FindAllStringSubmatch(line, -1) {
				reads = append(reads, m[1])
			}
			if len(reads) == 0 {
				known := false
				for key, path := range outsideReadShapes {
					if key.file == file && strings.Contains(line, key.shape) {
						known = true
						if path != "" {
							reads = append(reads, path)
						}
					}
				}
				if !known {
					t.Errorf("%s:%d reads outside x/go in a shape the list test cannot name; add it to outsideReadShapes:\n%s", file, n+1, line)
				}
			}
			for _, path := range reads {
				// a tool binary, a symlink target inside a fixture, a title string: none reads a repo file
				if strings.HasPrefix(path, "node_modules/") || strings.Contains(line, "os.Symlink(") || strings.Contains(line, `"title":`) {
					continue
				}
				if !slices.Contains(listed, path) {
					t.Errorf("%s:%d reads %s, missing from %s", file, n+1, path, xGoReadsFile)
				}
			}
		}
	}
}

// the hook's shape: tsc with the mods' strict flags, the real retired-names and memory-lint, a commit-only suite
const realGatesHook = `pre-commit:
  parallel: true
  commands:
    typecheck-mods:
      glob: "*.ts"
      run: "\"$X_TSC\" --noEmit --strict --noUnusedLocals --target esnext --module esnext --moduleResolution bundler --allowImportingTsExtensions {staged_files}"
    memory-lint:
      run: node recipes/nurture-memory/scripts/memory-lint.ts {staged_files}
    retired-names:
      run: node script/retired-names-check.ts
    mods-test:
      glob: "` + modsDir + `**"
      tags: [commit-only]
      run: script/index-run.sh sh -c 'echo suite ran >> "$X_SUITE_RAN"'
    only-speak:
      glob: "speak/**"
      run: exit 1
`

func gateFixture(t *testing.T, hook string) (string, []string) {
	t.Helper()
	dir, env := modsFixture(t)
	// copied so a row reads what the commit hook reads
	for _, path := range xGoReads(t) {
		body, err := os.ReadFile(filepath.Join("../..", path))
		if err != nil {
			t.Fatal(err)
		}
		write(t, filepath.Join(dir, path), string(body))
	}
	write(t, filepath.Join(dir, "pnpm-workspace.yaml"), "packages: []\n")
	write(t, filepath.Join(dir, "recipes/nurture-memory/scripts/memory-budgets.tsv"), "# path\tbudget bytes\treason\n"+modAgents+"\t40\tfixture\n")
	write(t, filepath.Join(dir, modAgents), "# m\n")
	write(t, filepath.Join(dir, "lefthook.yaml"), hook)
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "gates")
	tsc, err := filepath.Abs("../../node_modules/.bin/tsc")
	if err != nil {
		t.Fatal(err)
	}
	return dir, append(env, "X_TSC="+tsc, "X_STATE="+t.TempDir(), "X_SUITE_RAN="+filepath.Join(t.TempDir(), "suite"), "MEMORY_LINT_STATES=/dev/null")
}

func edited(t *testing.T, dir string, env []string, path, body string) {
	t.Helper()
	write(t, pullCopy(t, dir, env, path), body)
}

func verdictsOf(got ran) map[string]string {
	verdicts := map[string]string{}
	gates, _ := got.data["gates"].([]any)
	for _, g := range gates {
		row, _ := g.(map[string]any)
		name, _ := row["gate"].(string)
		verdicts[name], _ = row["verdict"].(string)
	}
	return verdicts
}

func TestModsEditTestRedsTheGateTheCommitWouldRed(t *testing.T) {
	t.Parallel()
	retired := "cc" + "lio"
	cases := []struct{ name, path, body, gate string }{
		{"an unused variable", modHooks, "const unused = 1;\nexport const register = () => {};\n", "typecheck-mods"},
		{"a dropped import", modHooks, "import { gone } from './gone.ts';\nexport const register = () => gone;\n", "typecheck-mods"},
		{"a retired name", modHooks, "// the " + retired + " seat\nexport const register = () => {};\n", "retired-names"},
		{"a budget overrun", modAgents, "# m\n" + strings.Repeat("a line past its budget\n", 4), "memory-lint"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := gateFixture(t, realGatesHook)
			edited(t, dir, env, c.path, c.body)
			got := xIn(t, dir, env, "mods", "edit", "test")
			if got.code != 1 || !strings.Contains(got.stdout, c.gate) {
				t.Fatalf("exit %d, want 1 naming %s:\n%s", got.code, c.gate, got.stdout)
			}
			if readFile(t, filepath.Join(dir, c.path)) == c.body {
				t.Error("the overlay reached the repo")
			}
		})
	}
}

func TestModsEditTestPrintsEachGatesVerdictInTheHooksOrder(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, realGatesHook)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	got := xIn(t, dir, env, "mods", "edit", "test")
	if got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	want := map[string]string{"typecheck-mods": gateGreen, "memory-lint": gateGreen, "retired-names": gateGreen, "mods-test": gateCommits, "only-speak": gateNoPath}
	verdicts := verdictsOf(got)
	for name, verdict := range want {
		if verdicts[name] != verdict {
			t.Errorf("%s reads %q, want %q", name, verdicts[name], verdict)
		}
	}
	order := regexp.MustCompile(`(?s)typecheck-mods.*memory-lint.*retired-names.*mods-test.*only-speak`)
	if !order.MatchString(got.stdout) {
		t.Errorf("the verdicts left the hook's order:\n%s", got.stdout)
	}
}

func TestModsEditTestGateReadsTheOverlaysBytesNeverTheTrees(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, `pre-commit:
  commands:
    the-bytes:
      glob: "*.ts"
      run: grep -q OVERLAY {staged_files}
`)
	edited(t, dir, env, modHooks, "// OVERLAY\n")
	if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
		t.Errorf("a gate missed the overlay's bytes: exit %d\n%s", got.code, got.stdout)
	}
	write(t, filepath.Join(dir, modHooks), "// OVERLAY in the tree alone\n")
	edited(t, dir, env, modHooks, "// no marker\n")
	if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 1 {
		t.Errorf("a gate read the tree over the overlay: exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestPassesOnlyTheGlobsPathsToAGate(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, `pre-commit:
  commands:
    only-md:
      glob: "*.md"
      run: test "{staged_files}" = "`+modAgents+`"
    no-md:
      glob: "`+modsDir+`**"
      exclude:
        - "**/*.md"
      run: test "{staged_files}" = "`+modHooks+`"
`)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	edited(t, dir, env, modAgents, "# m, edited\n")
	if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
		t.Errorf("exit %d:\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestRunsADocOnlyEditPastAnExcludedGate(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, `pre-commit:
  commands:
    no-md:
      glob: "`+modsDir+`**"
      exclude:
        - "**/*.md"
      run: exit 1
`)
	edited(t, dir, env, modAgents, "# m, edited\n")
	got := xIn(t, dir, env, "mods", "edit", "test")
	if got.code != 0 || verdictsOf(got)["no-md"] != gateNoPath {
		t.Errorf("exit %d, %q; want 0 and %q\n%s", got.code, verdictsOf(got)["no-md"], gateNoPath, got.stdout)
	}
}

func TestModsEditTestExitsNonZeroNamingAGateItCannotRun(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, gate, why string }{
		{"a placeholder x cannot fill", "      run: echo {push_files}\n", "{push_files}"},
		{"a key x does not read", "      skip: merge\n      run: exit 0\n", "skip"},
		{"no run line", "      script: a.sh\n", "script"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := gateFixture(t, "pre-commit:\n  commands:\n    odd-gate:\n"+c.gate)
			edited(t, dir, env, modHooks, "export const register = () => 1;\n")
			got := xIn(t, dir, env, "mods", "edit", "test")
			if got.code == 0 || !strings.Contains(got.stdout, "odd-gate") || !strings.Contains(got.stdout, c.why) {
				t.Errorf("exit %d, want non-zero naming odd-gate and %s:\n%s", got.code, c.why, got.stdout)
			}
		})
	}
}

func TestModsEditTestRedsAThrowingHookInATouchedTest(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, realGatesHook)
	edited(t, dir, env, modTestA, "HOOK-THROWS\n")
	got := xIn(t, dir, env, "mods", "edit", "test")
	if got.code != 1 || !strings.Contains(got.stdout, "hook was skipped") {
		t.Errorf("exit %d, want 1 naming the skipped hook:\n%s", got.code, got.stdout)
	}
}

// the real mods/test.ts behind a real pre-commit hook, on a branch so the commit runs no ci job
func modsChain(t *testing.T) (dir string, env []string, tests func() int) {
	t.Helper()
	const suite = modsDir + "test.ts"
	if !slices.Contains(xGoReads(t), suite) {
		t.Fatalf("modsChain reads %s, which is off %s", suite, xGoReadsFile)
	}
	dir, env = gateFixture(t, "pre-commit:\n  commands:\n    mods-test:\n      glob: \""+modsDir+"**\"\n      tags: [commit-only]\n      run: script/index-run.sh node "+suite+" --skip-tested\n")
	gitT(t, dir, "checkout", "-q", "-b", "codie/chain")
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexec script/index-run.sh node "+suite+" --skip-tested >> \"$CLAUDE_CALLS.out\"\n")
	calls := filepath.Join(t.TempDir(), "calls")
	return dir, append(env, "CLAUDE_CALLS="+calls), func() int {
		logged, _ := os.ReadFile(calls)
		n := 0
		for _, call := range nonBlank(string(logged)) {
			if call == "test" {
				n++
			}
		}
		return n
	}
}

func commitHooks(t *testing.T, dir string, env []string) {
	t.Helper()
	if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
}

func pushOverlay(t *testing.T, dir string, env []string) {
	t.Helper()
	if got := xIn(t, dir, env, "mods", "edit", "push"); got.code != 0 {
		t.Fatalf("push: exit %d\n%s", got.code, got.stdout)
	}
}

func testOverlay(t *testing.T, dir string, env []string) {
	t.Helper()
	if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
		t.Fatalf("test: exit %d\n%s", got.code, got.stdout)
	}
}

func envValue(env []string, key string) string {
	for _, kv := range env {
		if value, ok := strings.CutPrefix(kv, key+"="); ok {
			return value
		}
	}
	return ""
}

func TestModsChainRunsAModsTestsOnce(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	commitHooks(t, dir, env)
	if n := tests(); n != 1 {
		t.Errorf("the mod's tests ran %d times across test, push and commit, want 1", n)
	}
}

func TestModsChainRerunsBytesTheOverlayNeverTested(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	edited(t, dir, env, modHooks, "export const register = () => 2;\n")
	pushOverlay(t, dir, env)
	commitHooks(t, dir, env)
	if n := tests(); n != 2 {
		t.Errorf("the mod's tests ran %d times, want 2: test, push on new bytes", n)
	}
}

func TestModsChainCountsAPushsTestRun(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	pushOverlay(t, dir, env)
	commitHooks(t, dir, env)
	if n := tests(); n != 1 {
		t.Errorf("the mod's tests ran %d times across push and commit, want 1", n)
	}
}

func TestGreenOverlayRecordsNoBytesItsTestsNeverRead(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	copied := pullCopy(t, dir, env, modHooks)
	write(t, copied, "export const register = () => 1;\n")
	env = append(env, "CLAUDE_MID_TEST=echo '// saved mid-test' >> "+copied)
	testOverlay(t, dir, env)
	if record, _ := os.ReadFile(filepath.Join(envValue(env, "X_STATE"), gatesGreenFile)); strings.Contains(string(record), "mod m") {
		t.Errorf("a save during the tests was recorded as tested:\n%s", record)
	}
}

func TestModsChainRerunsARecordPastItsHour(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	record := filepath.Join(envValue(env, "X_STATE"), gatesGreenFile)
	_, rest, ok := strings.Cut(readFile(t, record), "\t")
	if !ok {
		t.Fatalf("no record in %s", record)
	}
	write(t, record, "1000\t"+rest)
	commitHooks(t, dir, env)
	if n := tests(); n != 2 {
		t.Errorf("the mod's tests ran %d times, want 2: a record past its hour stands for nothing", n)
	}
}

// what the suite printed across the chain's commits
func suiteSaid(t *testing.T, env []string) string {
	t.Helper()
	return readFile(t, envValue(env, "CLAUDE_CALLS")+".out")
}

// the chain behind real lefthook hooks and the real biome, whose rewrite the commit's format step makes
func modsChainFormatted(t *testing.T) (string, []string, func() int) {
	t.Helper()
	dir, env, tests := modsChain(t)
	lefthook, err := filepath.Abs("../../node_modules/.bin/lefthook")
	if err != nil {
		t.Fatal(err)
	}
	biome, err := filepath.Abs("../../node_modules/.bin/biome")
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "lefthook.yaml"), "pre-commit:\n  commands:\n    mods-test:\n      glob: \""+modsDir+"**\"\n      tags: [commit-only]\n      run: script/index-run.sh sh -c 'node "+modsDir+"test.ts --skip-tested >> \"$CLAUDE_CALLS.out\"'\n")
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexec "+lefthook+" run pre-commit --no-auto-install \"$@\"\n")
	write(t, filepath.Join(dir, "biome.json"), "{}\n")
	write(t, filepath.Join(dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(dir, "node_modules/.bin/biome"), "#!/bin/sh\nexec "+biome+" \"$@\"\n")
	gitT(t, dir, "add", "lefthook.yaml", "biome.json", ".gitignore")
	gitT(t, dir, "commit", "-q", "-m", "real hooks")
	return dir, env, tests
}

func TestModsChainSkipsBytesTheFormatStepRewrites(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChainFormatted(t)
	saw := filepath.Join(t.TempDir(), "saw")
	env = append(env, "CLAUDE_SAW="+saw)
	const raw = "import { b } from './b.ts';\nimport { a } from './a.ts';\n\nexport const register = () => [a, b];\n"
	edited(t, dir, env, modHooks, raw)
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	commitHooks(t, dir, env)
	committed := gitT(t, dir, "show", "HEAD:"+modHooks)
	if strings.TrimSpace(raw) == committed {
		t.Fatalf("the format step rewrote nothing, so this proves nothing:\n%s", committed)
	}
	if n := tests(); n != 1 {
		t.Errorf("the mod's tests ran %d times across test, push and commit, want 1\n%s", n, suiteSaid(t, env))
	}
	if said := suiteSaid(t, env); !strings.Contains(said, "skipped on tested bytes") {
		t.Errorf("the suite never said it skipped:\n%s", said)
	}
	if read := readFile(t, saw); strings.TrimSpace(read) != committed {
		t.Errorf("the overlay's tests read other bytes than the commit holds:\n%s\nagainst:\n%s", read, committed)
	}
}

func TestModsChainSkipsAcrossTwoOverlaysOfOneMod(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChainFormatted(t)
	other := modsDir + "m/hooks/other.ts"
	edited(t, dir, env, modHooks, "import { b } from './b.ts';\nimport { a } from './a.ts';\n\nexport const register = () => [a, b];\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	edited(t, dir, env, other, "export const other = 1;\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	if got := xIn(t, dir, env, "mods", "edit", "status"); len(anyList(got.data["edited"])) != 0 {
		t.Errorf("a push left an edit in scratch:\n%s", got.stdout)
	}
	if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks, other); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if n := tests(); n != 2 {
		t.Errorf("the mod's tests ran %d times across two overlays and a commit, want 2\n%s", n, suiteSaid(t, env))
	}
}

func TestModsEditPushKeepsASaveMadeDuringItsTests(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChainFormatted(t)
	copied := pullCopy(t, dir, env, modHooks)
	write(t, copied, "export const register = () => 1;\n")
	const saved = "// saved mid-test\n"
	if got := xIn(t, dir, append(env[:len(env):len(env)], "CLAUDE_MID_TEST=printf '"+saved+"' >> "+copied), "mods", "edit", "push"); got.code != 0 {
		t.Fatalf("push: exit %d\n%s", got.code, got.stdout)
	}
	if strings.Contains(readFile(t, filepath.Join(dir, modHooks)), "saved") {
		t.Errorf("the push wrote bytes its tests never read:\n%s", readFile(t, filepath.Join(dir, modHooks)))
	}
	if !strings.Contains(readFile(t, copied), "saved") {
		t.Errorf("the push overwrote a save in scratch:\n%s", readFile(t, copied))
	}
}

func TestModsEditPushKeepsBytesTheFormatStepLeavesAlone(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, path, body string }{
		{"last newlines of an .md", modsDir + "m/notes.md", "# notes\n\n\n"},
		{"a first indent of a .yaml", modsDir + "m/config.yaml", "  key: value\n  other: value\n"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env, _ := modsChainFormatted(t)
			// as biome-config-polished: biome's defaults reformat .md and .yaml too, on stdin and on a file alike
			write(t, filepath.Join(dir, "biome.json"), `{"yaml":{"formatter":{"enabled":false}},"markdown":{"formatter":{"enabled":false}}}`+"\n")
			gitT(t, dir, "add", "biome.json")
			gitT(t, dir, "commit", "-q", "-m", "as frame")
			edited(t, dir, env, c.path, c.body)
			pushOverlay(t, dir, env)
			if got := readFile(t, filepath.Join(dir, c.path)); got != c.body {
				t.Errorf("landed %q, want %q", got, c.body)
			}
			if got := xIn(t, dir, env, "lane", "commit", message(t), "--", c.path); got.code != 0 {
				t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
			}
			if got := readFile(t, filepath.Join(dir, c.path)); got != c.body {
				t.Errorf("the commit's format moved it to %q, so this file proves nothing", got)
			}
		})
	}
}

func TestModsEditFormatsEachCopyOnceARun(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChainFormatted(t)
	stub := filepath.Join(dir, "node_modules/.bin/biome")
	calls := filepath.Join(t.TempDir(), "biome")
	write(t, stub, "#!/bin/sh\necho \"$*\" >> "+calls+"\n"+strings.SplitN(readFile(t, stub), "\n", 2)[1])
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	n := 0
	for _, call := range nonBlank(readFile(t, calls)) {
		if strings.Contains(call, "--stdin-file-path="+modHooks) {
			n++
		}
	}
	if n != 1 {
		t.Errorf("the copy was formatted %d times in one run, want 1: its tests and its record could read two results", n)
	}
}

func anyList(v any) []any {
	list, _ := v.([]any)
	return list
}

func TestModsChainNamesNoWhyForAClockRead(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	write(t, filepath.Join(dir, modHooks), "export const register = () => Date.now();\n")
	if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks); got.code == 0 {
		t.Fatalf("a clock read committed\n%s", got.stdout)
	}
	if said := suiteSaid(t, env); !strings.Contains(said, "a clock read") || strings.Contains(said, "m ran:") {
		t.Errorf("want the clock read and no why:\n%s", said)
	}
}

func TestModsEditOnlyReadsTheFormattedBytes(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChainFormatted(t)
	saw := filepath.Join(t.TempDir(), "saw")
	env = append(env, "CLAUDE_SAW="+saw)
	edited(t, dir, env, modHooks, "import { b } from './b.ts';\nimport { a } from './a.ts';\n\nexport const register = () => [a, b];\n")
	if got := xIn(t, dir, env, "mods", "edit", "test", "--only", modTestA); got.code != 0 {
		t.Fatalf("--only: exit %d\n%s", got.code, got.stdout)
	}
	if read := readFile(t, saw); !strings.HasPrefix(read, "import { a }") {
		t.Errorf("--only read the raw scratch:\n%s", read)
	}
}

func TestModsChainRunsTheSuiteOnWhatTheGreenNeverRead(t *testing.T) {
	t.Parallel()
	saved := func(t *testing.T, dir string, env []string) []string {
		copied := pullCopy(t, dir, env, modHooks)
		write(t, copied, "export const register = () => 1;\n")
		testOverlay(t, dir, append(env[:len(env):len(env)], "CLAUDE_MID_TEST=echo '// saved mid-test' >> "+copied))
		write(t, filepath.Join(dir, modHooks), readFile(t, copied))
		return []string{modHooks}
	}
	changed := func(t *testing.T, dir string, env []string) []string {
		edited(t, dir, env, modHooks, "export const register = () => 1;\n")
		testOverlay(t, dir, env)
		pushOverlay(t, dir, env)
		write(t, filepath.Join(dir, modHooks), "export const register = () => 2;\n")
		return []string{modHooks}
	}
	second := func(t *testing.T, dir string, env []string) []string {
		edited(t, dir, env, modHooks, "export const register = () => 1;\n")
		testOverlay(t, dir, env)
		pushOverlay(t, dir, env)
		write(t, filepath.Join(dir, modsDir, "n/.claude-plugin/plugin.json"), "{}\n")
		write(t, filepath.Join(dir, modsDir, "n/hooks/register.ts"), "export const register = () => 1;\n")
		write(t, filepath.Join(dir, modsDir, "n/tests/a.test.ts"), "green\n")
		return []string{modHooks, modsDir + "n"}
	}
	stale := func(t *testing.T, dir string, env []string) []string {
		edited(t, dir, env, modHooks, "export const register = () => 1;\n")
		testOverlay(t, dir, env)
		pushOverlay(t, dir, env)
		record := filepath.Join(envValue(env, "X_STATE"), gatesGreenFile)
		_, rest, ok := strings.Cut(readFile(t, record), "\t")
		if !ok {
			t.Fatalf("no record in %s", record)
		}
		write(t, record, "1000\t"+rest)
		return []string{modHooks}
	}
	shared := func(t *testing.T, dir string, env []string) []string {
		edited(t, dir, env, modHooks, "export const register = () => 1;\n")
		testOverlay(t, dir, env)
		pushOverlay(t, dir, env)
		write(t, filepath.Join(dir, modsDir, "shared.ts"), "export {};\n")
		return []string{modHooks, modsDir + "shared.ts"}
	}
	cases := []struct {
		name  string
		setup func(*testing.T, string, []string) []string
		runs  int
		said  []string
	}{
		{"a byte changed after the green", changed, 2, []string{"m ran: other bytes"}},
		{"a save during the tests", saved, 2, []string{"m ran: no record"}},
		{"a second mod in the commit", second, 2, []string{"m: tests skipped, a green already read these bytes", "n ran: no record"}},
		{"a record past its hour", stale, 2, []string{"m ran: past its hour"}},
		{"a shared path under mods", shared, 2, []string{"m ran: a shared path"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env, tests := modsChain(t)
			paths := c.setup(t, dir, env)
			before := tests()
			if got := xIn(t, dir, env, append([]string{"lane", "commit", message(t), "--"}, paths...)...); got.code != 0 {
				t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
			}
			if tests() != before+1 || tests() != c.runs {
				t.Errorf("the suite ran %d times, %d of them at the commit, want %d", tests(), tests()-before, c.runs)
			}
			said := suiteSaid(t, env)
			for _, want := range c.said {
				if !strings.Contains(said, want) {
					t.Errorf("want %q in:\n%s", want, said)
				}
			}
		})
	}
}

func TestModsChainSkipsBesideASharedMarkdownFile(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	notes := modsDir + "NOTES.md"
	write(t, filepath.Join(dir, notes), "# notes\n")
	if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks, notes); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if n := tests(); n != 1 {
		t.Errorf("the suite ran %d times, want 1: no mods test reads an .md\n%s", n, suiteSaid(t, env))
	}
}

// the hook's suite went green, then a later step of the same commit refused it once
func redsAfterTheSuiteOnce(t *testing.T, dir string) {
	t.Helper()
	marker := filepath.Join(t.TempDir(), "refused")
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nscript/index-run.sh node "+modsDir+"test.ts --skip-tested >> \"$CLAUDE_CALLS.out\" || exit 1\n[ -e "+marker+" ] && exit 0\ntouch "+marker+"\nexit 1\n")
}

func TestModsChainRetryRunsNoSecondSuiteOnBytesTheHookPassed(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	redsAfterTheSuiteOnce(t, dir)
	write(t, filepath.Join(dir, modHooks), "export const register = () => 1;\n")
	if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks); got.code == 0 {
		t.Fatalf("the first attempt should be refused\n%s", got.stdout)
	}
	commitHooks(t, dir, env)
	if n := tests(); n != 1 {
		t.Errorf("the suite ran %d times across a refused attempt and its retry, want 1\n%s", n, suiteSaid(t, env))
	}
}

func TestAWholeModsRunLogsItsCpuAndASkippedOneLogsADash(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	redsAfterTheSuiteOnce(t, dir)
	write(t, filepath.Join(dir, modHooks), "export const register = () => 1;\n")
	if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks); got.code == 0 {
		t.Fatalf("the first attempt should be refused\n%s", got.stdout)
	}
	commitHooks(t, dir, env)

	rows := nonBlank(readFile(t, filepath.Join(envValue(env, "X_STATE"), "gate-steps.log")))
	if len(rows) < 2 {
		t.Fatalf("%d rows, want the suite's run and its skip:\n%q", len(rows), rows)
	}
	last := func(row string) string { return row[strings.LastIndex(row, "\t")+1:] }
	if whole := last(rows[0]); !regexp.MustCompile(`^\d+\.\d$`).MatchString(whole) {
		t.Errorf("the whole run's last column reads %q, want user + sys:\n%s", whole, rows[0])
	}
	if skipped := last(rows[len(rows)-1]); skipped != "-" {
		t.Errorf("the skipped run's last column reads %q, want -:\n%s", skipped, rows[len(rows)-1])
	}
}

func TestAModsRunOfPartOfTheModsLogsADash(t *testing.T) {
	t.Parallel()
	lastColumn := func(t *testing.T, env []string) string {
		t.Helper()
		rows := nonBlank(readFile(t, filepath.Join(envValue(env, "X_STATE"), "gate-steps.log")))
		if len(rows) == 0 {
			t.Fatal("no gate-steps row")
		}
		row := rows[len(rows)-1]
		return row[strings.LastIndex(row, "\t")+1:]
	}
	t.Run("one mod named", func(t *testing.T) {
		t.Parallel()
		dir, env, _ := modsChain(t)
		hand := exec.Command("bash", "script/index-run.sh", "node", modsDir+"test.ts", "m")
		hand.Dir, hand.Env = dir, append(append(cleanEnv(), "X_TEST=1"), env...)
		if out, err := hand.CombinedOutput(); err != nil {
			t.Fatalf("%v\n%s", err, out)
		}
		if got := lastColumn(t, env); got != "-" {
			t.Errorf("last column %q, want -", got)
		}
	})
	t.Run("a commit that leaves one mod untouched", func(t *testing.T) {
		t.Parallel()
		dir, env, _ := modsChain(t)
		sibling := filepath.Join(dir, modsDir, "n")
		write(t, filepath.Join(sibling, ".claude-plugin/plugin.json"), `{"name": "n"}`+"\n")
		write(t, filepath.Join(sibling, "tests/a.test.ts"), "green\n")
		write(t, filepath.Join(sibling, "hooks/register.ts"), "export const register = () => {};\n")
		gitT(t, dir, "add", ".")
		gitT(t, dir, "-c", "core.hooksPath=/dev/null", "commit", "-q", "-m", "a sibling mod")
		touched := modsDir + "n/hooks/register.ts"
		write(t, filepath.Join(dir, touched), "export const register = () => 1;\n")
		if got := xIn(t, dir, env, "lane", "commit", message(t), "--", touched); got.code != 0 {
			t.Fatalf("exit %d\n%s", got.code, got.stdout)
		}
		if got := lastColumn(t, env); got != "-" {
			t.Errorf("last column %q, want -", got)
		}
	})
}

func TestModsChainRetryRerunsARedSuite(t *testing.T) {
	t.Parallel()
	for _, red := range []string{"RED\n", "HOOK-THROWS\n", "DIES-QUIET\n"} {
		t.Run(strings.TrimSpace(red), func(t *testing.T) {
			t.Parallel()
			dir, env, tests := modsChain(t)
			write(t, filepath.Join(dir, modTestA), red)
			for range 2 {
				if got := xIn(t, dir, env, "lane", "commit", message(t), "--", modTestA); got.code == 0 {
					t.Fatalf("a red suite committed\n%s", got.stdout)
				}
			}
			if n := tests(); n != 2 {
				t.Errorf("the suite ran %d times, want 2: a red records nothing", n)
			}
		})
	}
}

// a hand run reads the working tree, never the index, so its green proves nothing a commit holds
func TestHandSkipTestedRecordsNothing(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	write(t, filepath.Join(dir, modHooks), "export const register = () => 1;\n")
	hand := exec.Command("node", modsDir+"test.ts", "--skip-tested")
	hand.Dir = dir
	// a gate's own go tests inherit this; here no gate runs
	hand.Env = slices.DeleteFunc(append(append(cleanEnv(), "X_TEST=1"), env...), func(pair string) bool {
		return strings.HasPrefix(pair, "INDEX_RUN_BRANCH=")
	})
	if out, err := hand.CombinedOutput(); err != nil {
		t.Fatalf("%v\n%s", err, out)
	}
	if record := readFile(t, filepath.Join(envValue(env, "X_STATE"), gatesGreenFile)); strings.Contains(record, "mod m") {
		t.Errorf("a hand run recorded a green:\n%s", record)
	}
}

func TestHandModsTestSkipsNothing(t *testing.T) {
	t.Parallel()
	dir, env, tests := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	hand := exec.Command("node", modsDir+"test.ts")
	hand.Dir = dir
	hand.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	if out, err := hand.CombinedOutput(); err != nil {
		t.Fatalf("%v\n%s", err, out)
	}
	if n := tests(); n != 2 {
		t.Errorf("the mod's tests ran %d times, want 2: a hand run skips nothing", n)
	}
}

func TestModsEditTestRedsTheClockReadTheCommitWouldRed(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => Date.now();\n")
	got := xIn(t, dir, env, "mods", "edit", "test")
	if got.code != 1 || verdictsOf(got)["mods-test"] == gateCommits {
		t.Errorf("exit %d, mods-test %q: a clock read the commit reds passed the overlay\n%s", got.code, verdictsOf(got)["mods-test"], got.stdout)
	}
	if !strings.Contains(got.stdout, "mods-test") {
		t.Errorf("the red names no gate:\n%s", got.stdout)
	}
}

func TestCommitRedsAClockReadThoughItsBytesPassed(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	edited(t, dir, env, modHooks, "export const register = () => Date.now();\n")
	pushOverlay(t, dir, env)
	got := xIn(t, dir, env, "lane", "commit", message(t), "--", modHooks)
	if got.code != 1 {
		t.Errorf("exit %d, want 1: a clock read reds at the commit\n%s", got.code, got.stdout)
	}
}

func TestGreenOverlayKeepsTheRecordsLast200Lines(t *testing.T) {
	t.Parallel()
	dir, env, _ := modsChain(t)
	record := filepath.Join(envValue(env, "X_STATE"), gatesGreenFile)
	write(t, record, strings.Repeat("1000\tmod old\tabc\tmods-test\n", 250))
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	lines := nonBlank(readFile(t, record))
	if len(lines) != 200 || !strings.Contains(lines[199], "mod m") {
		t.Errorf("%d lines, last %q; want 200 ending on the new record", len(lines), lines[len(lines)-1])
	}
}

func TestModsEditTestGateSeesOnlyTheOverlaysPaths(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, `pre-commit:
  commands:
    the-paths:
      run: test "{staged_files}" = "`+modHooks+`"
`)
	write(t, filepath.Join(dir, modAgents), "# a peer's half-done edit\n")
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
		t.Errorf("a gate read a peer's dirt in the mod: exit %d\n%s", got.code, got.stdout)
	}
}

func TestModsEditTestRunsTheGatesBesideARedTest(t *testing.T) {
	t.Parallel()
	dir, env := gateFixture(t, realGatesHook)
	edited(t, dir, env, modTestA, "HOOK-THROWS\n")
	edited(t, dir, env, modHooks, "// the c"+"clio seat\nexport const register = () => {};\n")
	got := xIn(t, dir, env, "mods", "edit", "test")
	for _, want := range []string{"hook was skipped", "retired-names"} {
		if got.code != 1 || !strings.Contains(got.stdout, want) {
			t.Errorf("exit %d, want 1 naming %s:\n%s", got.code, want, got.stdout)
		}
	}
}

// a commit's own format step fixes an import order, so the overlay's format gate reads what that step would leave
func TestModsEditTestFormatGateReadsWhatTheCommitsFormatLeaves(t *testing.T) {
	t.Parallel()
	biome, err := filepath.Abs("../../node_modules/.bin/biome")
	if err != nil {
		t.Fatal(err)
	}
	dir, env := gateFixture(t, "pre-commit:\n  commands:\n    format:\n      glob: \"*.ts\"\n      run: "+biome+" check --no-errors-on-unmatched {staged_files}\n")
	write(t, filepath.Join(dir, "biome.json"), "{}\n")
	write(t, filepath.Join(dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(dir, "node_modules/.bin/biome"), "#!/bin/sh\nexec "+biome+" \"$@\"\n")
	gitT(t, dir, "add", "biome.json", ".gitignore")
	gitT(t, dir, "commit", "-q", "-m", "biome")
	edited(t, dir, env, modHooks, "import { b } from './b.ts';\nimport { a } from './a.ts';\n\nexport const register = () => [a, b];\n")
	got := xIn(t, dir, env, "mods", "edit", "test")
	if got.code != 0 || verdictsOf(got)["format"] != gateGreen {
		t.Errorf("exit %d, format %q: an import order the commit fixes itself reds the overlay\n%s", got.code, verdictsOf(got)["format"], got.stdout)
	}
}

func TestFrameHookHoldsNoGateTheOverlayCannotRun(t *testing.T) {
	t.Parallel()
	for _, hook := range []string{"pre-commit", "commit-msg"} {
		gates, err := readHookGates("../..", hook)
		if err != nil || len(gates) == 0 {
			t.Fatalf("%s: %d gates, %v", hook, len(gates), err)
		}
		for _, g := range gates {
			if g.cannot != "" {
				t.Errorf("%s's %s: %s", hook, g.name, g.cannot)
			}
		}
	}
}

func TestFrameHookKeepsTheModsSuiteTheCommits(t *testing.T) {
	t.Parallel()
	gates, err := readHookGates("../..", "pre-commit")
	if err != nil {
		t.Fatal(err)
	}
	for _, g := range gates {
		if suite := strings.Contains(g.run, "mods:test"); suite != g.commitOnly {
			t.Errorf("%s: runs the suite %v, commit-only %v", g.name, suite, g.commitOnly)
		}
	}
}

func TestGateGlobReadsTheHooksGlobs(t *testing.T) {
	t.Parallel()
	cases := []struct {
		glob, path string
		match      bool
	}{
		{"*.{js,ts,tsx}", "a.ts", true},
		{"*.{js,ts,tsx}", modHooks, true},
		{"*.{js,ts,tsx}", "a.md", false},
		{modsDir + "**", modHooks, true},
		{modsDir + "**", "speak/a.ts", false},
		{"**/*.md", modAgents, true},
		{"**/*.md", "a.md", false},
		{"home/.claude/rules/fleet-hazards*.md", "home/.claude/rules/fleet-hazards-files.md", true},
		{"speak/**", "speak/a.ts", true},
		{"a.ts", "ba.ts", false},
		{"a?ts", "a.ts", true},
	}
	for _, c := range cases {
		matcher, err := gateGlob(c.glob)
		if err != nil {
			t.Fatal(err)
		}
		if got := matcher.MatchString(c.path); got != c.match {
			t.Errorf("%s on %s: %v, want %v", c.glob, c.path, got, c.match)
		}
	}
}
