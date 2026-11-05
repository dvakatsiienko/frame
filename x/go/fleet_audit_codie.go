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

const (
	checkRead    = "read"
	checkMissed  = "missed"
	checkOlder   = "n/a"
	checkNoEdit  = "no edit"
	lessonsName  = "how-you-work.md"
	ticketChecks = "ticket read"
)

// a read matches under any skill dir, so a rename of the skill cannot break it; a session opened before a file's
// birth reads n/a for it, never a miss
var auditFiles = []struct{ name, match, born string }{
	{lessonsName, "/how-you-work.md", "2026-09-30"},
	{"crew-dna", "/crew-dna/SKILL.md", "2026-10-09"},
}

var (
	auditEditTools = map[string]bool{"Edit": true, "Write": true, "NotebookEdit": true, "MultiEdit": true}
	auditEditBins  = regexp.MustCompile(`\b(edit-anchored|edit-batch)\b`)
	briefTicket    = regexp.MustCompile(`\b(FRM|BYT)-\d+\b`)
	ticketReadCmd  = regexp.MustCompile(`\blinear[ :-](read|issue)\b`)
)

type compactRead struct {
	At     string `json:"at"`
	Reread bool   `json:"reread"`
	Edited bool   `json:"edited"`
}

type auditCheck struct {
	File  string `json:"file"`
	State string `json:"state"`
	Read  string `json:"read"`
}

type codieSession struct {
	ID        string        `json:"id"`
	Cwd       string        `json:"cwd"`
	Opened    string        `json:"opened"`
	FirstEdit string        `json:"first_edit"`
	Checks    []auditCheck  `json:"checks"`
	Compacts  []compactRead `json:"compacts"`
	Retro     bool          `json:"retro"`
}

type auditMiss struct {
	Session string `json:"session"`
	Cwd     string `json:"cwd"`
	File    string `json:"file"`
	Why     string `json:"why"`
}

type auditData struct {
	Days     int            `json:"days,omitempty"`
	Since    string         `json:"since,omitempty"`
	Codies   int            `json:"codies"`
	Retros   int            `json:"retros"`
	Sessions []codieSession `json:"sessions"`
	Misses   []auditMiss    `json:"misses"`
	Summary  string         `json:"summary"`
}

type auditLine struct {
	UUID      string `json:"uuid"`
	Subtype   string `json:"subtype"`
	Timestamp string `json:"timestamp"`
	Cwd       string `json:"cwd"`
	Message   struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

// fleetAuditCodie asks of every codie session (opened with /x:crew-codie) whether it read its contract before its
// first edit and how-you-work.md again after each compaction; the transcript is the proof, codie's own «i read it» is not
func fleetAuditCodie(r *Run, _ []string, flags Flags) (any, error) {
	days, since, err := auditWindow(flags)
	if err != nil {
		return nil, err
	}
	data := auditData{Sessions: []codieSession{}, Misses: []auditMiss{}}
	cut := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	if since.IsZero() {
		data.Days = days
	} else {
		cut, data.Since = since, since.Format(sinceLayout)
	}
	// mtime is the fast prefilter, so a run never opens every transcript; a touched old session stays out below
	for _, path := range sessionFiles(cut, 0) {
		session, ok := auditSession(path)
		if !ok || !session.inWindow(cut, !since.IsZero()) {
			continue
		}
		data.Sessions = append(data.Sessions, session)
		data.Misses = append(data.Misses, session.misses()...)
		if session.Retro {
			data.Retros++
		}
	}
	data.Codies = len(data.Sessions)
	counts := auditCounts(data.Sessions)
	data.Summary = counts[len(counts)-1]
	var fail error
	if len(data.Misses) > 0 {
		fail = &Fail{Msg: fmt.Sprintf("%d missed; %s", len(data.Misses), data.Summary), Next: "read data.misses: each names the file and the session", Data: data}
	}
	if !r.human {
		return data, fail
	}
	home, _ := os.UserHomeDir()
	var lines []string
	for _, m := range data.Misses {
		lines = append(lines, fmt.Sprintf("🚫 %s %s %s: %s", m.Session, strings.Replace(m.Cwd, home, "~", 1), m.File, m.Why))
	}
	lines = append(lines, fmt.Sprintf("retros written in %s", plural(data.Retros, "session")))
	lines = append(lines, counts...)
	window := cmp.Or(data.Since, fmt.Sprintf("last %d days", days))
	r.Board(textBoard("fleet audit-codie", fmt.Sprintf("%s, %s", plural(data.Codies, "codie session"), window), lines))
	if fail != nil {
		fmt.Println(r.output)
		r.passthrough, r.code = true, 1
		traced.Kind = (&Fail{}).kind()
	}
	return data, nil
}

// siesta-last's stamp: local time, no zone
const sinceLayout = "2006-01-02T15:04:05"

func auditWindow(flags Flags) (int, time.Time, error) {
	stamp, _ := flags["since"].(string)
	if stamp == "" {
		days, err := daysFlag(flags, "fleet audit-codie", 1)
		return days, time.Time{}, err
	}
	if days, _ := flags["days"].(string); days != "" {
		return 0, time.Time{}, usageFail("--days and --since pick the window two ways, pass one", "x fleet audit-codie --since "+stamp)
	}
	since, err := time.ParseInLocation(sinceLayout, stamp, time.Local)
	if err != nil {
		return 0, time.Time{}, usageFail("--since is local time like 2026-11-05T21:04:00, not "+stamp, "x fleet audit-codie --since 2026-11-05T21:04:00")
	}
	return 0, since, nil
}

// --days keeps a session by when it opened; --since by its first edit, so one opened before a siesta and edited after it counts
func (s codieSession) inWindow(cut time.Time, byEdit bool) bool {
	stamp := s.Opened
	if byEdit {
		stamp = s.FirstEdit
	}
	at, err := time.Parse(time.RFC3339, stamp)
	return err == nil && !at.Before(cut)
}

func (s codieSession) misses() []auditMiss {
	var misses []auditMiss
	for _, c := range s.Checks {
		if c.State == checkMissed {
			misses = append(misses, auditMiss{s.ID, s.Cwd, c.File, fmt.Sprintf("first edit %s, read %s", clockOf(s.FirstEdit), cmp.Or(clockOf(c.Read), "never"))})
		}
	}
	for _, c := range s.Compacts {
		if c.Edited && !c.Reread {
			misses = append(misses, auditMiss{s.ID, s.Cwd, lessonsName, "edited after the compaction at " + clockOf(c.At) + " with no re-read"})
		}
	}
	return misses
}

// one line per check, how-you-work.md last: the board's last line and the summary
func auditCounts(sessions []codieSession) []string {
	names := []string{ticketChecks, auditFiles[1].name, lessonsName}
	lines := make([]string, 0, len(names))
	for _, name := range names {
		read, asked, older := 0, 0, 0
		for _, s := range sessions {
			for _, c := range s.Checks {
				if c.File != name {
					continue
				}
				switch c.State {
				case checkRead:
					read++
					asked++
				case checkMissed:
					asked++
				case checkOlder:
					older++
				}
			}
		}
		line := fmt.Sprintf("%s %d of %d read before first edit", name, read, asked)
		if older > 0 {
			line += fmt.Sprintf(", %d n/a", older)
		}
		lines = append(lines, line)
	}
	return lines
}

// one codie session's reads and edits; a session that does not open with the command is no codie
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
	reads := map[string]string{}
	seen := map[string]bool{}
	for _, raw := range lines {
		var line auditLine
		if len(raw) == 0 || json.Unmarshal(raw, &line) != nil {
			continue
		}
		// cc re-appends rows
		if line.UUID != "" && seen[line.UUID] {
			continue
		}
		seen[line.UUID] = true
		s.Opened = cmp.Or(s.Opened, line.Timestamp)
		s.Cwd = cmp.Or(s.Cwd, line.Cwd)
		if line.Subtype == "compact_boundary" {
			s.Compacts = append(s.Compacts, compactRead{At: line.Timestamp})
		}
		var blocks []flowBlock
		if json.Unmarshal(line.Message.Content, &blocks) != nil {
			continue
		}
		for _, b := range blocks {
			if b.Type == "tool_use" {
				s.readBlock(b, line.Timestamp, reads)
			}
		}
	}
	for _, file := range auditFiles {
		state := s.stateOf(reads[file.name])
		if s.Opened != "" && s.Opened < file.born {
			state = checkOlder
		}
		s.Checks = append(s.Checks, auditCheck{file.name, state, reads[file.name]})
	}
	// the ticket check runs only when the brief names one
	if briefTicket.Match(opening) {
		s.Checks = append(s.Checks, auditCheck{ticketChecks, s.stateOf(reads[ticketChecks]), reads[ticketChecks]})
	}
	return s, true
}

func (s *codieSession) readBlock(b flowBlock, at string, reads map[string]string) {
	target := b.Input.FilePath + " " + b.Input.Command
	for _, file := range auditFiles {
		if !strings.Contains(target, file.match) {
			continue
		}
		reads[file.name] = cmp.Or(reads[file.name], at)
		if n := len(s.Compacts); file.name == lessonsName && n > 0 && !s.Compacts[n-1].Edited {
			s.Compacts[n-1].Reread = true
		}
	}
	if b.Name == "Bash" && ticketReadCmd.MatchString(b.Input.Command) {
		reads[ticketChecks] = cmp.Or(reads[ticketChecks], at)
	}
	if !auditEditTools[b.Name] && (b.Name != "Bash" || !auditEditBins.MatchString(target)) {
		return
	}
	s.FirstEdit = cmp.Or(s.FirstEdit, at)
	if n := len(s.Compacts); n > 0 {
		s.Compacts[n-1].Edited = true
	}
	s.Retro = s.Retro || strings.HasSuffix(b.Input.FilePath, "-retro.md")
}

// a session with no edit may be live, or edited nothing: no miss either way
func (s codieSession) stateOf(read string) string {
	switch {
	case s.FirstEdit == "":
		return checkNoEdit
	case read != "" && read <= s.FirstEdit:
		return checkRead
	}
	return checkMissed
}

func clockOf(stamp string) string {
	if len(stamp) < 16 {
		return stamp
	}
	return stamp[:10] + " " + stamp[11:16]
}
