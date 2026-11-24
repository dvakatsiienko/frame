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
	// the date it was first reported, empty for one a baseline from before this field named; Calmed: reported before, under its limit now
	First  string `json:"first,omitempty"`
	Calmed bool   `json:"calmed,omitempty"`
	// First is the day a run dated a kind a baseline from before the date had already reported, not the day it was first reported
	ReportedBefore bool `json:"reportedBefore,omitempty"`
	// a fixes crossing names both its counts: Count since the part's seed or last keep (Since, its date), Week all in 7 days
	Since string `json:"since,omitempty"`
	Week  int    `json:"week,omitempty"`
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
// named since then: a size or fixes one prints on every run until the keep, the rough turns one only the once
type growthEntry struct {
	Lines    int      `json:"lines"`
	At       string   `json:"at"`
	Reported []string `json:"reported,omitempty"`
	// the date each reported kind was first named, for the kinds named since the field exists
	First map[string]string `json:"first,omitempty"`
	// the kinds reported before the date existed, dated by a later run: their First says when x first saw them, not when they crossed
	Before []string `json:"before,omitempty"`
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
		fixes, week, fixesErr := growthFixCounts(root, now, baseline)
		if fixesErr != nil {
			data.Error = fixesErr.Error()
		}
		turns := growthTurnCounts(now, baseline, parts)
		for _, part := range parts {
			if fixes[part] >= growthFixes {
				data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "fixes", Count: fixes[part], Week: week[part], Since: sinceOf(baseline, part, now)})
			}
			if turns[part] >= growthTurns {
				data.Crossings = append(data.Crossings, growthCrossing{Part: part, Trigger: "turns (rough)", Count: turns[part]})
			}
		}
		rank := map[string]int{"size": 0, "fixes": 1, "turns (rough)": 2}
		slices.SortStableFunc(data.Crossings, func(a, b growthCrossing) int {
			return strings.Compare(a.Part, b.Part)*3 + rank[a.Trigger] - rank[b.Trigger]
		})
		// a size or fixes crossing prints on every run until the keep; the rough turns one prints once
		live := map[[2]string]bool{}
		for _, c := range data.Crossings {
			live[[2]string{c.Part, c.Trigger}] = true
		}
		shown := []growthCrossing{}
		for _, c := range data.Crossings {
			entry := baseline.Parts[c.Part]
			named := slices.Contains(entry.Reported, c.Trigger)
			if named && c.Trigger == "turns (rough)" {
				continue
			}
			written := !named
			if !named {
				entry.Reported = append(entry.Reported, c.Trigger)
			}
			// a kind reported before its date existed is dated by this run, and says so
			if (!named || entry.First[c.Trigger] == "") && c.Trigger != "turns (rough)" {
				entry.First = maps.Clone(entry.First)
				if entry.First == nil {
					entry.First = map[string]string{}
				}
				entry.First[c.Trigger] = now.Format(time.DateOnly)
				if named {
					entry.Before, written = append(slices.Clone(entry.Before), c.Trigger), true
				}
			}
			if written {
				baseline.Parts[c.Part], changed = entry, true
			}
			c.First, c.ReportedBefore = entry.First[c.Trigger], slices.Contains(entry.Before, c.Trigger)
			shown = append(shown, c)
		}
		// a kind reported before and under its limit now stays in the report, saying so, until the keep
		for _, part := range parts {
			entry := baseline.Parts[part]
			for _, trigger := range []string{"size", "fixes"} {
				if !slices.Contains(entry.Reported, trigger) || live[[2]string{part, trigger}] {
					continue
				}
				// a fixes count nobody took says nothing of a calm: the read's failure is in `error`
				if trigger == "fixes" && fixesErr != nil {
					continue
				}
				calmed := growthCrossing{Part: part, Trigger: trigger, Calmed: true, First: entry.First[trigger]}
				if trigger == "size" {
					calmed.Then, calmed.Now = entry.Lines, sizes[part]
				} else {
					calmed.Count, calmed.Week, calmed.Since = fixes[part], week[part], sinceOf(baseline, part, now)
				}
				shown = append(shown, calmed)
			}
		}
		slices.SortStableFunc(shown, func(a, b growthCrossing) int {
			return strings.Compare(a.Part, b.Part)*3 + rank[a.Trigger] - rank[b.Trigger]
		})
		data.Crossings = shown
		if len(shown) > 0 {
			origins, err := growthOrigins(root)
			if err != nil {
				data.Error = err.Error()
			}
			for i, c := range data.Crossings {
				data.Crossings[i].Ask = growthAsk(c, baseline.Parts[c.Part].Lines, sizes[c.Part], origins[c.Part], growthFixCount{since: sinceOf(baseline, c.Part, now), count: fixes[c.Part], week: week[c.Part]}, turns[c.Part])
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
		if c.ReportedBefore {
			lines = append(lines, c.Ask+" first seen "+c.First+", reported before")
		} else if c.First != "" {
			lines = append(lines, c.Ask+" first: "+c.First)
		} else {
			lines = append(lines, c.Ask)
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

// the date the fixes count really starts: the part's seed or last keep, or the start of the 7 days the git read covers when that is later
func sinceOf(b growthBaseline, part string, now time.Time) string {
	from := b.seededAt(part)
	if week := now.Add(-growthWindow); from.Before(week) {
		from = week
	}
	return from.Format(time.DateOnly)
}

// the instant a part was seeded; a missing or unreadable stamp counts every event
func (b growthBaseline) seededAt(part string) time.Time {
	at, _ := time.Parse(time.RFC3339, b.Parts[part].At)
	return at
}

// 🐞 commits of the last 7 days touching each part's files: week counts them all, since only those from the part's seed or last keep
// on; one git read over the five roots, each commit credited once to every part it touched
func growthFixCounts(root string, now time.Time, baseline growthBaseline) (since, week map[string]int, err error) {
	out, err := exec.Command("git", "-C", root, "log", "--since="+now.Add(-growthWindow).Format(time.RFC3339), "--name-only", "--format=%x1e%ct%x09%s", "--",
		growthModsDir, growthHerdrDir, growthSkillsX, growthSkillsClo, growthGoDir).Output()
	if err != nil {
		return nil, nil, &Fail{Msg: "git log failed: " + err.Error(), Next: "git status"}
	}
	var families []string
	for _, family := range familyList {
		families = append(families, family.Name)
	}
	since, week = map[string]int{}, map[string]int{}
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
			if _, known := baseline.Parts[part]; known {
				week[part]++
				if at >= baseline.seededAt(part).Unix() {
					since[part]++
				}
			}
		}
	}
	return since, week, nil
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

// a part's fixes: counted from its seed or last keep (since is that date), and all of the last 7 days
type growthFixCount struct {
	since       string
	count, week int
}

func growthAsk(c growthCrossing, then, now int, origin growthOrigin, fixes growthFixCount, turns int) string {
	if c.Calmed {
		under := fmt.Sprintf("%d fixes since %s, %d in 7 days", c.Count, c.Since, c.Week)
		if c.Trigger == "size" {
			under = thousands(c.Now) + " lines"
		}
		return fmt.Sprintf("%s crossed on %s, was over the limit, now %s: the part calmed down. first commit «%s» on %s. keep it, shrink or delete?",
			c.Part, c.Trigger, under, origin.subject, origin.date)
	}
	return fmt.Sprintf("%s crossed on %s: %s → %s lines. first commit «%s» on %s. fixes since %s: %d, in 7 days: %d, his turns in a day (rough): %d. keep, shrink or delete?",
		c.Part, c.Trigger, thousands(then), thousands(now), origin.subject, origin.date, fixes.since, fixes.count, fixes.week, turns)
}

func thousands(n int) string {
	digits := strconv.Itoa(n)
	for i := len(digits) - 3; i > 0; i -= 3 {
		digits = digits[:i] + "," + digits[i:]
	}
	return digits
}
