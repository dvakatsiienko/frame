package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

type headCount struct {
	Name  string `json:"name"`
	Calls int    `json:"calls"`
	// the x door that does this job, when one does: the head went around it
	Cover string `json:"cover,omitempty"`
}

type outsideData struct {
	// the days from the first Bash call found to the last, both included
	Days        int         `json:"days"`
	First       string      `json:"first"`
	Last        string      `json:"last"`
	Transcripts int         `json:"transcripts"`
	Calls       int         `json:"calls"`
	XCalls      int         `json:"x_calls"`
	Heads       []headCount `json:"heads"`
	Elapsed     int64       `json:"elapsed_ms"`
}

type ccLine struct {
	Timestamp time.Time `json:"timestamp"`
	Message   struct {
		Content []struct {
			Type  string `json:"type"`
			ID    string `json:"id"`
			Name  string `json:"name"`
			Input struct {
				Command string `json:"command"`
			} `json:"input"`
		} `json:"content"`
	} `json:"message"`
}

// a tool whose second word is its verb is counted by both words
var twoWord = map[string]bool{"git": true, "claude": true, "gh": true, "pnpm": true, "brew": true, "go": true,
	"linear": true, "npm": true, "npx": true, "op": true}

// an interpreter's head names the script it runs, so two scripts count apart
var interpreters = map[string]bool{"bash": true, "node": true, "python": true, "python3": true, "sh": true, "zsh": true}

var scriptFile = regexp.MustCompile(`^[\w./~-]+\.(js|mjs|py|sh|ts)$`)

// flags that take the next word as their value, so the verb sits after it
var valueFlags = map[string]bool{"-C": true, "-c": true, "--dir": true, "--filter": true, "-F": true, "-R": true, "--repo": true}

var assignment = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*=`)

// statsOutside ranks the Bash command heads cc ran by hand in the window, x's own calls left out
func statsOutside(r *Run, days, top int) (any, error) {
	started := time.Now()
	cut := time.Now().AddDate(0, 0, 1-days).Format(time.DateOnly)
	cutTime, _ := time.ParseInLocation(time.DateOnly, cut, time.Local)
	home, _ := os.UserHomeDir()
	seen := map[string]bool{}
	counts := map[headCount]int{}
	var read window
	data := outsideData{Heads: []headCount{}}
	filepath.WalkDir(filepath.Join(home, ".claude", "projects"), func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || filepath.Ext(path) != ".jsonl" {
			return nil
		}
		if info, err := entry.Info(); err != nil || info.ModTime().Before(cutTime) {
			return nil
		}
		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()
		data.Transcripts++
		reader := bufio.NewReader(f)
		for {
			line, err := reader.ReadBytes('\n')
			if bytes.Contains(line, []byte(`"name":"Bash"`)) {
				var parsed ccLine
				if json.Unmarshal(line, &parsed) == nil {
					day := parsed.Timestamp.Local().Format(time.DateOnly)
					for _, block := range parsed.Message.Content {
						if block.Type != "tool_use" || block.Name != "Bash" || day < cut || seen[block.ID] {
							continue
						}
						seen[block.ID] = true
						data.Calls++
						if read.first == "" || day < read.first {
							read.first = day
						}
						read.last = max(read.last, day)
						switch head := commandHead(block.Input.Command); head {
						case "":
						case "x":
							data.XCalls++
						default:
							counts[headCount{Name: head, Cover: cover(block.Input.Command, head)}]++
						}
					}
				}
			}
			if err != nil {
				return nil
			}
		}
	})
	heads := slices.Collect(maps.Keys(counts))
	slices.SortFunc(heads, byCalls(func(h headCount) int { return counts[h] }, func(h headCount) string { return h.Name + " " + h.Cover }))
	for _, head := range heads[:min(top, len(heads))] {
		head.Calls = counts[head]
		data.Heads = append(data.Heads, head)
	}
	data.Days, data.First, data.Last = read.span(), read.first, read.last
	data.Elapsed = time.Since(started).Milliseconds()
	if r.human {
		r.Board(outsideBoard(data))
	}
	return data, nil
}

// commandHead names what a Bash command runs, past any `cd <dir> &&` and variable setup;
// an `x` call reads "x", since x traces itself; setup alone reads ""
func commandHead(command string) string {
	words := shellWords(command)
	i := pastSetup(words)
	if i >= len(words) {
		return ""
	}
	tool := filepath.Base(words[i])
	if tool == "x" {
		return "x"
	}
	if interpreters[tool] {
		if j := pastFlags(words, i+1); j < len(words) && scriptFile.MatchString(words[j]) {
			return tool + " " + filepath.Base(words[j])
		}
		return tool
	}
	if !twoWord[tool] {
		return tool
	}
	// claude's flags take values freely (`-p --model haiku 'prompt'`), so only a word right after it is its verb
	if tool == "claude" {
		if i+1 < len(words) && !isSeparator(words[i+1]) && !strings.HasPrefix(words[i+1], "-") {
			return tool + " " + words[i+1]
		}
		return tool
	}
	for j := i + 1; j < len(words) && !isSeparator(words[j]); j++ {
		switch {
		case valueFlags[words[j]]:
			j++
		case strings.HasPrefix(words[j], "-"):
		default:
			return tool + " " + words[j]
		}
	}
	return tool
}

// cover names the x door that does a head's job: a family's raw door (`x linear api` for `linear api`),
// or the verb that replaces the script the command runs or the pnpm script it names
func cover(command, head string) string {
	for _, family := range familyList {
		if family.RawDoor != "" && head == strings.TrimPrefix(family.RawDoor, "x ") {
			return family.RawDoor
		}
	}
	for _, verb := range verbs {
		for _, door := range verb.Replaces {
			if strings.Contains(door, "/") && strings.Contains(command, door) || head == "pnpm "+door {
				return "x " + verb.Name
			}
		}
	}
	return ""
}

// the index of the first word past the leading `cd <dir> &&`, `NAME=value;`, `export NAME=value;`,
// a `source`, `pushd` or `set` line, and the wrappers `timeout <n>`, `env …`, `command`, `exec` and
// `time` that only run the command after them
func pastSetup(words []string) int {
	i := 0
	for i < len(words) && isSeparator(words[i]) {
		i++
	}
	for i < len(words) {
		switch {
		case assignment.MatchString(words[i]):
			i++
		case words[i] == "export" && i+1 < len(words) && assignment.MatchString(words[i+1]):
			i += 2
		case words[i] == "timeout":
			i = pastFlags(words, i+1, "-s", "--signal", "-k", "--kill-after") + 1
		case words[i] == "env":
			i = pastFlags(words, i+1, "-u", "--unset", "-C", "--chdir")
		case words[i] == "command" || words[i] == "exec" || words[i] == "time":
			i = pastFlags(words, i+1)
		case words[i] == "cd" || words[i] == "source" || words[i] == "pushd" || words[i] == "set":
			next := slices.IndexFunc(words[i:], isSeparator)
			if next < 0 {
				return i
			}
			i += next
		default:
			return i
		}
		for i < len(words) && isSeparator(words[i]) {
			i++
		}
	}
	return i
}

// the index of the first word from i on that is no flag; the named flags take the next word as their value
func pastFlags(words []string, i int, valued ...string) int {
	for i < len(words) && strings.HasPrefix(words[i], "-") {
		if slices.Contains(valued, words[i]) {
			i++
		}
		i++
	}
	return i
}

func isSeparator(word string) bool {
	return word == ";" || word == "&&" || word == "||" || word == "|"
}

// shellWords splits a command line the way sh reads its words, quotes dropped; `;`, `&&`, `||`, `|`
// and a newline come out as their own words
func shellWords(command string) []string {
	var words []string
	var word strings.Builder
	inWord := false
	end := func() {
		if inWord {
			words = append(words, word.String())
			word.Reset()
			inWord = false
		}
	}
	var quote rune
	runes := []rune(command)
	for i := 0; i < len(runes); i++ {
		c := runes[i]
		switch {
		case quote != 0:
			if c == quote {
				quote = 0
			} else {
				word.WriteRune(c)
			}
		case c == '\'' || c == '"' || c == '`':
			quote, inWord = c, true
		case c == '$' && i+1 < len(runes) && runes[i+1] == '(':
			// a command substitution belongs to its word, however its parens and quotes nest
			depth, inner := 0, rune(0)
			for ; i < len(runes); i++ {
				r := runes[i]
				word.WriteRune(r)
				switch {
				case inner != 0:
					if r == inner {
						inner = 0
					}
				case r == '\'' || r == '"':
					inner = r
				case r == '(':
					depth++
				case r == ')':
					depth--
				}
				if depth == 0 && r == ')' {
					break
				}
			}
			inWord = true
		case c == '#' && !inWord:
			// a comment runs to the end of its line, which still ends the command
			for i+1 < len(runes) && runes[i+1] != '\n' {
				i++
			}
		case c == '\\' && i+1 < len(runes):
			i++
			word.WriteRune(runes[i])
			inWord = true
		case c == ' ' || c == '\t':
			end()
		case c == ';' || c == '\n' || c == '(' || c == ')':
			end()
			words = append(words, ";")
		case c == '&' || c == '|':
			end()
			if i+1 < len(runes) && runes[i+1] == c {
				i++
				words = append(words, string(c)+string(c))
			} else if c == '|' {
				words = append(words, "|")
			} else {
				words = append(words, ";")
			}
		default:
			word.WriteRune(c)
			inWord = true
		}
	}
	end()
	return words
}

func outsideBoard(data outsideData) string {
	b := frame{width: frameWidth(), titleLeft: titleOf("stats --outside"),
		titleRight: ui.dim.Render(spanTitle("Bash calls", data.Calls, data.Days, data.First, data.Last)),
		footLeft:   ui.dim.Render(fmt.Sprintf("%d transcripts read in %.1fs", data.Transcripts, float64(data.Elapsed)/1000)),
		footRight:  ui.dim.Render(fmt.Sprintf("%d x calls left out", data.XCalls)), padRows: true}
	widths := []int{8, b.inner() - 8 - 22, 22}
	for _, h := range data.Heads {
		door := ""
		if h.Cover != "" {
			door = ui.dim.Render("→ " + h.Cover)
		}
		b.rows = append(b.rows, columns(widths, ui.bold.Render(strconv.Itoa(h.Calls)), ui.fg.Render(h.Name), door)...)
	}
	if len(data.Heads) == 0 {
		b.rows = append(b.rows, ui.dim.Render("no Bash calls in the window"))
	}
	return b.String()
}
