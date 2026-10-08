package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
)

// the `fleet` family: the fleet measuring itself from transcripts, the flawlog and the guard's store

func projectsDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "projects")
}

// the session transcripts one level under ~/.claude/projects (subagents left out, as the scripts did)
// whose mtime is not before `since` and whose size reaches `minBytes`
func sessionFiles(since time.Time, minBytes int64) []string {
	var found []string
	projects, _ := os.ReadDir(projectsDir())
	for _, project := range projects {
		if !project.IsDir() {
			continue
		}
		dir := filepath.Join(projectsDir(), project.Name())
		entries, _ := os.ReadDir(dir)
		for _, entry := range entries {
			if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".jsonl") {
				continue
			}
			info, err := entry.Info()
			if err != nil || info.ModTime().Before(since) || info.Size() < minBytes {
				continue
			}
			found = append(found, filepath.Join(dir, entry.Name()))
		}
	}
	return found
}

// a transcript's lines; a live session's last line can be half-written, and the reader takes any length
func transcriptLines(path string) [][]byte {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var lines [][]byte
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(nil, len(data)+1)
	for scanner.Scan() {
		lines = append(lines, slices.Clone(scanner.Bytes()))
	}
	return lines
}

// --days as a whole number of days, ≥ 1
func daysFlag(flags Flags, verb string, fallback int) (int, error) {
	value, _ := flags["days"].(string)
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 {
		return 0, usageFail("--days is a whole number of days ≥ 1, not "+value, fmt.Sprintf("x %s --days %d", verb, fallback))
	}
	return n, nil
}

// the middle value, or the mean of the two middle ones; 0 for none
func median(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := slices.Sorted(slices.Values(values))
	mid := len(sorted) / 2
	if len(sorted)%2 == 1 {
		return sorted[mid]
	}
	return (sorted[mid-1] + sorted[mid]) / 2
}

// javascript's toFixed(1) and Math.round: a half rounds up, where go's formatting rounds it to even
func fixed1(x float64) string   { return strconv.FormatFloat(math.Floor(x*10+0.5)/10, 'f', 1, 64) }
func roundHalfUp(x float64) int { return int(math.Floor(x + 0.5)) }

// a report printed as its lines inside a board; a long line wraps under itself
func textBoard(verb, right string, lines []string) string {
	b := frame{width: frameWidth(), titleLeft: titleOf(verb), titleRight: ui.dim.Render(right),
		footLeft: ui.dim.Render("x " + verb + " --json"), padRows: true}
	for _, line := range lines {
		b.rows = append(b.rows, columns([]int{b.inner()}, line)...)
	}
	return b.String()
}

// the keys of a json object in the order they were written; javascript keeps that order, and a
// stable sort over it breaks ties the same way
func orderedKeys(raw json.RawMessage) ([]string, map[string]json.RawMessage, error) {
	var values map[string]json.RawMessage
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, nil, err
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	if _, err := dec.Token(); err != nil {
		return nil, nil, err
	}
	var keys []string
	for dec.More() {
		token, err := dec.Token()
		if err != nil {
			return nil, nil, err
		}
		keys = append(keys, token.(string))
		var skip json.RawMessage
		if err := dec.Decode(&skip); err != nil {
			return nil, nil, err
		}
	}
	return keys, values, nil
}
