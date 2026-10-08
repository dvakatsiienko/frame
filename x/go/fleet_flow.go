package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

type tagCount struct {
	Tag      string `json:"tag"`
	Count    int    `json:"count"`
	Baseline int    `json:"baseline"`
}

type guardCount struct {
	Refused int `json:"refused"`
	Escaped int `json:"escaped"`
}

type guardRule struct {
	Rule string `json:"rule"`
	guardCount
}

type guardToday struct {
	guardCount
	Sessions int         `json:"sessions"`
	Rules    []guardRule `json:"rules"`
}

type prMedian struct {
	Repo     string   `json:"repo"`
	Minutes  *float64 `json:"median_min"`
	PRs      int      `json:"prs"`
	Baseline int      `json:"baseline"`
}

type fileCount struct {
	File  string `json:"file"`
	Count int    `json:"count"`
}

type flowData struct {
	Days           int         `json:"days"`
	Since          string      `json:"since"`
	Tags           []tagCount  `json:"tags"`
	BareRuns       int         `json:"bare_runs"`
	BareSessions   int         `json:"bare_sessions"`
	BriefLed       int         `json:"brief_led"`
	FalseFires     int         `json:"false_fires"`
	Guard          *guardToday `json:"guard"`
	PRs            []prMedian  `json:"prs"`
	KnowledgeReads []fileCount `json:"knowledge_reads"`
}

// the counts before tagging began (FRM-316), and each repo's pr median in minutes before the flow work
var (
	flowTags     = []tagCount{{Tag: "#dima-caught", Baseline: 23}, {Tag: "#brief", Baseline: 47}}
	flowRepos    = []prMedian{{Repo: "frame", Baseline: 36}, {Repo: "bytes", Baseline: 25}}
	crewSkills   = []string{"x:crew-coder", "x:crew-verifier"}
	bareRun      = regexp.MustCompile(`\bclaude\b[^|;&\n]*--safe-mode`)
	knowledgeAt  = regexp.MustCompile(`/docs/knowledge/(.+)$`)
	guardStoreRe = regexp.MustCompile(`^(x-mod-)?guard_.*\.json$`)
	flawlogName  = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}-.*\.md$`)
)

// fleetFlow is the fleet-flow done test (FRM-309): tagged flawlog lines, bare cc runs, crew-skill loads,
// today's guard counts, the pr open → merge median per repo, and Reads per docs/knowledge file
func fleetFlow(r *Run, _ []string, flags Flags) (any, error) {
	days, err := daysFlag(flags, "fleet flow", 14)
	if err != nil {
		return nil, err
	}
	// flawlog files are named by local date; today is day 1 of the window
	now := time.Now()
	start := time.Date(now.Year(), now.Month(), now.Day()-(days-1), 0, 0, 0, 0, time.Local)
	since := start.Format(time.DateOnly)
	home, _ := os.UserHomeDir()
	flawlog := filepath.Join(home, ".claude", "shelf", "flawlog")
	if _, err := os.Stat(flawlog); err != nil {
		return nil, &Fail{Msg: "no flawlog dir at " + flawlog, Next: "ls ~/.claude/shelf"}
	}
	data := flowData{Days: days, Since: since, Tags: flawlogCounts(flawlog, since), PRs: []prMedian{}}
	var knowledge []string
	root := knowledgeRoot()
	filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err == nil && !entry.IsDir() && strings.HasSuffix(path, ".md") {
			rel, _ := filepath.Rel(root, path)
			knowledge = append(knowledge, rel)
		}
		return nil
	})
	counts := transcriptCounts(start, knowledge)
	data.BareRuns, data.BareSessions, data.BriefLed, data.FalseFires = counts.bareRuns, counts.bareSessions, counts.briefLed, counts.falseFires
	data.KnowledgeReads = counts.reads
	if store := filepath.Join(home, ".claude", "plugins", "store"); exists(store) {
		today := guardDay(store, now.Format(time.DateOnly))
		data.Guard = &today
	}
	for _, repo := range flowRepos {
		prs, err := mergedPRs(repo.Repo, since)
		if err != nil {
			return nil, err
		}
		repo.PRs = len(prs)
		repo.Minutes = medianMinutes(prs)
		data.PRs = append(data.PRs, repo)
	}
	if r.human {
		r.Board(textBoard("fleet flow", fmt.Sprintf("last %d days, since %s", days, since), flowLines(data)))
	}
	return data, nil
}

func flowLines(d flowData) []string {
	lines := []string{fmt.Sprintf("flow report — last %d days, since %s", d.Days, d.Since)}
	for _, t := range d.Tags {
		lines = append(lines, fmt.Sprintf("- %s: %d (baseline %d)", t.Tag, t.Count, t.Baseline))
	}
	lines = append(lines,
		fmt.Sprintf("- bare runs: %d over %d sessions (`claude … --safe-mode` in a Bash call)", d.BareRuns, d.BareSessions),
		fmt.Sprintf("- crew-skill loads: %d — brief-led %d, false fires %d", d.BriefLed+d.FalseFires, d.BriefLed, d.FalseFires))
	if g := d.Guard; g != nil {
		lines = append(lines, fmt.Sprintf("- guard: %d refusals · %d escapes today, %d sessions", g.Refused, g.Escaped, g.Sessions))
		var rules []string
		for _, rule := range g.Rules {
			rules = append(rules, fmt.Sprintf("%s %d/%d", rule.Rule, rule.Refused, rule.Escaped))
		}
		if len(rules) > 0 {
			lines = append(lines, "- guard by rule, refused/escaped: "+strings.Join(rules, ", "))
		}
	} else {
		lines = append(lines, "- guard: no plugin store at ~/.claude/plugins/store")
	}
	lines = append(lines, "- pr open → merge median, renovate excluded:")
	for _, p := range d.PRs {
		shown := "none"
		if p.Minutes != nil {
			shown = fmt.Sprintf("%d min", roundHalfUp(*p.Minutes))
		}
		lines = append(lines, fmt.Sprintf("  - %s: %s over %d prs (baseline %d min)", p.Repo, shown, p.PRs, p.Baseline))
	}
	lines = append(lines, "- docs/knowledge Reads, most-read first:")
	for _, k := range d.KnowledgeReads {
		lines = append(lines, fmt.Sprintf("  - %s: %d", k.File, k.Count))
	}
	return lines
}

// the tagged list lines of the flawlog files dated from `since` on; a file belongs to the day its name starts with
func flawlogCounts(dir, since string) []tagCount {
	var lines []string
	entries, _ := os.ReadDir(dir)
	for _, entry := range entries {
		name := entry.Name()
		if !flawlogName.MatchString(name) || name[:10] < since {
			continue
		}
		body, _ := os.ReadFile(filepath.Join(dir, name))
		for line := range strings.SplitSeq(string(body), "\n") {
			if strings.HasPrefix(strings.TrimLeft(line, " \t"), "- ") {
				lines = append(lines, line)
			}
		}
	}
	counts := slices.Clone(flowTags)
	for i := range counts {
		for _, line := range lines {
			if hasTag(line, counts[i].Tag) {
				counts[i].Count++
			}
		}
	}
	return counts
}

// the tag stands alone: no word character, # or - right before it, no word character or - right after
func hasTag(line, tag string) bool {
	word := func(c byte) bool {
		return c == '_' || c >= '0' && c <= '9' || c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
	}
	for at := 0; ; {
		i := strings.Index(line[at:], tag)
		if i < 0 {
			return false
		}
		i += at
		end := i + len(tag)
		before := i == 0 || !(word(line[i-1]) || line[i-1] == '#' || line[i-1] == '-')
		after := end == len(line) || !(word(line[end]) || line[end] == '-')
		if before && after {
			return true
		}
		at = i + 1
	}
}

type flowTranscripts struct {
	bareRuns, bareSessions, briefLed, falseFires int
	reads                                        []fileCount
}

type flowLine struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
	Message   struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

type flowBlock struct {
	Type  string `json:"type"`
	Text  string `json:"text"`
	Name  string `json:"name"`
	Input struct {
		Command  string `json:"command"`
		FilePath string `json:"file_path"`
		Skill    string `json:"skill"`
	} `json:"input"`
}

// bare cc runs, crew-skill loads and Reads of each knowledge file, counting tool calls from `start` on
func transcriptCounts(start time.Time, knowledge []string) flowTranscripts {
	var counts flowTranscripts
	reads := map[string]int{}
	for _, file := range knowledge {
		reads[file] = 0
	}
	for _, path := range sessionFiles(start, 0) {
		lines := transcriptLines(path)
		joined := bytes.Join(lines, []byte("\n"))
		if !bytes.Contains(joined, []byte("--safe-mode")) && !bytes.Contains(joined, []byte(`"Skill"`)) && !bytes.Contains(joined, []byte("docs/knowledge/")) {
			continue
		}
		named := map[string]bool{}
		bare := 0
		for _, raw := range lines {
			crew := slices.ContainsFunc(crewSkills, func(s string) bool { return bytes.Contains(raw, []byte(s)) })
			if !crew && !bytes.Contains(raw, []byte("--safe-mode")) && !bytes.Contains(raw, []byte("docs/knowledge/")) {
				continue
			}
			var line flowLine
			if json.Unmarshal(raw, &line) != nil {
				continue
			}
			var text string
			var blocks []flowBlock
			isText := json.Unmarshal(line.Message.Content, &text) == nil
			if !isText {
				_ = json.Unmarshal(line.Message.Content, &blocks)
			}
			if line.Type == "user" {
				said := text
				if !isText {
					var parts []string
					for _, b := range blocks {
						if b.Type == "text" {
							parts = append(parts, b.Text)
						} else {
							parts = append(parts, "")
						}
					}
					said = strings.Join(parts, "\n")
				}
				for _, s := range crewSkills {
					if strings.Contains(said, s) {
						named[s] = true
					}
				}
				continue
			}
			if line.Type != "assistant" || isText {
				continue
			}
			at, err := time.Parse(time.RFC3339Nano, line.Timestamp)
			if err != nil || at.Before(start) {
				continue
			}
			for _, b := range blocks {
				if b.Type != "tool_use" {
					continue
				}
				if b.Name == "Read" {
					if m := knowledgeAt.FindStringSubmatch(b.Input.FilePath); m != nil {
						if _, ok := reads[m[1]]; ok {
							reads[m[1]]++
						}
					}
				}
				if b.Name == "Bash" && bareRun.MatchString(b.Input.Command) {
					bare++
				}
				if b.Name == "Skill" && slices.Contains(crewSkills, b.Input.Skill) {
					if named[b.Input.Skill] {
						counts.briefLed++
					} else {
						counts.falseFires++
					}
				}
			}
		}
		counts.bareRuns += bare
		if bare > 0 {
			counts.bareSessions++
		}
	}
	counts.reads = []fileCount{}
	for file, count := range reads {
		counts.reads = append(counts.reads, fileCount{File: file, Count: count})
	}
	slices.SortFunc(counts.reads, byCalls(func(f fileCount) int { return f.Count }, func(f fileCount) string { return f.File }))
	return counts
}

// one day's refusals and escapes, summed from x-mod-guard's `day:<yyyy-mm-dd>:<session>` keys, the store
// it kept as `guard` before the rename included; a file mid-write is skipped
func guardDay(dir, day string) guardToday {
	prefix := "day:" + day + ":"
	sessions := map[string]bool{}
	today := guardToday{Rules: []guardRule{}}
	index := map[string]int{}
	entries, _ := os.ReadDir(dir)
	for _, entry := range entries {
		if !guardStoreRe.MatchString(entry.Name()) {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		keys, values, err := orderedKeys(raw)
		if err != nil {
			continue
		}
		for _, key := range keys {
			if !strings.HasPrefix(key, prefix) {
				continue
			}
			sessions[key[len(prefix):]] = true
			var count struct {
				guardCount
				Rules json.RawMessage `json:"rules"`
			}
			_ = json.Unmarshal(values[key], &count)
			today.Refused += count.Refused
			today.Escaped += count.Escaped
			if len(count.Rules) == 0 {
				continue
			}
			ruleKeys, ruleValues, err := orderedKeys(count.Rules)
			if err != nil {
				continue
			}
			for _, name := range ruleKeys {
				var n guardCount
				_ = json.Unmarshal(ruleValues[name], &n)
				i, seen := index[name]
				if !seen {
					i = len(today.Rules)
					index[name] = i
					today.Rules = append(today.Rules, guardRule{Rule: name})
				}
				today.Rules[i].Refused += n.Refused
				today.Rules[i].Escaped += n.Escaped
			}
		}
	}
	today.Sessions = len(sessions)
	slices.SortStableFunc(today.Rules, func(a, b guardRule) int {
		return (b.Refused + b.Escaped) - (a.Refused + a.Escaped)
	})
	return today
}

type mergedPR struct {
	CreatedAt time.Time `json:"createdAt"`
	MergedAt  time.Time `json:"mergedAt"`
}

// the prs merged since the window opened; renovate auto-merges in seconds and is not the flow measured
func mergedPRs(repo, since string) ([]mergedPR, error) {
	got, _ := run("", nil, "", "gh", "pr", "list", "--repo", "dvakatsiienko/"+repo, "--state", "merged",
		"--search", "merged:>="+since+" -author:app/renovate", "--limit", "500", "--json", "createdAt,mergedAt")
	var prs []mergedPR
	if !got.ok || json.Unmarshal([]byte(got.out), &prs) != nil {
		return nil, &Fail{Msg: "gh pr list failed for " + repo + ": " + strings.SplitN(got.log, "\n", 2)[0], Next: "gh auth status"}
	}
	return prs, nil
}

func medianMinutes(prs []mergedPR) *float64 {
	if len(prs) == 0 {
		return nil
	}
	var minutes []float64
	for _, pr := range prs {
		minutes = append(minutes, pr.MergedAt.Sub(pr.CreatedAt).Minutes())
	}
	m := median(minutes)
	return &m
}
