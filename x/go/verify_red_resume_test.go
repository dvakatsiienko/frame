package main

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

// a go fixture whose second mutant hangs once, so a run can be cut there; each test run logs one line
func cutRedFixture(t *testing.T) (redFixture, string) {
	t.Helper()
	f := goRedFixture(t)
	marker := filepath.Join(t.TempDir(), "hung")
	write(t, filepath.Join(f.dir, "lib_test.go"), `package p

import (
	"os"
	"testing"
	"time"
)

func TestLimit(t *testing.T) {
	f, _ := os.OpenFile(os.Getenv("VERIFY_LOG"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	f.WriteString("ran\n")
	f.Close()
	if _, err := os.Stat(os.Getenv("HANG_MARKER")); Limit == 5 && err != nil {
		os.WriteFile(os.Getenv("HANG_MARKER"), nil, 0o644)
		time.Sleep(time.Minute)
	}
	if Limit != 3 {
		t.Fatalf("got %d", Limit)
	}
}
`)
	commitAll(t, f.dir)
	return f, marker
}

// exit line 5: a cut run resumes from its first unfinished pair; a change to its inputs or the tree starts over, and a finished
// run leaves nothing to replay
func TestVerifyRedResumesACutRun(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		change func(f redFixture, pairs string)
		runs   int
	}{
		{"the same inputs", func(redFixture, string) {}, 2},
		{"the pairs file changed", func(_ redFixture, pairs string) {
			body := readOr(pairs, "")
			write(t, pairs, body+"Limit = 3\tLimit = 7\n")
		}, 5},
		{"the tree gained an uncommitted file", func(f redFixture, _ string) { write(t, filepath.Join(f.dir, "notes.txt"), "new\n") }, 4},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f, marker := cutRedFixture(t)
			pairs := pairsFile(t, "Limit = 3\tLimit = 4", "Limit = 3\tLimit = 5", "Limit = 3\tLimit = 6")
			log := filepath.Join(t.TempDir(), "verify.log")
			env := []string{"VERIFY_LOG=" + log, "HANG_MARKER=" + marker, "X_STATE=" + t.TempDir(), "TMPDIR=" + t.TempDir()}
			args := []string{f.file, "--pairs", pairs, f.test}
			before, _ := os.Stat(filepath.Join(f.dir, f.file))
			cutAt(t, f, env, 3, syscall.SIGKILL, args...)
			// red-proof's kill left its mutant in the file; this run never wrote it
			if after, _ := os.Stat(filepath.Join(f.dir, f.file)); !after.ModTime().Equal(before.ModTime()) || readOr(filepath.Join(f.dir, f.file), "") != "package p\n\nconst Limit = 3\n" {
				t.Fatalf("the kill left %s changed", f.file)
			}
			c.change(f, pairs)

			got := xIn(t, f.dir, append(f.env, env...), append([]string{"verify", "red"}, args...)...)

			if got.code != 0 || got.data["verdict"] != verdictRed {
				t.Fatalf("exit %d, data %v, want red:\n%s", got.code, got.data, got.stdout)
			}
			if runs := strings.Count(readOr(log, ""), "\n") - 3; runs != c.runs {
				t.Fatalf("the second run ran the test %d times, want %d", runs, c.runs)
			}
			if again := xIn(t, f.dir, append(f.env, env...), append([]string{"verify", "red"}, args...)...); strings.Count(readOr(log, ""), "\n")-3-c.runs != len(pairRows(t, again))+1 {
				t.Fatalf("a run after a finished one replayed saved pairs: the log reads\n%s", readOr(log, ""))
			}
		})
	}
}
