package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Claude Code context structure (v1.0.85+)
// Reference: https://docs.anthropic.com/en/docs/claude-code/statusline#json-input-structure
type ClaudeContext struct {
	SessionID      string `json:"session_id"`
	SessionName    string `json:"session_name"`
	TranscriptPath string `json:"transcript_path"`
	Cwd            string `json:"cwd"`
	Version        string `json:"version"`
	Model          struct {
		ID          string `json:"id"`
		DisplayName string `json:"display_name"`
	} `json:"model"`
	Workspace struct {
		CurrentDir string `json:"current_dir"`
		ProjectDir string `json:"project_dir"`
	} `json:"workspace"`
	// API-equivalent value of this session's tokens. On a subscription nothing is
	// billed per-unit, so this is what the tokens would have cost at API rates —
	// a token-volume gauge, not a bill. Rendered with a leading "~" to say so.
	Cost *struct {
		TotalCostUSD float64 `json:"total_cost_usd"`
	} `json:"cost"`
	// Server-provided subscription quota. Pro/Max only, and only after the
	// first API response of a session — each window may be independently absent.
	RateLimits *struct {
		FiveHour *RateLimitWindow `json:"five_hour"`
		SevenDay *RateLimitWindow `json:"seven_day"`
	} `json:"rate_limits"`
	ContextWindow *ContextWindowInfo `json:"context_window"`
	// Reasoning effort as CC currently has it. Authoritative over settings.json,
	// which /effort does not rewrite mid-session.
	Effort *struct {
		Level string `json:"level"`
	} `json:"effort"`
	// Opus running with faster output — Opus 5/4.8 only, absent elsewhere, so
	// it marks a state that silently cannot apply on other models.
	FastMode bool `json:"fast_mode"`
	// Active output style. "default" when none is selected, which is not news.
	OutputStyle *struct {
		Name string `json:"name"`
	} `json:"output_style"`
}

type ContextWindowInfo struct {
	UsedPercentage    *float64 `json:"used_percentage"`
	ContextWindowSize int      `json:"context_window_size"`
	CurrentUsage      *struct {
		InputTokens              int `json:"input_tokens"`
		CacheCreationInputTokens int `json:"cache_creation_input_tokens"`
		CacheReadInputTokens     int `json:"cache_read_input_tokens"`
		OutputTokens             int `json:"output_tokens"`
	} `json:"current_usage"`
}

// One rate limit window, derived from Anthropic's own response — not a local estimate.
type RateLimitWindow struct {
	UsedPercentage float64 `json:"used_percentage"`
	ResetsAt       int64   `json:"resets_at"`
}

func runCommand(command string, args ...string) string {
	output, err := exec.Command(command, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func isStdinPiped() bool {
	stat, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return (stat.Mode() & os.ModeCharDevice) == 0
}

func readClaudeContext() *ClaudeContext {
	if !isStdinPiped() {
		return nil
	}
	input, err := io.ReadAll(os.Stdin)
	if err != nil || len(input) == 0 {
		return nil
	}
	var ctx ClaudeContext
	if json.Unmarshal(input, &ctx) != nil || ctx.SessionID == "" {
		return nil
	}
	return &ctx
}

// claudeContextOrEmpty absorbs the bare-terminal case once, here at the
// boundary, so no segment downstream carries a nil guard for it. Every field
// then reads as its zero value, which is exactly what "Claude Code told us
// nothing" means.
func claudeContextOrEmpty() *ClaudeContext {
	if ctx := readClaudeContext(); ctx != nil {
		return ctx
	}
	return &ClaudeContext{}
}

// workingDir reports the directory absolutely and as displayed. The absolute
// form feeds the Finder link; the ~-shortened form is what gets rendered. Prefers
// the dir Claude Code reports over the process cwd.
func workingDir(currentDir string) (abs, display string) {
	if currentDir != "" {
		abs = currentDir
	} else if cwd, err := os.Getwd(); err == nil {
		abs = cwd
	} else {
		return "", "unknown"
	}

	homeDir, _ := os.UserHomeDir()
	switch {
	case homeDir != "" && abs == homeDir:
		return abs, "~"
	case homeDir != "" && strings.HasPrefix(abs, homeDir+"/"):
		return abs, "~" + abs[len(homeDir):]
	}
	return abs, abs
}

func dirSegment(currentDir string) string {
	abs, display := workingDir(currentDir)
	return "📼 " + paint(DirColor, hyperlink(editorURL(abs), display))
}

func getGitEmoji() string {
	hour := time.Now().Hour()
	if hour >= 6 && hour < 18 {
		return "🦔" // Day hedgehog
	}
	return "🦦" // Night otter
}

// =============================================================================
// STATUSLINE ASSEMBLY
// =============================================================================

// repoDir is the directory sline reports git for: the session's project, not
// wherever the shell has wandered to. Travelling out of the repo mid-session
// used to blank the segment.
func repoDir(claudeContext *ClaudeContext) string {
	if claudeContext.Workspace.ProjectDir != "" {
		return claudeContext.Workspace.ProjectDir
	}
	return claudeContext.Workspace.CurrentDir
}

func gitSegments(claudeContext *ClaudeContext) []string {
	return renderGitStatus(readGitStatus(repoDir(claudeContext)))
}

// renderGitStatus formats an already-read status as up to three segments —
// branch, working tree, stash. It reads nothing itself, so every branch below is
// reachable from a GitStatus literal in a test.
func renderGitStatus(st GitStatus) []string {
	gitEmoji := getGitEmoji()

	if !st.IsRepo {
		return []string{gitEmoji + " " + paint(CleanColor, "no git")}
	}

	branchSegment := paint(BranchColor, branchLabel(st))
	if sync := formatSyncIndicator(st); sync != "" {
		branchSegment += " " + sync
	}

	hasStagedChanges := st.Staged > 0
	hasUnstagedChanges := st.Modified > 0 || st.Untracked > 0

	// diffPair reads as one unit: green insertions immediately followed by red
	// deletions, no space between them.
	diffPair := func(insertions, deletions int) string {
		return paintf(AddColor, "+%d", insertions) + paintf(DelColor, "-%d", deletions)
	}
	// fileCount is the (n) prefix every non-clean branch opens with.
	fileCount := func(n int) string {
		return gitEmoji + " " + paintf(CleanColor, "(%d)", n) + " "
	}
	stagedMark := " " + paint(AddColor, "✓")

	var tree string
	switch {
	case hasStagedChanges && hasUnstagedChanges:
		tree = fileCount(st.Entries+st.Untracked) +
			diffPair(st.StagedInsertions, st.StagedDeletions) + stagedMark + " " +
			diffPair(st.UnstagedInsertions, st.UnstagedDeletions)
	case hasStagedChanges:
		tree = fileCount(st.Staged) +
			diffPair(st.StagedInsertions, st.StagedDeletions) + stagedMark
	case hasUnstagedChanges:
		tree = fileCount(st.Modified+st.Untracked) +
			diffPair(st.UnstagedInsertions, st.UnstagedDeletions)
	default:
		tree = gitEmoji + " " + paint(CleanColor, "clean")
	}

	// Net diff only earns space when both signs are present — otherwise it just
	// restates the one number already on screen.
	totalInsertions := st.StagedInsertions + st.UnstagedInsertions
	totalDeletions := st.StagedDeletions + st.UnstagedDeletions
	if totalInsertions > 0 && totalDeletions > 0 {
		tree += " " + paintf(CleanColor, "%+d", totalInsertions-totalDeletions)
	}

	segments := []string{branchSegment, tree}
	if st.Stash > 0 {
		segments = append(segments, "💾 "+paintf(StashColor, "stash: %d", st.Stash))
	}
	return segments
}

func generateStatusline() string {
	claudeContext := claudeContextOrEmpty()

	state := loadState()
	emoji, emojiChanged := modelEmoji(&state)
	pnpmVersion, pnpmChanged := getPnpmVersion(&state)
	if emojiChanged || pnpmChanged {
		saveState(state)
	}

	// The line, in order. Anything that renders empty drops out and takes its
	// separator with it — see segment.go.
	line1 := joinSegments(flatten(
		[]string{
			dirSegment(claudeContext.Workspace.CurrentDir),
			paint(Bold+NodeIconColor, "󰎙") + " " + paint(NodeColor, getNodeVersion()),
			paint(PnpmIconColor, "📦") + " " + paint(PnpmColor, pnpmVersion),
		},
		gitSegments(claudeContext),
		// Session identity, then the ticket in focus.
		[]string{
			sessionSegment(claudeContext),
			focusSegment(claudeContext.SessionID),
		},
		// Alerts close line 1 — one place for every active fault. See alert.go.
		alertSegments(claudeContext),
	)...)

	// The model leads line 2's usage gauges.
	line2 := joinSegments(flatten(
		[]string{emoji + getModelDisplayName(claudeContext)},
		usageSegments(claudeContext),
	)...)

	return Reset + line1 + "\n" + line2
}

func main() {
	fmt.Print(generateStatusline())
}
