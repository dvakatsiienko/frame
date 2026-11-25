package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// a go module whose test runs the source only through a binary its TestMain builds, as x's own suite does
func childBuildFixture(t *testing.T) redFixture {
	t.Helper()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "lib.go"), "package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Print(3) }\n")
	write(t, filepath.Join(f.dir, "lib_test.go"), `package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

var bin string

func TestMain(m *testing.M) {
	dir, _ := os.MkdirTemp("", "child-")
	bin = filepath.Join(dir, "p")
	if out, err := exec.Command("go", "build", "-o", bin, ".").CombinedOutput(); err != nil {
		panic(string(out))
	}
	os.Exit(m.Run())
}

func TestPrintsThree(t *testing.T) {
	if out, _ := exec.Command(bin).Output(); string(out) != "3" {
		t.Fatalf("printed %q", out)
	}
}

func TestPrintsSomething(t *testing.T) {
	if out, _ := exec.Command(bin).Output(); string(out) != "3" {
		t.Fatalf("printed %q", out)
	}
}
`)
	commitAll(t, f.dir)
	return redFixture{dir: f.dir, file: "lib.go", test: "lib_test.go", anchor: "fmt.Print(3)", replacement: "fmt.Print(4)"}
}

// exit line 10: a mutant only a TestMain's child build runs reads red, the run stops at its first failure
func TestVerifyRedReachesATestMainsChildBuild(t *testing.T) {
	t.Parallel()
	f := childBuildFixture(t)

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	rows := pairRows(t, got)
	if got.code != 0 || len(rows) != 1 || rows[0]["verdict"] != verdictRed {
		t.Fatalf("exit %d, pairs %v, want red through the child build:\n%s", got.code, rows, got.stdout)
	}
	if tests, _ := rows[0]["tests"].([]any); len(tests) != 1 {
		t.Fatalf("the row names %v, want one test: -failfast stops at the first", tests)
	}
}

// review round: a go test reads a data file at runtime, which an overlay never reaches, so the mutant runs in the copy
func TestVerifyRedMutatesAFileAGoTestReadsAtRuntime(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "limit.txt"), "3\n")
	write(t, filepath.Join(f.dir, "lib_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestLimit(t *testing.T) {\n\tif body, _ := os.ReadFile(\"limit.txt\"); string(body) != \"3\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, "limit.txt", "3", "4", f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red on a file read at runtime:\n%s", got.code, got.data, got.stdout)
	}
}

// a root file a go module in a subdir reads, as x/go reads lefthook.yaml from the repo root: the test runs from its own module
func TestVerifyRedMutatesARootFileAGoModuleBelowReads(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "hook.yaml"), "count: 1\n")
	write(t, filepath.Join(dir, "sub/go.mod"), "module p\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "sub/hook_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestHook(t *testing.T) {\n\tif body, _ := os.ReadFile(\"../hook.yaml\"); string(body) != \"count: 1\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, dir)

	got, _ := verifyRedIn(t, redFixture{dir: dir}, nil, "hook.yaml", "count: 1", "count: 2", "sub/hook_test.go")

	if rows := pairRows(t, got); got.code != 0 || got.data["verdict"] != verdictRed || len(rows) != 1 || !strings.Contains(fmt.Sprint(rows[0]["tests"]), "TestHook") {
		t.Fatalf("exit %d, data %v, want red naming TestHook from a clean run green in the tree:\n%s", got.code, got.data, got.stdout)
	}
}

// the package manager guard covers a pnpm command alone: a go test whose own fixture runs pnpm reads its clean run green
func TestVerifyRedLeavesAGoTestsOwnPnpmCallAlone(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "hook.yaml"), "count: 1\n")
	write(t, filepath.Join(dir, "sub/go.mod"), "module p\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "sub/hook_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"os/exec\"\n\t\"testing\"\n)\n\nfunc TestHook(t *testing.T) {\n\tif out, err := exec.Command(\"pnpm\", \"--version\").CombinedOutput(); err != nil {\n\t\tt.Fatalf(\"pnpm: %v %s\", err, out)\n\t}\n\tif body, _ := os.ReadFile(\"../hook.yaml\"); string(body) != \"count: 1\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, dir)

	got, _ := verifyRedIn(t, redFixture{dir: dir}, nil, "hook.yaml", "count: 1", "count: 2", "sub/hook_test.go")

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red from a clean run whose test ran pnpm itself:\n%s", got.code, got.data, got.stdout)
	}
}

// review round: a go tree reached through a symlinked dir still reads the mutant
func TestVerifyRedOverlaysThroughASymlinkedDir(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	link := filepath.Join(t.TempDir(), "link")
	if err := os.Symlink(f.dir, link); err != nil {
		t.Fatal(err)
	}
	f.dir = link

	got, _ := verifyRedIn(t, f, []string{"PWD=" + link}, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red through the link:\n%s", got.code, got.data, got.stdout)
	}
}

// exit line 12: a go assertion whose message holds a load word reads red, though -v prints it apart from its row
func TestVerifyRedReadsAGoFailureQuotingALoadWordRed(t *testing.T) {
	t.Parallel()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, "lib_test.go"), "package p\n\nimport \"testing\"\n\nfunc TestLimit(t *testing.T) {\n\tt.Parallel()\n\tt.Run(\"sub\", func(t *testing.T) {\n\t\tt.Parallel()\n\t\tif Limit != 3 {\n\t\t\tt.Fatalf(\"got %d: the file did not load\", Limit)\n\t\t}\n\t})\n}\n\nfunc TestOther(t *testing.T) { t.Parallel() }\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red:\n%s", got.code, got.data, got.stdout)
	}
}
