package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"maps"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

var (
	opsCodeExtensions = []string{".ts", ".tsx", ".go", ".sh", ".py", ".swift"}
	opsEditTools      = []string{"Edit", "Write", "MultiEdit"}
	opsTicket         = regexp.MustCompile(`\b(?:FRM|BYT|DOT)-\d+`)
	commandName       = regexp.MustCompile(`<command-name>/?([^<]+)<`)
	slashCommand      = regexp.MustCompile(`^/(\S+)`)
	commandArgs       = regexp.MustCompile(`<command-args>([^<]*)<`)
	slashArgs         = regexp.MustCompile(`^/\S+\s+(.*)`)
)

type opsUsage struct {
	Input         int `json:"input_tokens"`
	CacheCreation int `json:"cache_creation_input_tokens"`
	CacheRead     int `json:"cache_read_input_tokens"`
	Output        int `json:"output_tokens"`
}

type opsEntry struct {
	Type        string  `json:"type"`
	Timestamp   string  `json:"timestamp"`
	CustomTitle *string `json:"customTitle"`
	AgentName   *string `json:"agentName"`
	IsSidechain bool    `json:"isSidechain"`
	IsMeta      bool    `json:"isMeta"`
	Cwd         string  `json:"cwd"`
	UUID        string  `json:"uuid"`
	Origin      struct {
		Kind string `json:"kind"`
	} `json:"origin"`
	Message struct {
		ID         string          `json:"id"`
		StopReason string          `json:"stop_reason"`
		Usage      *opsUsage       `json:"usage"`
		Content    json.RawMessage `json:"content"`
	} `json:"message"`
}

type opsStep struct {
	end    bool
	tokens int
	ts     int64
}

type opsBoot struct {
	Kind    string  `json:"kind"`
	ID      string  `json:"id"`
	Tokens  int     `json:"tokens"`
	Seconds float64 `json:"seconds"`
}

type opsSession struct {
	ID        string
	Role      string
	Ticket    string
	Title     string
	Steps     int
	Tokens    int
	WallMs    int64
	CodeEdits int
	Boot      *opsBoot
}

type ticketCost struct {
	Ticket string `json:"ticket"`
	Tokens int    `json:"tokens"`
	WallMs int64  `json:"wall_ms"`
}

type cclioEdits struct {
	ID    string `json:"id"`
	Edits int    `json:"edits"`
	Title string `json:"title"`
}

type opsData struct {
	Days         int          `json:"days"`
	MinKB        int          `json:"min_kb"`
	Tickets      []ticketCost `json:"tickets"`
	CclioEdits   []cclioEdits `json:"cclio_edits"`
	Boots        []opsBoot    `json:"boots"`
	SizeMisses   []sizeMiss   `json:"size_misses"`
	SizeError    string       `json:"size_error,omitempty"`
	SessionsRead int          `json:"sessions_read"`
}

// a ticket closed in the window whose coder turns reached its estimate's size line
type sizeMiss struct {
	Ticket string `json:"ticket"`
	Size   string `json:"size"`
	Turns  int    `json:"turns"`
	Line   int    `json:"line"`
}

type ticketSize struct {
	Estimate int
	Closed   bool
}

// the size lines in agent turns (x:pm references/workspace.md § fields); M has none, it is split before a spawn
var sizeLines = map[int]struct {
	name string
	line int
}{1: {"XS", 80}, 2: {"S", 400}}

// fleetOps reads agent ops off the transcripts, no model tokens: tokens and wall time per ticket (coder
// + verifier), cclio's own code edits per session, the cost of a cclio boot
func fleetOps(r *Run, _ []string, flags Flags) (any, error) {
	days, err := daysFlag(flags, "fleet ops", 7)
	if err != nil {
		return nil, err
	}
	minKB := 200
	if value, _ := flags["min-kb"].(string); value != "" {
		if minKB, err = strconv.Atoi(value); err != nil || minKB < 0 {
			return nil, usageFail("--min-kb is a whole number of kilobytes, not "+value, "x fleet ops --min-kb 200")
		}
	}
	var sessions []opsSession
	for _, path := range sessionFiles(time.Now().Add(-time.Duration(days)*24*time.Hour), int64(minKB)*1024) {
		sessions = append(sessions, parseOpsSession(transcriptLines(path), path))
	}
	data := opsData{Days: days, MinKB: minKB, Tickets: costPerTicket(sessions), CclioEdits: []cclioEdits{}, Boots: []opsBoot{}, SizeMisses: []sizeMiss{}, SessionsRead: len(sessions)}
	if turns := coderTurns(sessions); len(turns) > 0 {
		actor, err := actorOf(flags)
		if err != nil {
			return nil, err
		}
		// a linear outage leaves the transcript numbers standing; the miss check names why it is empty
		since := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
		if sizes, err := ticketSizes(actor, slices.Sorted(maps.Keys(turns)), since); err != nil {
			data.SizeError = err.Error()
		} else {
			data.SizeMisses = sizeMisses(turns, sizes)
		}
	}
	var cclio []opsSession
	for _, s := range sessions {
		if s.Role == "cclio" {
			cclio = append(cclio, s)
		}
	}
	slices.SortStableFunc(cclio, func(a, b opsSession) int { return b.CodeEdits - a.CodeEdits })
	for _, s := range cclio {
		data.CclioEdits = append(data.CclioEdits, cclioEdits{ID: s.ID, Edits: s.CodeEdits, Title: s.Title})
	}
	for _, kind := range []string{"full", "mini"} {
		for _, s := range cclio {
			if s.Boot != nil && s.Boot.Kind == kind {
				data.Boots = append(data.Boots, *s.Boot)
			}
		}
	}
	if r.human {
		lines := strings.Split(strings.ReplaceAll(strings.Join(opsLines(data), "\n"), "\t", "  "), "\n")
		r.Board(textBoard("fleet ops", fmt.Sprintf("%d sessions, last %d days", len(sessions), days), lines))
	}
	return data, nil
}

func parseOpsSession(lines [][]byte, path string) opsSession {
	var title, firstCmd, firstArgs, firstPrompt, cwd string
	var firstTs, lastTs, firstPromptTs int64
	steps := map[string]*opsStep{}
	type turn struct {
		user bool
		id   string
	}
	var order []turn
	codeEdits := 0
	for _, raw := range lines {
		var e opsEntry
		if len(raw) == 0 || json.Unmarshal(raw, &e) != nil {
			continue
		}
		ts, tsErr := time.Parse(time.RFC3339Nano, e.Timestamp)
		var ms int64
		if tsErr == nil {
			ms = ts.UnixMilli()
			if firstTs == 0 {
				firstTs = ms
			}
			lastTs = ms
		}
		var text string
		var blocks []flowBlock
		isText := json.Unmarshal(e.Message.Content, &text) == nil
		if !isText {
			_ = json.Unmarshal(e.Message.Content, &blocks)
		}
		switch {
		case e.Type == "custom-title" || e.Type == "agent-name":
			if e.CustomTitle != nil {
				title = *e.CustomTitle
			} else if e.AgentName != nil {
				title = *e.AgentName
			}
		case e.Type == "user" && !e.IsSidechain:
			if cwd == "" {
				cwd = e.Cwd
			}
			toolResult := slices.ContainsFunc(blocks, func(b flowBlock) bool { return b.Type == "tool_result" })
			task := e.Origin.Kind == "task-notification" || e.Origin.Kind == "peer" || e.IsMeta
			if toolResult || task {
				continue
			}
			order = append(order, turn{user: true})
			if firstPrompt != "" {
				continue
			}
			if !isText {
				if i := slices.IndexFunc(blocks, func(b flowBlock) bool { return b.Type == "text" }); i >= 0 {
					text = blocks[i].Text
				}
			}
			firstPrompt = utf16Prefix(text, 400)
			firstPromptTs = ms
			firstCmd = firstMatch(text, commandName, slashCommand)
			firstArgs = firstMatch(text, commandArgs, slashArgs)
		case e.Type == "assistant" && !e.IsSidechain:
			id := cmp.Or(e.Message.ID, e.UUID)
			step := steps[id]
			if step == nil {
				step = &opsStep{ts: ms}
				steps[id] = step
				order = append(order, turn{id: id})
			}
			if u := e.Message.Usage; u != nil {
				step.tokens = u.Input + u.CacheCreation + u.CacheRead + u.Output
			}
			for _, b := range blocks {
				if b.Type == "tool_use" && slices.Contains(opsEditTools, b.Name) &&
					slices.ContainsFunc(opsCodeExtensions, func(ext string) bool { return strings.HasSuffix(b.Input.FilePath, ext) }) {
					codeEdits++
				}
			}
			if e.Message.StopReason == "end_turn" {
				step.end = true
			}
		}
	}
	ticket := opsTicket.FindString(title)
	if ticket == "" {
		ticket = opsTicket.FindString(firstPrompt)
	}
	s := opsSession{ID: filepath.Base(path)[:min(8, len(filepath.Base(path)))], Role: opsRole(cwd, firstCmd, path, title),
		Ticket: ticket, Title: title, Steps: len(steps), CodeEdits: codeEdits, WallMs: max(0, lastTs-firstTs)}
	for _, step := range steps {
		s.Tokens += step.tokens
	}
	// a cclio boot costs the tokens and seconds from the first prompt to the first end_turn
	if s.Role == "cclio" && firstCmd == "cclio:boot" {
		tokens := 0
		for _, t := range order {
			step := steps[t.id]
			if t.user || step == nil {
				continue
			}
			tokens += step.tokens
			if step.end {
				kind := "full"
				if strings.HasPrefix(strings.TrimSpace(firstArgs), "mini") {
					kind = "mini"
				}
				s.Boot = &opsBoot{Kind: kind, ID: s.ID, Tokens: tokens, Seconds: max(0, float64(step.ts-firstPromptTs)/1000)}
				break
			}
		}
	}
	return s
}

var (
	ccrowTitle    = regexp.MustCompile(`(?i)ccrow`)
	cclioTitle    = regexp.MustCompile(`(?i)cclio`)
	cclioCwd      = regexp.MustCompile(`/frame/cclio(/|$)`)
	probeTitle    = regexp.MustCompile(`(?i)🧪|probe`)
	researchTitle = regexp.MustCompile(`(?i)🔬|adviser|research`)
)

func opsRole(cwd, firstCmd, path, title string) string {
	switch {
	case strings.Contains(title, "🔧") || firstCmd == "x:crew-coder":
		return "coder"
	case strings.Contains(title, "🔎") || firstCmd == "x:crew-verifier":
		return "verifier"
	case ccrowTitle.MatchString(title):
		return "ccrow"
	case cclioTitle.MatchString(title) || title == "" && strings.HasSuffix(cwd, "/frame/cclio") || cclioCwd.MatchString(cwd):
		return "cclio"
	case probeTitle.MatchString(title) || strings.Contains(path, "probe"):
		return "probe"
	case researchTitle.MatchString(title):
		return "research"
	}
	return "other"
}

// coder + verifier sessions summed per ticket, the costliest first
func costPerTicket(sessions []opsSession) []ticketCost {
	costs := []ticketCost{}
	index := map[string]int{}
	for _, s := range sessions {
		if s.Ticket == "" || s.Role != "coder" && s.Role != "verifier" {
			continue
		}
		i, seen := index[s.Ticket]
		if !seen {
			i = len(costs)
			index[s.Ticket] = i
			costs = append(costs, ticketCost{Ticket: s.Ticket})
		}
		costs[i].Tokens += s.Tokens
		costs[i].WallMs += s.WallMs
	}
	slices.SortStableFunc(costs, func(a, b ticketCost) int { return b.Tokens - a.Tokens })
	return costs
}

// coder turns (distinct assistant message ids) summed per ticket over every session that worked it
func coderTurns(sessions []opsSession) map[string]int {
	turns := map[string]int{}
	for _, s := range sessions {
		if s.Role == "coder" && s.Ticket != "" {
			turns[s.Ticket] += s.Steps
		}
	}
	return turns
}

func sizeMisses(turns map[string]int, sizes map[string]ticketSize) []sizeMiss {
	misses := []sizeMiss{}
	for ticket, n := range turns {
		size, known := sizes[ticket]
		line, sized := sizeLines[size.Estimate]
		if known && size.Closed && sized && n >= line.line {
			misses = append(misses, sizeMiss{Ticket: ticket, Size: line.name, Turns: n, Line: line.line})
		}
	}
	slices.SortFunc(misses, func(a, b sizeMiss) int { return cmp.Or(b.Turns-a.Turns, strings.Compare(a.Ticket, b.Ticket)) })
	return misses
}

// one aliased request for every ticket; an id linear does not know comes back null and is left out.
// closed means closed inside the window, so the next halt never reports the same miss again
func ticketSizes(actor string, tickets []string, since time.Time) (map[string]ticketSize, error) {
	var query strings.Builder
	query.WriteString("query {")
	for i, id := range tickets {
		fmt.Fprintf(&query, " t%d: issue(id: %q) { estimate completedAt state { type } }", i, id)
	}
	query.WriteString(" }")
	data, _, err := gql(actor, query.String(), nil)
	if err != nil {
		return nil, err
	}
	sizes := map[string]ticketSize{}
	for i, id := range tickets {
		var issue *struct {
			Estimate    *float64  `json:"estimate"`
			CompletedAt time.Time `json:"completedAt"`
			State       struct {
				Type string `json:"type"`
			} `json:"state"`
		}
		if json.Unmarshal(data[fmt.Sprintf("t%d", i)], &issue) != nil || issue == nil {
			continue
		}
		size := ticketSize{Closed: issue.State.Type == "completed" && !issue.CompletedAt.Before(since)}
		if issue.Estimate != nil {
			size.Estimate = int(*issue.Estimate)
		}
		sizes[id] = size
	}
	return sizes, nil
}

func opsLines(d opsData) []string {
	millions := func(n float64) string { return fixed1(n/1e6) + "M" }
	minutes := func(ms float64) string { return fixed1(ms/60000) + "min" }
	lines := []string{"", "== cost per ticket: coder + verifier sessions, tokens = input + cache_creation + cache_read + output per step (deduped by message.id), wall = first to last timestamp =="}
	var tokens, walls []float64
	for _, c := range d.Tickets {
		lines = append(lines, fmt.Sprintf("%s\t%s tokens\t%s", c.Ticket, millions(float64(c.Tokens)), minutes(float64(c.WallMs))))
		tokens, walls = append(tokens, float64(c.Tokens)), append(walls, float64(c.WallMs))
	}
	lines = append(lines, fmt.Sprintf("median over %d tickets: %s tokens, %s", len(d.Tickets), millions(median(tokens)), minutes(median(walls))),
		"", "== cclio code edits: Edit/Write/MultiEdit on "+strings.Join(opsCodeExtensions, " ")+", per cclio session ==")
	var edits []float64
	for _, c := range d.CclioEdits {
		lines = append(lines, fmt.Sprintf("%s\t%d\t%s", c.ID, c.Edits, cmp.Or(c.Title, "-")))
		edits = append(edits, float64(c.Edits))
	}
	lines = append(lines, fmt.Sprintf("median over %d sessions: %s", len(d.CclioEdits), strconv.FormatFloat(median(edits), 'f', -1, 64)),
		"", "== boot cost: cclio sessions opening with /cclio:boot, first prompt to first end_turn ==")
	for _, kind := range []string{"full", "mini"} {
		var bootTokens, seconds []float64
		for _, b := range d.Boots {
			if b.Kind != kind {
				continue
			}
			lines = append(lines, fmt.Sprintf("%s\t%s\t%s tokens\t%ds", kind, b.ID, millions(float64(b.Tokens)), roundHalfUp(b.Seconds)))
			bootTokens, seconds = append(bootTokens, float64(b.Tokens)), append(seconds, b.Seconds)
		}
		lines = append(lines, fmt.Sprintf("%s median over %d: %s tokens, %ds", kind, len(bootTokens), millions(median(bootTokens)), roundHalfUp(median(seconds))))
	}
	if d.SizeError != "" {
		lines = append(lines, "", "== size misses: not checked — "+d.SizeError+" ==")
	}
	if len(d.SizeMisses) > 0 {
		var bounds []string
		for _, estimate := range slices.Sorted(maps.Keys(sizeLines)) {
			bounds = append(bounds, fmt.Sprintf("%s %d", sizeLines[estimate].name, sizeLines[estimate].line))
		}
		lines = append(lines, "", "== size misses: tickets closed in the window whose coder turns reached their size line ("+strings.Join(bounds, ", ")+") ==")
		for _, m := range d.SizeMisses {
			lines = append(lines, fmt.Sprintf("%s\t%s\t%d turns (line %d)", m.Ticket, m.Size, m.Turns, m.Line))
		}
	}
	return lines
}

func firstMatch(text string, patterns ...*regexp.Regexp) string {
	for _, p := range patterns {
		if m := p.FindStringSubmatch(text); m != nil {
			return m[1]
		}
	}
	return ""
}

// the first n utf-16 units, as javascript's slice counts them
func utf16Prefix(s string, n int) string {
	units := 0
	for i, r := range s {
		units += len(utf16.Encode([]rune{r}))
		if units > n {
			return s[:i]
		}
	}
	return s
}
