package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var (
	flowStart = time.Date(2026, 10, 1, 0, 0, 0, 0, time.Local)
	flowAt    = "2026-10-05T10:00:00.000Z"
)

// the lines as cc writes them: `<` stays `<`, where go's default escapes it
func jsonLines(t *testing.T, lines ...any) string {
	t.Helper()
	var out strings.Builder
	enc := json.NewEncoder(&out)
	enc.SetEscapeHTML(false)
	for _, line := range lines {
		if err := enc.Encode(line); err != nil {
			t.Fatal(err)
		}
	}
	return strings.TrimSuffix(out.String(), "\n")
}

// one session transcript under a fresh HOME's ~/.claude/projects/<project>/
func session(t *testing.T, lines ...any) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	write(t, filepath.Join(home, ".claude/projects/-Users-dima-frame/session.jsonl"), jsonLines(t, lines...))
}

func said(text string) map[string]any {
	return map[string]any{"type": "user", "timestamp": flowAt, "message": map[string]any{"content": text}}
}

func called(name string, input map[string]any, at string) map[string]any {
	return map[string]any{"type": "assistant", "timestamp": at,
		"message": map[string]any{"content": []any{map[string]any{"type": "tool_use", "name": name, "input": input}}}}
}

func bashCalled(command string) map[string]any {
	return called("Bash", map[string]any{"command": command}, flowAt)
}

var crewLoad = called("Skill", map[string]any{"skill": "x:crew-codie"}, flowAt)

func flowCounts(t *testing.T, lines ...any) flowTranscripts {
	session(t, lines...)
	return transcriptCounts(flowStart, []string{"authoring-skill.md", "go-charm.md"})
}

func TestFlawlogCountsTaggedLinesInTheWindow(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	write(t, filepath.Join(dir, "2026-10-05-day.md"), strings.Join([]string{
		"# flawlog — 2026-10-05",
		"- the brief named a banned path #brief",
		"  - the exit lines lived in codie's brief only (`#brief`) #dima-caught",
		"- a #briefing word is not the tag",
		"- nor is a tag glued to a word#brief",
		"- an untagged line",
	}, "\n"))
	write(t, filepath.Join(dir, "2026-09-01-old.md"), "- outside the window #brief\n")

	cases := []struct {
		name, since string
		brief       int
	}{
		{"inside the window", "2026-09-22", 2},
		{"from the window start on", "2026-09-01", 3},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := flawlogCounts(dir, c.since)
			if got[1].Tag != "#brief" || got[1].Count != c.brief {
				t.Errorf("counts %+v, want #brief %d", got, c.brief)
			}
		})
	}
}

func TestMedianMinutesTakesTheMiddlePR(t *testing.T) {
	t.Parallel()
	pr := func(minutes int) mergedPR {
		at := time.Date(2026, 10, 1, 10, 0, 0, 0, time.UTC)
		return mergedPR{CreatedAt: at, MergedAt: at.Add(time.Duration(minutes) * time.Minute)}
	}
	cases := []struct {
		name string
		prs  []mergedPR
		want float64
	}{
		{"the mean of the two middle ones on an even count", []mergedPR{pr(40), pr(10), pr(20), pr(100)}, 30},
		{"the middle one on an odd count", []mergedPR{pr(40), pr(10), pr(100)}, 40},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := medianMinutes(c.prs); got == nil || *got != c.want {
				t.Errorf("median %v, want %v", got, c.want)
			}
		})
	}
	if got := medianMinutes(nil); got != nil {
		t.Errorf("median of no prs = %v, want none", *got)
	}
}

func TestFixed1RoundsLikeJavascriptToFixed(t *testing.T) {
	t.Parallel()
	// node: (0.15).toFixed(1) "0.1", (0.25).toFixed(1) "0.3", (1.05).toFixed(1) "1.1", (2.449).toFixed(1) "2.4"
	cases := []struct {
		in   float64
		want string
	}{{0.15, "0.1"}, {0.25, "0.3"}, {1.05, "1.1"}, {2.449, "2.4"}, {30, "30.0"}, {0, "0.0"}}
	for _, c := range cases {
		if got := fixed1(c.in); got != c.want {
			t.Errorf("fixed1(%v) = %s, want %s", c.in, got, c.want)
		}
	}
}

func TestFlowCountsABareCCRun(t *testing.T) {
	// serial: t.Setenv(HOME) — the flow counts read transcripts from the process HOME
	cases := []struct {
		name string
		line map[string]any
		want int
	}{
		{"a bare run", bashCalled("claude -p --model haiku --safe-mode 'hi'"), 1},
		{"no bare run once the flag is gone", bashCalled("claude -p --model haiku 'hi'"), 0},
		{"a search for the flag", bashCalled("rg -- --safe-mode docs"), 0},
		{"a bare run before the window", called("Bash", map[string]any{"command": "claude -p --safe-mode x"}, "2026-09-20T10:00:00.000Z"), 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := flowCounts(t, c.line).bareRuns; got != c.want {
				t.Errorf("bare runs %d, want %d", got, c.want)
			}
		})
	}
}

func TestFlowMarksACrewLoadByWhetherAMessageNamedIt(t *testing.T) {
	// serial: t.Setenv(HOME) — the flow counts read transcripts from the process HOME
	cases := []struct {
		name, said           string
		briefLed, falseFires int
	}{
		{"brief-led when an earlier message names the skill", "load `x:crew-codie` first", 1, 0},
		{"a false fire when none does", "fix the typo", 0, 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := flowCounts(t, said(c.said), crewLoad)
			if got.briefLed != c.briefLed || got.falseFires != c.falseFires {
				t.Errorf("brief-led %d, false fires %d", got.briefLed, got.falseFires)
			}
		})
	}
}

func TestFlowCountsReadsOfEachKnowledgeFile(t *testing.T) {
	// serial: t.Setenv(HOME) — the flow counts read transcripts from the process HOME
	got := flowCounts(t, called("Read", map[string]any{"file_path": "/Users/dima/frame/docs/knowledge/go-charm.md"}, flowAt))
	want := `[{"file":"go-charm.md","count":1},{"file":"authoring-skill.md","count":0}]`
	if marshal(got.reads) != want {
		t.Errorf("reads %s, want %s", marshal(got.reads), want)
	}
}

func TestGuardDaySumsTheDaysKeysOfEveryGuardStore(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	write(t, filepath.Join(dir, "x-mod-guard_inline-abc.json"), `{"day:2026-10-05:a1":{"refused":9,"escaped":9},`+
		`"day:2026-10-06:a1":{"refused":2,"escaped":1},"day:2026-10-06:b2":{"refused":1,"escaped":0},"event:1:a1":{"kind":"refused"}}`)
	write(t, filepath.Join(dir, "guard_inline-0ld.json"), `{"day:2026-10-06:c3":{"refused":1,"escaped":0}}`)
	write(t, filepath.Join(dir, "x-mod-stash_inline-def.json"), `{"day:2026-10-06:d4":{"refused":5,"escaped":5}}`)

	got := guardDay(dir, "2026-10-06")

	if got.Refused != 4 || got.Escaped != 1 || got.Sessions != 3 {
		t.Errorf("refused %d, escaped %d, sessions %d", got.Refused, got.Escaped, got.Sessions)
	}
}

func TestGuardDaySumsEachRuleAcrossSessions(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	write(t, filepath.Join(dir, "x-mod-guard_inline-abc.json"), `{`+
		`"day:2026-10-06:a1":{"escaped":1,"refused":2,"rules":{"rm":{"escaped":1,"refused":0},"overwrite":{"escaped":0,"refused":2}}},`+
		`"day:2026-10-06:b2":{"escaped":0,"refused":1,"rules":{"overwrite":{"escaped":0,"refused":1}}},`+
		`"day:2026-10-06:c3":{"escaped":0,"refused":1}}`)

	got := guardDay(dir, "2026-10-06").Rules

	want := `[{"rule":"overwrite","refused":3,"escaped":0},{"rule":"rm","refused":0,"escaped":1}]`
	if marshal(got) != want {
		t.Errorf("rules %s, want %s", marshal(got), want)
	}
}

func assistantStep(id, at string, usage map[string]int, stop string) map[string]any {
	return map[string]any{"type": "assistant", "timestamp": at, "message": map[string]any{
		"id": id, "stop_reason": stop, "usage": usage, "content": []any{map[string]any{"type": "text", "text": "hi"}}}}
}

func opsSessionOf(t *testing.T, lines ...any) opsSession {
	t.Helper()
	var raw [][]byte
	for line := range strings.SplitSeq(jsonLines(t, lines...), "\n") {
		raw = append(raw, []byte(line))
	}
	return parseOpsSession(raw, "a.jsonl")
}

func TestOpsCountsAStepOnceWhenItsMessageIDRepeats(t *testing.T) {
	t.Parallel()
	usage := map[string]int{"input_tokens": 10, "output_tokens": 5}
	s := opsSessionOf(t, assistantStep("m1", "2026-10-07T10:00:00Z", usage, "tool_use"), assistantStep("m1", "2026-10-07T10:00:01Z", usage, "tool_use"))
	if s.Steps != 1 || s.Tokens != 15 {
		t.Errorf("steps %d, tokens %d", s.Steps, s.Tokens)
	}
}

func TestOpsSumsInputCacheAndOutputTokens(t *testing.T) {
	t.Parallel()
	usage := map[string]int{"input_tokens": 1, "cache_creation_input_tokens": 100, "cache_read_input_tokens": 1000, "output_tokens": 10}
	if s := opsSessionOf(t, assistantStep("m1", "2026-10-07T10:00:00Z", usage, "end_turn")); s.Tokens != 1111 {
		t.Errorf("tokens %d, want 1111", s.Tokens)
	}
}

func TestOpsCostsAClioBootUpToItsFirstEndTurn(t *testing.T) {
	t.Parallel()
	boot := map[string]any{"type": "user", "timestamp": "2026-10-07T10:00:00Z", "cwd": "/Users/dima/frame/_clio",
		"message": map[string]any{"content": "<command-name>/clio:boot</command-name><command-args>mini</command-args>"}}
	usage := map[string]int{"output_tokens": 10}
	s := opsSessionOf(t, boot,
		assistantStep("m1", "2026-10-07T10:00:05Z", usage, "tool_use"), assistantStep("m1", "2026-10-07T10:00:06Z", usage, "tool_use"),
		assistantStep("m2", "2026-10-07T10:00:30Z", map[string]int{"output_tokens": 5}, "end_turn"),
		assistantStep("m3", "2026-10-07T10:01:00Z", usage, "end_turn"))
	if want := `{"kind":"mini","id":"a.jsonl","tokens":15,"seconds":30}`; s.Role != "clio" || marshal(s.Boot) != want {
		t.Errorf("role %s, boot %s, want %s", s.Role, marshal(s.Boot), want)
	}
}

func TestOpsReadsBothCoordinatorCwds(t *testing.T) {
	t.Parallel()
	for _, cwd := range []string{"/Users/dima/frame/_clio", "/Users/dima/frame/cclio/script"} { // read-both
		if got := opsRole(cwd, "", "a.jsonl", "untitled"); got != "clio" {
			t.Errorf("cwd %s: role %q, want the coordinator", cwd, got)
		}
	}
}

func TestOpsCountsCodeEditsAndSkipsTheSidechain(t *testing.T) {
	t.Parallel()
	edit := func(file string, sidechain bool) map[string]any {
		return map[string]any{"type": "assistant", "timestamp": flowAt, "isSidechain": sidechain, "message": map[string]any{
			"id": "m-" + file, "content": []any{map[string]any{"type": "tool_use", "name": "Edit", "input": map[string]any{"file_path": file}}}}}
	}
	s := opsSessionOf(t, edit("a.go", false), edit("b.md", false), edit("c.ts", true))
	if s.CodeEdits != 1 || s.Steps != 2 {
		t.Errorf("code edits %d, steps %d — want 1 edit of a.go, the sidechain step left out", s.CodeEdits, s.Steps)
	}
}

func TestRoundHalfUpRoundsAHalfUp(t *testing.T) {
	t.Parallel()
	// node: Math.round(2.5) 3, Math.round(2.49) 2
	if roundHalfUp(2.5) != 3 || roundHalfUp(2.49) != 2 {
		t.Errorf("roundHalfUp(2.5) = %d, roundHalfUp(2.49) = %d", roundHalfUp(2.5), roundHalfUp(2.49))
	}
}

func TestOpsAddsTheCoderAndVerifierOfOneTicket(t *testing.T) {
	t.Parallel()
	usage := map[string]int{"output_tokens": 100}
	of := func(title, start, end string) opsSession {
		return opsSessionOf(t, map[string]any{"type": "custom-title", "customTitle": title},
			assistantStep("m1", start, usage, "end_turn"), assistantStep("m2", end, usage, "end_turn"))
	}
	costs := costPerTicket([]opsSession{
		of("☕️ 🔧 FRM-9 code: x", "2026-10-07T10:00:00Z", "2026-10-07T10:10:00Z"),
		of("☕️ 🔎 FRM-9 verify: #1", "2026-10-07T11:00:00Z", "2026-10-07T11:05:00Z"),
	})
	if want := `[{"ticket":"FRM-9","tokens":400,"wall_ms":900000}]`; marshal(costs) != want {
		t.Errorf("costs %s, want %s", marshal(costs), want)
	}
}

func TestSizeMissesFlagAClosedTicketPastItsLine(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		turns int
		size  ticketSize
		want  string
	}{
		{"a closed S past 400", 600, ticketSize{Estimate: 2, Closed: true}, `[{"ticket":"FRM-9","size":"S","turns":600,"line":400}]`},
		{"a closed S under 400", 399, ticketSize{Estimate: 2, Closed: true}, `[]`},
		{"a closed XS at 80", 80, ticketSize{Estimate: 1, Closed: true}, `[{"ticket":"FRM-9","size":"XS","turns":80,"line":80}]`},
		{"an open S past 400", 600, ticketSize{Estimate: 2}, `[]`},
		{"a closed M has no line", 900, ticketSize{Estimate: 3, Closed: true}, `[]`},
		{"a closed ticket with no estimate", 900, ticketSize{Closed: true}, `[]`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := marshal(sizeMisses(map[string]int{"FRM-9": c.turns}, map[string]ticketSize{"FRM-9": c.size})); got != c.want {
				t.Errorf("misses %s, want %s", got, c.want)
			}
		})
	}
}

func TestCoderTurnsSumEverySessionOfATicketAndSkipTheVerifier(t *testing.T) {
	t.Parallel()
	turns := codieTurns([]opsSession{
		{Role: "codie", Ticket: "FRM-9", Steps: 300},
		{Role: "codie", Ticket: "FRM-9", Steps: 200},
		{Role: "sixth-sense", Ticket: "FRM-9", Steps: 900},
	})
	if marshal(turns) != `{"FRM-9":500}` {
		t.Errorf("turns %s, want FRM-9 at 500", marshal(turns))
	}
}

// a home holding one coder transcript of n turns for FRM-9, and a fake linear answering with reply
func opsWorld(t *testing.T, n int, reply string) (string, *fakeLinear) {
	t.Helper()
	home := t.TempDir()
	dir := filepath.Join(home, ".claude", "projects", "-frame")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	lines := []any{map[string]any{"type": "custom-title", "customTitle": "☕️ 🔧 FRM-9 code: x"}}
	for i := range n {
		lines = append(lines, assistantStep(fmt.Sprintf("m%d", i), "2026-10-10T10:00:00Z", map[string]int{"output_tokens": 1}, "tool_use"))
	}
	if err := os.WriteFile(filepath.Join(dir, "s.jsonl"), []byte(jsonLines(t, lines...)+"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	return home, newFakeLinear(t, func(gqlCall) string { return reply })
}

// linear's answer for FRM-9 as an S in the given state, closed at the given time
func sizedS(stateType string, completedAt time.Time) string {
	return `{"data":{"t0":{"estimate":2,"completedAt":"` + completedAt.UTC().Format(time.RFC3339) + `","state":{"type":"` + stateType + `"}}}}`
}

func opsSizeData(t *testing.T, home string, server *fakeLinear) map[string]any {
	t.Helper()
	envelope, got := runLinear(t, server, []string{"HOME=" + home}, "fleet", "ops", "--days", "1", "--min-kb", "0")
	data, ok := envelope["data"].(map[string]any)
	if !ok {
		t.Fatalf("no data in the envelope:\n%s\n%s", got.stdout, got.stderr)
	}
	return data
}

func TestFleetOpsPrintsAClosedTicketPastItsSizeAsAMiss(t *testing.T) {
	t.Parallel()
	home, server := opsWorld(t, 600, sizedS("completed", time.Now()))
	if got, want := marshal(opsSizeData(t, home, server)["size_misses"]), `[{"line":400,"size":"S","ticket":"FRM-9","turns":600}]`; got != want {
		t.Errorf("size_misses %s, want %s", got, want)
	}
}

func TestFleetOpsLeavesOutATicketClosedBeforeTheWindow(t *testing.T) {
	t.Parallel()
	home, server := opsWorld(t, 600, sizedS("completed", time.Now().Add(-72*time.Hour)))
	if got := marshal(opsSizeData(t, home, server)["size_misses"]); got != `[]` {
		t.Errorf("size_misses %s — a miss the last halt already reported came back", got)
	}
}

func TestFleetOpsNamesASizeCheckLinearCouldNotAnswer(t *testing.T) {
	t.Parallel()
	home, server := opsWorld(t, 600, "not json")
	if data := opsSizeData(t, home, server); data["size_error"] == nil || marshal(data["size_misses"]) != `[]` {
		t.Errorf("size_error %v, size_misses %s — want the error named and no misses", data["size_error"], marshal(data["size_misses"]))
	}
}

func TestFleetOpsPrintsNoSizeSectionWithoutAClosedTicket(t *testing.T) {
	t.Parallel()
	home, server := opsWorld(t, 600, sizedS("started", time.Time{}))
	_, got := runLinear(t, server, []string{"HOME=" + home}, "fleet", "ops", "--days", "1", "--min-kb", "0", "--board")
	if asked := len(server.requests()); asked != 1 || strings.Contains(got.stdout+got.stderr, "size misses") {
		t.Errorf("linear asked %d times (want 1: the check ran); board:\n%s", asked, got.stdout+got.stderr)
	}
}

func auditOpening(at, brief string) map[string]any {
	line := said("<command-name>/x:crew-codie</command-name> " + brief)
	line["timestamp"] = at
	return line
}

func auditWithCwd(line map[string]any, cwd string) map[string]any {
	line["cwd"] = cwd
	return line
}

func auditStateOf(s codieSession, file string) string {
	for _, c := range s.Checks {
		if c.Name == file {
			return c.State
		}
	}
	return "unchecked"
}

func auditOf(t *testing.T, lines ...any) codieSession {
	t.Helper()
	path := filepath.Join(t.TempDir(), "session.jsonl")
	write(t, path, jsonLines(t, lines...))
	s, ok := auditSession(path)
	if !ok {
		t.Fatal("the session did not read as codie")
	}
	return s
}

func TestAuditCodieChecksEachFileBeforeTheFirstEdit(t *testing.T) {
	t.Parallel()
	const day = "2026-10-20T"
	read := func(path, at string) map[string]any {
		return called("Read", map[string]any{"file_path": path}, day+at+":00.000Z")
	}
	edit := func(at string) map[string]any {
		return called("Edit", map[string]any{"file_path": "/x/a.go"}, day+at+":00.000Z")
	}
	const lessons, dna = "/p/skills/crew-codie/how-you-work.md", "/p/skills/crew-dna/SKILL.md"
	opening := auditOpening(day+"09:00:00.000Z", "a brief")
	cases := []struct {
		name, file, want string
		lines            []any
	}{
		{"read, then edit", lessonsName, checkRead, []any{opening, read(lessons, "10:01"), edit("10:02")}},
		{"edit before any read", lessonsName, checkMissed, []any{opening, edit("10:01"), read(lessons, "10:02")}},
		{"under a skill dir of another name", lessonsName, checkRead, []any{opening, read("/p/skills/crew-renamed/how-you-work.md", "10:01"), edit("10:02")}},
		{"never read", lessonsName, checkMissed, []any{opening, edit("10:02")}},
		{"a session with no edit", lessonsName, checkNoEdit, []any{opening, read(dna, "10:01")}},
		{"crew-dna read", "crew-dna", checkRead, []any{opening, read(dna, "10:01"), edit("10:02")}},
		{"crew-dna missed", "crew-dna", checkMissed, []any{opening, read(lessons, "10:01"), edit("10:02")}},
		{"a read a day later reads late, whatever its clock", lessonsName, checkMissed, []any{opening,
			called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-10-20T23:00:00.000Z"),
			called("Read", map[string]any{"file_path": lessons}, "2026-10-21T01:00:00.000Z")}},
		{"opened before how-you-work.md was born", lessonsName, checkOlder, []any{auditOpening("2026-09-20T09:00:00.000Z", "a brief"),
			called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-09-20T10:00:00.000Z")}},
		{"opened before crew-dna was born", "crew-dna", checkOlder, []any{auditOpening("2026-10-01T09:00:00.000Z", "a brief"),
			called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-10-01T10:00:00.000Z")}},
		{"no ticket in the brief", ticketCheck, "unchecked", []any{opening, edit("10:02")}},
		{"a ticket in the brief, read first", ticketCheck, checkRead, []any{auditOpening(day+"09:00:00.000Z", "FRM-1 the job"),
			called("Bash", map[string]any{"command": "x linear read FRM-1 --comments"}, day+"10:01:00.000Z"), edit("10:02")}},
		{"a ticket in the brief, never read", ticketCheck, checkMissed, []any{auditOpening(day+"09:00:00.000Z", "FRM-1 the job"), edit("10:02")}},
		{"another ticket read", ticketCheck, checkMissed, []any{auditOpening(day+"09:00:00.000Z", "FRM-1 the job"),
			called("Bash", map[string]any{"command": "x linear read FRM-2"}, day+"10:01:00.000Z"), edit("10:02")}},
		{"a ticket only in the row's cwd", ticketCheck, "unchecked", []any{auditWithCwd(auditOpening(day+"09:00:00.000Z", "a brief"), "/w/FRM-434-x"), edit("10:02")}},
		{"an Edit of the file is no read", lessonsName, checkMissed, []any{opening, called("Edit", map[string]any{"file_path": lessons}, day+"10:01:00.000Z"), read(lessons, "10:02")}},
		{"a Bash line only naming the file is no read", lessonsName, checkMissed, []any{opening,
			called("Bash", map[string]any{"command": "rg foo " + lessons}, day+"10:01:00.000Z"), edit("10:02")}},
		{"a cat of the file reads it", lessonsName, checkRead, []any{opening, called("Bash", map[string]any{"command": "cat " + lessons}, day+"10:01:00.000Z"), edit("10:02")}},
		{"edit-anchored is a first edit", lessonsName, checkMissed, []any{opening,
			called("Bash", map[string]any{"command": "edit-anchored a.go anchor repl"}, day+"10:01:00.000Z"), read(lessons, "10:02")}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := auditStateOf(auditOf(t, c.lines...), c.file); got != c.want {
				t.Errorf("%s reads %q, want %q", c.file, got, c.want)
			}
		})
	}
}

func TestAuditCodieReadsACompactionByTheEditAfterIt(t *testing.T) {
	t.Parallel()
	opening := auditOpening("2026-10-20T09:00:00.000Z", "a brief")
	read := called("Read", map[string]any{"file_path": "/x/skills/crew-codie/how-you-work.md"}, "2026-10-20T10:01:00.000Z")
	dna := called("Read", map[string]any{"file_path": "/x/crew-dna/SKILL.md"}, "2026-10-20T10:01:00.000Z")
	edit := called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-10-20T10:02:00.000Z")
	compact := map[string]any{"type": "system", "subtype": "compact_boundary", "uuid": "c1", "timestamp": "2026-10-20T10:03:00.000Z"}
	cases := []struct {
		name   string
		lines  []any
		misses int
	}{
		{"an edit after with no re-read", []any{opening, dna, read, edit, compact, edit}, 1},
		{"a re-read, then an edit", []any{opening, dna, read, edit, compact, read, edit}, 0},
		{"an edit, then the re-read", []any{opening, dna, read, edit, compact, edit, read}, 1},
		{"no edit after it, it may be live", []any{opening, dna, read, edit, compact}, 0},
		{"opened before how-you-work.md was born", []any{auditOpening("2026-09-20T09:00:00.000Z", "a brief"),
			called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-09-20T10:00:00.000Z"),
			map[string]any{"type": "system", "subtype": "compact_boundary", "uuid": "c2", "timestamp": "2026-09-20T10:03:00.000Z"},
			called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-09-20T10:04:00.000Z")}, 0},
		{"a row seen twice counts once", []any{opening, dna, read, edit, compact, read, edit, compact, edit}, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := auditOf(t, c.lines...).misses(); len(got) != c.misses {
				t.Errorf("misses %v, want %d", got, c.misses)
			}
		})
	}
}

func TestAuditCodieCountsARetroAsNoMiss(t *testing.T) {
	t.Parallel()
	opening := auditOpening("2026-10-20T09:00:00.000Z", "a brief")
	read := called("Read", map[string]any{"file_path": "/x/skills/crew-codie/how-you-work.md"}, "2026-10-20T10:01:00.000Z")
	dna := called("Read", map[string]any{"file_path": "/x/crew-dna/SKILL.md"}, "2026-10-20T10:01:00.000Z")
	retro := called("Write", map[string]any{"file_path": "/l/lane-1-codie-retro.md"}, "2026-10-20T10:02:00.000Z")
	edit := called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-10-20T10:02:00.000Z")
	if s := auditOf(t, opening, read, dna, retro); !s.Retro || len(s.misses()) != 0 {
		t.Errorf("retro %v, misses %v", s.Retro, s.misses())
	}
	if s := auditOf(t, opening, read, dna, edit); s.Retro || len(s.misses()) != 0 {
		t.Errorf("no retro written: retro %v, misses %v", s.Retro, s.misses())
	}
	appended := called("Edit", map[string]any{"file_path": "/l/lane-1-codie-retro.md"}, "2026-10-20T10:02:00.000Z")
	if s := auditOf(t, opening, read, dna, appended); s.Retro {
		t.Error("the rider counts a Write, an Edit of a retro is no retro")
	}
}

func TestAuditCodieReadsARetroAsNoEdit(t *testing.T) {
	t.Parallel()
	opening := auditOpening("2026-10-20T09:00:00.000Z", "a brief")
	written := called("Write", map[string]any{"file_path": "/l/lane-1-codie-retro.md"}, "2026-10-20T10:02:00.000Z")
	appended := called("Edit", map[string]any{"file_path": "/l/lane-1-codie-retro.md"}, "2026-10-20T10:02:00.000Z")
	scripted := called("Bash", map[string]any{"command": "edit-anchored /l/lane-1-codie-retro.md a.txt b.txt"}, "2026-10-20T10:02:00.000Z")
	for name, retro := range map[string]any{"written": written, "appended": appended, "scripted": scripted} {
		if s := auditOf(t, opening, retro); s.FirstEdit != "" || len(s.misses()) != 0 {
			t.Errorf("a retro %s alone: first edit %q, misses %v", name, s.FirstEdit, s.misses())
		}
	}
	const later = "2026-10-20T10:03:00.000Z"
	if s := auditOf(t, opening, written, called("Edit", map[string]any{"file_path": "/x/a.go"}, later)); s.FirstEdit != later || !s.Retro {
		t.Errorf("the code edit is the first edit: %q, retro %v", s.FirstEdit, s.Retro)
	}
}

// a codie transcript under a planted HOME, stamped at its offsets from now
func auditHome(t *testing.T, sessions map[string][]any) string {
	t.Helper()
	home := t.TempDir()
	for id, lines := range sessions {
		write(t, filepath.Join(home, ".claude/projects/p", id+"-rest.jsonl"), jsonLines(t, lines...))
	}
	return home
}

func auditAt(ago time.Duration) string { return time.Now().Add(-ago).UTC().Format(time.RFC3339) }

func auditClean(opened, edited time.Duration) []any {
	return []any{auditOpening(auditAt(opened), "a brief"),
		called("Read", map[string]any{"file_path": "/x/skills/crew-codie/how-you-work.md"}, auditAt(opened)),
		called("Read", map[string]any{"file_path": "/x/crew-dna/SKILL.md"}, auditAt(opened)),
		called("Edit", map[string]any{"file_path": "/x/a.go"}, auditAt(edited))}
}

func auditMissing(opened, edited time.Duration) []any {
	return []any{auditOpening(auditAt(opened), "a brief"),
		called("Read", map[string]any{"file_path": "/x/crew-dna/SKILL.md"}, auditAt(opened)),
		called("Edit", map[string]any{"file_path": "/x/a.go"}, auditAt(edited))}
}

func TestAuditCodieBoardEndsOnTheLessonsCount(t *testing.T) {
	t.Parallel()
	home := auditHome(t, map[string][]any{"aaaaaaaa": auditClean(time.Hour, time.Hour), "bbbbbbbb": auditMissing(time.Hour, time.Hour)})

	got := xIn(t, home, []string{"HOME=" + home}, "fleet", "audit-codie", "--days", "30", "--board")

	var last string
	for line := range strings.SplitSeq(got.stdout, "\n") {
		if strings.Contains(line, " of ") || strings.Contains(line, "🚫") || strings.Contains(line, "retros") {
			last = line
		}
	}
	if got.code != 1 || !strings.Contains(last, "how-you-work.md 1 of 2 read before first edit") {
		t.Errorf("exit %d, last counted line %q:\n%s", got.code, last, got.stdout)
	}
	if !strings.Contains(got.stdout, "🚫 bbbbbbbb") || !strings.Contains(got.stdout, "how-you-work.md: first edit") {
		t.Errorf("want a miss row naming the session and the file:\n%s", got.stdout)
	}
}

func TestAuditCodieJsonNamesEveryMiss(t *testing.T) {
	t.Parallel()
	home := auditHome(t, map[string][]any{"bbbbbbbb": auditMissing(time.Hour, time.Hour)})
	got := xIn(t, home, []string{"HOME=" + home}, "fleet", "audit-codie", "--days", "30", "--json")
	if got.code != 1 || !strings.Contains(got.stdout, `"session":"bbbbbbbb"`) || !strings.Contains(got.stdout, `"file":"how-you-work.md"`) {
		t.Errorf("exit %d:\n%s", got.code, got.stdout)
	}
}

func TestAuditCodieCleanExitsZero(t *testing.T) {
	t.Parallel()
	home := auditHome(t, map[string][]any{"aaaaaaaa": auditClean(time.Hour, time.Hour)})
	if got := xIn(t, home, []string{"HOME=" + home}, "fleet", "audit-codie", "--days", "30", "--json"); got.code != 0 {
		t.Errorf("a clean run exits %d:\n%s", got.code, got.stdout)
	}
}

func TestAuditCodieWindow(t *testing.T) {
	t.Parallel()
	stamp := time.Now().Add(-time.Hour).Format(sinceLayout)
	const day = 24 * time.Hour
	cases := []struct {
		name    string
		session []any
		args    []string
		counted bool
	}{
		{"--days keeps one opened inside", auditClean(day, day), []string{"--days", "3"}, true},
		{"--days drops a touched old one", auditClean(9*day, 9*day), []string{"--days", "3"}, false},
		{"--since keeps one opened before it and edited past it", auditClean(3*time.Hour, 10*time.Minute), []string{"--since", stamp}, true},
		{"--since keeps one edited before it and again past it", append(auditClean(3*time.Hour, 2*time.Hour), called("Edit", map[string]any{"file_path": "/x/b.go"}, auditAt(10*time.Minute))), []string{"--since", stamp}, true},
		{"--since drops one edited before it", auditClean(3*time.Hour, 2*time.Hour), []string{"--since", stamp}, false},
		{"--since drops one with no edit", auditClean(3*time.Hour, time.Hour)[:3], []string{"--since", stamp}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			home := auditHome(t, map[string][]any{"aaaaaaaa": c.session})
			got := xIn(t, home, []string{"HOME=" + home}, append([]string{"fleet", "audit-codie", "--json"}, c.args...)...)
			if counted := strings.Contains(got.stdout, `"codies":1`); got.code != 0 || counted != c.counted {
				t.Errorf("exit %d, counted %v, want %v:\n%s", got.code, counted, c.counted, got.stdout)
			}
		})
	}
}

func TestAuditCodieRefusesAWindowItCannotRead(t *testing.T) {
	t.Parallel()
	home := t.TempDir()
	for _, args := range [][]string{{"--since", "yesterday"}, {"--since", "2026-11-05T21:04:00", "--days", "3"}, {"--days", "0"}} {
		got := xIn(t, home, []string{"HOME=" + home}, append([]string{"fleet", "audit-codie", "--json"}, args...)...)
		if got.code != 2 {
			t.Errorf("%v: exit %d, want a usage refusal:\n%s", args, got.code, got.stdout)
		}
	}
}

func TestAuditCodieHelpNamesTheFilesItChecks(t *testing.T) {
	t.Parallel()
	got := xIn(t, t.TempDir(), nil, "fleet", "audit-codie", "--help")
	for _, want := range []string{"crew-dna", "how-you-work.md", "ticket read"} {
		if !strings.Contains(got.stdout, want) {
			t.Errorf("--help lacks %q:\n%s", want, got.stdout)
		}
	}
}

func TestAuditSkipsASessionThatOnlyMentionsTheCoder(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "session.jsonl")
	write(t, path, jsonLines(t, said("spawn codie with /x:crew-codie")))
	if _, ok := auditSession(path); ok {
		t.Error("a session that names codie in prose counted as codie")
	}
}

func TestAuditCodieReadsABashLineWhateverDirItSitsIn(t *testing.T) {
	t.Parallel()
	const day = "2026-10-20T"
	cases := []struct{ name, command, file, want string }{
		{"cd, then crew-dna by a relative path", "cd /p/skills; cat crew-dna/SKILL.md", "crew-dna", checkRead},
		{"cd into crew-dna", "cd /p/skills/crew-dna && cat SKILL.md", "crew-dna", checkRead},
		{"cd into crew-dna with a slash", "cd crew-dna/; sed -n 1,20p SKILL.md", "crew-dna", checkRead},
		{"cd into crew-codie", "cd crew-codie && cat how-you-work.md", lessonsName, checkRead},
		{"cd and the read on two lines", "cd /p/skills/crew-dna\ncat SKILL.md", "crew-dna", checkRead},
		{"a read, a mention on the next line", "cat a.txt\necho how-you-work.md", lessonsName, checkMissed},
		{"cd into crew-dna, another skill's contract read", "cd crew-dna && cat ../crew-lead/SKILL.md", "crew-dna", checkMissed},
		{"cd into a longer dir", "cd /p/skills/crew-dna-old && cat SKILL.md", "crew-dna", checkMissed},
		{"an absolute path", "head -50 /p/skills/crew-codie/how-you-work.md", lessonsName, checkRead},
		{"after another file", "cat a.txt how-you-work.md", lessonsName, checkRead},
		{"quoted", `cat "/p/skills/crew-dna/SKILL.md"`, "crew-dna", checkRead},
		{"another skill's contract", "cd /p/skills/crew-lead && cat SKILL.md", "crew-dna", checkMissed},
		{"a longer name in front", "cat old-how-you-work.md", lessonsName, checkMissed},
		{"a longer name behind", "cat how-you-work.md.bak", lessonsName, checkMissed},
		{"a name only mentioned beside a read", "cat a.txt; echo how-you-work.md", lessonsName, checkMissed},
		{"a search of the file", "rg rule how-you-work.md", lessonsName, checkMissed},
		{"a write to the file", "echo x > how-you-work.md", lessonsName, checkMissed},
		{"a chained cd past crew-dna", "cd crew-dna && ls && cd ../crew-codie && cat SKILL.md", "crew-dna", checkMissed},
		{"a read verb standing as an argument", "rg head how-you-work.md", lessonsName, checkMissed},
		{"a heredoc line naming the verb", "cat > note.md <<'EOF'\nhead how-you-work.md\nEOF", lessonsName, checkMissed},
		{"a read verb inside quotes", `echo "a; cat how-you-work.md"`, lessonsName, checkMissed},
		{"a file of that name elsewhere", "cat /tmp/how-you-work.md", lessonsName, checkMissed},
		{"a file of that name after a cd elsewhere", "cd /tmp && cat how-you-work.md", lessonsName, checkMissed},
		{"an edit in place", "sed -i '' s/a/b/ /p/skills/crew-codie/how-you-work.md", lessonsName, checkMissed},
		{"a read thrown away", "cat /p/skills/crew-codie/how-you-work.md >/dev/null", lessonsName, checkMissed},
		{"a read thrown away, spaced", "cat /p/skills/crew-codie/how-you-work.md > /dev/null", lessonsName, checkMissed},
		{"a read with its errors thrown away", "cat /p/skills/crew-codie/how-you-work.md 2>/dev/null", lessonsName, checkRead},
		{"a quoted name holding a space", `tail "old how-you-work.md"`, lessonsName, checkMissed},
		{"a quoted path holding a space", `cat "/p/my skills/crew-codie/how-you-work.md"`, lessonsName, checkRead},
		{"a read after then", "if [ -f f ]; then cat /p/skills/crew-dna/SKILL.md; fi", "crew-dna", checkRead},
		{"a read after do", "for f in a; do cat /p/skills/crew-dna/SKILL.md; done", "crew-dna", checkRead},
		{"a read behind an env word", "FOO=1 cat /p/skills/crew-dna/SKILL.md", "crew-dna", checkRead},
		{"a read behind a timeout", "timeout 5 cat /p/skills/crew-dna/SKILL.md", "crew-dna", checkRead},
		{"a read after a comment's apostrophe", "# don't skip\ncat /p/skills/crew-dna/SKILL.md", "crew-dna", checkRead},
		{"a read after an escaped quote", "echo \"a \\\" b\"; cat /p/skills/crew-dna/SKILL.md", "crew-dna", checkRead},
		{"a read after a here-string", "grep x <<< foo\ncat /p/skills/crew-dna/SKILL.md", "crew-dna", checkRead},
		{"a read after shell arithmetic", "echo $((1<<2))\ncat /p/skills/crew-dna/SKILL.md", "crew-dna", checkRead},
		{"a cd inside a subshell stays in it", "(cd /p/skills/crew-dna && ls); cat SKILL.md", "crew-dna", checkMissed},
		{"a read after a heredoc", "cat > note.md <<'EOF'\nnote\nEOF\ncat /p/skills/crew-codie/how-you-work.md", lessonsName, checkRead},
		{"a read inside a substitution", "x=$(cat /p/skills/crew-codie/how-you-work.md)", lessonsName, checkRead},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			s := auditOf(t, auditOpening(day+"09:00:00.000Z", "a brief"),
				called("Bash", map[string]any{"command": c.command}, day+"10:01:00.000Z"),
				called("Edit", map[string]any{"file_path": "/x/a.go"}, day+"10:02:00.000Z"))
			if got := auditStateOf(s, c.file); got != c.want {
				t.Errorf("%s reads %q, want %q", c.file, got, c.want)
			}
		})
	}
}

func TestAuditCodieReadsAReadOrALoadByItsFile(t *testing.T) {
	t.Parallel()
	const day = "2026-10-20T"
	cases := []struct {
		name string
		call map[string]any
		file string
		want string
	}{
		{"a Read of the contract's own file", called("Read", map[string]any{"file_path": "/p/skills/crew-codie/how-you-work.md"}, day+"10:01:00.000Z"), lessonsName, checkRead},
		{"a Read of a file of that name elsewhere", called("Read", map[string]any{"file_path": "/tmp/how-you-work.md"}, day+"10:01:00.000Z"), lessonsName, checkMissed},
		{"a Skill load of crew-dna", called("Skill", map[string]any{"skill": "x:crew-dna"}, day+"10:01:00.000Z"), "crew-dna", checkRead},
		{"a Skill load of another", called("Skill", map[string]any{"skill": "x:crew-lead"}, day+"10:01:00.000Z"), "crew-dna", checkMissed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			s := auditOf(t, auditOpening(day+"09:00:00.000Z", "a brief"), c.call,
				called("Edit", map[string]any{"file_path": "/x/a.go"}, day+"10:02:00.000Z"))
			if got := auditStateOf(s, c.file); got != c.want {
				t.Errorf("%s reads %q, want %q", c.file, got, c.want)
			}
		})
	}
}

func TestAuditCodieReadsTheTicketFromTheSkillCallsArgs(t *testing.T) {
	t.Parallel()
	const at = "2026-11-05T10:00:00.000Z"
	s := auditOf(t, said("carry on"),
		called("Skill", map[string]any{"skill": "x:crew-codie", "args": "FRM-1 the job"}, at),
		called("Bash", map[string]any{"command": "x linear read FRM-1 --comments"}, at),
		called("Edit", map[string]any{"file_path": "/x/a.go"}, at))
	if got := auditStateOf(s, ticketCheck); got != checkRead {
		t.Errorf("the ticket check reads %q, want %q", got, checkRead)
	}
}

func TestAuditCountsASkillCallInTheOpeningRows(t *testing.T) {
	t.Parallel()
	const at = "2026-11-05T10:00:00.000Z"
	skill := func(id string) map[string]any { return called("Skill", map[string]any{"skill": id}, at) }
	hookRows := func(n int) []any {
		rows := make([]any, n)
		for i := range rows {
			rows[i] = map[string]any{"type": "attachment", "timestamp": at}
		}
		return rows
	}
	cases := []struct {
		name  string
		rows  []any
		codie bool
	}{
		{"the call right after the brief", []any{skill("x:crew-codie")}, true},
		{"the call at row 41, where hook rows pushed a real one", append(hookRows(39), skill("x:crew-codie")), true},
		{"the id before 10-29", []any{skill("x:crew-coder")}, true}, // read-both
		{"another member's contract", []any{skill("x:crew-sixth-sense")}, false},
		{"a Bash line naming the skill", []any{called("Bash", map[string]any{"command": "echo x:crew-codie"}, at)}, false},
		{"a read of the contract", []any{called("Read", map[string]any{"file_path": "/p/skills/crew-codie/SKILL.md"}, at)}, false},
		{"the call deep in a coordinator's session", append(hookRows(codieOpeningRows), skill("x:crew-codie")), false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			path := filepath.Join(t.TempDir(), "session.jsonl")
			write(t, path, jsonLines(t, append([]any{said("a brief for FRM-1")}, c.rows...)...))
			s, ok := auditSession(path)
			if ok != c.codie {
				t.Fatalf("read as codie: %v, want %v", ok, c.codie)
			}
			if ok && auditStateOf(s, ticketCheck) == "unchecked" {
				t.Error("the brief's ticket went unread: its check is missing")
			}
		})
	}
}

func TestOpsRoleReadsOldSkillIDs(t *testing.T) {
	t.Parallel()
	for id, want := range map[string]string{
		"x:crew-codie":       "codie",
		"x:crew-coder":       "codie", // read-both
		"x:crew-sixth-sense": "sixth-sense",
		"x:crew-verifier":    "sixth-sense", // read-both
	} {
		if got := opsRole("/tmp", id, "a.jsonl", "untitled"); got != want {
			t.Errorf("opsRole(%s) = %s, want %s", id, got, want)
		}
	}
}
