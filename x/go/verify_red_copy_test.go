package main

import (
	"os"
	"path/filepath"
	"testing"
)

// review round: a link into the repo, a workspace package's in node_modules or an absolute one, reads the copy's mutant
func TestVerifyRedFollowsLinksIntoTheCopy(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		link func(t *testing.T, dir string) (target, imported string)
	}{
		{"a workspace package in node_modules", func(t *testing.T, dir string) (string, string) {
			write(t, filepath.Join(dir, "pkg/package.json"), `{"name": "pkg", "type": "module"}`+"\n")
			if err := os.Symlink("../pkg", filepath.Join(dir, "node_modules/pkg")); err != nil {
				t.Fatal(err)
			}
			return "pkg/lib.js", "pkg/lib.js"
		}},
		{"an absolute link", func(t *testing.T, dir string) (string, string) {
			if err := os.Symlink(filepath.Join(dir, "src"), filepath.Join(dir, "linked")); err != nil {
				t.Fatal(err)
			}
			return "src/lib.js", "./linked/lib.js"
		}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := vitestRedFixture(t)
			target, imported := c.link(t, f.dir)
			write(t, filepath.Join(f.dir, target), "export const limit = 3;\n")
			write(t, filepath.Join(f.dir, "lib.test.js"), "import { expect, test } from \"vitest\";\nimport { limit } from \""+imported+"\";\n\ntest(\"limit is three\", () => {\n\texpect(limit).toBe(3);\n});\n")
			commitAll(t, f.dir)

			got, _ := verifyRedIn(t, f, nil, target, "limit = 3", "limit = 4", f.test)

			if got.code != 0 || got.data["verdict"] != verdictRed {
				t.Fatalf("exit %d, data %v, want the link to read the copy's mutant:\n%s", got.code, got.data, got.stdout)
			}
		})
	}
}

// review round: the git-crypt set never reaches the copy, a non-ascii path and an untracked one included
func TestVerifyRedLeavesTheGitCryptSetOutOfTheCopy(t *testing.T) {
	t.Parallel()
	f := vitestRedFixture(t)
	write(t, filepath.Join(f.dir, ".gitattributes"), "secret.txt filter=git-crypt\nсекрет.txt filter=git-crypt\nnew.txt filter=git-crypt\n")
	for _, name := range []string{"secret.txt", "секрет.txt"} {
		write(t, filepath.Join(f.dir, name), "plain text\n")
	}
	write(t, filepath.Join(f.dir, "lib.test.js"), "import { existsSync } from \"node:fs\";\nimport { expect, test } from \"vitest\";\nimport { limit } from \"./lib.js\";\n\ntest(\"no plain text and the limit is three\", () => {\n\texpect([\"secret.txt\", \"секрет.txt\", \"new.txt\"].filter((name) => existsSync(name))).toEqual([]);\n\texpect(limit).toBe(3);\n});\n")
	commitAll(t, f.dir)
	write(t, filepath.Join(f.dir, "new.txt"), "plain text\n")

	got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red with no git-crypt file in the copy:\n%s", got.code, got.data, got.stdout)
	}
}

// round 2: a dash command reads a runtime file and a flag's absolute value from the copy
func TestVerifyRedRunsADashCommandOnTheCopy(t *testing.T) {
	t.Parallel()
	g := goRedFixture(t)
	write(t, filepath.Join(g.dir, "limit.txt"), "3\n")
	write(t, filepath.Join(g.dir, "lib_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestLimit(t *testing.T) {\n\tif body, _ := os.ReadFile(\"limit.txt\"); string(body) != \"3\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
	commitAll(t, g.dir)
	if got, _ := verifyRedIn(t, g, nil, "limit.txt", "3", "4", "--", "go", "test", "-v", "."); got.code != 0 {
		t.Fatalf("a runtime file through -- go test: exit %d, want red:\n%s", got.code, got.stdout)
	}

	v := vitestRedFixture(t)
	if got, _ := verifyRedIn(t, v, nil, v.file, v.anchor, v.replacement, "--", "vitest", "run", "--root="+v.dir, "lib.test.js"); got.code != 0 {
		t.Fatalf("a --root=<abs> flag: exit %d, want red, its value read in the copy:\n%s", got.code, got.stdout)
	}
}

// FRM-572 exit 11: the copy carries a repo at the tree's HEAD, so a test that runs git, as x/go's lefthook.yaml readers do,
// reads its clean run green and its swap red
func TestVerifyRedRunsATestThatRunsGitOnTheCopy(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name               string
		isStaged, hasDecoy bool
	}{
		{"a committed file", false, false},
		{"a file only staged", true, false},
		{"a hook's GIT_INDEX_FILE in the caller's env", false, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir := repo(t)
			write(t, filepath.Join(dir, "sub/go.mod"), "module p\n\ngo 1.24\n")
			write(t, filepath.Join(dir, "sub/hook_test.go"), "package p\n\nimport (\n\t\"os\"\n\t\"os/exec\"\n\t\"testing\"\n)\n\nfunc TestHook(t *testing.T) {\n\tif out, err := exec.Command(\"git\", \"ls-files\", \"--error-unmatch\", \"../hook.yaml\").CombinedOutput(); err != nil {\n\t\tt.Fatalf(\"git: %v %s\", err, out)\n\t}\n\tif body, _ := os.ReadFile(\"../hook.yaml\"); string(body) != \"count: 1\\n\" {\n\t\tt.Fatalf(\"read %q\", body)\n\t}\n}\n")
			commitAll(t, dir)
			write(t, filepath.Join(dir, "hook.yaml"), "count: 1\n")
			if c.isStaged {
				gitT(t, dir, "add", "hook.yaml")
			} else {
				commitAll(t, dir)
			}
			var env []string
			if c.hasDecoy {
				// as a pre-commit hook's temp index: git in the copy must read the copy's own
				env = []string{"GIT_INDEX_FILE=" + filepath.Join(t.TempDir(), "hook-index")}
			}

			got, _ := verifyRedIn(t, redFixture{dir: dir}, env, "hook.yaml", "count: 1", "count: 2", "sub/hook_test.go")

			if rows := pairRows(t, got); got.code != 0 || got.data["verdict"] != verdictRed || len(rows) != 1 {
				t.Fatalf("exit %d, data %v, want a green clean run and a red swap:\n%s", got.code, got.data, got.stdout)
			}
		})
	}
}
