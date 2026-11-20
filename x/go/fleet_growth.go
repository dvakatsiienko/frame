package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
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
	growthWindow    = 7 * 24 * time.Hour
	growthFixes     = 3
	growthTurns     = 3
)

// a size crossing carries lines then → now, a fixes or turns crossing its count
type growthCrossing struct {
	Part    string `json:"part"`
	Trigger string `json:"trigger"`
	Then    int    `json:"then,omitempty"`
	Now     int    `json:"now,omitempty"`
	Count   int    `json:"count,omitempty"`
}

type growthData struct {
	Seeded    bool             `json:"seeded"`
	Parts     int              `json:"parts"`
	Crossings []growthCrossing `json:"crossings"`
}

// at is the instant the part was seeded: fixes and turns count only from it
type growthEntry struct {
	Lines int    `json:"lines"`
	At    string `json:"at"`
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
	now := clock()
	stamp := now.Format(time.RFC3339)
	data := growthData{Seeded: !hadBaseline, Parts: len(sizes), Crossings: []growthCrossing{}}
	if !hadBaseline {
		baseline = growthBaseline{Parts: map[string]growthEntry{}}
	}
	born := false
	parts := slices.Sorted(maps.Keys(sizes))
	for _, part := range parts {
		entry, known := baseline.Parts[part]
		switch {
		case !known:
			baseline.Parts[part] = growthEntry{Lines: sizes[part], At: stamp}
			born = true
		case entry.Lines > 0 && sizes[part] >= growthSizeRatio*entry.Lines:
			data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "size", Then: entry.Lines, Now: sizes[part]})
		}
	}
	if hadBaseline {
		fixes, err := growthFixCounts(root, now, baseline)
		if err != nil {
			return nil, err
		}
		turns := growthTurnCounts(now, baseline, parts)
		for _, part := range parts {
			if fixes[part] >= growthFixes {
				data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "fixes", Count: fixes[part]})
			}
			if turns[part] >= growthTurns {
				data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "turns (rough)", Count: turns[part]})
			}
		}
		rank := map[string]int{"size": 0, "fixes": 1, "turns (rough)": 2}
		slices.SortStableFunc(data.Crossings, func(a, b growthCrossing) int {
			return strings.Compare(a.Part, b.Part)*3 + rank[a.Trigger] - rank[b.Trigger]
		})
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
		switch c.Trigger {
		case "size":
			lines = append(lines, fmt.Sprintf("%s: %d → %d lines (size)", c.Part, c.Then, c.Now))
		case "fixes":
			lines = append(lines, fmt.Sprintf("%s: %d fixes in 7 days", c.Part, c.Count))
		default:
			lines = append(lines, fmt.Sprintf("%s: %d of his turns in one day (rough)", c.Part, c.Count))
		}
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
	for file := range strings.SplitSeq(string(out), "\x00") {
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

// the instant a part was seeded; a missing or unreadable stamp counts every event
func (b growthBaseline) seededAt(part string) time.Time {
	at, _ := time.Parse(time.RFC3339, b.Parts[part].At)
	return at
}

// 🐞 commits of the last 7 days touching each part's files, from the part's seed on: one git read over the five roots, each commit
// credited once to every part it touched
func growthFixCounts(root string, now time.Time, baseline growthBaseline) (map[string]int, error) {
	out, err := exec.Command("git", "-C", root, "log", "--since="+now.Add(-growthWindow).Format(time.RFC3339), "--name-only", "--format=%x1e%ct%x09%s", "--",
		growthModsDir, growthHerdrDir, growthSkillsX, growthSkillsClo, growthGoDir).Output()
	if err != nil {
		return nil, &Fail{Msg: "git log failed: " + err.Error(), Next: "git status"}
	}
	var families []string
	for _, family := range familyList {
		families = append(families, family.Name)
	}
	counts := map[string]int{}
	for commit := range strings.SplitSeq(string(out), "\x1e") {
		head, files, _ := strings.Cut(commit, "\n")
		secs, subject, ok := strings.Cut(head, "\t")
		at, err := strconv.ParseInt(secs, 10, 64)
		if !ok || err != nil || !strings.HasPrefix(subject, "🐞") {
			continue
		}
		touched := map[string]bool{}
		for file := range strings.SplitSeq(files, "\n") {
			if part, ok := growthPartOf(file, families); ok {
				touched[part] = true
			}
		}
		for part := range touched {
			if _, known := baseline.Parts[part]; known && at >= baseline.seededAt(part).Unix() {
				counts[part]++
			}
		}
	}
	return counts, nil
}

type promptBlock struct {
	at   time.Time
	body strings.Builder
}

var promptHead = regexp.MustCompile(`^## (\d\d):(\d\d)\s*$`)

// the most of his prompt blocks naming one part on one day of the last 7, from the part's seed on: a block names a part by its id
// (a skill also by its bare name), any case; a rough count, a name inside a longer word counts
func growthTurnCounts(now time.Time, baseline growthBaseline, parts []string) map[string]int {
	home, _ := os.UserHomeDir()
	needles := map[string][]string{}
	for _, part := range parts {
		needles[part] = []string{strings.ToLower(part)}
		if _, bare, ok := strings.Cut(part, ":"); ok {
			needles[part] = append(needles[part], bare)
		}
	}
	best := map[string]int{}
	for back := range 7 {
		day := now.Local().AddDate(0, 0, -back)
		raw, err := os.ReadFile(filepath.Join(home, ".local/state/clio/prompts", day.Format("2006-01-02")+".md"))
		if err != nil {
			continue
		}
		perDay := map[string]int{}
		var blocks []promptBlock
		for line := range strings.SplitSeq(string(raw), "\n") {
			if m := promptHead.FindStringSubmatch(line); m != nil {
				hour, _ := strconv.Atoi(m[1])
				minute, _ := strconv.Atoi(m[2])
				blocks = append(blocks, promptBlock{at: time.Date(day.Year(), day.Month(), day.Day(), hour, minute, 0, 0, time.Local)})
			} else if len(blocks) > 0 {
				blocks[len(blocks)-1].body.WriteString(strings.ToLower(line) + "\n")
			}
		}
		for _, block := range blocks {
			text := block.body.String()
			for _, part := range parts {
				if _, known := baseline.Parts[part]; !known || block.at.Before(baseline.seededAt(part)) {
					continue
				}
				if slices.ContainsFunc(needles[part], func(needle string) bool { return strings.Contains(text, needle) }) {
					perDay[part]++
				}
			}
		}
		for part, n := range perDay {
			best[part] = max(best[part], n)
		}
	}
	return best
}
