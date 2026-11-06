package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

const (
	checkRead   = "read"
	checkMissed = "missed"
	checkOlder  = "n/a"
	checkNoEdit = "no edit"
	lessonsName = "how-you-work.md"
	ticketCheck = "ticket read"
)

// a read matches under any install's skills dir, and a file of that name elsewhere credits nothing; a bare name with no
// `cd` before it credits how-you-work.md, the one file no other skill shares. a session opened before a file's birth reads n/a
type auditFile struct {
	name, born string
	paths      []string
	bareName   string
	skill      string
}

var auditFiles = []auditFile{
	{name: "crew-dna", born: "2026-10-09", paths: []string{"crew-dna/SKILL.md"}, skill: "x:crew-dna"},
	{name: lessonsName, born: "2026-09-30", paths: []string{"crew-codie/" + lessonsName, "crew-coder/" + lessonsName}, bareName: lessonsName}, // read-both
}

func (f auditFile) namedBy(path string) bool {
	path = filepath.Clean(path)
	if f.bareName != "" && (path == f.bareName || filepath.Base(path) == f.bareName && strings.Contains(path, "/skills/")) {
		return true
	}
	return slices.ContainsFunc(f.paths, func(own string) bool { return path == own || strings.HasSuffix(path, "/"+own) })
}

var (
	shellReadVerbs = map[string]bool{"cat": true, "head": true, "tail": true, "sed": true, "bat": true, "less": true}
	shellRedirect  = regexp.MustCompile(`^\d*[<>]`)
	shellHeredoc   = regexp.MustCompile(`(?:^|[^<])<<-?\s*['"]?([A-Za-z_]\w*)['"]?`)
	shellEnvWord   = regexp.MustCompile(`^\w+=`)
	shellOpeners   = map[string]bool{"then": true, "do": true, "else": true, "if": true, "elif": true, "while": true, "until": true, "!": true, "{": true, "time": true}
)

// the paths a shell line reads, each through the `cd`s before it; a verb counts only as its statement's first word
func shellReadPaths(command string) []string {
	var paths, outer []string
	dir := ""
	for _, statement := range shellStatements(dropHeredocs(command)) {
		switch statement {
		case "(":
			outer = append(outer, dir)
			continue
		case ")":
			if len(outer) > 0 {
				dir, outer = outer[len(outer)-1], outer[:len(outer)-1]
			}
			continue
		}
		words := shellCommandWords(statementWords(statement))
		if len(words) == 0 {
			continue
		}
		if words[0] == "cd" && len(words) > 1 {
			dir = pathUnderShellDir(dir, words[1])
			continue
		}
		if !shellReadVerbs[words[0]] || throwsAwayItsRead(words) {
			continue
		}
		for _, word := range words[1:] {
			if shellRedirect.MatchString(word) {
				break
			}
			if !strings.HasPrefix(word, "-") {
				paths = append(paths, pathUnderShellDir(dir, word))
			}
		}
	}
	return paths
}

// `sed -i` writes its file, and a read sent to /dev/null reaches nobody; errors sent there leave the read standing
func throwsAwayItsRead(words []string) bool {
	if words[0] == "sed" && slices.ContainsFunc(words, editsInPlace) {
		return true
	}
	for i, word := range words {
		target, isOut := strings.CutPrefix(strings.TrimLeft(word, "1&"), ">")
		if isOut && (target == "/dev/null" || target == "" && i+1 < len(words) && words[i+1] == "/dev/null") {
			return true
		}
	}
	return false
}

// sed's -i alone or in a flag cluster (-Ei), or its long form
func editsInPlace(word string) bool {
	if strings.HasPrefix(word, "--") {
		return strings.HasPrefix(word, "--in-place")
	}
	return strings.HasPrefix(word, "-") && strings.Contains(word, "i")
}

// a statement's words, a quoted one kept whole and its quotes dropped
func statementWords(statement string) []string {
	var words []string
	var now strings.Builder
	open, inWord := byte(0), false
	for i := range len(statement) {
		c := statement[i]
		switch {
		case open != 0:
			if c == open {
				open = 0
			} else {
				now.WriteByte(c)
			}
		case c == '"' || c == '\'':
			open, inWord = c, true
		case c == ' ' || c == '\t':
			if inWord {
				words = append(words, now.String())
				now.Reset()
				inWord = false
			}
		default:
			now.WriteByte(c)
			inWord = true
		}
	}
	if inWord {
		words = append(words, now.String())
	}
	return words
}

// the words from the command on, past a keyword, an env word or a timeout in front of it
func shellCommandWords(words []string) []string {
	for len(words) > 0 {
		switch {
		case shellOpeners[words[0]] || shellEnvWord.MatchString(words[0]):
			words = words[1:]
		case words[0] == "timeout" && len(words) > 1:
			words = words[2:]
		default:
			return words
		}
	}
	return nil
}

func pathUnderShellDir(dir, word string) string {
	if dir == "" || filepath.IsAbs(word) || strings.HasPrefix(word, "~") {
		return word
	}
	return filepath.Join(dir, word)
}

// a heredoc's body is its command's input: no line of it runs
func dropHeredocs(command string) string {
	var kept []string
	end := ""
	for line := range strings.SplitSeq(command, "\n") {
		switch {
		case end != "":
			if strings.TrimSpace(line) == end {
				end = ""
			}
		default:
			kept = append(kept, line)
			if open := shellHeredoc.FindStringSubmatch(line); open != nil {
				end = open[1]
			}
		}
	}
	return strings.Join(kept, "\n")
}

// split on the shell's separators, a quoted or escaped one staying inside its word; a comment is no statement, and each
// parenthesis stands as its own item, so a subshell's `cd` can end with it
func shellStatements(command string) []string {
	var statements []string
	var now strings.Builder
	open := byte(0)
	for i := 0; i < len(command); i++ {
		c := command[i]
		switch {
		case c == '\\' && open != '\'' && i+1 < len(command):
			now.WriteByte(c)
			i++
			c = command[i]
		case open != 0:
			if c == open {
				open = 0
			}
		case c == '"' || c == '\'':
			open = c
		case c == '#' && (now.Len() == 0 || strings.HasSuffix(now.String(), " ")):
			for i+1 < len(command) && command[i+1] != '\n' {
				i++
			}
			continue
		case c == '(' || c == ')':
			statements = append(statements, now.String(), string(c))
			now.Reset()
			continue
		case c == '&' && (i+1 < len(command) && command[i+1] == '>' || i > 0 && command[i-1] == '>'):
			// `&>` and `2>&1` are redirects, no separator
		case strings.IndexByte(";&|\n", c) >= 0:
			statements = append(statements, now.String())
			now.Reset()
			continue
		}
		now.WriteByte(c)
	}
	return append(statements, now.String())
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
	Name  string `json:"name"`
	State string `json:"state"`
	Read  string `json:"read"`
}

type codieSession struct {
	ID        string `json:"id"`
	Cwd       string `json:"cwd"`
	Opened    string `json:"opened"`
	FirstEdit string `json:"first_edit"`
	lastEdit  string
	Checks    []auditCheck  `json:"checks"`
	Compacts  []compactRead `json:"compacts"`
	Retro     bool          `json:"retro"`
	tickets   []string
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

// fleetAuditCodie asks of every codie session (opened with /x:crew-codie or a Skill call of it) whether it read its contract before its
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
		fail = &Fail{Refused: true, Msg: fmt.Sprintf("%d missed; %s", len(data.Misses), data.Summary), Next: "x fleet audit-codie " + auditWindowArgs(data) + " --board", Data: data}
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
		traced.Kind = "refused"
	}
	return data, nil
}

func auditWindowArgs(data auditData) string {
	if data.Since != "" {
		return "--since " + data.Since
	}
	return fmt.Sprintf("--days %d", data.Days)
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

// --days keeps a session by when it opened; --since by its last edit, so a compaction's re-read owed past the stamp shows
func (s codieSession) inWindow(cut time.Time, byEdit bool) bool {
	stamp := s.Opened
	if byEdit {
		stamp = s.lastEdit
	}
	at, err := time.Parse(time.RFC3339, stamp)
	return err == nil && !at.Before(cut)
}

func (s codieSession) misses() []auditMiss {
	var misses []auditMiss
	for _, c := range s.Checks {
		if c.State == checkMissed {
			misses = append(misses, auditMiss{s.ID, s.Cwd, c.Name, fmt.Sprintf("first edit %s, read %s", clockOf(s.FirstEdit), cmp.Or(clockOf(c.Read), "never"))})
		}
	}
	for _, c := range s.Compacts {
		if c.Edited && !c.Reread && s.stateFor(lessonsName) != checkOlder {
			misses = append(misses, auditMiss{s.ID, s.Cwd, lessonsName, "edited after the compaction at " + clockOf(c.At) + " with no re-read"})
		}
	}
	return misses
}

func (s codieSession) stateFor(name string) string {
	for _, c := range s.Checks {
		if c.Name == name {
			return c.State
		}
	}
	return ""
}

// one line per check, how-you-work.md last: the board's last line and the summary
func auditCounts(sessions []codieSession) []string {
	names := []string{ticketCheck}
	for _, file := range auditFiles {
		names = append(names, file.name)
	}
	lines := make([]string, 0, len(names))
	for _, name := range names {
		read, asked, older := 0, 0, 0
		for _, s := range sessions {
			for _, c := range s.Checks {
				if c.Name != name {
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

// hook rows pushed a real codie's contract load to row 41 of its transcript (2026-11-05)
const codieOpeningRows = 100

// its opening prompt is the command, or its opening rows call the skill; a later load is a coordinator reading the contract
func opensAsCodie(lines [][]byte, opening []byte) (isCodie bool, args string) {
	for id, now := range skillNow {
		if now == "x:crew-codie" && bytes.Contains(opening, []byte("<command-name>/"+id+"</command-name>")) {
			return true, ""
		}
	}
	for _, raw := range lines[:min(codieOpeningRows, len(lines))] {
		var line auditLine
		var blocks []flowBlock
		if !bytes.Contains(raw, []byte(`"name":"Skill"`)) || json.Unmarshal(raw, &line) != nil || json.Unmarshal(line.Message.Content, &blocks) != nil {
			continue
		}
		for _, b := range blocks {
			if b.Type == "tool_use" && b.Name == "Skill" && skillNow[b.Input.Skill] == "x:crew-codie" {
				return true, b.Input.Args
			}
		}
	}
	return false, ""
}

// one codie session's reads and edits; a session that does not open as codie is none
func auditSession(path string) (codieSession, bool) {
	lines := transcriptLines(path)
	// the brief; a later mention (clio talking about it) is not codie
	opening := []byte{}
	for _, raw := range lines[:min(codieOpeningRows, len(lines))] {
		if bytes.Contains(raw, []byte(`"type":"user"`)) {
			opening = raw
			break
		}
	}
	isCodie, args := opensAsCodie(lines, opening)
	if !isCodie {
		return codieSession{}, false
	}
	s := codieSession{ID: filepath.Base(path)[:min(8, len(filepath.Base(path)))], Compacts: []compactRead{}}
	// the brief sits in the opening prompt or the Skill call's args
	s.tickets = briefTicket.FindAllString(args, -1)
	var first auditLine
	if json.Unmarshal(opening, &first) == nil {
		s.tickets = append(s.tickets, briefTicket.FindAllString(string(first.Message.Content), -1)...)
	}
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
	if len(s.tickets) > 0 {
		s.Checks = append(s.Checks, auditCheck{ticketCheck, s.stateOf(reads[ticketCheck]), reads[ticketCheck]})
	}
	return s, true
}

func (s *codieSession) readBlock(b flowBlock, at string, reads map[string]string) {
	target := b.Input.FilePath + " " + b.Input.Command
	var shellPaths []string
	if b.Name == "Bash" {
		shellPaths = shellReadPaths(b.Input.Command)
	}
	for _, file := range auditFiles {
		isRead := b.Name == "Read" && file.namedBy(b.Input.FilePath) || slices.ContainsFunc(shellPaths, file.namedBy) ||
			b.Name == "Skill" && file.skill != "" && b.Input.Skill == file.skill
		if !isRead {
			continue
		}
		reads[file.name] = cmp.Or(reads[file.name], at)
		if n := len(s.Compacts); file.name == lessonsName && n > 0 && !s.Compacts[n-1].Edited {
			s.Compacts[n-1].Reread = true
		}
	}
	if b.Name == "Bash" && ticketReadCmd.MatchString(b.Input.Command) && slices.ContainsFunc(s.tickets, func(id string) bool { return strings.Contains(b.Input.Command, id) }) {
		reads[ticketCheck] = cmp.Or(reads[ticketCheck], at)
	}
	// a retro is a count, never an edit: alone it would read as misses
	retro := strings.HasSuffix(b.Input.FilePath, "-retro.md") || b.Name == "Bash" && strings.Contains(b.Input.Command, "-retro.md")
	s.Retro = s.Retro || b.Name == "Write" && retro
	if retro || !auditEditTools[b.Name] && (b.Name != "Bash" || !auditEditBins.MatchString(target)) {
		return
	}
	s.FirstEdit = cmp.Or(s.FirstEdit, at)
	s.lastEdit = at
	if n := len(s.Compacts); n > 0 {
		s.Compacts[n-1].Edited = true
	}
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
