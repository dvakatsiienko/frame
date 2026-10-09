package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

var versionLine = regexp.MustCompile(`("version"\s*:\s*")([^"]*)(")`)

type pluginManifest struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

func pluginBumpPlan(r *Run, args []string, _ Flags) (any, error) {
	name := args[0]
	tree, err := top()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var manifest, from, to, market string
	if err := r.Step("plan", "finding the plugin and its marketplace", func() (string, error) {
		var dir string
		if manifest, dir, from, err = findPlugin(tree, name); err != nil {
			return "", err
		}
		if to, err = nextPatch(from); err != nil {
			return "", err
		}
		if market, err = marketOf(tree, dir); err != nil || market == "" {
			return fmt.Sprintf("%s → %s, no marketplace lists it: a bump only", from, to), err
		}
		// a listing is not an install: the mods load @inline and x-cw's marketplace is never added
		installed, err := installedPlugins()
		if err != nil {
			return "", err
		}
		if id := name + "@" + market; !slices.Contains(installed, id) {
			market = ""
			return fmt.Sprintf("%s → %s, %s is not installed: a bump only", from, to, id), nil
		}
		return fmt.Sprintf("%s → %s, marketplace %s", from, to, market), nil
	}); err != nil {
		return nil, err
	}
	return ordered{{"name", name}, {"manifest", manifest}, {"from", from}, {"to", to}, {"marketplace", market}}, nil
}

func askPluginBump(plan any) string {
	fields := plan.(ordered)
	return fmt.Sprintf("bump %s to %s and refresh it?", fields[0].value, fields[3].value)
}

func pluginBump(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	name, manifest, from, to, market := fields[0].value.(string), fields[1].value.(string), fields[2].value.(string), fields[3].value.(string), fields[4].value.(string)
	if err := r.Step("write", "the version line", func() (string, error) {
		return home(manifest), writeVersion(manifest, from, to)
	}); err != nil {
		return nil, err
	}
	data := ordered{{"name", name}, {"from", from}, {"to", to}, {"marketplace", market}}
	if market == "" {
		r.skip("marketplace", "update", "cache")
		r.Done(fmt.Sprintf("%s %s, bump only — no marketplace lists it", name, to), "")
		return data, nil
	}
	cache, err := pluginCache()
	if err != nil {
		return nil, err
	}
	if err := r.Step("marketplace", "claude plugin marketplace update", func() (string, error) {
		return market, claudePlugin("marketplace", "update", market)
	}); err != nil {
		return nil, err
	}
	id := name + "@" + market
	if err := r.Step("update", "claude plugin update", func() (string, error) {
		return id, claudePlugin("update", id, "-y")
	}); err != nil {
		return nil, err
	}
	installed := filepath.Join(cache, market, name, to)
	if err := r.Step("cache", "reading the cache back", func() (string, error) {
		if !exists(installed) {
			// a marketplace added from the main checkout reads it there, so a worktree's bump never arrives
			return "", &Fail{Msg: fmt.Sprintf("the cache holds no %s %s at %s", name, to, home(installed)),
				Next: "claude plugin marketplace list --json — bump where the marketplace's source lives"}
		}
		return home(installed), nil
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%s %s in the cache; binds after a reload", name, to), "/reload-plugins")
	return append(data, kv{"cache", installed}, kv{"reload", "/reload-plugins"}), nil
}

// findPlugin reads every tracked plugin.json; a name nobody carries lists the ones that exist
func findPlugin(tree, name string) (manifest, dir, version string, err error) {
	paths, err := tracked(tree, "plugin.json")
	if err != nil {
		return "", "", "", err
	}
	var names []string
	for _, path := range paths {
		var found pluginManifest
		raw, _ := os.ReadFile(path)
		if json.Unmarshal(raw, &found) != nil || found.Name == "" {
			continue
		}
		if found.Name == name {
			return path, filepath.Dir(filepath.Dir(path)), found.Version, nil
		}
		names = append(names, found.Name)
	}
	slices.Sort(names)
	return "", "", "", usageFail(fmt.Sprintf("no plugin named %q here; there are %s", name, strings.Join(names, ", ")), "x plugin bump <name>")
}

// marketOf finds the marketplace whose plugin entry's source is the plugin's own dir
func marketOf(tree, dir string) (string, error) {
	paths, err := tracked(tree, "marketplace.json")
	if err != nil {
		return "", err
	}
	for _, path := range paths {
		var market struct {
			Name    string `json:"name"`
			Plugins []struct {
				Source json.RawMessage `json:"source"`
			} `json:"plugins"`
		}
		raw, _ := os.ReadFile(path)
		if json.Unmarshal(raw, &market) != nil {
			continue
		}
		root := filepath.Dir(filepath.Dir(path))
		for _, plugin := range market.Plugins {
			var source string
			if json.Unmarshal(plugin.Source, &source) == nil && filepath.Join(root, source) == dir {
				return market.Name, nil
			}
		}
	}
	return "", nil
}

func tracked(tree, file string) ([]string, error) {
	out, err := mustGitIn(tree, "ls-files", "ls-files", "--", ":(glob)**/.claude-plugin/"+file)
	if err != nil || out == "" {
		return nil, err
	}
	var paths []string
	for line := range strings.SplitSeq(out, "\n") {
		paths = append(paths, filepath.Join(tree, line))
	}
	return paths, nil
}

func nextPatch(version string) (string, error) {
	parts := strings.Split(version, ".")
	if len(parts) == 3 {
		if patch, err := strconv.Atoi(parts[2]); err == nil {
			return fmt.Sprintf("%s.%s.%d", parts[0], parts[1], patch+1), nil
		}
	}
	return "", &Fail{Refused: true, Msg: fmt.Sprintf("version %q is not a.b.c", version), Next: "set a semver version in its plugin.json by hand"}
}

// a line edit, never a re-serialize: the manifests sit outside biome, and a rewrite reformats them whole
func writeVersion(manifest, from, to string) error {
	raw, err := os.ReadFile(manifest)
	if err != nil {
		return err
	}
	found := versionLine.FindSubmatchIndex(raw)
	if found == nil || string(raw[found[4]:found[5]]) != from {
		return &Fail{Refused: true, Msg: home(manifest) + " moved since the plan — not writing over it", Next: "x plugin bump <name> --apply"}
	}
	next := slices.Concat(raw[:found[4]], []byte(to), raw[found[5]:])
	return os.WriteFile(manifest, next, 0o644)
}

func pluginCache() (string, error) {
	dir := os.Getenv("CLAUDE_CONFIG_DIR")
	if dir == "" {
		if os.Getenv("X_TEST") != "" {
			return "", &Fail{Msg: "X_TEST without CLAUDE_CONFIG_DIR — no test reads the real plugin cache", Next: "set CLAUDE_CONFIG_DIR to a temp dir"}
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		dir = filepath.Join(home, ".claude")
	}
	return filepath.Join(dir, "plugins", "cache"), nil
}

func installedPlugins() ([]string, error) {
	listed, _ := run("", nil, "", "claude", "plugin", "list", "--json")
	var plugins []struct {
		ID string `json:"id"`
	}
	if !listed.ok || json.Unmarshal([]byte(listed.out), &plugins) != nil {
		return nil, &Fail{Msg: "claude plugin list --json gave no list — its output is above", Next: "claude plugin list --json", Log: nonBlank(listed.log)}
	}
	var ids []string
	for _, plugin := range plugins {
		ids = append(ids, plugin.ID)
	}
	return ids, nil
}

func claudePlugin(args ...string) error {
	done, _ := run("", nil, "", "claude", append([]string{"plugin"}, args...)...)
	if !done.ok {
		return &Fail{Msg: "claude plugin " + strings.Join(args, " ") + " failed — its output is above",
			Next: "claude plugin " + strings.Join(args, " "), Log: nonBlank(done.log)}
	}
	return nil
}
