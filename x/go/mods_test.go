package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// a frame-shaped repo with one mod, and a fake `claude` reading markers the tests plant: PARSE-ERROR in a hooks file
// fails the validator, RED in a test fails that test, NO-IMPORT makes its file fail to load
func modsFixture(t *testing.T) (dir string, env []string) {
	t.Helper()
	dir = repo(t)
	mod := filepath.Join(dir, modsDir, "m")
	write(t, filepath.Join(mod, ".claude-plugin/plugin.json"), `{"name": "m"}`+"\n")
	write(t, filepath.Join(mod, "hooks/register.ts"), "export const register = () => {};\n")
	write(t, filepath.Join(mod, "tests/a.test.ts"), "green\n")
	write(t, filepath.Join(mod, "tests/b.test.ts"), "green\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "mod")
	bin := t.TempDir()
	write(t, filepath.Join(bin, "claude"), `#!/bin/sh
d="$3"
if [ "$2" = validate ]; then
  if grep -q PARSE-ERROR "$d"/hooks/* 2>/dev/null; then echo "  ❯ modules../register.ts: m: does not parse: PARSE-ERROR (line 1)"; echo "✘ Validation failed"; exit 1; fi
  echo "✔ Validation passed"; exit 0
fi
red=0
for f in "$d"/tests/*.test.ts; do
  n=$(basename "$f")
  echo "tests/$n:"
  if grep -q NO-IMPORT "$f"; then echo "(fail) the file did not load"; red=1
  elif grep -q RED "$f"; then echo "(fail) $n is red [1.0ms]"; red=1
  else echo "(pass) $n [1.0ms]"; fi
done
exit $red
`)
	return dir, []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "CLAUDE_JOB_DIR=" + t.TempDir()}
}

func pullCopy(t *testing.T, dir string, env []string, path string) string {
	t.Helper()
	got := xIn(t, dir, env, "mods", "edit", "pull", path)
	copies, _ := got.data["copies"].([]any)
	if got.code != 0 || len(copies) != 1 {
		t.Fatalf("pull %s: exit %d\n%s", path, got.code, got.stdout)
	}
	return copies[0].(string)
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	body, _ := os.ReadFile(path)
	return string(body)
}

const modHooks = modsDir + "m/hooks/register.ts"
const modTestA = modsDir + "m/tests/a.test.ts"
const modTestB = modsDir + "m/tests/b.test.ts"

func TestModsEditPushLandsAGreenEdit(t *testing.T) {
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	write(t, copyA, "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code != 0 || readFile(t, filepath.Join(dir, modTestA)) != "green, edited\n" {
		t.Fatalf("exit %d, file %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

// exit 1: a red test keeps the edit out of the mod, and test shows the same red
func TestModsEditPushRefusesARedTestAndWritesNothing(t *testing.T) {
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	write(t, copyA, "RED\n")

	pushed := xIn(t, dir, env, "mods", "edit", "push")
	tested := xIn(t, dir, env, "mods", "edit", "test")

	if pushed.code == 0 || !strings.Contains(pushed.stdout, "a.test.ts is red") {
		t.Errorf("push: exit %d, want the red test named\n%s", pushed.code, pushed.stdout)
	}
	if readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Errorf("the red edit reached the mod")
	}
	if tested.code == 0 || !strings.Contains(tested.stdout, "a.test.ts is red") {
		t.Errorf("test: exit %d, want the same red\n%s", tested.code, tested.stdout)
	}
}

// exit 2b: a hooks file that does not parse is refused by the validator before any write, every test green (PK-64)
func TestModsEditPushRefusesAnUnparseableHooksFileBeforeAnyWrite(t *testing.T) {
	dir, env := modsFixture(t)
	copyHooks := pullCopy(t, dir, env, modHooks)
	write(t, copyHooks, "export const register = () => { PARSE-ERROR\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || !strings.Contains(got.stdout, "does not parse") {
		t.Errorf("exit %d, want the parse error named\n%s", got.code, got.stdout)
	}
	if !strings.HasPrefix(readFile(t, filepath.Join(dir, modHooks)), "export const register = () => {};") {
		t.Errorf("the unparseable hooks file reached the mod")
	}
}

// exit 2: an unpulled file in scratch, or a target the push cannot write as a file, refuses the whole push
func TestModsEditPushWritesNothingWhenOnePathCannotLand(t *testing.T) {
	cases := []struct {
		name, want string
		setup      func(t *testing.T, dir string, env []string)
	}{
		{"an unpulled file in scratch", "was never pulled", func(t *testing.T, dir string, env []string) {
			copyA := pullCopy(t, dir, env, modTestA)
			write(t, filepath.Join(filepath.Dir(copyA), "c.test.ts"), "green\n")
		}},
		{"a target that is a directory", "is a directory", func(t *testing.T, dir string, env []string) {
			copyC := pullCopy(t, dir, env, modsDir+"m/tests/c.test.ts")
			write(t, copyC, "green\n")
			if err := os.MkdirAll(filepath.Join(dir, modsDir, "m/tests/c.test.ts"), 0o755); err != nil {
				t.Fatal(err)
			}
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir, env := modsFixture(t)
			copyA := pullCopy(t, dir, env, modTestA)
			write(t, copyA, "green, edited\n")
			c.setup(t, dir, env)

			got := xIn(t, dir, env, "mods", "edit", "push")

			if got.code == 0 || !strings.Contains(got.stdout, c.want) {
				t.Errorf("exit %d, want %q\n%s", got.code, c.want, got.stdout)
			}
			if readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
				t.Errorf("a.test.ts was written though the push was refused")
			}
		})
	}
}

func TestModsEditPushAddsAnUnpulledFileNamedWithAdd(t *testing.T) {
	dir, env := modsFixture(t)
	copyA := pullCopy(t, dir, env, modTestA)
	newPath := modsDir + "m/tests/c.test.ts"
	write(t, filepath.Join(filepath.Dir(copyA), "c.test.ts"), "green\n")

	got := xIn(t, dir, env, "mods", "edit", "push", "--add", newPath)

	if got.code != 0 || readFile(t, filepath.Join(dir, newPath)) != "green\n" {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}

// exit 2: a write that fails midway puts back every file written before it
func TestModsEditPushRestoresEveryWrittenFileWhenAWriteFails(t *testing.T) {
	dir, env := modsFixture(t)
	for _, path := range []string{modTestA, modTestB} {
		write(t, pullCopy(t, dir, env, path), "green, edited\n")
	}
	target := filepath.Join(dir, modTestB)
	if err := os.Chmod(target, 0o444); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(target, 0o644) })

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || !strings.Contains(got.stdout, "restored") {
		t.Errorf("exit %d, want the failed write named\n%s", got.code, got.stdout)
	}
	if a := readFile(t, filepath.Join(dir, modTestA)); a != "green\n" {
		t.Errorf("a.test.ts is %q after the failed push, want it restored", a)
	}
}

func TestModsEditPushRefusesAFileTheRepoChangedSinceThePull(t *testing.T) {
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "green, mine\n")
	write(t, filepath.Join(dir, modTestA), "green, theirs\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || readFile(t, filepath.Join(dir, modTestA)) != "green, theirs\n" {
		t.Errorf("exit %d, file %q\n%s", got.code, readFile(t, filepath.Join(dir, modTestA)), got.stdout)
	}
}

// exit 3: the edited tests run on HEAD's mod; one that errors there is «errored», never «failed», and nothing is written
func TestModsEditTestAgainstHeadNamesFailedApartFromErrored(t *testing.T) {
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestA), "RED on HEAD\n")
	write(t, pullCopy(t, dir, env, modTestB), "NO-IMPORT of a helper HEAD lacks\n")

	got := xIn(t, dir, env, "mods", "edit", "test", "--against", "HEAD")

	mods, _ := got.data["mods"].([]any)
	if len(mods) != 1 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	m := mods[0].(map[string]any)
	if !strings.Contains(strings.Join(anyStrings(m["failed"]), ";"), "a.test.ts") ||
		strings.Join(anyStrings(m["errored"]), ";") != "tests/b.test.ts" {
		t.Errorf("failed %v, errored %v", m["failed"], m["errored"])
	}
	if readFile(t, filepath.Join(dir, modTestA)) != "green\n" {
		t.Errorf("--against wrote into the mod")
	}
}

func TestModsEditPullRefusesAPathOutsideAMod(t *testing.T) {
	dir, env := modsFixture(t)

	got := xIn(t, dir, env, "mods", "edit", "pull", "readme.txt")

	if got.code != 2 || !strings.Contains(got.stdout, "not under") {
		t.Errorf("exit %d\n%s", got.code, got.stdout)
	}
}

func anyStrings(v any) []string {
	list, _ := v.([]any)
	var out []string
	for _, item := range list {
		out = append(out, item.(string))
	}
	return out
}

// the sample the stash's pnpm mods:test parser (mods/test.ts outcome) is held to as well: both read it the same way
func TestTestOutcomeReadsTheSharedSample(t *testing.T) {
	raw, err := os.ReadFile("../../home/.claude/plugin-x/mods/plugin-test.sample.txt")
	if err != nil {
		t.Fatal(err)
	}
	passed, failed, errored := testOutcome(string(raw))
	got := []string{strings.Join(failed, "|"), strings.Join(errored, "|")}
	if passed != 2 || got[0] != "a breaks" || got[1] != "tests/c.test.ts" {
		t.Fatalf("passed %d, failed %q, errored %q", passed, failed, errored)
	}
}
