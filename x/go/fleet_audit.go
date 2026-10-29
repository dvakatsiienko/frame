package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type compactRead struct {
	At     string `json:"at"`
	Reread bool   `json:"reread"`
}

type docLookups struct {
	Ctx7 int `json:"ctx7"`
	MCP  int `json:"mcp"`
	Web  int `json:"web"`
}

type codieSession struct {
	ID        string        `json:"id"`
	Cwd       string        `json:"cwd"`
	InOrder   bool          `json:"in_order"`
	FirstRead string        `json:"first_read"`
	FirstEdit string        `json:"first_edit"`
	Docs      docLookups    `json:"docs"`
	Compacts  []compactRead `json:"compacts"`
}

type auditData struct {
	Days     int            `json:"days"`
	Codies   int            `json:"codies"`
	Sessions []codieSession `json:"sessions"`
}

type auditLine struct {
	Subtype   string `json:"subtype"`
	Timestamp string `json:"timestamp"`
	Cwd       string `json:"cwd"`
	Message   struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

const lessonsFile = "crew-codie/how-you-work.md"

var (
	auditEditTools = map[string]bool{"Edit": true, "Write": true, "NotebookEdit": true, "MultiEdit": true}
	auditEditBins  = regexp.MustCompile(`\b(edit-anchored|edit-batch)\b`)
	ctx7Word       = regexp.MustCompile(`\bctx7\b`)
)

// fleetAudit asks of every codie session (opened with /x:crew-codie) whether it read its lessons file
// before its first edit and again after each compaction, and counts its library-docs lookups; the
// transcript is the proof, codie's own «i read it» is not
func fleetAudit(r *Run, _ []string, flags Flags) (any, error) {
	days, err := daysFlag(flags, "fleet audit", 1)
	if err != nil {
		return nil, err
	}
	data := auditData{Days: days, Sessions: []codieSession{}}
	for _, path := range sessionFiles(time.Now().Add(-time.Duration(days)*24*time.Hour), 0) {
		if session, ok := auditSession(path); ok {
			data.Sessions = append(data.Sessions, session)
		}
	}
	data.Codies = len(data.Sessions)
	if r.human {
		var lines []string
		for _, s := range data.Sessions {
			lines = append(lines, auditRow(s))
		}
		lines = append(lines, fmt.Sprintf("x fleet audit — %d codie session(s) in %d day(s)", data.Codies, days))
		r.Board(textBoard("fleet audit", fmt.Sprintf("%d codie sessions, last %d days", data.Codies, days), lines))
	}
	return data, nil
}

// one codie session's reads, edits and lookups; a session that does not open with the command is no codie
func auditSession(path string) (codieSession, bool) {
	lines := transcriptLines(path)
	// codie's opening prompt is the command; a later mention (clio talking about it) is not codie
	opening := []byte{}
	for _, raw := range lines[:min(40, len(lines))] {
		if bytes.Contains(raw, []byte(`"type":"user"`)) {
			opening = raw
			break
		}
	}
	isCodie := false
	for id, now := range skillNow {
		isCodie = isCodie || now == "x:crew-codie" && bytes.Contains(opening, []byte("<command-name>/"+id+"</command-name>"))
	}
	if !isCodie {
		return codieSession{}, false
	}
	s := codieSession{ID: filepath.Base(path)[:min(8, len(filepath.Base(path)))], Compacts: []compactRead{}}
	for _, raw := range lines {
		var line auditLine
		if len(raw) == 0 || json.Unmarshal(raw, &line) != nil {
			continue
		}
		at := "?"
		if len(line.Timestamp) >= 19 {
			at = line.Timestamp[11:19]
		}
		if s.Cwd == "" {
			s.Cwd = line.Cwd
		}
		if line.Subtype == "compact_boundary" {
			s.Compacts = append(s.Compacts, compactRead{At: at})
		}
		var blocks []flowBlock
		if json.Unmarshal(line.Message.Content, &blocks) != nil {
			continue
		}
		for _, b := range blocks {
			if b.Type != "tool_use" {
				continue
			}
			target := b.Input.FilePath + " " + b.Input.Command
			if strings.Contains(target, lessonsFile) {
				if s.FirstRead == "" {
					s.FirstRead = at
				}
				if n := len(s.Compacts); n > 0 {
					s.Compacts[n-1].Reread = true
				}
			}
			if s.FirstEdit == "" && (auditEditTools[b.Name] || b.Name == "Bash" && auditEditBins.MatchString(target)) {
				s.FirstEdit = at
			}
			switch {
			case b.Name == "Bash" && ctx7Word.MatchString(target):
				s.Docs.Ctx7++
			case strings.HasPrefix(b.Name, "mcp__plugin_context7"):
				s.Docs.MCP++
			case b.Name == "WebSearch" || b.Name == "WebFetch":
				s.Docs.Web++
			}
		}
	}
	s.InOrder = s.FirstRead != "" && (s.FirstEdit == "" || s.FirstRead <= s.FirstEdit)
	return s, true
}

func auditRow(s codieSession) string {
	mark := func(ok bool) string {
		if ok {
			return "✅"
		}
		return "🚫"
	}
	home, _ := os.UserHomeDir()
	row := fmt.Sprintf("%s %s %s · read %s · first edit %s · docs ctx7 %d mcp %d web %d", mark(s.InOrder), s.ID,
		strings.Replace(s.Cwd, home, "~", 1), cmp.Or(s.FirstRead, "never"), cmp.Or(s.FirstEdit, "none"), s.Docs.Ctx7, s.Docs.MCP, s.Docs.Web)
	var compacts []string
	for _, c := range s.Compacts {
		compacts = append(compacts, mark(c.Reread)+" compact "+c.At)
	}
	if len(compacts) > 0 {
		row += " · " + strings.Join(compacts, ", ")
	}
	return row
}
