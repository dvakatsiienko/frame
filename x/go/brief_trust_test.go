package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// a ~/.claude.json as cc writes it, odd spacing and key order kept; each entry is one trust value
func trustFile(entries map[string]string) string {
	var body []string
	for home, value := range entries {
		body = append(body, "    \""+home+"\": {\n      \"allowedTools\": [],\n      \"hasTrustDialogAccepted\":   "+value+",\n      \"note\": \"false\"\n    }")
	}
	return "{\n  \"numStartups\": 12,\n  \"projects\": {\n" + strings.Join(body, ",\n") + "\n  },\n  \"tail\":   [1,  2]\n}\n"
}

// memberSummon writes the fixture trust file, summons from a command that cds into home, and returns the run and the file as read back
func memberSummon(t *testing.T, w summonWorld, home string, entries map[string]string, flags []string) (ran, string) {
	t.Helper()
	write(t, filepath.Join(w.home, ".claude.json"), trustFile(entries))
	got := w.summonWith(t, codieArgv(home, w.brief(t, goodBrief, true)), flags)
	after, err := os.ReadFile(filepath.Join(w.home, ".claude.json"))
	if err != nil {
		t.Fatal(err)
	}
	return got, string(after)
}

// FRM-599 exit 1: a member home whose trust key is false is set true at --apply, every other byte of the file as it was; a check only reads
func TestBriefSummonSetsTheTrustKeyOfAMemberHome(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	before := trustFile(map[string]string{w.frame: "false"})
	want := trustFile(map[string]string{w.frame: "true"})

	check, afterCheck := memberSummon(t, w, w.frame, map[string]string{w.frame: "false"}, []string{"--area", "cli"})
	applied, afterApply := memberSummon(t, w, w.frame, map[string]string{w.frame: "false"}, []string{"--apply", "--area", "cli"})

	if check.code != 4 || afterCheck != before {
		t.Errorf("a check (exit 4, the confirm): exit %d, the file changed: %q\n%s", check.code, afterCheck, check.stdout)
	}
	if applied.code != 0 || afterApply != want {
		t.Errorf("--apply: exit %d, the file reads %q, want %q\n%s", applied.code, afterApply, want, applied.stdout)
	}
}

// FRM-599 exit 2: only a member's own home is written; the rest refuse with today's fix, and the file stays
func TestBriefSummonRefusesToWriteTrustOutsideAMemberHome(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		home  func(t *testing.T, w summonWorld) string
		entry func(w summonWorld, home string) map[string]string
	}{
		{"a home outside the member homes", func(t *testing.T, w summonWorld) string { return w.repo }, func(w summonWorld, home string) map[string]string { return map[string]string{home: "false"} }},
		{"a member home with no entry", func(t *testing.T, w summonWorld) string { return w.frame }, func(w summonWorld, home string) map[string]string { return map[string]string{w.repo: "false"} }},
		{"a dir beside the worktrees reached through ..", func(t *testing.T, w summonWorld) string {
			dir := filepath.Join(w.frame, "x")
			if err := os.MkdirAll(filepath.Join(w.frame, ".claude/worktrees"), 0o755); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatal(err)
			}
			return filepath.Join(w.frame, ".claude/worktrees/../x")
		}, func(w summonWorld, home string) map[string]string {
			return map[string]string{filepath.Clean(home): "false"}
		}},
		{"a symlink in the worktrees to a dir outside", func(t *testing.T, w summonWorld) string {
			if err := os.MkdirAll(filepath.Join(w.frame, ".claude/worktrees"), 0o755); err != nil {
				t.Fatal(err)
			}
			link := filepath.Join(w.frame, ".claude/worktrees/evil")
			if err := os.Symlink(w.repo, link); err != nil {
				t.Fatal(err)
			}
			return link
		}, func(w summonWorld, home string) map[string]string { return map[string]string{home: "false"} }},
		{"a grandchild of the worktrees", func(t *testing.T, w summonWorld) string {
			dir := filepath.Join(w.frame, ".claude/worktrees/lane/sub")
			if err := os.MkdirAll(dir, 0o755); err != nil {
				t.Fatal(err)
			}
			return dir
		}, func(w summonWorld, home string) map[string]string { return map[string]string{home: "false"} }},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			home := c.home(t, w)
			entries := c.entry(w, home)

			got, after := memberSummon(t, w, home, entries, []string{"--apply", "--area", "cli"})

			if got.code == 0 || !strings.Contains(got.stdout, "hasTrustDialogAccepted") || after != trustFile(entries) {
				t.Errorf("exit %d, want a refusal naming the trust fix and the file as it was:\n%s\n%s", got.code, got.stdout, after)
			}
		})
	}
}

// FRM-599 exit 2: a worktree that is a direct child of the worktrees dir is a member home, and a trailing slash writes the key cc reads
func TestBriefSummonWritesTrustForAWorktreeAndATrailingSlashHome(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name string
		home func(w summonWorld) string
	}{
		{"a direct child of the worktrees", func(w summonWorld) string { return filepath.Join(w.frame, ".claude/worktrees/lane-1") }},
		{"a member home with a trailing slash", func(w summonWorld) string { return w.frame + "/" }},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			home := c.home(w)
			if err := os.MkdirAll(home, 0o755); err != nil {
				t.Fatal(err)
			}
			key := filepath.Clean(home)

			got, after := memberSummon(t, w, home, map[string]string{key: "false"}, []string{"--apply", "--area", "cli"})

			if got.code != 0 || after != trustFile(map[string]string{key: "true"}) {
				t.Errorf("exit %d, the file reads %q:\n%s", got.code, after, got.stdout)
			}
		})
	}
}

// FRM-599 edge: a relative --settings path would read from x's cwd, not the command's cd, so it is refused for an absolute one
func TestBriefSummonRefusesARelativeSettingsPath(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	command := strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "--model opus", "--model opus --settings rel.json", 1)

	got := w.summon(t, command)

	if got.code != 2 || !strings.Contains(got.stdout, "absolute") {
		t.Errorf("exit %d, want a usage refusal asking for an absolute path:\n%s", got.code, got.stdout)
	}
}

// FRM-599 edge: a settings file holding null is no json object, refused where it once panicked
func TestBriefSummonRefusesASettingsFileHoldingNull(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	file := filepath.Join(t.TempDir(), "null.json")
	write(t, file, "null\n")
	command := strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "--model opus", "--model opus --settings "+file, 1)

	got := w.summon(t, command)

	if got.code != 2 || !strings.Contains(got.stdout, "not a json object") || strings.Contains(got.stdout, "panic") {
		t.Errorf("exit %d, want a usage refusal naming a non-object, no panic:\n%s", got.code, got.stdout)
	}
}

// a symlink that points at a member home is no member home: the home as typed must name a member too
func TestBriefSummonRefusesASymlinkIntoAMemberHome(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		target func(w summonWorld) string
	}{
		{"a worktree", func(w summonWorld) string { return filepath.Join(w.frame, ".claude/worktrees/lane-1") }},
		{"the frame checkout", func(w summonWorld) string { return w.frame }},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			target := c.target(w)
			if err := os.MkdirAll(target, 0o755); err != nil {
				t.Fatal(err)
			}
			link := filepath.Join(t.TempDir(), "link")
			if err := os.Symlink(target, link); err != nil {
				t.Fatal(err)
			}
			entries := map[string]string{link: "false"}

			got, after := memberSummon(t, w, link, entries, []string{"--apply", "--area", "cli"})

			if got.code == 0 || after != trustFile(entries) {
				t.Errorf("exit %d, want a refusal and the file as it was:\n%s\n%s", got.code, got.stdout, after)
			}
		})
	}
}

// the write keeps the file's mode and leaves no temp file beside it
func TestBriefSummonTrustWriteKeepsTheModeAndLeavesNoTempFile(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	file := filepath.Join(w.home, ".claude.json")
	write(t, file, trustFile(map[string]string{w.frame: "false"}))
	if err := os.Chmod(file, 0o640); err != nil {
		t.Fatal(err)
	}

	got := w.summonWith(t, codieArgv(w.frame, w.brief(t, goodBrief, true)), []string{"--apply", "--area", "cli"})

	info, err := os.Stat(file)
	left, _ := filepath.Glob(filepath.Join(w.home, ".claude.json.x-trust*"))
	if err != nil || got.code != 0 || info.Mode().Perm() != 0o640 || len(left) != 0 {
		t.Errorf("exit %d, mode %v, temp files left %v, want 0640 and none:\n%s", got.code, info.Mode().Perm(), left, got.stdout)
	}
}

// a file whose entry holds the key twice reads false to cc after the edit: refused with today's fix, never a silent start
func TestBriefSummonRefusesWhenTheTrustEditDoesNotTake(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	write(t, filepath.Join(w.home, ".claude.json"), "{\"projects\":{\""+w.frame+"\":{\"hasTrustDialogAccepted\":false,\"hasTrustDialogAccepted\":false}}}\n")

	got := w.summonWith(t, codieArgv(w.frame, w.brief(t, goodBrief, true)), []string{"--apply", "--area", "cli"})

	if got.code == 0 || !strings.Contains(got.stdout, "hasTrustDialogAccepted") {
		t.Errorf("exit %d, want a refusal naming the trust fix:\n%s", got.code, got.stdout)
	}
}

// run from a linked worktree, x still knows the main checkout and its worktrees as the member homes
func TestBriefSummonKnowsTheMainCheckoutFromAWorktree(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	main := repo(t)
	tree := filepath.Join(t.TempDir(), "wt")
	gitT(t, main, "worktree", "add", "-q", "-b", "wt-branch", tree)
	for _, rel := range []string{"script/test-drive-list.ts", "docs/test-drive/tdd.md", "docs/test-drive/gone.md"} {
		raw, err := os.ReadFile(filepath.Join(w.frame, rel))
		if err != nil {
			t.Fatal(err)
		}
		write(t, filepath.Join(tree, rel), string(raw))
	}
	w.frame = tree

	got, after := memberSummon(t, w, main, map[string]string{main: "false"}, []string{"--apply", "--area", "cli"})

	if got.code != 0 || after != trustFile(map[string]string{main: "true"}) {
		t.Errorf("exit %d, the file reads %q:\n%s", got.code, after, got.stdout)
	}
}
