package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCommitBumpLandsTheChangeAndTheBumpInOneCommit(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		paths []string
		want  string
	}{
		{"with a change", []string{"plug/skill.md"}, "plug/.claude-plugin/plugin.json\nplug/skill.md"},
		{"the flag alone", nil, "plug/.claude-plugin/plugin.json"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, _, log, env := pluginFixture(t)
			write(t, filepath.Join(dir, "plug/skill.md"), "a changed skill\n")
			args := []string{"lane", "commit", "--bump", "demo", message(t)}
			if len(c.paths) > 0 {
				args = append(append(args, "--"), c.paths...)
			}

			got := xIn(t, dir, env("1.2.4"), args...)

			if got.code != 0 {
				t.Fatalf("exit %d\n%s", got.code, got.stdout)
			}
			if files := gitT(t, dir, "show", "--name-only", "--format=", "HEAD"); files != c.want {
				t.Errorf("HEAD holds %q, want %q", files, c.want)
			}
			if !strings.Contains(read(t, filepath.Join(dir, "plug/.claude-plugin/plugin.json")), `"version": "1.2.4"`) {
				t.Error("the manifest did not step to 1.2.4")
			}
			if status := gitT(t, dir, "status", "--porcelain", "--", "plug/.claude-plugin/plugin.json"); status != "" {
				t.Errorf("plugin.json left %q", status)
			}
			if calls := read(t, log); calls != "plugin marketplace update mk\nplugin update demo@mk -y\n" {
				t.Errorf("claude ran %q", calls)
			}
		})
	}
}

func TestCommitBumpNamesTheLiveSessionsOnAnOlderCopy(t *testing.T) {
	t.Parallel()
	dir, cache, _, env := pluginFixture(t)
	old := time.Now().Add(-2 * time.Hour)
	write(t, filepath.Join(cache, "1.2.3", ".keep"), "")
	if err := os.Chtimes(filepath.Join(cache, "1.2.3"), old, old); err != nil {
		t.Fatal(err)
	}
	sessions := t.TempDir()
	write(t, filepath.Join(sessions, "a.json"), fmt.Sprintf(`{"name":"on the old copy","sessionId":"a","pid":%d,"startedAt":%d}`,
		os.Getpid(), time.Now().Add(-time.Hour).UnixMilli()))
	write(t, filepath.Join(dir, "plug/skill.md"), "a changed skill\n")

	got := xIn(t, dir, append(env("1.2.4"), "X_SESSIONS="+sessions, "HOME="+t.TempDir()), "lane", "commit", "--bump", "demo", message(t), "--", "plug/skill.md")

	if want := `[{"session":"on the old copy","version":"1.2.3"}]`; got.code != 0 || marshal(got.data["older"]) != want {
		t.Fatalf("exit %d, older %s, want %s\n%s", got.code, marshal(got.data["older"]), want, got.stdout)
	}
	if message, _ := got.data["message"].(string); !strings.HasSuffix(message, "; still on an older copy: on the old copy (1.2.3)") {
		t.Errorf("the reload message %q does not name who holds the old copy", message)
	}
}

func TestCommitOfAPluginWithoutBumpRemindsOnce(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		files  map[string]string
		paths  []string
		plugin string
	}{
		{"a plugin file", map[string]string{"plug/skill.md": "changed\n"}, []string{"plug/skill.md"}, "demo"},
		{"a mod's own file", map[string]string{"plug/mods/m/hook.md": "changed\n"}, []string{"plug/mods/m/hook.md"}, "m-mod"},
		{"with its plugin.json", map[string]string{"plug/skill.md": "changed\n", "plug/.claude-plugin/plugin.json": "{\"name\": \"demo\", \"version\": \"1.2.9\"}\n"},
			[]string{"plug/skill.md", "plug/.claude-plugin/plugin.json"}, ""},
		{"a plugin no marketplace lists", map[string]string{"other/.claude-plugin/plugin.json": `{"name": "other", "version": "1.0.0"}`, "other/a.md": "changed\n"}, []string{"other/a.md"}, ""},
		{"no plugin", map[string]string{"readme.txt": "changed\n"}, []string{"readme.txt"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, _, _, env := pluginFixture(t)
			for path, body := range c.files {
				write(t, filepath.Join(dir, path), body)
			}

			got := xIn(t, dir, env(""), append([]string{"lane", "commit", message(t), "--"}, c.paths...)...)

			reminder, _ := got.data["reminder"].(string)
			named := c.plugin == "" || strings.Contains(reminder, "x plugin bump "+c.plugin+" ")
			if got.code != 0 || (c.plugin == "") != (reminder == "") || !named {
				t.Fatalf("exit %d, reminder %q, want one naming %q\n%s", got.code, reminder, c.plugin, got.stdout)
			}
		})
	}
}

func TestCommitBumpUnderARedGateLeavesTheManifestAsItWas(t *testing.T) {
	t.Parallel()
	dir, _, _, env := pluginFixture(t)
	manifest := filepath.Join(dir, "plug/.claude-plugin/plugin.json")
	// a staged edit of the manifest's description stands before the run, and must stand after it
	write(t, manifest, strings.Replace(read(t, manifest), "keeps its shape", "staged before", 1))
	gitT(t, dir, "add", "plug/.claude-plugin/plugin.json")
	was := read(t, manifest)
	stagedBefore := gitT(t, dir, "ls-files", "-s", "--", "plug/.claude-plugin/plugin.json")
	hook := filepath.Join(dir, ".git/hooks/pre-commit")
	write(t, hook, "#!/bin/sh\necho a red gate\nexit 1\n")
	write(t, filepath.Join(dir, "plug/skill.md"), "a changed skill\n")
	args := []string{"lane", "commit", "--bump", "demo", message(t), "--", "plug/skill.md"}

	red := xIn(t, dir, env("1.2.4"), args...)

	if red.code == 0 {
		t.Fatalf("a red gate committed\n%s", red.stdout)
	}
	if read(t, manifest) != was {
		t.Errorf("plugin.json moved under a red gate: %q", read(t, manifest))
	}
	if staged := gitT(t, dir, "ls-files", "-s", "--", "plug/.claude-plugin/plugin.json"); staged != stagedBefore {
		t.Errorf("plugin.json's index entry %q, want the staged one %q", staged, stagedBefore)
	}
	if !strings.Contains(red.stdout, "x lane commit --bump demo ") || strings.Contains(red.stdout, "-- plug/skill.md plug/.claude-plugin") {
		t.Errorf("the retry drops --bump or names the manifest\n%s", red.stdout)
	}

	write(t, hook, "#!/bin/sh\nexit 0\n")
	green := xIn(t, dir, env("1.2.4"), args...)

	if green.code != 0 || !strings.Contains(read(t, manifest), `"version": "1.2.4"`) {
		t.Fatalf("exit %d, manifest %s\n%s", green.code, read(t, manifest), green.stdout)
	}
}

// the run leaves its turn last, so the next in line reads the manifest as it stood
func TestCommitBumpIsTakenBackBeforeTheTurnIsLeft(t *testing.T) {
	t.Parallel()
	dir, _, _, env := pluginFixture(t)
	manifest := filepath.Join(dir, "plug/.claude-plugin/plugin.json")
	was := read(t, manifest)
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n")
	write(t, filepath.Join(dir, "plug/skill.md"), "a changed skill\n")
	root, left := t.TempDir(), filepath.Join(t.TempDir(), "left")
	write(t, filepath.Join(root, gateQueueScript), "#!/bin/sh\necho "+gateQueueReady+"\nread code\ncp '"+manifest+"' '"+left+"'\n")

	got := xIn(t, dir, append(env("1.2.4"), "X_FRAME_ROOT="+root, "X_GATE_TURN=1", "GATE_QUEUE_HELD="), "lane", "commit", "--bump", "demo", message(t), "--", "plug/skill.md")

	if got.code == 0 || !exists(left) {
		t.Fatalf("exit %d, the turn left: %v\n%s", got.code, exists(left), got.stdout)
	}
	if read(t, left) != was {
		t.Errorf("the turn went while the manifest read %q", read(t, left))
	}
}

// the bump is in HEAD once the commit lands, so a restore that fails after it takes nothing back
func TestCommitBumpStandsWhenTheRestoreFailsAfterTheCommit(t *testing.T) {
	t.Parallel()
	dir, _, _, env := pluginFixture(t)
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\necho peer > loose/note.txt\n")
	write(t, filepath.Join(dir, "loose/note.txt"), "held\n")
	write(t, filepath.Join(dir, "plug/skill.md"), "a changed skill\n")

	got := xIn(t, dir, env("1.2.4"), "lane", "commit", "--hold-unstaged", "--bump", "demo", message(t), "--", "plug/skill.md")

	if got.code != 1 || !strings.Contains(got.stdout, "changed during the hold") {
		t.Fatalf("exit %d, want the restore to fail after the commit\n%s", got.code, got.stdout)
	}
	if status := gitT(t, dir, "status", "--porcelain", "--", "plug"); status != "" {
		t.Errorf("the landed bump was taken back: %q", status)
	}
}

// a dry run writes the bump so its gates read it, then puts the manifest back, the shared index never touched
func TestCommitDryBumpLeavesNoTrace(t *testing.T) {
	t.Parallel()
	dir, _, _, env := pluginFixture(t)
	write(t, filepath.Join(dir, gateCopyRun), "#!/bin/sh\nexec \"$@\"\n")
	write(t, filepath.Join(dir, "lefthook.yaml"), "pre-commit:\n  commands:\n    bumped:\n      run: script/index-run.sh grep -q 1.2.4 plug/.claude-plugin/plugin.json\n")
	gitT(t, dir, "add", gateCopyRun, "lefthook.yaml")
	gitT(t, dir, "checkout", "-q", "-b", "codie/dry")
	gitT(t, dir, "commit", "-q", "-m", "gates")
	write(t, filepath.Join(dir, "plug/skill.md"), "a changed skill\n")
	manifest := filepath.Join(dir, "plug/.claude-plugin/plugin.json")
	was, index := read(t, manifest), gitT(t, dir, "ls-files", "-s")

	got := xIn(t, dir, append(env("1.2.4"), "X_STATE="+t.TempDir()), "lane", "commit", "--dry", "--bump", "demo", message(t), "--", "plug/skill.md")

	if got.code != 0 {
		t.Fatalf("exit %d, want the gate to read the bump\n%s", got.code, got.stdout)
	}
	if read(t, manifest) != was || gitT(t, dir, "ls-files", "-s") != index {
		t.Errorf("a dry run left the manifest %q, the index %q", read(t, manifest), gitT(t, dir, "ls-files", "-s"))
	}
}
