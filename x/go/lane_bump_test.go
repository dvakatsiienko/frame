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
