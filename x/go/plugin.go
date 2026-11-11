package main

import (
	"encoding/json"
	"errors"
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

// a bump's plan: the manifest it edits, its version step, and the marketplace to refresh after ("" when none will)
type bumpTarget struct {
	name, manifest, from, to, market string
	// the tree is a worktree: its bump rides the branch, and main's merge is the release
	linked bool
	common string
}

func planBump(tree, name string) (bumpTarget, string, error) {
	b := bumpTarget{name: name}
	common, linked, err := worktreeOf(tree)
	if err != nil {
		return b, "", err
	}
	b.linked, b.common = linked, common
	var dir string
	if b.manifest, dir, b.from, err = findPlugin(tree, name); err != nil {
		return b, "", err
	}
	if b.to, err = nextPatch(b.from); err != nil {
		return b, "", err
	}
	step := b.from + " → " + b.to
	// a marketplace reads the checkout it was added from, so a worktree's bump never reaches the cache
	if linked {
		return b, step + ", a worktree: the release is main's at the merge", nil
	}
	var root string
	if b.market, root, err = marketOf(tree, dir); err != nil || b.market == "" {
		return b, step + ", no marketplace lists it: a bump only", err
	}
	// a listing is not an install: the mods load @inline and x-cloud-chat's marketplace is never added
	installed, err := installedPlugins()
	if err != nil {
		return b, "", err
	}
	if id := name + "@" + b.market; len(installed[id]) == 0 {
		b.market = ""
		return b, fmt.Sprintf("%s, %s is not installed: a bump only", step, id), nil
	}
	// a directory marketplace reads the checkout it was added from; a bump in any other tree never
	// reaches the cache, and the refresh would touch the live install for nothing
	reads, err := marketPath(b.market)
	if err != nil {
		return b, "", err
	}
	if reads != root {
		return b, "", &Fail{Refused: true, Msg: fmt.Sprintf("marketplace %s reads %s, not this tree — nothing written", b.market, home(reads)),
			Next: "x plugin bump " + name + " from the checkout holding " + home(reads)}
	}
	return b, fmt.Sprintf("%s, marketplace %s", step, b.market), nil
}

func pluginBumpPlan(r *Run, args []string, _ Flags) (any, error) {
	name := args[0]
	tree, err := top()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var b bumpTarget
	if err := r.Step("plan", "finding the plugin and its marketplace", func() (string, error) {
		planned, said, err := planBump(tree, name)
		b = planned
		return said, err
	}); err != nil {
		return nil, err
	}
	return ordered{{"name", name}, {"manifest", b.manifest}, {"from", b.from}, {"to", b.to}, {"marketplace", b.market}, {"worktree", b.linked}}, nil
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
	// a worktree's bump commits on its own branch: an uncommitted plugin.json in main is what the fork guard refused
	if fields[5].value == true {
		r.skip("marketplace", "update", "cache")
		var sha string
		if err := r.Step("commit", "the bump, on this tree's branch", func() (string, error) {
			committed, _, err := lockedGit("commit", "-q", "-m", fmt.Sprintf("🔧 %s: bump to %s", name, to), "--", manifest)
			if err != nil {
				return "", errors.Join(writeVersion(manifest, to, from), err)
			}
			if !committed.ok {
				return "", errors.Join(writeVersion(manifest, to, from), hookFail(committed.log, "x plugin bump "+name+" --apply"))
			}
			sha, err = head()
			return short(sha), err
		}); err != nil {
			return nil, err
		}
		r.Done(fmt.Sprintf("%s %s committed on this branch; the release is main's at the merge", name, to), "x lane push --apply")
		return append(data, kv{"sha", sha}), nil
	}
	r.skip("commit")
	if market == "" {
		r.skip("marketplace", "update", "cache")
		r.Done(fmt.Sprintf("%s %s, bump only — not installed from a marketplace", name, to), "")
		return data, nil
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
	var cache string
	if err := r.Step("cache", "reading the install back", func() (string, error) {
		found, err := installedAt(id, to)
		cache = found
		return home(cache), err
	}); err != nil {
		return nil, err
	}
	older := olderCopies(filepath.Dir(cache), to)
	r.Done(reloadLine(name, to, older), "/reload-plugins")
	return append(data, kv{"cache", cache}, kv{"reload", "/reload-plugins"}, kv{"older", older}), nil
}

// the reload message: the new version, and every live session still on an older copy
func reloadLine(name, to string, older []ordered) string {
	line := fmt.Sprintf("%s %s in the cache; binds after a reload", name, to)
	if len(older) == 0 {
		return line + "; no live session holds an older copy"
	}
	var held []string
	for _, o := range older {
		held = append(held, fmt.Sprintf("%s (%s)", o[0].value, o[1].value))
	}
	return line + "; still on an older copy: " + strings.Join(held, ", ")
}

// refreshPlugin moves the marketplace and the install to the version a commit just landed, and reads it back
func refreshPlugin(id, market, to string) (string, error) {
	if err := claudePlugin("marketplace", "update", market); err != nil {
		return "", err
	}
	if err := claudePlugin("update", id, "-y"); err != nil {
		return "", err
	}
	return installedAt(id, to)
}

// installedAt is the cache dir claude reports for the plugin at that version
func installedAt(id, to string) (string, error) {
	installed, err := installedPlugins()
	if err != nil {
		return "", err
	}
	// a stale dir for the same version proves nothing: claude must report the install at that version
	var versions []string
	for _, got := range installed[id] {
		if got.Version == to && exists(got.InstallPath) {
			return got.InstallPath, nil
		}
		versions = append(versions, got.Version)
	}
	// a marketplace added from the main checkout reads it there, so a worktree's bump never arrives
	return "", &Fail{Msg: fmt.Sprintf("claude reports %s at %s, not %s", id, or(strings.Join(versions, ", "), "nothing"), to),
		Next: "claude plugin marketplace list --json — bump where the marketplace's source lives"}
}

// unbumpedPlugins are the plugins whose files a commit changed without their plugin.json, each one a marketplace
// lists. the nearest plugin dir above a path owns it, so a mod with its own manifest answers for its own files
func unbumpedPlugins(tree string, paths []string) []string {
	var names []string
	for _, path := range paths {
		for dir := filepath.Dir(path); dir != "." && dir != "/"; dir = filepath.Dir(dir) {
			rel := filepath.Join(dir, ".claude-plugin", "plugin.json")
			var found pluginManifest
			raw, err := os.ReadFile(filepath.Join(tree, rel))
			if err != nil {
				continue
			}
			if slices.Contains(paths, rel) || json.Unmarshal(raw, &found) != nil {
				break
			}
			if market, _, _ := marketOf(tree, filepath.Join(tree, dir)); market != "" && !slices.Contains(names, found.Name) {
				names = append(names, found.Name)
			}
			break
		}
	}
	return names
}

// findPlugin reads every tracked plugin.json; a name nobody carries lists the ones that exist
func findPlugin(tree, name string) (manifest, dir, version string, err error) {
	paths, err := pluginFiles(tree, "plugin.json")
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
func marketOf(tree, dir string) (name, root string, err error) {
	paths, err := pluginFiles(tree, "marketplace.json")
	if err != nil {
		return "", "", err
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
				return market.Name, root, nil
			}
		}
	}
	return "", "", nil
}

// marketPath is the dir a registered marketplace reads its plugins from
func marketPath(name string) (string, error) {
	listed, _ := run("", nil, "", "claude", "plugin", "marketplace", "list", "--json")
	var markets []struct {
		Name string `json:"name"`
		Path string `json:"path"`
	}
	if !listed.ok || json.Unmarshal([]byte(listed.out), &markets) != nil {
		return "", &Fail{Msg: "claude plugin marketplace list --json gave no list — its output is above", Next: "claude plugin marketplace list --json", Log: nonBlank(listed.log)}
	}
	for _, market := range markets {
		if market.Name == name {
			return market.Path, nil
		}
	}
	return "", nil
}

func pluginFiles(tree, file string) ([]string, error) {
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

type install struct {
	Version     string `json:"version"`
	InstallPath string `json:"installPath"`
}

// installedPlugins maps each plugin@marketplace to its installs: one id can sit in several scopes
func installedPlugins() (map[string][]install, error) {
	listed, _ := run("", nil, "", "claude", "plugin", "list", "--json")
	var plugins []struct {
		install
		ID string `json:"id"`
	}
	if !listed.ok || json.Unmarshal([]byte(listed.out), &plugins) != nil {
		return nil, &Fail{Msg: "claude plugin list --json gave no list — its output is above", Next: "claude plugin list --json", Log: nonBlank(listed.log)}
	}
	installs := map[string][]install{}
	for _, plugin := range plugins {
		installs[plugin.ID] = append(installs[plugin.ID], plugin.install)
	}
	return installs, nil
}

func claudePlugin(args ...string) error {
	done, _ := run("", nil, "", "claude", append([]string{"plugin"}, args...)...)
	if !done.ok {
		return &Fail{Msg: "claude plugin " + strings.Join(args, " ") + " failed — its output is above",
			Next: "claude plugin " + strings.Join(args, " "), Log: nonBlank(done.log)}
	}
	return nil
}
