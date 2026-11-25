package main

import (
	"crypto/sha256"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

// every entry's size, mode, mtime, link target and content hash under the roots, links not followed; git's own dir is git's, so it stays out
func treeWrites(t *testing.T, roots ...string) map[string]string {
	t.Helper()
	seen := map[string]string{}
	for _, root := range roots {
		_ = filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if entry.IsDir() && entry.Name() == ".git" {
				return filepath.SkipDir
			}
			if info, err := os.Lstat(path); err == nil {
				target, _ := os.Readlink(path)
				var hash [sha256.Size]byte
				if info.Mode().IsRegular() {
					body, _ := os.ReadFile(path)
					hash = sha256.Sum256(body)
				}
				seen[path] = fmt.Sprintf("%d %v %d →%s %x", info.Size(), info.Mode(), info.ModTime().UnixNano(), target, hash[:6])
			}
			return nil
		})
	}
	return seen
}

// exit line 6: neither the clean run nor a mutant writes the real tree, the caches a runner keeps in node_modules included
func TestVerifyRedWritesNothingInTheRealTree(t *testing.T) {
	t.Parallel()
	modules := frameNodeModules(t)
	for _, c := range []struct {
		name    string
		fixture func(*testing.T) redFixture
		caches  []string
	}{
		{"go test", goRedFixture, nil},
		{"a mod's test", modRedFixture, nil},
		{"vitest", vitestRedFixture, []string{".vite", ".vite-temp", ".vitest-cache"}},
		{"vitest on a linked node_modules", vitestLinkedFixture, []string{".vite", ".vite-temp", ".vitest-cache"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f := c.fixture(t)
			watched := []string{f.dir}
			for _, cache := range c.caches {
				watched = append(watched, filepath.Join(modules, cache))
			}
			before := treeWrites(t, watched...)
			nodeModules, _ := os.Lstat(modules)

			got, _ := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, f.test)

			if got.code != 0 {
				t.Fatalf("exit %d, want red:\n%s", got.code, got.stdout)
			}
			after := treeWrites(t, watched...)
			for path, was := range before {
				if after[path] != was {
					t.Errorf("%s changed: %s → %s", path, was, after[path])
				}
			}
			for path := range after {
				if _, ok := before[path]; !ok {
					t.Errorf("%s appeared", path)
				}
			}
			if now, _ := os.Lstat(modules); c.caches != nil && !now.ModTime().Equal(nodeModules.ModTime()) {
				t.Errorf("%s gained or lost an entry", modules)
			}
		})
	}
}

// a repo whose node_modules is its own, as a pnpm install leaves it: a shim at the root and in one workspace package, pnpm's state
// files and run records, one store entry, and a git hook, plus a shim that is a link, as npm leaves one, and a package whose .bin is a link to the
// root's; relink.sh does to the tree it runs in what an install does, then reads the mutated file
func shimsFixture(t *testing.T) (redFixture, []string) {
	t.Helper()
	dir := repo(t)
	write(t, filepath.Join(dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(dir, "lib.js"), "export const limit = 3;\n")
	for _, modules := range []string{"node_modules", "pkg/node_modules"} {
		// as pnpm's shim does, it finds its package from the dir it really sits in
		write(t, filepath.Join(dir, modules, ".bin/tool"), "#!/bin/sh\nexec node \"$(cd \"$(dirname \"$0\")\" && pwd -P)/../tool/index.js\"\n")
	}
	// the two state files and the dir of run records pnpm keeps beside them
	for _, state := range []string{".modules.yaml", ".pnpm-workspace-state-v1.json", ".pnpm-task-run-state-v1/latest.json"} {
		write(t, filepath.Join(dir, "node_modules", state), "state\n")
	}
	write(t, filepath.Join(dir, "node_modules/.pnpm/tool@1.0.0/node_modules/tool/index.js"), "console.log('tool');\n")
	if err := os.Symlink(".pnpm/tool@1.0.0/node_modules/tool", filepath.Join(dir, "node_modules/tool")); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "hoisted/node_modules/.modules.yaml"), "state\n")
	for link, target := range map[string]string{"node_modules/.bin/linked": "../tool/index.js", "hoisted/node_modules/.bin": "../../node_modules/.bin"} {
		if err := os.Symlink(target, filepath.Join(dir, link)); err != nil {
			t.Fatal(err)
		}
	}
	// a tripwire: the copy's repo starts with no hooks, so only a command that reaches out of the copy could write one
	hooks := filepath.Join(dir, ".git", "hooks")
	write(t, filepath.Join(hooks, "pre-commit"), "#!/bin/sh\nexec node_modules/.bin/tool\n")
	write(t, filepath.Join(dir, "relink.sh"), `[ -e node_modules/.bin/added ] || [ -L node_modules/.bin/linked ] || echo "the link shim reached the copy as a file" >> "$VERIFY_LOG"
[ -e node_modules/.bin/added ] || hoisted/node_modules/.bin/tool > /dev/null 2>&1 || echo "the shim behind a linked .bin lost its package" >> "$VERIFY_LOG"
for modules in node_modules pkg/node_modules hoisted/node_modules; do
	for shim in "$modules"/.bin/*; do
		[ ! -L "$shim" ] || rm "$shim"
		printf '#!/bin/sh\nexec node "%s"\n' "$PWD/$modules/tool/index.js" > "$shim"
	done
	echo added > "$modules/.bin/added"
done
mkdir -p node_modules/.pnpm-task-run-state-v1
for state in .modules.yaml .pnpm-workspace-state-v1.json .pnpm-task-run-state-v1/latest.json .pnpm-task-run-state-v1/run.finished; do
	echo "$PWD" > "node_modules/$state"
done
echo "$PWD" >> "$VERIFY_LOG"
[ -z "$HANG" ] || sleep 60
grep -q 'limit = 3' lib.js
`)
	commitAll(t, dir)
	f := redFixture{dir: dir, file: "lib.js", anchor: "limit = 3", replacement: "limit = 4"}
	return f, []string{filepath.Join(dir, "node_modules"), filepath.Join(dir, "pkg/node_modules"), filepath.Join(dir, "hoisted/node_modules"), hooks}
}

// FRM-554: a command that rewrites the shims and pnpm's state, as the install behind a `pnpm exec` does, writes the copy's own; the
// real ones keep their bytes whether the run finishes or is cut mid-command, since nothing repairs the real tree after a run
func TestVerifyRedKeepsTheRealShimsFromACommandThatRelinksThem(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		cut  syscall.Signal
	}{
		{"a finished run", 0},
		{"a run cut by an interrupt", syscall.SIGINT},
		{"a run cut by a kill", syscall.SIGKILL},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f, watched := shimsFixture(t)
			log := filepath.Join(t.TempDir(), "verify.log")
			args := []string{f.file, f.anchor, f.replacement, "--", "sh", "relink.sh"}
			before := treeWrites(t, watched...)

			if c.cut == 0 {
				got := xIn(t, f.dir, []string{"VERIFY_LOG=" + log}, append([]string{"verify", "red"}, args...)...)
				if got.data["verdict"] != verdictFailed {
					t.Fatalf("data %v, want the mutant's run read failed:\n%s", got.data, got.stdout)
				}
			} else {
				// a kill skips x's own cleanup, so the copy it leaves dies with the test
				cutAt(t, f, []string{"VERIFY_LOG=" + log, "HANG=1", "X_STATE=" + t.TempDir(), "TMPDIR=" + t.TempDir()}, 1, c.cut, args...)
			}

			if ran := readOr(log, ""); ran == "" || strings.Contains(ran, f.dir+"\n") || strings.Contains(ran, "shim") {
				t.Fatalf("the command logged %q, want a run in the copy, its link shim a link and its linked .bin's shim running, and none in the real tree", ran)
			}
			wantNoWrites(t, before, treeWrites(t, watched...))
		})
	}
}

func wantNoWrites(t *testing.T, before, after map[string]string) {
	t.Helper()
	for path, was := range before {
		if after[path] != was {
			t.Errorf("%s changed: %s → %s", path, was, after[path])
		}
	}
	for path := range after {
		if _, ok := before[path]; !ok {
			t.Errorf("%s appeared", path)
		}
	}
}

// the go fixture as a pnpm workspace with no dependency but its own package, installed by the real pnpm, offline, from a planted
// lockfile: the shim pnpm wrote runs the go test. autoDedupe is frame's setting, which no lockfile records, so pnpm installs
// again before every run and exec
func pnpmWorkspaceFixture(t *testing.T) (redFixture, []string) {
	t.Helper()
	f := goRedFixture(t)
	write(t, filepath.Join(f.dir, ".gitignore"), "node_modules\n")
	write(t, filepath.Join(f.dir, "package.json"), `{"name": "p", "private": true, "scripts": {"limit": "limit-test"}, "devDependencies": {"runner": "workspace:*"}}`+"\n")
	write(t, filepath.Join(f.dir, "pnpm-workspace.yaml"), "packages:\n  - runner\nautoDedupe: true\n")
	write(t, filepath.Join(f.dir, "pnpm-lock.yaml"), `lockfileVersion: '9.0'

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

importers:

  .:
    devDependencies:
      runner:
        specifier: workspace:*
        version: link:runner

  runner: {}
`)
	write(t, filepath.Join(f.dir, "runner/package.json"), `{"name": "runner", "version": "1.0.0", "bin": {"limit-test": "limit-test.sh"}}`+"\n")
	write(t, filepath.Join(f.dir, "runner/limit-test.sh"), "#!/bin/sh\nexec go test -v .\n")
	install := exec.Command("pnpm", "install", "--offline", "--frozen-lockfile")
	install.Dir, install.Env = f.dir, cleanEnv()
	if out, err := install.CombinedOutput(); err != nil {
		t.Fatalf("pnpm install in the fixture: %v\n%s", err, out)
	}
	commitAll(t, f.dir)
	return f, []string{filepath.Join(f.dir, "node_modules"), filepath.Join(f.dir, ".git", "hooks")}
}

// FRM-554: pnpm in the copy runs the command and installs nothing, so the store the copy shares with the real tree is never relinked
func TestVerifyRedRunsAPnpmCommandWithNoInstall(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name    string
		env     []string
		command []string
	}{
		{"the caller's env leaves the setting alone", nil, []string{"pnpm", "exec", "limit-test"}},
		{"the caller's env asks for the install, in the spelling pnpm puts first", []string{"PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=install"}, []string{"pnpm", "exec", "limit-test"}},
		{"a word after the subcommand that names a store write", nil, []string{"pnpm", "exec", "limit-test", "install"}},
		{"a script through run", nil, []string{"pnpm", "run", "limit"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			f, watched := pnpmWorkspaceFixture(t)
			before := treeWrites(t, watched...)

			got, log := verifyRedIn(t, f, c.env, append([]string{f.file, f.anchor, f.replacement, "--"}, c.command...)...)

			if got.code != 0 || got.data["verdict"] != verdictRed || log != "1\n1\n" {
				t.Fatalf("exit %d, data %v, the test logged %q, want red off a clean and a mutated run:\n%s", got.code, got.data, log, got.stdout)
			}
			wantNoWrites(t, before, treeWrites(t, watched...))
		})
	}
}

// FRM-554: the copy shares the store, so a pnpm command that may write it would write the real tree's: any but a plain run as
// pnpm's first word refuses before any run
func TestVerifyRedRefusesAPnpmCommandThatWritesTheStore(t *testing.T) {
	t.Parallel()
	f, watched := shimsFixture(t)
	before := treeWrites(t, watched...)
	for _, command := range [][]string{
		{"pnpm", "install"}, {"pnpm", "i"}, {"pnpm", "add", "left-pad"}, {"pnpm", "remove", "tool"}, {"pnpm", "rm", "tool"},
		{"pnpm", "uni", "tool"}, {"pnpm", "update"}, {"pnpm", "up"}, {"pnpm", "dedupe"}, {"pnpm", "ci"},
		// the subcommand behind pnpm's own flags, a flag's value before it, and pnpm by its path or in another case
		{"pnpm", "--frozen-lockfile", "install"}, {"pnpm", "--filter", "pkg", "add", "left-pad"}, {"pnpm", "-C", ".", "install"},
		{"/opt/homebrew/bin/pnpm", "install"}, {"PNPM", "install"},
		// a write behind a prefix subcommand, a bare pnpm, which installs, and a flag's value that reads as a run
		{"pnpm", "m", "install"}, {"pnpm", "recursive", "install"}, {"pnpm", "with", "12.16.1", "install"}, {"pnpm"},
		{"pnpm", "--filter", "exec", "install"},
		// what installs or builds under another name, and a bin by pnpm's shorthand, which no read can tell from one
		{"pnpm", "pipeline"}, {"pnpm", "deploy", "out"}, {"pnpm", "approve-builds"}, {"pnpm", "vitest", "run"},
		// a package manager behind a run, behind a launcher, or as one word of a shell line
		{"pnpm", "exec", "pnpm", "install"}, {"pnpm", "exec", "npm", "i"}, {"env", "X=1", "pnpm", "install"},
		{"corepack", "pnpm", "install"}, {"npx", "pnpm", "install"}, {"sh", "-c", "pnpm install"}, {"pnpm", "exec", "sh", "-c", "pnpm install"},
		// a shell word glued to its neighbour by an operator or a quote
		{"sh", "-c", "true;pnpm install"}, {"bash", "-c", "cd .&&pnpm i"}, {"sh", "-c", "echo $(npm i)"}, {"sh", "-c", `"pnpm" i`},
	} {
		got, log := verifyRedIn(t, f, nil, append([]string{f.file, f.anchor, f.replacement, "--"}, command...)...)

		if got.code != 2 || !strings.Contains(got.stdout, "node_modules/.pnpm") || log != "" {
			t.Errorf("%v: exit %d, the command logged %q, want a usage refusal naming the store and no run:\n%s", command, got.code, log, got.stdout)
		}
	}
	wantNoWrites(t, before, treeWrites(t, watched...))
}

// a script behind a plain `pnpm run` is read by no argv check, so a package manager it calls is refused as it runs
func TestVerifyRedRefusesAPackageManagerAScriptCalls(t *testing.T) {
	t.Parallel()
	f, watched := pnpmWorkspaceFixture(t)
	write(t, filepath.Join(f.dir, "package.json"), `{"name": "p", "private": true, "scripts": {"limit": "pnpm i && limit-test"}, "devDependencies": {"runner": "workspace:*"}}`+"\n")
	commitAll(t, f.dir)
	before := treeWrites(t, watched...)

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, "--", "pnpm", "run", "limit")

	if got.code != 1 || got.data["verdict"] != nil || log != "" || !strings.Contains(got.stdout, "may write the store") {
		t.Fatalf("exit %d, data %v, the test logged %q, want the script's pnpm i refused before the test ran:\n%s", got.code, got.data, log, got.stdout)
	}
	wantNoWrites(t, before, treeWrites(t, watched...))
}

// a shell line no word read can take apart still meets the shim: any command after -- runs with the guard first on PATH
func TestVerifyRedRefusesAPackageManagerAShellLineHides(t *testing.T) {
	t.Parallel()
	f, watched := pnpmWorkspaceFixture(t)
	before := treeWrites(t, watched...)

	got, log := verifyRedIn(t, f, nil, f.file, f.anchor, f.replacement, "--", "sh", "-c", `pn""pm i && limit-test`)

	if got.code != 1 || log != "" || !strings.Contains(got.stdout, "may write the store") {
		t.Fatalf("exit %d, the test logged %q, want the hidden pnpm i refused before the test ran:\n%s", got.code, log, got.stdout)
	}
	wantNoWrites(t, before, treeWrites(t, watched...))
}
