package main

import (
	"bufio"
	"cmp"
	"encoding/json"
	"fmt"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

type familyCount struct {
	Name  string `json:"name"`
	Calls int    `json:"calls"`
	// the top raw-door queries of the family; the raw doors fill it as they land
	Raw []string `json:"raw"`
}

type verbCount struct {
	Name     string         `json:"name"`
	Calls    int            `json:"calls"`
	P50      int64          `json:"p50_ms"`
	P95      int64          `json:"p95_ms"`
	Failures map[string]int `json:"failures"`
	took     []int64
}

type statsData struct {
	// the days from the first counted trace to the last, both included; never the window asked for
	Days  int    `json:"days"`
	First string `json:"first"`
	Last  string `json:"last"`
	// the lines a worktree-built x wrote in the window (`x.dev`); counted only under --dev
	Dev      int            `json:"dev"`
	Calls    int            `json:"calls"`
	Callers  map[string]int `json:"callers"`
	Failures map[string]int `json:"failures"`
	Families []familyCount  `json:"families"`
	Verbs    []*verbCount   `json:"verbs"`
	Unused   []string       `json:"unused"`
	Trashed  []string       `json:"trashed"`
}

const keepDays = 90

// the five shapes a family's raw door carried most; a shape seen three times is a verb candidate
func topShapes(counts map[string]int) []string {
	names := slices.Collect(maps.Keys(counts))
	slices.SortFunc(names, byCalls(func(s string) int { return counts[s] }, func(s string) string { return s }))
	top := []string{}
	for _, name := range names[:min(5, len(names))] {
		top = append(top, fmt.Sprintf("%s ×%d", name, counts[name]))
	}
	return top
}

// day files older than keepDays go to the macos trash, never rm; a missing `trash` keeps them, silently
func trashOld() []string {
	old := dayFiles(-keepDays, true)
	var names []string
	for _, file := range old {
		names = append(names, filepath.Base(file))
	}
	if len(old) == 0 || exec.Command("trash", old...).Run() != nil {
		return []string{}
	}
	return names
}

// nearest rank over sorted durations
func percentile(sorted []int64, p int) int64 {
	return sorted[max((len(sorted)*p+99)/100, 1)-1]
}

func byCalls[T any](calls func(T) int, name func(T) string) func(a, b T) int {
	return func(a, b T) int { return cmp.Or(calls(b)-calls(a), strings.Compare(name(a), name(b))) }
}

func stats(r *Run, _ []string, flags Flags) (any, error) {
	days, err := daysFlag(flags, "stats", 30)
	if err != nil {
		return nil, err
	}
	if days > keepDays {
		return nil, usageFail(fmt.Sprintf("the traces keep %d days, not %d", keepDays, days), fmt.Sprintf("x stats --days %d", keepDays))
	}
	topValue, _ := flags["top"].(string)
	if topValue != "" && flags["outside"] != true {
		return nil, usageFail("--top ranks the --outside heads; x's own verbs are all listed", "x stats --outside --top 25")
	}
	if flags["outside"] == true {
		if flags["dev"] == true {
			return nil, usageFail("--dev counts x's own dev builds; --outside reads cc transcripts, which have none", "x stats --outside")
		}
		top := 25
		if topValue != "" {
			if top, err = strconv.Atoi(topValue); err != nil || top < 1 {
				return nil, usageFail("--top is a whole number of heads ≥ 1, not "+topValue, "x stats --outside --top 25")
			}
		}
		return statsOutside(r, days, top)
	}
	trashed := trashOld()
	dev := flags["dev"] == true
	read := readTraces(days, dev)
	lines := read.lines
	data := statsData{Days: read.span(), First: read.first, Last: read.last, Dev: read.dev, Calls: len(lines),
		Callers: map[string]int{}, Failures: map[string]int{},
		Families: []familyCount{}, Verbs: []*verbCount{}, Unused: []string{}, Trashed: trashed}
	byFamily := map[string]int{}
	shapes := map[string]map[string]int{}
	byVerb := map[string]*verbCount{}
	for _, line := range lines {
		data.Callers[cmp.Or(line.Caller, "unknown")]++
		family := strings.Fields(line.Name)[0]
		byFamily[family]++
		if line.Shape != "" {
			if shapes[family] == nil {
				shapes[family] = map[string]int{}
			}
			shapes[family][line.Shape]++
		}
		verb := byVerb[line.Name]
		if verb == nil {
			verb = &verbCount{Name: line.Name, Failures: map[string]int{}}
			byVerb[line.Name] = verb
			data.Verbs = append(data.Verbs, verb)
		}
		verb.Calls++
		verb.took = append(verb.took, line.Duration)
		if line.Kind != "" {
			data.Failures[line.Kind]++
			verb.Failures[line.Kind]++
		}
	}
	for name, calls := range byFamily {
		data.Families = append(data.Families, familyCount{Name: name, Calls: calls, Raw: topShapes(shapes[name])})
	}
	for _, verb := range verbsUnder("") {
		if byVerb[verb.Name] == nil {
			data.Unused = append(data.Unused, verb.Name)
		}
	}
	for _, verb := range data.Verbs {
		slices.Sort(verb.took)
		verb.P50, verb.P95 = percentile(verb.took, 50), percentile(verb.took, 95)
	}
	slices.SortFunc(data.Families, byCalls(func(f familyCount) int { return f.Calls }, func(f familyCount) string { return f.Name }))
	slices.SortFunc(data.Verbs, byCalls(func(v *verbCount) int { return v.Calls }, func(v *verbCount) string { return v.Name }))
	if r.human {
		r.Board(statsBoard(data, dev))
	}
	return data, nil
}

// the plain summary dima reads until the x-stats-board spec lands: top families, slowest p95,
// failure kinds, callers, unused verbs
func spanTitle(noun string, calls, days int, first, last string) string {
	if calls == 0 {
		return "no " + noun + " in the window"
	}
	if days == 1 {
		return fmt.Sprintf("%d %s on %s", calls, noun, first)
	}
	return fmt.Sprintf("%d %s over %d days, %s → %s", calls, noun, days, first, last)
}

func statsBoard(data statsData, dev bool) string {
	b := frame{width: frameWidth(), titleLeft: titleOf("stats"),
		titleRight: ui.dim.Render(spanTitle("calls", data.Calls, data.Days, data.First, data.Last)),
		footLeft:   ui.dim.Render("x stats --json"), footRight: ui.dim.Render(home(filepath.Join(stateDir(), "traces"))), padRows: true}
	widths := []int{16, b.inner() - 16}
	section := func(name string, cells []string) {
		if len(cells) == 0 {
			cells = []string{ui.dim.Render("none")}
		}
		b.rows = append(b.rows, columns(widths, ui.label.Render(name), strings.Join(cells, ui.dim.Render(", ")))...)
	}
	var families, slowest, failures, callers []string
	for _, f := range data.Families[:min(len(data.Families), 6)] {
		families = append(families, ui.fg.Render(f.Name)+" "+ui.bold.Render(strconv.Itoa(f.Calls)))
	}
	byP95 := slices.Clone(data.Verbs)
	slices.SortFunc(byP95, func(a, b *verbCount) int { return cmp.Compare(b.P95, a.P95) })
	for _, v := range byP95[:min(len(byP95), 3)] {
		slowest = append(slowest, ui.fg.Render(v.Name)+" "+ui.bold.Render(fmt.Sprintf("%dms", v.P95)))
	}
	for _, kind := range slices.Sorted(maps.Keys(data.Failures)) {
		failures = append(failures, ui.er.Render(kind)+" "+ui.bold.Render(strconv.Itoa(data.Failures[kind])))
	}
	for _, caller := range slices.Sorted(maps.Keys(data.Callers)) {
		callers = append(callers, ui.fg.Render(caller)+" "+ui.bold.Render(strconv.Itoa(data.Callers[caller])))
	}
	section("families", families)
	section("slowest p95", slowest)
	section("failures", failures)
	section("callers", callers)
	section("unused", []string{ui.dim.Render(strings.Join(data.Unused, ", "))})
	devNote := " left out, x stats --dev counts them"
	if dev {
		devNote = " counted"
	}
	section("dev builds", []string{ui.bold.Render(strconv.Itoa(data.Dev)) + ui.dim.Render(devNote)})
	return b.String()
}

// the day files dated before the day `offset` days from today, or from it on; the name is the date
func dayFiles(offset int, before bool) []string {
	cut := time.Now().AddDate(0, 0, offset).Format(time.DateOnly)
	files, _ := filepath.Glob(filepath.Join(stateDir(), "traces", "*.jsonl"))
	return slices.DeleteFunc(files, func(file string) bool {
		return strings.TrimSuffix(filepath.Base(file), ".jsonl") < cut != before
	})
}

type window struct {
	lines       []span
	first, last string
	dev         int
}

func (t window) span() int {
	first, err1 := time.Parse(time.DateOnly, t.first)
	last, err2 := time.Parse(time.DateOnly, t.last)
	if err1 != nil || err2 != nil {
		return 0
	}
	return int(last.Sub(first).Hours()/24) + 1
}

// the trace lines of the last `days` local days, today included; a line that does not parse is skipped,
// a dev build's line only counts with dev
func readTraces(days int, dev bool) window {
	var read window
	for _, file := range dayFiles(1-days, false) {
		f, err := os.Open(file)
		if err != nil {
			continue
		}
		day := strings.TrimSuffix(filepath.Base(file), ".jsonl")
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			var line span
			if json.Unmarshal(scanner.Bytes(), &line) != nil || strings.TrimSpace(line.Name) == "" {
				continue
			}
			if line.Dev {
				read.dev++
				if !dev {
					continue
				}
			}
			read.lines = append(read.lines, line)
			read.first = cmp.Or(read.first, day)
			read.last = day
		}
		f.Close()
	}
	return read
}
