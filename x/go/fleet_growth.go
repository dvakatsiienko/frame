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
	// the ask clio puts on the board: the part's origin, its size then → now, its fixes and his turns, and the three answers
	Ask string `json:"ask"`
}

type growthData struct {
	Seeded    bool             `json:"seeded"`
	Parts     int              `json:"parts"`
	Kept      string           `json:"kept,omitempty"`
	Crossings []growthCrossing `json:"crossings"`
	// a read that failed (git, the repo): the reader never refuses, so what it could not read is said here and the run exits 0
	Error string `json:"error,omitempty"`
}

// at is the instant the part was seeded or last kept: fixes and turns count only from it; reported lists the trigger kinds already
// named since then, so a crossing is raised once
type growthEntry struct {
	Lines    int      `json:"lines"`
	At       string   `json:"at"`
	Reported []string `json:"reported,omitempty"`
}

type growthBaseline struct {
	Parts map[string]growthEntry `json:"parts"`
}

func fleetGrowth(r *Run, _ []string, flags Flags) (any, error) {
	root := frameRoot()
	sizes, err := growthSizes(root)
	if err != nil {
		return growthData{Crossings: []growthCrossing{}, Error: err.Error()}, nil
	}
	path := filepath.Join(stateDir(), "fleet-growth", "baseline.json")
	baseline, hadBaseline := growthBaseline{Parts: map[string]growthEntry{}}, false
	if raw, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(raw, &baseline); err != nil {
			return nil, &Fail{Msg: path + " does not parse (" + err.Error() + "), so x leaves it as it is", Next: "jq . " + quote(path)}
		}
		hadBaseline = baseline.Parts != nil
	}
	now := clock()
	stamp := now.Format(time.RFC3339)
	data := growthData{Seeded: !hadBaseline, Parts: len(sizes), Crossings: []growthCrossing{}}
	if !hadBaseline {
		baseline = growthBaseline{Parts: map[string]growthEntry{}}
	}
	changed := !hadBaseline
	if keep, _ := flags["keep"].(string); keep != "" {
		if _, ok := sizes[keep]; !ok {
			return nil, usageFail("no part named "+keep+" to keep", "x fleet growth --json")
		}
		baseline.Parts[keep] = growthEntry{Lines: sizes[keep], At: stamp}
		data.Kept, changed = keep, true
	}
	parts := slices.Sorted(maps.Keys(sizes))
	for _, part := range parts {
		entry, known := baseline.Parts[part]
		switch {
		case !known:
			baseline.Parts[part] = growthEntry{Lines: sizes[part], At: stamp}
			changed = true
		case entry.Lines > 0 && sizes[part] >= growthSizeRatio*entry.Lines:
			data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "size", Then: entry.Lines, Now: sizes[part]})
		}
	}
	if hadBaseline {
		fixes, err := growthFixCounts(root, now, baseline)
		if err != nil {
			data.Error = err.Error()
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
		fresh := []growthCrossing{}
		for _, c := range data.Crossings {
			entry := baseline.Parts[c.Part]
			if slices.Contains(entry.Reported, c.Trigger) {
				continue
			}
			entry.Reported = append(entry.Reported, c.Trigger)
			baseline.Parts[c.Part] = entry
			fresh, changed = append(fresh, c), true
		}
		data.Crossings = fresh
		if len(fresh) > 0 {
			origins, err := growthOrigins(root)
			if err != nil {
				data.Error = err.Error()
			}
			for i, c := range data.Crossings {
				data.Crossings[i].Ask = growthAsk(c, baseline.Parts[c.Part].Lines, sizes[c.Part], origins[c.Part], fixes[c.Part], turns[c.Part])
			}
		}
	}
	if changed {
		if err := writeGrowthBaseline(path, baseline); err != nil {
			return nil, err
		}
	}
	if r.human {
		lines := growthLines(data)
		if data.Error != "" {
			lines = append(lines, "not read: "+data.Error)
		}
		r.Board(textBoard("fleet growth", fmt.Sprintf("%d parts", data.Parts), lines))
	}
	return data, nil
}

func growthLines(data growthData) []string {
	if data.Kept != "" {
		return append([]string{"kept " + data.Kept + " at today's size"}, growthLines(growthData{Crossings: data.Crossings, Parts: data.Parts})...)
	}
	if data.Seeded {
		return []string{fmt.Sprintf("seeded the baseline from today's sizes: %d parts", data.Parts)}
	}
	if len(data.Crossings) == 0 {
		return []string{"no part crossed"}
	}
	var lines []string
	for _, c := range data.Crossings {
		lines = append(lines, c.Ask)
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

// the most of his prompt blocks naming one part on one day of the last 7, from the part's seed on, the main's log and every wing's
// together: a block names a part by its id (a skill also by its bare name when that holds a hyphen), any case, on word edges; a
// rough count
func growthTurnCounts(now time.Time, baseline growthBaseline, parts []string) map[string]int {
	home, _ := os.UserHomeDir()
	promptsDir := filepath.Join(home, ".local/state/clio/prompts")
	needles := map[string]*regexp.Regexp{}
	for _, part := range parts {
		names := []string{regexp.QuoteMeta(strings.ToLower(part))}
		// a bare skill name counts only when it is distinctive (it holds a hyphen): «pm» would name «npm» and «5pm»
		if _, bare, ok := strings.Cut(part, ":"); ok && strings.Contains(bare, "-") {
			names = append(names, regexp.QuoteMeta(bare))
		}
		needles[part] = regexp.MustCompile(`(?:^|[^a-z0-9:-])(?:` + strings.Join(names, "|") + `)(?:$|[^a-z0-9:-])`)
	}
	best := map[string]int{}
	for back := range 7 {
		day := now.Local().AddDate(0, 0, -back)
		name := day.Format("2006-01-02") + ".md"
		wings, _ := filepath.Glob(filepath.Join(promptsDir, "wing-*", name))
		perDay := map[string]int{}
		for _, file := range append([]string{filepath.Join(promptsDir, name)}, wings...) {
			raw, err := os.ReadFile(file)
			if err != nil {
				continue
			}
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
					if _, known := baseline.Parts[part]; known && !block.at.Before(baseline.seededAt(part)) && needles[part].MatchString(text) {
						perDay[part]++
					}
				}
			}
		}
		for part, n := range perDay {
			best[part] = max(best[part], n)
		}
	}
	return best
}

type growthOrigin struct{ subject, date string }

// each part's first commit: the oldest commit that added a file of it, one git read over the five roots
func growthOrigins(root string) (map[string]growthOrigin, error) {
	out, err := exec.Command("git", "-C", root, "log", "--reverse", "--diff-filter=A", "--name-only", "--format=%x1e%cs%x09%s", "--",
		growthModsDir, growthHerdrDir, growthSkillsX, growthSkillsClo, growthGoDir).Output()
	if err != nil {
		return nil, &Fail{Msg: "git log failed: " + err.Error(), Next: "git status"}
	}
	var families []string
	for _, family := range familyList {
		families = append(families, family.Name)
	}
	origins := map[string]growthOrigin{}
	for commit := range strings.SplitSeq(string(out), "\x1e") {
		head, files, _ := strings.Cut(commit, "\n")
		date, subject, ok := strings.Cut(head, "\t")
		if !ok {
			continue
		}
		for file := range strings.SplitSeq(files, "\n") {
			if part, ok := growthPartOf(file, families); ok {
				if _, seen := origins[part]; !seen {
					origins[part] = growthOrigin{subject: subject, date: date}
				}
			}
		}
	}
	return origins, nil
}

func growthAsk(c growthCrossing, then, now int, origin growthOrigin, fixes, turns int) string {
	return fmt.Sprintf("%s crossed on %s: %s → %s lines. first commit «%s» on %s. fixes in 7 days: %d, his turns in a day (rough): %d. keep, shrink or delete?",
		c.Part, c.Trigger, thousands(then), thousands(now), origin.subject, origin.date, fixes, turns)
}

func thousands(n int) string {
	digits := strconv.Itoa(n)
	for i := len(digits) - 3; i > 0; i -= 3 {
		digits = digits[:i] + "," + digits[i:]
	}
	return digits
}
