package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

const modAgents = modsDir + "m/AGENTS.md"

// the real gate scripts this file reds through, copied so a row reads what the commit hook reads
var realGateScripts = []string{
	"script/index-run.sh",
	"script/retired-names-check.ts",
	"script/lib/retired-names.ts",
	"script/lib/fleet-hazards-check.ts",
	"recipes/nurture-memory/scripts/memory-lint.ts",
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
	for _, path := range realGateScripts {
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

func TestModsEditTestNamesAGateItCannotRunAndExitsNonZero(t *testing.T) {
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
