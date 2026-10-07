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
	Days     int            `json:"days"`
	Calls    int            `json:"calls"`
	Callers  map[string]int `json:"callers"`
	Failures map[string]int `json:"failures"`
	Families []familyCount  `json:"families"`
	Verbs    []*verbCount   `json:"verbs"`
	Unused   []string       `json:"unused"`
	Trashed  []string       `json:"trashed"`
}

const keepDays = 90

// day files older than keepDays go to the macos trash, never rm; a missing `trash` keeps them, silently
func trashOld() []string {
	last := time.Now().AddDate(0, 0, -keepDays).Format(time.DateOnly)
	files, _ := filepath.Glob(filepath.Join(stateDir(), "traces", "*.jsonl"))
	var old, names []string
	for _, file := range files {
		if strings.TrimSuffix(filepath.Base(file), ".jsonl") < last {
			old = append(old, file)
			names = append(names, filepath.Base(file))
		}
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
	days := 30
	if value, _ := flags["days"].(string); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 1 {
			return nil, usageFail("--days is a whole number of days, not "+value, "x stats --days 30")
		}
		days = n
	}
	trashed := trashOld()
	lines := readTraces(days)
	data := statsData{Days: days, Calls: len(lines), Callers: map[string]int{}, Failures: map[string]int{},
		Families: []familyCount{}, Verbs: []*verbCount{}, Unused: []string{}, Trashed: trashed}
	byFamily := map[string]int{}
	byVerb := map[string]*verbCount{}
	for _, line := range lines {
		data.Callers[cmp.Or(line.Caller, "unknown")]++
		byFamily[strings.Fields(line.Name + " x")[0]]++
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
		data.Families = append(data.Families, familyCount{Name: name, Calls: calls, Raw: []string{}})
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
		r.Board(statsBoard(data))
	}
	return data, nil
}

// the plain summary dima reads until the x-stats-board spec lands: top families, slowest p95,
// failure kinds, callers, unused verbs
func statsBoard(data statsData) string {
	b := frame{width: frameWidth(), titleLeft: titleOf("stats"),
		titleRight: ui.dim.Render(fmt.Sprintf("%d calls, last %d days", data.Calls, data.Days)),
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
	return b.String()
}

// the trace lines of the last `days` local days, today included; a line that does not parse is skipped
func readTraces(days int) []span {
	first := time.Now().AddDate(0, 0, 1-days).Format(time.DateOnly)
	files, _ := filepath.Glob(filepath.Join(stateDir(), "traces", "*.jsonl"))
	var lines []span
	for _, file := range files {
		if strings.TrimSuffix(filepath.Base(file), ".jsonl") < first {
			continue
		}
		f, err := os.Open(file)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			var line span
			if json.Unmarshal(scanner.Bytes(), &line) == nil && line.Name != "" {
				lines = append(lines, line)
			}
		}
		f.Close()
	}
	return lines
}
