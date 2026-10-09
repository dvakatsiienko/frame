package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// pluginFixture plants a marketplace listing a plugin at its root, a mod under it and a sibling only
// installed @inline, and a fake `claude` that logs its writes and, on `plugin update`, installs into
// the cache only when told where
func pluginFixture(t *testing.T) (dir, config, log string, env func(install string) []string) {
	t.Helper()
	dir = repo(t)
	write(t, filepath.Join(dir, "plug/.claude-plugin/plugin.json"), "{\n  \"name\": \"demo\",\n  \"version\": \"1.2.3\",\n  \"description\": \"keeps its shape\"\n}\n")
	write(t, filepath.Join(dir, "plug/.claude-plugin/marketplace.json"),
		`{"name":"mk","plugins":[{"name":"demo","source":"./"},{"name":"m-mod","source":"./mods/m"},{"name":"loose","source":"../loose"}]}`)
	write(t, filepath.Join(dir, "plug/mods/m/.claude-plugin/plugin.json"), `{"name": "m-mod", "version": "0.1.9"}`)
	write(t, filepath.Join(dir, "loose/.claude-plugin/plugin.json"), `{"name": "loose", "version": "2.0.0"}`)
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "plugins")

	bin, config := t.TempDir(), t.TempDir()
	log = filepath.Join(t.TempDir(), "claude.log")
	write(t, filepath.Join(bin, "claude"), `#!/bin/sh
if [ "$2" = list ]; then echo '[{"id":"demo@mk"},{"id":"m-mod@mk"},{"id":"loose@inline"}]'; exit 0; fi
echo "$*" >> "$FAKE_LOG"
if [ "$2" = update ] && [ -n "$FAKE_INSTALL" ]; then mkdir -p "$FAKE_INSTALL"; fi
`)
	return dir, config, log, func(install string) []string {
		return []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "CLAUDE_CONFIG_DIR=" + config, "FAKE_LOG=" + log, "FAKE_INSTALL=" + install}
	}
}

func TestPluginBumpReleasesIntoTheCache(t *testing.T) {
	cases := []struct {
		name, manifest, before, after string
	}{
		{"demo", "plug/.claude-plugin/plugin.json", `"version": "1.2.3"`, `"version": "1.2.4"`},
		{"m-mod", "plug/mods/m/.claude-plugin/plugin.json", `"version": "0.1.9"`, `"version": "0.1.10"`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir, config, log, env := pluginFixture(t)
			manifest := filepath.Join(dir, c.manifest)
			was, _ := os.ReadFile(manifest)
			to := strings.Split(c.after, `"`)[3]

			got := xIn(t, dir, env(filepath.Join(config, "plugins/cache/mk", c.name, to)), "plugin", "bump", c.name, "--apply")

			if got.code != 0 || got.data["reload"] != "/reload-plugins" {
				t.Fatalf("exit %d, reload %v\n%s", got.code, got.data["reload"], got.stdout)
			}
			if now, _ := os.ReadFile(manifest); string(now) != strings.Replace(string(was), c.before, c.after, 1) {
				t.Errorf("manifest now %q", now)
			}
			calls, _ := os.ReadFile(log)
			if want := "plugin marketplace update mk\nplugin update " + c.name + "@mk -y\n"; string(calls) != want {
				t.Errorf("claude ran %q, want %q", calls, want)
			}
		})
	}
}

func TestPluginBumpFailsWhenTheCacheLacksTheNewVersion(t *testing.T) {
	dir, _, _, env := pluginFixture(t)

	got := xIn(t, dir, env(""), "plugin", "bump", "demo", "--apply")

	if got.code != 1 {
		t.Fatalf("exit %d, want 1\n%s", got.code, got.stdout)
	}
}

func TestPluginBumpOfAPluginNotInstalledFromItsMarketplaceBumpsOnly(t *testing.T) {
	dir, _, log, env := pluginFixture(t)

	got := xIn(t, dir, env(""), "plugin", "bump", "loose", "--apply")

	if body, _ := os.ReadFile(filepath.Join(dir, "loose/.claude-plugin/plugin.json")); got.code != 0 || !strings.Contains(string(body), `"2.0.1"`) {
		t.Fatalf("exit %d, manifest %s\n%s", got.code, body, got.stdout)
	}
	if exists(log) {
		t.Error("claude refreshed a plugin its marketplace never installed")
	}
}

func TestPluginBumpRefusesANameNobodyCarries(t *testing.T) {
	dir, _, _, env := pluginFixture(t)

	got := xIn(t, dir, env(""), "plugin", "bump", "nope", "--apply")

	if got.code != 2 || !strings.Contains(got.stdout, "demo, loose, m-mod") {
		t.Fatalf("exit %d, want 2 naming the plugins\n%s", got.code, got.stdout)
	}
}

func TestSchemaPluginListsBump(t *testing.T) {
	if got := xIn(t, t.TempDir(), nil, "schema", "plugin"); got.code != 0 || !strings.Contains(got.stdout, `"plugin bump"`) {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}
