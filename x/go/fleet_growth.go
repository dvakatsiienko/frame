package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
)

// `x fleet growth`: each part of the fleet (a cc mod, a herdr mod, an x verb family, a skill) measured in lines with its tests, against
// the size it was seeded at; a part that doubled is named, so a guard that grew 932 → 2,617 lines in 6 days is seen by the reader
// and not by dima (FRM-590)

const (
	growthModsDir   = "home/.claude/plugin-x/mods/"
	growthHerdrDir  = "home/.config/herdr-app/mods/"
	growthSkillsX   = "home/.claude/plugin-x/skills/"
	growthSkillsClo = "_clio/plugin-clio/skills/"
	growthGoDir     = "x/go/"
	growthSizeRatio = 2
)

type growthCrossing struct {
	Part    string `json:"part"`
	Trigger string `json:"trigger"`
	Then    int    `json:"then"`
	Now     int    `json:"now"`
}

type growthData struct {
	Seeded    bool             `json:"seeded"`
	Parts     int              `json:"parts"`
	Crossings []growthCrossing `json:"crossings"`
}

type growthEntry struct {
	Lines int `json:"lines"`
}

type growthBaseline struct {
	Parts map[string]growthEntry `json:"parts"`
}

func fleetGrowth(r *Run, _ []string, _ Flags) (any, error) {
	root := frameRoot()
	sizes, err := growthSizes(root)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(stateDir(), "fleet-growth", "baseline.json")
	baseline, hadBaseline := growthBaseline{Parts: map[string]growthEntry{}}, false
	if raw, err := os.ReadFile(path); err == nil {
		hadBaseline = json.Unmarshal(raw, &baseline) == nil && baseline.Parts != nil
	}
	data := growthData{Seeded: !hadBaseline, Parts: len(sizes), Crossings: []growthCrossing{}}
	if !hadBaseline {
		baseline = growthBaseline{Parts: map[string]growthEntry{}}
	}
	born := false
	for _, part := range slices.Sorted(maps.Keys(sizes)) {
		entry, known := baseline.Parts[part]
		switch {
		case !known:
			baseline.Parts[part] = growthEntry{Lines: sizes[part]}
			born = true
		case entry.Lines > 0 && sizes[part] >= growthSizeRatio*entry.Lines:
			data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "size", Then: entry.Lines, Now: sizes[part]})
		}
	}
	if !hadBaseline || born {
		if err := writeGrowthBaseline(path, baseline); err != nil {
			return nil, err
		}
	}
	if r.human {
		r.Board(textBoard("fleet growth", fmt.Sprintf("%d parts", data.Parts), growthLines(data)))
	}
	return data, nil
}

func growthLines(data growthData) []string {
	if data.Seeded {
		return []string{fmt.Sprintf("seeded the baseline from today's sizes: %d parts", data.Parts)}
	}
	if len(data.Crossings) == 0 {
		return []string{"no part crossed"}
	}
	var lines []string
	for _, c := range data.Crossings {
		lines = append(lines, fmt.Sprintf("%s: %d → %d lines (%s)", c.Part, c.Then, c.Now, c.Trigger))
	}
	return lines
}

func writeGrowthBaseline(path string, baseline growthBaseline) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	var out bytes.Buffer
	enc := json.NewEncoder(&out)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(baseline); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, out.Bytes(), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// the lines of every tracked file of each part, today's working-tree bytes; the tracked set keeps an engine's generated types and
// node_modules out
func growthSizes(root string) (map[string]int, error) {
	out, err := exec.Command("git", "-C", root, "ls-files", "-z", "--", growthModsDir, growthHerdrDir, growthSkillsX, growthSkillsClo, growthGoDir).Output()
	if err != nil {
		return nil, &Fail{Msg: "git ls-files failed: " + err.Error(), Next: "git status"}
	}
	var families []string
	for _, family := range familyList {
		families = append(families, family.Name)
	}
	sizes := map[string]int{}
	for _, file := range strings.Split(string(out), "\x00") {
		part, ok := growthPartOf(file, families)
		if !ok {
			continue
		}
		body, err := os.ReadFile(filepath.Join(root, file))
		if err != nil || bytes.IndexByte(body, 0) >= 0 {
			continue
		}
		sizes[part] += bytes.Count(body, []byte("\n"))
		if len(body) > 0 && body[len(body)-1] != '\n' {
			sizes[part]++
		}
	}
	return sizes, nil
}

// the part a tracked path belongs to: a mod is its directory under mods/, a skill its directory (`x:` or `clio:` before the name),
// a verb family the go files that open with its name
func growthPartOf(file string, families []string) (string, bool) {
	for _, dir := range []struct{ prefix, mark, label string }{
		{growthModsDir, "x-mod-", ""},
		{growthHerdrDir, "x-herdr-", ""},
		{growthSkillsX, "", "x:"},
		{growthSkillsClo, "", "clio:"},
	} {
		rest, ok := strings.CutPrefix(file, dir.prefix)
		name, _, nested := strings.Cut(rest, "/")
		if ok && nested && strings.HasPrefix(name, dir.mark) {
			return dir.label + name, true
		}
	}
	base, ok := strings.CutPrefix(file, growthGoDir)
	if !ok || strings.Contains(base, "/") || !strings.HasSuffix(base, ".go") {
		return "", false
	}
	best := ""
	for _, family := range families {
		if (base == family+".go" || strings.HasPrefix(base, family+"_")) && len(family) > len(best) {
			best = family
		}
	}
	return "x " + best, best != ""
}
