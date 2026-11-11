package main

import (
	"path/filepath"
	"strings"
	"testing"
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

func TestCommitBumpUnderARedGateLeavesTheManifestAsItWas(t *testing.T) {
	t.Parallel()
	dir, _, _, env := pluginFixture(t)
	manifest := filepath.Join(dir, "plug/.claude-plugin/plugin.json")
	was := read(t, manifest)
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
	if staged := gitT(t, dir, "diff", "--cached", "--name-only", "--", "plug/.claude-plugin/plugin.json"); staged != "" {
		t.Errorf("plugin.json stayed staged: %q", staged)
	}

	write(t, hook, "#!/bin/sh\nexit 0\n")
	green := xIn(t, dir, env("1.2.4"), args...)

	if green.code != 0 || !strings.Contains(read(t, manifest), `"version": "1.2.4"`) {
		t.Fatalf("exit %d, manifest %s\n%s", green.code, read(t, manifest), green.stdout)
	}
}
