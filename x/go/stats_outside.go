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

const topHeads = 25

// a tool whose second word is its verb is counted by both words
var twoWord = map[string]bool{"git": true, "claude": true, "gh": true, "pnpm": true}

// flags that take the next word as their value, so the verb sits after it
var valueFlags = map[string]bool{"-C": true, "-c": true, "--dir": true, "--filter": true, "-F": true, "-R": true, "--repo": true}

var assignment = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*=`)

// statsOutside ranks the Bash command heads cc ran by hand in the window, x's own calls left out
func statsOutside(r *Run, days int) (any, error) {
	started := time.Now()
	cut := time.Now().AddDate(0, 0, 1-days).Format(time.DateOnly)
	cutTime, _ := time.ParseInLocation(time.DateOnly, cut, time.Local)
	home, _ := os.UserHomeDir()
	seen := map[string]bool{}
	counts := map[string]int{}
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
							counts[head]++
						}
					}
				}
			}
			if err != nil {
				return nil
			}
		}
	})
	names := slices.Collect(maps.Keys(counts))
	slices.SortFunc(names, byCalls(func(s string) int { return counts[s] }, func(s string) string { return s }))
	for _, name := range names[:min(topHeads, len(names))] {
		data.Heads = append(data.Heads, headCount{Name: name, Calls: counts[name]})
	}
	data.Days, data.First, data.Last = read.span(), read.first, read.last
	data.Elapsed = time.Since(started).Milliseconds()
	if r.human {
		r.Board(outsideBoard(data))
	}
	return data, nil
}

// commandHead names what a Bash command runs, past any `cd <dir> &&` and variable setup;
// an `x` call, or the `lane` shim that runs one, reads "x", since x traces itself; setup alone reads ""
func commandHead(command string) string {
	words := shellWords(command)
	i := pastSetup(words)
	if i >= len(words) {
		return ""
	}
	tool := filepath.Base(words[i])
	if tool == "x" || tool == "lane" {
		return "x"
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

// the index of the first word past the leading `cd <dir> &&`, `NAME=value;` and `export NAME=value;`
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
		case words[i] == "cd":
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
			depth := 0
			for ; i < len(runes); i++ {
				word.WriteRune(runes[i])
				if runes[i] == '(' {
					depth++
				} else if runes[i] == ')' {
					if depth--; depth == 0 {
						break
					}
				}
			}
			inWord = true
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
	widths := []int{8, b.inner() - 8}
	for _, h := range data.Heads {
		b.rows = append(b.rows, columns(widths, ui.bold.Render(strconv.Itoa(h.Calls)), ui.fg.Render(h.Name))...)
	}
	if len(data.Heads) == 0 {
		b.rows = append(b.rows, ui.dim.Render("no Bash calls in the window"))
	}
	return b.String()
}
