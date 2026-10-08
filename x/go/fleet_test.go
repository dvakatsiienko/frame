package main

import (
	"encoding/json"
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

var crewLoad = called("Skill", map[string]any{"skill": "x:crew-coder"}, flowAt)

func flowCounts(t *testing.T, lines ...any) flowTranscripts {
	session(t, lines...)
	return transcriptCounts(flowStart, []string{"authoring-skill.md", "models.md"})
}

func TestFlawlogCountsTaggedLinesInTheWindow(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "2026-10-05-day.md"), strings.Join([]string{
		"# flawlog — 2026-10-05",
		"- the brief named a banned path #brief",
		"  - the exit lines lived in the coder brief only (`#brief`) #dima-caught",
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
	cases := []struct {
		name, said           string
		briefLed, falseFires int
	}{
		{"brief-led when an earlier message names the skill", "load `x:crew-coder` first", 1, 0},
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
	got := flowCounts(t, called("Read", map[string]any{"file_path": "/Users/dima/frame/docs/knowledge/models.md"}, flowAt))
	want := `[{"file":"models.md","count":1},{"file":"authoring-skill.md","count":0}]`
	if marshal(got.reads) != want {
		t.Errorf("reads %s, want %s", marshal(got.reads), want)
	}
}

func TestGuardDaySumsTheDaysKeysOfEveryGuardStore(t *testing.T) {
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
	usage := map[string]int{"input_tokens": 10, "output_tokens": 5}
	s := opsSessionOf(t, assistantStep("m1", "2026-10-07T10:00:00Z", usage, "tool_use"), assistantStep("m1", "2026-10-07T10:00:01Z", usage, "tool_use"))
	if s.Steps != 1 || s.Tokens != 15 {
		t.Errorf("steps %d, tokens %d", s.Steps, s.Tokens)
	}
}

func TestOpsSumsInputCacheAndOutputTokens(t *testing.T) {
	usage := map[string]int{"input_tokens": 1, "cache_creation_input_tokens": 100, "cache_read_input_tokens": 1000, "output_tokens": 10}
	if s := opsSessionOf(t, assistantStep("m1", "2026-10-07T10:00:00Z", usage, "end_turn")); s.Tokens != 1111 {
		t.Errorf("tokens %d, want 1111", s.Tokens)
	}
}

func TestOpsCostsACclioBootUpToItsFirstEndTurn(t *testing.T) {
	boot := map[string]any{"type": "user", "timestamp": "2026-10-07T10:00:00Z", "cwd": "/Users/dima/frame/cclio",
		"message": map[string]any{"content": "<command-name>/cclio:boot</command-name><command-args>mini</command-args>"}}
	usage := map[string]int{"output_tokens": 10}
	s := opsSessionOf(t, boot,
		assistantStep("m1", "2026-10-07T10:00:05Z", usage, "tool_use"), assistantStep("m1", "2026-10-07T10:00:06Z", usage, "tool_use"),
		assistantStep("m2", "2026-10-07T10:00:30Z", map[string]int{"output_tokens": 5}, "end_turn"),
		assistantStep("m3", "2026-10-07T10:01:00Z", usage, "end_turn"))
	if want := `{"kind":"mini","id":"a.jsonl","tokens":15,"seconds":30}`; s.Role != "cclio" || marshal(s.Boot) != want {
		t.Errorf("role %s, boot %s, want %s", s.Role, marshal(s.Boot), want)
	}
}

func TestOpsAddsTheCoderAndVerifierOfOneTicket(t *testing.T) {
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

func TestAuditChecksTheLessonsReadComesFirst(t *testing.T) {
	opening := said("<command-name>/x:crew-coder</command-name> FRM-1")
	read := called("Read", map[string]any{"file_path": "/x/crew-coder/how-you-work.md"}, "2026-10-05T10:01:00.000Z")
	edit := called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-10-05T10:02:00.000Z")
	compact := map[string]any{"type": "system", "subtype": "compact_boundary", "timestamp": "2026-10-05T10:03:00.000Z"}
	cases := []struct {
		name      string
		lines     []any
		inOrder   bool
		compacted string
	}{
		{"read, then edit", []any{opening, read, edit}, true, ""},
		{"edit before any read", []any{opening,
			called("Edit", map[string]any{"file_path": "/x/a.go"}, "2026-10-05T10:01:00.000Z"),
			called("Read", map[string]any{"file_path": "/x/crew-coder/how-you-work.md"}, "2026-10-05T10:02:00.000Z")}, false, ""},
		{"a compaction with no re-read", []any{opening, read, edit, compact}, true, "🚫 compact 10:03:00"},
		{"a compaction re-read", []any{opening, read, compact, read}, true, "✅ compact 10:03:00"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "session.jsonl")
			write(t, path, jsonLines(t, c.lines...))
			s, ok := auditSession(path)
			row := auditRow(s)
			if !ok || s.InOrder != c.inOrder || c.compacted != "" && !strings.Contains(row, c.compacted) {
				t.Errorf("coder %v, in order %v, row %q", ok, s.InOrder, row)
			}
		})
	}
}

func TestAuditSkipsASessionThatOnlyMentionsTheCoder(t *testing.T) {
	path := filepath.Join(t.TempDir(), "session.jsonl")
	write(t, path, jsonLines(t, said("spawn a coder with /x:crew-coder")))
	if _, ok := auditSession(path); ok {
		t.Error("a session that names the coder in prose counted as a coder")
	}
}
