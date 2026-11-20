package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// a mod's files as a tree of «path: body» lines, for the reach function to read
func reachTree(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for path, body := range files {
		write(t, filepath.Join(dir, path), body)
	}
	return dir
}

var reachMod = map[string]string{
	"hooks/register.ts":    "import { score } from './rules/score.ts';\nexport const register = () => score;\n",
	"hooks/rules/score.ts": "export const score = 1;\n",
	"hooks/lonely.ts":      "export const lonely = 1;\n",
	"hooks/guard.ts":       "export const guard = 1;\n",
	"tests/guard.test.ts":  "// no import: the host loads the hook, the file carries its name\n",
	"tests/world.ts":       "import { register } from '../hooks/register.ts';\nexport const world = register;\n",
	"tests/a.test.ts":      "import { world } from './world.ts';\n",
	"tests/b.test.ts":      "import { world } from './world';\nimport('../hooks/rules/score.ts');\n",
	"tests/c.test.ts":      "export {};\n",
	"types/redact.d.ts":    "export {};\n",
	"hooks/hooks.json":     "{}\n",
	"FTR.md":               "x\n",
}

// the tests a change reaches: the test itself, what imports the changed file however deep (a world in between included, an import with
// or without its extension, a dynamic one), the test carrying a hooks file's name; docs and types reach nothing; a manifest reaches all
func TestModsReachFindsTheTestsAChangeReaches(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name       string
		changed    []string
		reached    string
		unreached  string
		reachesAll bool
	}{
		{"a test file is itself", []string{"tests/c.test.ts"}, "tests/c.test.ts", "", false},
		{"a hooks file through a world", []string{"hooks/register.ts"}, "tests/a.test.ts,tests/b.test.ts", "", false},
		{"a file two imports deep", []string{"hooks/rules/score.ts"}, "tests/a.test.ts,tests/b.test.ts", "", false},
		{"a hooks file by the name of its test", []string{"hooks/guard.ts"}, "tests/guard.test.ts", "", false},
		{"a hooks file nothing reaches", []string{"hooks/lonely.ts"}, "", "hooks/lonely.ts", false},
		{"a doc and a type", []string{"FTR.md", "types/redact.d.ts"}, "", "", false},
		{"a manifest", []string{"hooks/hooks.json"}, "", "", true},
		{"two changes, one unreached", []string{"tests/c.test.ts", "hooks/lonely.ts"}, "tests/c.test.ts", "hooks/lonely.ts", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			reached, unreached, all := testsReached(reachTree(t, reachMod), c.changed)

			if got := strings.Join(reached, ","); got != c.reached || strings.Join(unreached, ",") != c.unreached || all != c.reachesAll {
				t.Errorf("reached %q, unreached %q, all %v; want %q, %q, %v", got, strings.Join(unreached, ","), all, c.reached, c.unreached, c.reachesAll)
			}
		})
	}
}

// a node_modules dir and the engine's types are no part of the graph
func TestModsReachReadsNoNodeModulesOrEngineTypes(t *testing.T) {
	t.Parallel()
	dir := reachTree(t, map[string]string{
		"hooks/a.ts":                           "export const a = 1;\n",
		"tests/a.test.ts":                      "import '../hooks/a.ts';\n",
		"node_modules/dep/tests/dep.test.ts":   "import '../../../hooks/a.ts';\n",
		".claude-plugin/types/tests/t.test.ts": "import '../../../hooks/a.ts';\n",
	})

	reached, _, _ := testsReached(dir, []string{"hooks/a.ts"})

	if got := strings.Join(reached, ","); got != "tests/a.test.ts" {
		t.Errorf("reached %q, want only tests/a.test.ts", got)
	}
	if _, err := os.Stat(dir); err != nil {
		t.Fatal(err)
	}
}

// the fixture mod with a hooks file a test imports, one it names and one nothing reaches; the first launch count is the files the fake
// `claude plugin test` saw
func reachWorld(t *testing.T) (dir string, env []string, calls string) {
	t.Helper()
	dir, env = modsFixture(t)
	calls = filepath.Join(t.TempDir(), "calls")
	env = append(env, "CLAUDE_CALLS="+calls, "X_FRAME_ROOT="+dir, "X_STATE="+t.TempDir())
	write(t, filepath.Join(dir, modsDir, "m/hooks/x.ts"), "export const x = 1;\n")
	write(t, filepath.Join(dir, modsDir, "m/hooks/lonely.ts"), "export const lonely = 1;\n")
	write(t, filepath.Join(dir, modsDir, "m/tests/x.test.ts"), "import '../hooks/x.ts';\ngreen\n")
	commitAll(t, dir)
	turns := filepath.Join(t.TempDir(), "turns")
	write(t, filepath.Join(dir, "script/gate-queue.sh"), "#!/bin/sh\necho \"$*\" >> "+turns+"\n[ \"$1\" = --long ] && shift\nexec \"$@\"\n")
	env = append(env, "TURNS_LOG="+turns)
	return dir, env, calls
}

// a push or a test of a one-hook change runs the tests that change reaches, never the suite: the launches are counted
func TestModsEditRunsOnlyTheTestsAChangeReaches(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, file, body string
		verb             []string
		files            string
		line             string
		turns            int
	}{
		{"test: a hook a test imports", "hooks/x.ts", "export const x = 2;\n", []string{"test"}, "1", `"only":["tests/x.test.ts"]`, 0},
		{"push: the same", "hooks/x.ts", "export const x = 2;\n", []string{"push"}, "1", `"only":["tests/x.test.ts"]`, 0},
		{"a hook nothing reaches", "hooks/lonely.ts", "export const lonely = 2;\n", []string{"test"}, "", `"unreached":["hooks/lonely.ts"]`, 0},
		{"--whole", "hooks/x.ts", "export const x = 2;\n", []string{"test", "--whole"}, "3", `"passed":3`, 1},
		{"a manifest reaches every test", ".claude-plugin/plugin.json", `{"name": "m", "v": 2}` + "\n", []string{"test"}, "3", `"passed":3`, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env, calls := reachWorld(t)
			write(t, pullCopy(t, dir, env, modsDir+"m/"+c.file), c.body)

			out, errs, code := xStderr(t, dir, env, append([]string{"mods", "edit"}, c.verb...)...)

			if files := launchedFiles(t, calls); code != 0 || files != c.files || !strings.Contains(out+errs, c.line) {
				t.Errorf("exit %d, launches saw %q files, want %q and %q in:\n%s\n%s", code, files, c.files, c.line, out, errs)
			}
			if n := strings.Count(readFile0(envFile(env, "TURNS_LOG")), "--long claude plugin test"); n != c.turns {
				t.Errorf("%d whole suites took the long turn, want %d", n, c.turns)
			}
		})
	}
}

func envFile(env []string, key string) string { return envValue(env, key) }

// a file that times out runs once more and no oftener, said in the report: a loaded machine never multiplies its load; the launches
// are counted
func TestModsEditRerunsATimedOutFileOnceAndSaysSo(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, marker string
		code         int
		files, said  string
	}{
		{"a file that is slow once", "SLOW-ONCE", 0, "3,1", `"retried":["tests/a.test.ts"]`},
		{"a file that is always slow", "ALWAYS-SLOW", 1, "3,1", "rerun once: tests/a.test.ts"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env, calls := reachWorld(t)
			write(t, pullCopy(t, dir, env, modsDir+"m/tests/a.test.ts"), c.marker+"\n")

			out, errs, code := xStderr(t, dir, env, "mods", "edit", "test", "--whole")

			if files := launchedFiles(t, calls); code != c.code || files != c.files || !strings.Contains(out, c.said) {
				t.Errorf("exit %d, launches saw %q files, want %d, %q and %q in:\n%s\n%s", code, files, c.code, c.files, c.said, out, errs)
			}
		})
	}
}
