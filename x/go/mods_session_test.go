package main

import (
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
)

func asSession(env []string, id string) []string {
	return append(env[:len(env):len(env)], "CLAUDE_CODE_SESSION_ID="+id)
}

// a pulled copy's scratch root: the copy's path without the repo path under it
func rootOfCopy(copied, path string) string { return strings.TrimSuffix(copied, "/"+path) }

// every file under dir with its bytes, so a test reads «untouched» as equal snapshots
func snapshot(t *testing.T, dir string) map[string]string {
	t.Helper()
	files := map[string]string{}
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			rel, _ := filepath.Rel(dir, path)
			files[rel] = readFile(t, path)
		}
		return nil
	})
	return files
}

func sameFiles(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for name, body := range a {
		if other, ok := b[name]; !ok || other != body {
			return false
		}
	}
	return true
}

// FRM-621 exit 1 and 2: two sessions pulling one mod file each keep their own copy and base, through a re-pull and a land
func TestModsEditKeepsOneScratchPerSession(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	a, b := asSession(env, "session-a-id"), asSession(env, "session-b-id")
	copyA, copyB := pullCopy(t, dir, a, modTestA), pullCopy(t, dir, b, modTestA)
	rootB := rootOfCopy(copyB, modTestA)
	write(t, copyA, "green, edited by a\n")
	write(t, copyB, "green, edited by b\n")
	baseB := readFile(t, filepath.Join(rootB, scratchBase, modTestA))

	pullCopy(t, dir, a, modTestA)

	if readFile(t, copyB) != "green, edited by b\n" || readFile(t, filepath.Join(rootB, scratchBase, modTestA)) != baseB {
		t.Errorf("a's pull moved b's copy or its base: copy %q", readFile(t, copyB))
	}
	write(t, copyA, "green, edited by a\n")
	if got := xIn(t, dir, a, "mods", "edit", "push"); got.code != 0 {
		t.Fatalf("a's push: exit %d\n%s", got.code, got.stdout)
	}
	if readFile(t, copyB) != "green, edited by b\n" {
		t.Errorf("a's land moved b's copy: %q", readFile(t, copyB))
	}
}

// FRM-621 exit 3: no session id, today's path byte for byte
func TestModsEditWithNoSessionKeepsTheRepoLevelRoot(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	job := ""
	for _, pair := range env {
		if value, ok := strings.CutPrefix(pair, "CLAUDE_JOB_DIR="); ok {
			job = value
		}
	}

	copied := pullCopy(t, dir, env, modTestA)

	if want := filepath.Join(job, "tmp", "x-mods-edit", filepath.Base(dir), modTestA); copied != want {
		t.Errorf("scratch at %s, want %s", copied, want)
	}
}

// FRM-621 exit 4: an older repo-level scratch holding a pulled file is named once per session on its first pull, and never touched
func TestModsEditNamesAnOlderRepoLevelScratchOncePerSession(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	older := rootOfCopy(pullCopy(t, dir, env, modTestA), modTestA)
	before := snapshot(t, older)
	notices := 0
	for _, pull := range []struct{ session string }{{"session-a-id"}, {"session-a-id"}, {"session-b-id"}} {
		got := xIn(t, dir, asSession(env, pull.session), "mods", "edit", "pull", modTestB)
		if notice, _ := got.data["notice"].(string); notice != "" {
			notices++
			if !strings.Contains(notice, older) {
				t.Errorf("the notice does not name the older scratch %s: %s", older, notice)
			}
		}
	}

	if notices != 2 || !sameFiles(before, snapshot(t, older)) {
		t.Errorf("%d notices over three pulls, want 2; older scratch untouched: %v", notices, sameFiles(before, snapshot(t, older)))
	}
}

// FRM-621 exit 5: a run with no session id neither lists nor touches a session's scratch, and raises no notice
func TestModsEditWithNoSessionNeverSeesASessionScratch(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copied := pullCopy(t, dir, asSession(env, "session-a-id"), modTestA)
	write(t, copied, "green, edited by a\n")
	root := rootOfCopy(copied, modTestA)
	before := snapshot(t, root)

	got := xIn(t, dir, env, "mods", "edit", "status")

	edited, _ := got.data["edited"].([]any)
	if _, noticed := got.data["notice"]; got.code != 0 || len(edited) != 0 || noticed || !sameFiles(before, snapshot(t, root)) {
		t.Errorf("exit %d, edited %v, notice %v, want none listed, none raised, the session dir as it was:\n%s", got.code, edited, noticed, got.stdout)
	}
}

// FRM-621 exit 6: two sessions edit different lines of one file; the second land refuses on the repo's drift, so the first edit stays
func TestModsEditSecondSessionLandRefusesOnTheDrift(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	a, b := asSession(env, "session-a-id"), asSession(env, "session-b-id")
	copyA, copyB := pullCopy(t, dir, a, modTestA), pullCopy(t, dir, b, modTestA)
	write(t, copyA, "green\nedited by a\n")
	write(t, copyB, "green\nedited by b\n")
	if got := xIn(t, dir, a, "mods", "edit", "push"); got.code != 0 {
		t.Fatalf("a's push: exit %d\n%s", got.code, got.stdout)
	}

	got := xIn(t, dir, b, "mods", "edit", "push")

	if landed := readFile(t, filepath.Join(dir, modTestA)); got.code == 0 || !strings.Contains(got.stdout, "changed in the repo since the pull") || landed != "green\nedited by a\n" {
		t.Errorf("exit %d, the repo holds %q, want b refused and a's edit kept:\n%s", got.code, landed, got.stdout)
	}
}
