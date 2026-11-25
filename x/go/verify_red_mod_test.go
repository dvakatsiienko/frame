package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// ported from red-proof's suite: a mod's red base names the failed test; its first mutant ran beside it, so two runs and no more
func TestVerifyRedRefusesAModsRedBase(t *testing.T) {
	t.Parallel()
	f := modRedFixture(t)
	write(t, filepath.Join(f.dir, f.file), "export const register = () => { /* MUTANT */ };\n")
	commitAll(t, f.dir)

	got, log := verifyRedIn(t, f, nil, f.file, "/* MUTANT */", "", f.test)

	if got.code != 1 || !strings.Contains(got.stdout, "a.test.ts reads the hook") || strings.Count(log, "\n") != 2 {
		t.Fatalf("exit %d, %d runs, want a refusal naming the failed test after the clean run and the mutant beside it:\n%s", got.code, strings.Count(log, "\n"), got.stdout)
	}
}

// a mod's clean run and its first mutant share nothing, so they run side by side: each run waits up to 5 s for the other to start
func TestVerifyRedRunsAModsCleanRunBesideItsFirstMutant(t *testing.T) {
	t.Parallel()
	f := modRedFixture(t)
	bin := strings.TrimPrefix(strings.SplitN(f.env[0], ":", 2)[0], "PATH=")
	write(t, filepath.Join(bin, "claude"), `#!/bin/sh
d="$3"
[ "$2" = validate ] && { echo "✔ Validation passed"; exit 0; }
echo start >> "$VERIFY_LOG"
i=0
while [ "$(grep -c start "$VERIFY_LOG")" -lt 2 ] && [ $i -lt 50 ]; do sleep 0.1; i=$((i + 1)); done
echo end >> "$VERIFY_LOG"
echo "tests/a.test.ts:"
if grep -q MUTANT "$d"/hooks/*; then echo "(fail) a.test.ts reads the hook [1.0ms]"; echo "  AssertionError: expected 1 to be 2"; exit 1; fi
echo "(pass) a.test.ts [1.0ms]"; echo "Ran 1 tests across 1 files."
`)

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed || log != "start\nstart\nend\nend\n" {
		t.Fatalf("exit %d, data %v, the runs logged %q, want red off two runs that overlapped:\n%s", got.code, got.data, log, got.stdout)
	}
}

// exit lines 7 and 12: a mod with two hooks, one named test; the runner's load error reads broken whatever it reddened, while
// an assertion that quotes a load word is a real red, the one red-proof read as «did not load»
func TestVerifyRedReadsAModsLoadErrorApartFromARed(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, replacement, verdict string
		code                       int
		tests                      []string
	}{
		{"one named test went red", "() => { /* MUTANT */ }", verdictRed, 0, []string{"a.test.ts reads the hook"}},
		{"a load error beside a failed assertion", "() => { /* LOAD-BREAK */ }", verdictBroken, 1, nil},
		{"an assertion quoting a load word", "() => { /* QUOTES-LOAD */ }", verdictRed, 0, []string{"a.test.ts names the load error"}},
		{"a hook that does not parse", "() => { PARSE-ERROR }", verdictBroken, 1, nil},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := modRedFixture(t)
			write(t, filepath.Join(f.dir, modsDir, "m/hooks/second.ts"), "export const second = () => {};\n")
			commitAll(t, f.dir)

			got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, c.replacement, f.test)

			rows := pairRows(t, got)
			if got.code != c.code || len(rows) != 1 || rows[0]["verdict"] != c.verdict {
				t.Fatalf("exit %d, pairs %v, want %s and exit %d:\n%s", got.code, rows, c.verdict, c.code, got.stdout)
			}
			var tests []string
			named, _ := rows[0]["tests"].([]any)
			for _, test := range named {
				tests = append(tests, test.(string))
			}
			if strings.Join(tests, ",") != strings.Join(c.tests, ",") {
				t.Fatalf("the row names %v, want %v: only the named test file runs", tests, c.tests)
			}
		})
	}
}
