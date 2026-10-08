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

type coderSession struct {
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
	Coders   int            `json:"coders"`
	Sessions []coderSession `json:"sessions"`
}

type auditLine struct {
	Subtype   string `json:"subtype"`
	Timestamp string `json:"timestamp"`
	Cwd       string `json:"cwd"`
	Message   struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

const lessonsFile = "crew-coder/how-you-work.md"

var (
	auditEditTools = map[string]bool{"Edit": true, "Write": true, "NotebookEdit": true, "MultiEdit": true}
	auditEditBins  = regexp.MustCompile(`\b(edit-anchored|edit-batch)\b`)
	ctx7Word       = regexp.MustCompile(`\bctx7\b`)
)

// fleetAudit asks of every coder session (opened with /x:crew-coder) whether it read its lessons file
// before its first edit and again after each compaction, and counts its library-docs lookups; the
// transcript is the proof, a coder's own «i read it» is not
func fleetAudit(r *Run, _ []string, flags Flags) (any, error) {
	days, err := daysFlag(flags, "fleet audit", 1)
	if err != nil {
		return nil, err
	}
	data := auditData{Days: days, Sessions: []coderSession{}}
	for _, path := range sessionFiles(time.Now().Add(-time.Duration(days)*24*time.Hour), 0) {
		if session, ok := auditSession(path); ok {
			data.Sessions = append(data.Sessions, session)
		}
	}
	data.Coders = len(data.Sessions)
	if r.human {
		var lines []string
		for _, s := range data.Sessions {
			lines = append(lines, auditRow(s))
		}
		lines = append(lines, fmt.Sprintf("x fleet audit — %d coder session(s) in %d day(s)", data.Coders, days))
		r.Board(textBoard("fleet audit", fmt.Sprintf("%d coder sessions, last %d days", data.Coders, days), lines))
	}
	return data, nil
}

// one coder session's reads, edits and lookups; a session that does not open with the command is no coder
func auditSession(path string) (coderSession, bool) {
	lines := transcriptLines(path)
	// a coder's opening prompt is the command; a later mention (cclio talking about it) is not a coder
	opening := []byte{}
	for _, raw := range lines[:min(40, len(lines))] {
		if bytes.Contains(raw, []byte(`"type":"user"`)) {
			opening = raw
			break
		}
	}
	if !bytes.Contains(opening, []byte("<command-name>/x:crew-coder</command-name>")) {
		return coderSession{}, false
	}
	s := coderSession{ID: filepath.Base(path)[:min(8, len(filepath.Base(path)))], Compacts: []compactRead{}}
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

func auditRow(s coderSession) string {
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
