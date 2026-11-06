package main

import (
	"bytes"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
)

// a spawn is the suite's cost: a fixture built once and copied in process spends none per test. seeds sit beside xbin, since a t.TempDir dies with its first test
var (
	seedRepoOnce, seedModsOnce, worldOnce sync.Once
	seedRepoDir, seedModsDir, worldDir    string
)

// a fixture of several repos, built once per key, a fresh copy per test
var seeds sync.Map

func seeded(t *testing.T, key string, build func(root string)) string {
	t.Helper()
	made, _ := seeds.LoadOrStore(key, &seedOnce{})
	seed := made.(*seedOnce)
	seed.once.Do(func() {
		root, err := os.MkdirTemp(filepath.Dir(xbin), "seed-")
		if err != nil {
			t.Fatal(err)
		}
		build(root)
		seed.root = root
	})
	to, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	copyFixture(t, seed.root, to)
	return to
}

type seedOnce struct {
	once sync.Once
	root string
}

func seedRepo(t *testing.T) string {
	t.Helper()
	seedRepoOnce.Do(func() {
		seedRepoDir = filepath.Join(filepath.Dir(xbin), "seed-repo")
		buildSeedRepo(t, seedRepoDir)
	})
	return seedRepoDir
}

func buildSeedRepo(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	gitT(t, dir, "init", "-q", "-b", "main")
	write(t, filepath.Join(dir, "readme.txt"), "one\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "seed")
}

func seedMods(t *testing.T) string {
	t.Helper()
	seedModsOnce.Do(func() {
		seedModsDir = filepath.Join(filepath.Dir(xbin), "seed-mods")
		copyFixture(t, seedRepo(t), seedModsDir)
		mod := filepath.Join(seedModsDir, modsDir, "m")
		write(t, filepath.Join(mod, ".claude-plugin/plugin.json"), `{"name": "m"}`+"\n")
		write(t, filepath.Join(mod, "hooks/register.ts"), "export const register = () => {};\n")
		write(t, filepath.Join(mod, "tests/a.test.ts"), "green\n")
		write(t, filepath.Join(mod, "tests/b.test.ts"), "green\n")
		gitT(t, seedModsDir, "add", ".")
		gitT(t, seedModsDir, "commit", "-q", "-m", "mod")
	})
	return seedModsDir
}

func seedWorld(t *testing.T) string {
	t.Helper()
	worldOnce.Do(func() {
		worldDir = filepath.Join(filepath.Dir(xbin), "seed-world")
		buildSeedWorld(t, worldDir)
		worldDir, _ = filepath.EvalSymlinks(worldDir)
	})
	return worldDir
}

func buildSeedWorld(t *testing.T, dir string) {
	t.Helper()
	if out, err := exec.Command("../fixtures/setup.sh", dir).CombinedOutput(); err != nil {
		t.Fatalf("setup.sh: %v\n%s", err, out)
	}
}

// copyFixture lays a seed over a new dir, modes and times kept, and every file naming the seed's path names the copy's
func copyFixture(t *testing.T, from, to string) {
	t.Helper()
	if err := os.MkdirAll(to, 0o755); err != nil {
		t.Fatal(err)
	}
	to, err := filepath.EvalSymlinks(to)
	if err != nil {
		t.Fatal(err)
	}
	err = filepath.WalkDir(from, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(from, path)
		if err != nil {
			return err
		}
		target := filepath.Join(to, rel)
		info, err := entry.Info()
		if err != nil {
			return err
		}
		switch {
		case entry.IsDir():
			return os.MkdirAll(target, info.Mode().Perm()|0o700)
		case info.Mode()&fs.ModeSymlink != 0:
			link, err := os.Readlink(path)
			if err != nil {
				return err
			}
			return os.Symlink(link, target)
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		raw = bytes.ReplaceAll(raw, []byte(from), []byte(to))
		if err := os.WriteFile(target, raw, info.Mode().Perm()); err != nil {
			return err
		}
		return os.Chtimes(target, info.ModTime(), info.ModTime())
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestFixturesNeverReadAHooksGitEnv(t *testing.T) {
	// serial: t.Setenv stands in for the env a commit hook hands a test
	decoy := t.TempDir()
	gitT(t, decoy, "init", "-q", "-b", "decoy")
	t.Setenv("GIT_DIR", filepath.Join(decoy, ".git"))
	t.Setenv("GIT_INDEX_FILE", filepath.Join(decoy, ".git/index"))
	t.Setenv("GIT_WORK_TREE", decoy)

	fresh := t.TempDir()
	buildSeedRepo(t, fresh)
	freshWorld := filepath.Join(t.TempDir(), "world")
	buildSeedWorld(t, freshWorld)

	if exists(filepath.Join(decoy, ".git/refs/heads/decoy")) {
		t.Error("a fixture's git committed into the hook's repo")
	}
	if exists(filepath.Join(decoy, ".git/index")) {
		t.Error("a fixture's git staged into the hook's index")
	}
	if !exists(filepath.Join(fresh, ".git/HEAD")) || !exists(filepath.Join(freshWorld, "origin.git")) {
		t.Error("a fixture was never made in its own dir")
	}
}
