package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestFormatResetIn(t *testing.T) {
	cases := []struct {
		seconds int64
		want    string
	}{
		{0, ""},
		{-5, ""},
		{59, "0m"},
		{35 * 60, "35m"},
		{116 * 60, "1h 56m"},
		{(24*60 + 1) * 60, "1d 0h 01m"},
		{(5*24*60 + 5*60) * 60, "5d 5h 00m"},
	}
	for _, c := range cases {
		if got := formatResetIn(c.seconds); got != c.want {
			t.Errorf("formatResetIn(%d) = %q, want %q", c.seconds, got, c.want)
		}
	}
}

func TestCacheCold(t *testing.T) {
	dir := t.TempDir()
	transcript := filepath.Join(dir, "transcript.jsonl")
	if err := os.WriteFile(transcript, []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}

	if cacheCold(transcript) {
		t.Error("fresh transcript reported cold")
	}

	old := time.Now().Add(-cacheTTL - time.Minute)
	if err := os.Chtimes(transcript, old, old); err != nil {
		t.Fatal(err)
	}
	if !cacheCold(transcript) {
		t.Error("transcript idle past TTL not reported cold")
	}

	if cacheCold("") {
		t.Error("empty path reported cold")
	}
	if cacheCold(filepath.Join(dir, "missing.jsonl")) {
		t.Error("missing file reported cold")
	}
}

func TestToSuperscript(t *testing.T) {
	cases := map[int]string{0: "⁰", 1: "¹", 9: "⁹", 12: "¹²", 205: "²⁰⁵"}
	for n, want := range cases {
		if got := toSuperscript(n); got != want {
			t.Errorf("toSuperscript(%d) = %q, want %q", n, got, want)
		}
	}
}

func TestParseGitStats(t *testing.T) {
	ins, del := parseGitStats(" 2 files changed, 68 insertions(+), 59 deletions(-)")
	if ins != 68 || del != 59 {
		t.Errorf("got %d/%d, want 68/59", ins, del)
	}
	ins, del = parseGitStats(" 1 file changed, 1 insertion(+)")
	if ins != 1 || del != 0 {
		t.Errorf("got %d/%d, want 1/0", ins, del)
	}
	ins, del = parseGitStats("")
	if ins != 0 || del != 0 {
		t.Errorf("got %d/%d, want 0/0", ins, del)
	}
}

// The four render branches were only reachable through a live repository until
// reading moved behind readGitStatus.
func TestRenderGitStatusBranches(t *testing.T) {
	cases := []struct {
		name  string
		st    GitStatus
		want  []string
		avoid []string
	}{
		{
			name:  "not a repo",
			st:    GitStatus{},
			want:  []string{"no git"},
			avoid: []string{"clean"},
		},
		{
			name:  "clean repo",
			st:    GitStatus{IsRepo: true, Head: "main"},
			want:  []string{"clean", "main"},
			avoid: []string{"+", "✓"},
		},
		{
			name: "staged only carries the check mark",
			st: GitStatus{IsRepo: true, Head: "main", Staged: 2, Entries: 2,
				StagedInsertions: 10, StagedDeletions: 3},
			want:  []string{"(2)", "+10", "-3", "✓"},
			avoid: []string{"(0)"},
		},
		{
			name: "unstaged only omits the check mark",
			st: GitStatus{IsRepo: true, Head: "main", Modified: 1, Entries: 1,
				UnstagedInsertions: 4, UnstagedDeletions: 1},
			want:  []string{"(1)", "+4", "-1"},
			avoid: []string{"✓"},
		},
		{
			name: "both counts every touched path once",
			st: GitStatus{IsRepo: true, Head: "main", Staged: 1, Modified: 1, Entries: 2,
				Untracked: 1, StagedInsertions: 10, StagedDeletions: 2,
				UnstagedInsertions: 5, UnstagedDeletions: 1},
			// Entries + Untracked = 3, and the net is +12 with both signs present.
			want: []string{"(3)", "+10", "-2", "✓", "+5", "-1", "+12"},
		},
		{
			name: "stash rides along",
			st:   GitStatus{IsRepo: true, Head: "main", Stash: 2},
			want: []string{"stash: 2"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := joinSegments(renderGitStatus(tc.st)...)
			for _, want := range tc.want {
				if !strings.Contains(got, want) {
					t.Errorf("missing %q in %q", want, got)
				}
			}
			for _, avoid := range tc.avoid {
				if strings.Contains(got, avoid) {
					t.Errorf("unexpected %q in %q", avoid, got)
				}
			}
		})
	}
}

func TestUntrackedLineCountResolvesAgainstRepoDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "new.txt"), []byte("a\nb\nc\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	// git reports untracked paths repo-relative; counting them from the process
	// cwd found nothing whenever the shell sat outside the session's repo.
	if got := untrackedLineCount(dir, []string{"new.txt"}); got != 3 {
		t.Errorf("got %d, want 3", got)
	}
	if got := untrackedLineCount(dir, []string{"absent.txt"}); got != 0 {
		t.Errorf("got %d, want 0", got)
	}
}

func TestParseGitStatusV2(t *testing.T) {
	fixture := strings.Join([]string{
		"# branch.oid d421b9c253d183b251b866cb34e0bba5e70a9949",
		"# branch.head main",
		"# branch.upstream origin/main",
		"# branch.ab +3 -2",
		"# stash 2",
		"1 .M N... 100644 100644 100644 aaa bbb modified.txt",
		"1 A. N... 000000 100644 100644 000 ccc staged.txt",
		"1 MM N... 100644 100644 100644 ddd eee both.txt",
		"u UU N... 100644 100644 100644 100644 fff ggg hhh conflicted.txt",
		"? untracked.txt",
		"? another.txt",
	}, "\n")

	st := parseGitStatusV2(fixture)
	if !st.IsRepo || st.Head != "main" || !st.HasUpstream {
		t.Fatalf("header parse failed: %+v", st)
	}
	if st.Ahead != 3 || st.Behind != 2 || st.Stash != 2 {
		t.Errorf("ahead/behind/stash = %d/%d/%d, want 3/2/2", st.Ahead, st.Behind, st.Stash)
	}
	if st.Staged != 2 || st.Modified != 3 || st.Untracked != 2 || st.Entries != 4 {
		t.Errorf("staged/modified/untracked/entries = %d/%d/%d/%d, want 2/3/2/4",
			st.Staged, st.Modified, st.Untracked, st.Entries)
	}
	if len(st.UntrackedPaths) != 2 || st.UntrackedPaths[0] != "untracked.txt" {
		t.Errorf("untracked paths = %v", st.UntrackedPaths)
	}
}

func TestParseGitStatusV2Detached(t *testing.T) {
	st := parseGitStatusV2("# branch.oid abc\n# branch.head (detached)\n")
	if st.Head != "" || st.HasUpstream {
		t.Errorf("detached parse failed: %+v", st)
	}
}

func TestFormatSyncIndicator(t *testing.T) {
	if got := formatSyncIndicator(GitStatus{HasUpstream: false, Ahead: 1}); got != "" {
		t.Errorf("no upstream should render empty, got %q", got)
	}
	diverged := formatSyncIndicator(GitStatus{HasUpstream: true, Ahead: 1, Behind: 2})
	if !strings.Contains(diverged, "↑¹") || !strings.Contains(diverged, "↓²") {
		t.Errorf("diverged = %q, want ↑¹ and ↓²", diverged)
	}
	ahead := formatSyncIndicator(GitStatus{HasUpstream: true, Ahead: 12})
	if !strings.Contains(ahead, "↑¹²") {
		t.Errorf("ahead = %q, want ↑¹²", ahead)
	}
}

func TestExtractVersions(t *testing.T) {
	if got := extractVersionFromModelID("claude-opus-4-7-20251001"); got != "4.7" {
		t.Errorf("dated id = %q, want 4.7", got)
	}
	if got := extractVersionFromModelID("claude-fable-5"); got != "5" {
		t.Errorf("fable id = %q, want 5", got)
	}
	if got := extractVersionFromDisplayName("Opus 4.7 (1M context)"); got != "4.7" {
		t.Errorf("display = %q, want 4.7", got)
	}
	if got := extractModelFamily("Fable 5"); got != "Fable" {
		t.Errorf("family = %q, want Fable", got)
	}
}

func TestApplyGradient(t *testing.T) {
	// Rune-based interpolation: two runes must span the full stop range.
	got := applyGradient("éé")
	first := gradientStops[0]
	last := gradientStops[len(gradientStops)-1]
	if !strings.Contains(got, fmt.Sprintf("38;2;%d;%d;%d", first[0], first[1], first[2])) {
		t.Errorf("first rune should get the first stop, got %q", got)
	}
	if !strings.Contains(got, fmt.Sprintf("38;2;%d;%d;%d", last[0], last[1], last[2])) {
		t.Errorf("last rune should get the last stop, got %q", got)
	}
	if applyGradient("x") == "" || applyGradient("") != "" {
		t.Error("single-rune and empty inputs must not panic or misrender")
	}
}

func TestResolveSessionName(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
	write("100.json", `{"sessionId":"aaa-bbb","name":"alpha-thread"}`)
	write("200.json", `{"sessionId":"ccc-ddd","name":"beta-thread"}`)
	write("300.json", `broken json`)
	write("notes.txt", `ignored`)

	if got := resolveSessionName(dir, "ccc-ddd"); got != "beta-thread" {
		t.Errorf("got %q, want beta-thread", got)
	}
	if got := resolveSessionName(dir, "zzz"); got != "" {
		t.Errorf("unknown id should be empty, got %q", got)
	}
	if got := resolveSessionName(dir, ""); got != "" {
		t.Errorf("empty id should be empty, got %q", got)
	}
	if got := resolveSessionName(filepath.Join(dir, "missing"), "aaa-bbb"); got != "" {
		t.Errorf("missing dir should be empty, got %q", got)
	}
}

func TestKebabLabel(t *testing.T) {
	cases := map[string]string{
		"Check auto capture enabled status": "check-auto-capture-enabled-status",
		"already-kebab":                     "already-kebab",
		"  Spaced   Out  ":                  "spaced-out",
		"":                                  "",
	}
	for in, want := range cases {
		if got := kebabLabel(in); got != want {
			t.Errorf("kebabLabel(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestProgressBarWidth(t *testing.T) {
	cells := func(bar string) (filled, empty int) {
		return strings.Count(bar, "▮"), strings.Count(bar, "▯")
	}
	f, e := cells(progressBar(0))
	if f != 0 || e != barWidth {
		t.Errorf("0%% = %d filled / %d empty, want 0/%d", f, e, barWidth)
	}
	f, e = cells(progressBar(50))
	if want := int(math.Round(0.5 * barWidth)); f != want || f+e != barWidth {
		t.Errorf("50%% = %d filled / %d empty, want %d/%d", f, e, want, barWidth-want)
	}
	f, e = cells(progressBar(100))
	if f != barWidth || e != 0 {
		t.Errorf("100%% = %d filled / %d empty, want %d/0", f, e, barWidth)
	}
	f, e = cells(progressBar(150))
	if f != barWidth || e != 0 {
		t.Errorf("overflow must clamp, got %d/%d", f, e)
	}
}

func TestContextTokens(t *testing.T) {
	// Fallback path: pct × assumed 200k window.
	if got := contextTokens(&ContextWindowInfo{}, 7); got != "~14k" {
		t.Errorf("7%% of 200k = %q, want ~14k", got)
	}
	// Explicit window size wins over the 200k assumption.
	if got := contextTokens(&ContextWindowInfo{ContextWindowSize: 1_000_000}, 10); got != "~100k" {
		t.Errorf("10%% of 1M = %q, want ~100k", got)
	}
	// Server usage numbers win over any percentage math.
	w := &ContextWindowInfo{}
	w.CurrentUsage = &struct {
		InputTokens              int `json:"input_tokens"`
		CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
		CacheReadInputTokens     int `json:"cache_read_input_tokens"`
		OutputTokens             int `json:"output_tokens"`
	}{InputTokens: 20_000, CacheReadInputTokens: 60_400, OutputTokens: 1_000}
	if got := contextTokens(w, 7); got != "~81k" {
		t.Errorf("usage sum = %q, want ~81k", got)
	}
	if got := contextTokens(&ContextWindowInfo{}, 0); got != "" {
		t.Errorf("0%% should render nothing, got %q", got)
	}
}

func TestTruncateLabel(t *testing.T) {
	if got := truncateLabel("short", 28); got != "short" {
		t.Errorf("got %q", got)
	}
	if got := truncateLabel("abcdefghij", 5); got != "abcd…" {
		t.Errorf("got %q, want abcd…", got)
	}
}

func TestHandoffPendingCount(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "a.md"), []byte("x"), 0600)
	os.WriteFile(filepath.Join(dir, "b.md"), []byte("x"), 0600)
	os.WriteFile(filepath.Join(dir, "c.txt"), []byte("x"), 0600)
	if got := handoffPendingCount(dir); got != 2 {
		t.Errorf("got %d, want 2", got)
	}
	if got := handoffPendingCount(filepath.Join(dir, "missing")); got != 0 {
		t.Errorf("missing dir should be 0, got %d", got)
	}
}

func TestFormatWindowRollover(t *testing.T) {
	// resets_at in the past means the window rolled over while idle: the stale
	// pre-reset percentage must render as a fresh 0%, with no countdown.
	stale := &RateLimitWindow{UsedPercentage: 101, ResetsAt: 1000}
	got := formatWindow("5h", stale)
	if !strings.Contains(got, "0%") || strings.Contains(got, "101") || strings.Contains(got, "→") {
		t.Errorf("stale window should render fresh 0%% without countdown, got %q", got)
	}
}

func TestNormalizeRemoteURL(t *testing.T) {
	cases := map[string]string{
		"git@github.com:dvakatsiienko/frame.git": "https://github.com/dvakatsiienko/frame",
		"https://github.com/user/repo.git":       "https://github.com/user/repo",
		"https://github.com/user/repo":           "https://github.com/user/repo",
		"ssh://weird/path":                       "",
		"":                                       "",
	}
	for in, want := range cases {
		if got := normalizeRemoteURL(in); got != want {
			t.Errorf("normalizeRemoteURL(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestHyperlink(t *testing.T) {
	if got := hyperlink("", "main"); got != "main" {
		t.Errorf("empty url must return bare text, got %q", got)
	}
	got := hyperlink("https://x.dev", "main")
	if !strings.Contains(got, "\033]8;;https://x.dev\033\\main\033]8;;\033\\") {
		t.Errorf("bad OSC 8 wrapping: %q", got)
	}
}

func TestGradientAt(t *testing.T) {
	if gradientAt(gradientStops, 0) != gradientStops[0] {
		t.Error("t=0 must return the first stop")
	}
	if gradientAt(gradientStops, 1) != gradientStops[len(gradientStops)-1] {
		t.Error("t=1 must return the last stop")
	}
}

func TestRepoDirFollowsTheSessionNotTheShell(t *testing.T) {
	ctx := &ClaudeContext{}
	ctx.Workspace.ProjectDir = "/repo"
	ctx.Workspace.CurrentDir = "/tmp"

	// Travelling out of the repo must not blank the git segment.
	if got := repoDir(ctx); got != "/repo" {
		t.Errorf("repoDir = %q, want /repo", got)
	}

	ctx.Workspace.ProjectDir = ""
	if got := repoDir(ctx); got != "/tmp" {
		t.Errorf("repoDir without project_dir = %q, want /tmp", got)
	}

	// Nil is absorbed at the boundary now, so the bare-terminal case reaches
	// here as a zero-value context rather than a nil pointer.
	if got := repoDir(&ClaudeContext{}); got != "" {
		t.Errorf("repoDir on an empty context = %q, want empty", got)
	}
}

func TestEffortLevelPrefersPayloadOverSettings(t *testing.T) {
	context := &ClaudeContext{}
	context.Effort = &struct {
		Level string `json:"level"`
	}{Level: "xhigh"}

	if got := effortLevel(context); got != "xhigh" {
		t.Errorf("payload effort present: want xhigh, got %q", got)
	}

	// No payload effort: fall back to settings.json, whatever it holds. The
	// point is only that the payload wins when present, so assert the branch
	// rather than the machine's current file contents.
	if got := effortLevel(&ClaudeContext{}); got != getEffortFromSettings() {
		t.Errorf("payload effort absent: want the settings fallback, got %q", got)
	}
}

func TestFastModeAlertsInsteadOfBadgingTheModel(t *testing.T) {
	fast := &ClaudeContext{FastMode: true}
	fast.Model.ID = "claude-opus-5"
	fast.Model.DisplayName = "Opus 5"

	if !strings.Contains(joinSegments(alertSegments(fast)...), "↯ FAST") {
		t.Error("fast_mode true: want the ↯ FAST alert")
	}
	if !strings.Contains(joinSegments(alertSegments(fast)...), UsageCritColor) {
		t.Error("fast_mode true: want the alert rendered at crit level")
	}
	if strings.Contains(getModelDisplayName(fast), "⚡️") {
		t.Error("fast mode must not badge the model cluster any more")
	}

	slow := &ClaudeContext{}
	slow.Model.ID = "claude-opus-5"
	slow.Model.DisplayName = "Opus 5"

	if strings.Contains(joinSegments(alertSegments(slow)...), "↯ FAST") {
		t.Error("fast_mode false: want no ↯ FAST alert")
	}
}

// Crit before warn, whatever the mix. peerSocketAlive depends on the live
// environment, so the invariant is asserted over whatever it yields rather than
// against a fixed list.
func TestAlertsSortCritBeforeWarn(t *testing.T) {
	fast := &ClaudeContext{FastMode: true}
	alerts := collectAlerts(fast)
	for i := 1; i < len(alerts); i++ {
		if alerts[i-1].level < alerts[i].level {
			t.Errorf("alert %d (%s) outranks its predecessor (%s)",
				i, alerts[i].label, alerts[i-1].label)
		}
	}
}

func TestAlertSegmentEmptyWhenNothingIsWrong(t *testing.T) {
	if len(collectAlerts(&ClaudeContext{})) == 0 && joinSegments(alertSegments(&ClaudeContext{})...) != "" {
		t.Error("no alerts: want the segment omitted entirely")
	}
}

func TestOutputStyleBadge(t *testing.T) {
	custom := &ClaudeContext{}
	custom.Model.ID = "claude-opus-5"
	custom.Model.DisplayName = "Opus 5"
	custom.OutputStyle = &struct {
		Name string `json:"name"`
	}{Name: "output-fun"}

	rendered := getModelDisplayName(custom)
	if !strings.Contains(rendered, "🪶") {
		t.Error("custom output style: want the 🪶 marker")
	}
	// The badge carries two link targets, both containing the "output-" filing
	// prefix, so assertions about the label read the visible text only.
	tail := stripLinks(rendered[strings.Index(rendered, "🪶"):])
	// The name is rendered per-character through a gradient, so the letters are
	// separated by escape codes — assert on order, not on a contiguous substring.
	f, u, n := strings.Index(tail, "f"), strings.Index(tail, "u"), strings.LastIndex(tail, "n")
	if f < 0 || u < f || n < u {
		t.Error("custom output style: want the style name rendered in order")
	}
	if strings.Contains(tail, "output-") {
		t.Error("custom output style: the output- prefix should be stripped from the label")
	}

	abbrev := &ClaudeContext{}
	abbrev.Model.ID = "claude-opus-5"
	abbrev.Model.DisplayName = "Opus 5"
	abbrev.OutputStyle = &struct {
		Name string `json:"name"`
	}{Name: "output-ELI5"}

	abbrevTail := getModelDisplayName(abbrev)
	abbrevTail = abbrevTail[strings.Index(abbrevTail, "🪶"):]
	e, l, i := strings.Index(abbrevTail, "E"), strings.Index(abbrevTail, "L"), strings.Index(abbrevTail, "I")
	if e < 0 || l < e || i < l {
		t.Error("abbreviation output style: want the name's casing preserved")
	}
	if strings.Contains(abbrevTail, "eli5") {
		t.Error("abbreviation output style: the name should not be lowercased")
	}

	plain := &ClaudeContext{}
	plain.Model.ID = "claude-opus-5"
	plain.Model.DisplayName = "Opus 5"
	plain.OutputStyle = &struct {
		Name string `json:"name"`
	}{Name: "default"}

	if !strings.Contains(getModelDisplayName(plain), "🪶") {
		t.Error("default output style: want the badge — it is always shown")
	}
	if strings.Contains(getModelDisplayName(&ClaudeContext{}), "🪶") {
		t.Error("absent output style: want no badge")
	}
}

func TestWorkingDirShortensButKeepsTheAbsolutePath(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no home dir")
	}
	currentDir := filepath.Join(home, "frame")

	// The link needs the absolute path; only the rendered half wears the ~.
	abs, display := workingDir(currentDir)
	if abs != currentDir {
		t.Errorf("abs = %q, want %q", abs, currentDir)
	}
	if display != "~/frame" {
		t.Errorf("display = %q, want ~/frame", display)
	}

	if !strings.Contains(dirSegment(currentDir), "cursor://file"+abs) {
		t.Error("dir segment should link the absolute path at Cursor")
	}
}

func TestEditorURL(t *testing.T) {
	if got := editorURL("/Users/dima/frame"); got != "cursor://file/Users/dima/frame" {
		t.Errorf("got %q", got)
	}
	if got := editorURL(""); got != "" {
		t.Errorf("empty path should make no url, got %q", got)
	}
}

func TestClaudeHomePathsAgree(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip("no home dir")
	}
	base := filepath.Join(home, ".claude")
	cases := map[string]string{
		slineStatePath():   filepath.Join(base, "sline", "sline-state.json"),
		settingsPath():     filepath.Join(base, "settings.json"),
		sessionsDir():      filepath.Join(base, "sessions"),
		handoffsDir():      filepath.Join(base, "shelf", "handoffs"),
		focusPath("abc12"): filepath.Join(base, "focus", "abc12.json"),
	}
	for got, want := range cases {
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	}
}

func TestOutputStyleBadgeLinksItsSource(t *testing.T) {
	styled := &ClaudeContext{}
	styled.OutputStyle = &struct {
		Name string `json:"name"`
	}{Name: "output-ELI5"}

	// CC reports "ELI5"; the file on disk is output-ELI5.md. Both spellings of
	// the payload must resolve to the same existing file.
	for _, reported := range []string{"ELI5", "output-ELI5"} {
		styled.OutputStyle.Name = reported
		badge := outputStyleBadge(styled)
		want := "cursor://file" + claudeHome("output-styles", "output-ELI5.md")
		if !strings.Contains(badge, want) {
			t.Errorf("style %q: want a link to %q, got %q", reported, want, badge)
		}
	}
	// The 🪶 opens the folder instead, so the peer styles are one click away.
	styled.OutputStyle.Name = "ELI5"
	if !strings.Contains(outputStyleBadge(styled), "cursor://file"+outputStylesDir()) {
		t.Error("the marker should link the styles folder")
	}

	// CC's built-in style has no file behind it, so only the folder link applies.
	plain := &ClaudeContext{}
	plain.OutputStyle = &struct {
		Name string `json:"name"`
	}{Name: "default"}
	badge := outputStyleBadge(plain)
	if strings.Contains(badge, "output-default.md") {
		t.Error("default style has no source file and must not link one")
	}
	if !strings.Contains(badge, "cursor://file"+outputStylesDir()) {
		t.Error("default still gets the folder link")
	}
}

// Split out of TestOutputStyleBadgeLinksItsSource, which only builds link
// strings and runs anywhere. This half asserts the machine is actually wired
// up, which is true only where frame:link has run — so on a CI runner, or
// any checkout that is not the live one, it skips rather than fails.
func TestOutputStyleFileIsLinkedOnDisk(t *testing.T) {
	// read-only, so it alone looks at the real home TestMain moved HOME away from
	path := filepath.Join(realHome, ".claude", "output-styles", "output-ELI5.md")
	_, err := os.Stat(path)
	if os.IsNotExist(err) {
		t.Skipf("no style file at %s — frame:link has not run here", path)
	}
	if err != nil {
		t.Errorf("the linked style file must actually exist: %v", err)
	}
}

// stripLinks removes OSC 8 hyperlink sequences, leaving the text a terminal shows.
func stripLinks(s string) string {
	for {
		start := strings.Index(s, "\033]8;;")
		if start < 0 {
			return s
		}
		end := strings.Index(s[start:], "\033\\")
		if end < 0 {
			return s
		}
		s = s[:start] + s[start+end+2:]
	}
}

func TestStatusBadgeShortWordsAndStaleness(t *testing.T) {
	fresh := time.Now().Unix()
	cache := map[string]ticketStatus{
		"DOT-1": {Status: "In Progress", Type: "started", At: fresh},
		"DOT-2": {Status: "In Review", Type: "started", At: fresh},
		"DOT-3": {Status: "Done", Type: "completed", At: fresh},
		"DOT-4": {Status: "Todo", Type: "unstarted", At: fresh},
		"DOT-5": {Status: "Canceled", Type: "canceled", At: fresh},
		"DOT-6": {Status: "Backlog", Type: "backlog", At: fresh}, // unmapped name
		"DOT-7": {Status: "Done", Type: "completed",
			At: time.Now().Add(-statusStaleAfter - time.Minute).Unix()},
	}

	want := map[string]string{"DOT-1": "wip", "DOT-2": "review", "DOT-3": "done",
		"DOT-4": "todo", "DOT-5": "cancel", "DOT-6": "backlog"}
	for id, label := range want {
		got := statusBadge(cache, id)
		if !strings.Contains(got, label) {
			t.Errorf("%s: want %q in %q", id, label, got)
		}
	}

	// Colour is a second signal, never the only one — but it must still be right.
	if !strings.Contains(statusBadge(cache, "DOT-3"), AddColor) {
		t.Error("done should be green")
	}
	if !strings.Contains(statusBadge(cache, "DOT-2"), TicketColor) {
		t.Error("in review should be blue")
	}

	// Past the window it stops asserting: the colour drops and a ? goes on.
	stale := statusBadge(cache, "DOT-7")
	if !strings.Contains(stale, "done?") {
		t.Errorf("stale status should carry a ?, got %q", stale)
	}
	if strings.Contains(stale, AddColor) {
		t.Error("a stale status must not keep its confident colour")
	}

	if statusBadge(cache, "DOT-99") != "" {
		t.Error("an id with nothing cached renders nothing at all")
	}
	if statusBadge(nil, "DOT-1") != "" {
		t.Error("no cache at all renders nothing")
	}
}

func TestRefreshDueIgnoresEmptyPin(t *testing.T) {
	fresh := map[string]ticketStatus{"DOT-1": {Status: "Todo", At: time.Now().Unix()}}

	// An unpinned session passes "". Treating that as a missing status made
	// sline spawn a fetch on every single render, forever.
	if refreshDue(fresh, "") {
		t.Error("an empty pin is never due")
	}
	if refreshDue(fresh, "DOT-1") {
		t.Error("a freshly cached id is not due")
	}
	if !refreshDue(fresh, "DOT-2") {
		t.Error("an uncached id is due")
	}
	old := map[string]ticketStatus{"DOT-1": {Status: "Todo",
		At: time.Now().Add(-statusFetchTTL - time.Second).Unix()}}
	if !refreshDue(old, "DOT-1") {
		t.Error("past the TTL is due")
	}
}

func TestSaveUsageMirrorsTheWeeklyWindow(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cc-usage-window.json")
	limits := &struct {
		SevenDay *RateLimitWindow `json:"seven_day"`
	}{SevenDay: &RateLimitWindow{UsedPercentage: 90, ResetsAt: 1790600000}}

	if err := saveUsage(path, limits, time.Unix(1790500000, 0)); err != nil {
		t.Fatalf("saveUsage: %v", err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("no usage file written: %v", err)
	}
	var got struct {
		WrittenAt  int64 `json:"written_at"`
		RateLimits struct {
			SevenDay RateLimitWindow `json:"seven_day"`
		} `json:"rate_limits"`
	}
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatalf("usage file is not json: %v\n%s", err, raw)
	}
	if got.RateLimits.SevenDay.UsedPercentage != 90 || got.WrittenAt != 1790500000 {
		t.Errorf("want seven_day 90 %% written at 1790500000, got %s", raw)
	}
}
