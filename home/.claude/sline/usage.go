package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// barRamp colors the Nth filled cell of a progress bar: a gruvbox green →
// yellow → orange → red climb, so the bar's leading edge signals severity
// (technique borrowed from kcchien/claude-code-statusline).
var barRamp = [][3]int{
	{169, 182, 101}, // green  #a9b665
	{181, 186, 97},
	{193, 178, 93},
	{205, 172, 90},
	{216, 166, 87}, // yellow #d8a657
	{224, 152, 82},
	{231, 138, 78}, // orange #e78a4e
	{232, 127, 71},
	{233, 116, 84},
	{234, 105, 98}, // red    #ea6962
}

// progressBar renders pct as barWidth discrete cells: ▮ (filled) / ▯ (outlined
// empty) read as separate segments with natural gaps — solid █ blocks fuse into
// one strip in Warp and lose the segmented look.
const barWidth = 20

func progressBar(pct float64) string {
	filled := int(math.Round(pct / 100 * barWidth))
	if filled > barWidth {
		filled = barWidth
	}
	if filled < 0 {
		filled = 0
	}
	var bar strings.Builder
	for i := 0; i < barWidth; i++ {
		if i < filled {
			c := barRamp[i*len(barRamp)/barWidth]
			fmt.Fprintf(&bar, "\033[38;2;%d;%d;%dm▮", c[0], c[1], c[2])
		} else {
			bar.WriteString("\033[38;2;102;92;84m▯")
		}
	}
	bar.WriteString(Reset)
	return bar.String()
}

// usageColor grades a 0-100 percentage: calm below 75, warning past 75, alarm past 90.
func usageColor(pct float64) string {
	switch {
	case pct >= 90:
		return UsageCritColor
	case pct >= 75:
		return UsageWarnColor
	default:
		return UsageOkColor
	}
}

// formatResetIn renders seconds until a window resets as "2d 5h 14m", "2h 14m" or "43m".
func formatResetIn(seconds int64) string {
	if seconds <= 0 {
		return ""
	}
	minutes := seconds / 60
	if minutes < 60 {
		return fmt.Sprintf("%dm", minutes)
	}
	if minutes < 24*60 {
		return fmt.Sprintf("%dh %02dm", minutes/60, minutes%60)
	}
	return fmt.Sprintf("%dd %dh %02dm", minutes/(24*60), (minutes%(24*60))/60, minutes%60)
}

func formatWindow(label string, window *RateLimitWindow) string {
	if window == nil {
		return ""
	}

	pct := window.UsedPercentage
	var resetIn int64
	if window.ResetsAt > 0 {
		resetIn = window.ResetsAt - time.Now().Unix()
		// Quota data only refreshes on API traffic, so after an idle stretch the
		// JSON still holds pre-reset numbers. resets_at in the past proves the
		// window rolled over — show the fresh-window truth instead of stale 101%.
		if resetIn <= 0 {
			pct = 0
		}
	}

	segment := label + " " + progressBar(pct) + " " + paintf(usageColor(pct), "%.0f%%", pct)

	if resetIn > 0 {
		if formatted := formatResetIn(resetIn); formatted != "" {
			// → (U+2192) has no emoji presentation, so it renders single-width as
			// plain text — no color-emoji fallback to mis-size, unlike ⏳ (U+23F3).
			segment += " " + paint(CleanColor, "→ "+formatted)
		}
	}

	return segment
}

// cacheTTL mirrors the subscription's extended prompt-cache TTL (1h). CC's own
// "uncached · /clear to start fresh" note has no statusline-JSON counterpart
// (verified against the schema, v2.1.x), so coldness is inferred from the one
// local fact available: transcript mtime = last API activity. See ADR 0001's
// carve-out — this is a derived boolean off a filesystem fact, not an estimated
// number.
const cacheTTL = time.Hour

func cacheCold(transcriptPath string) bool {
	if transcriptPath == "" {
		return false
	}
	info, err := os.Stat(transcriptPath)
	if err != nil {
		return false
	}
	return time.Since(info.ModTime()) > cacheTTL
}

// contextTokens renders the absolute token count behind used_percentage ("~14k").
// Prefers the server's own usage numbers; falls back to pct × window size, with
// 200k assumed when the JSON omits the size.
func contextTokens(w *ContextWindowInfo, pct float64) string {
	tokens := 0
	if u := w.CurrentUsage; u != nil {
		tokens = u.InputTokens + u.CacheCreationInputTokens + u.CacheReadInputTokens + u.OutputTokens
	}
	if tokens == 0 {
		size := w.ContextWindowSize
		if size == 0 {
			size = 200_000
		}
		tokens = int(math.Round(pct / 100 * float64(size)))
	}
	if tokens <= 0 {
		return ""
	}
	if tokens < 1000 {
		return "~1k"
	}
	return fmt.Sprintf("~%dk", int(math.Round(float64(tokens)/1000)))
}

// usageSegments renders subscription quota and context window usage. Every field is
// server-provided; when none are present nothing is emitted rather than
// falling back to a client-side estimate.
func usageSegments(context *ClaudeContext) []string {
	var segments []string

	// 📡 belongs to the cost figure — post-/clear CC omits cost (and context)
	// until the thread's first API response, and a bare 📡 read as an orphan.
	if cost := context.Cost; cost != nil && cost.TotalCostUSD > 0 {
		segments = append(segments,
			"📡 "+paintf(UsageOkColor, "~$%.2f", cost.TotalCostUSD))
	}

	if limits := context.RateLimits; limits != nil {
		if segment := formatWindow("5h", limits.FiveHour); segment != "" {
			segments = append(segments, segment)
		}
		if segment := formatWindow("week", limits.SevenDay); segment != "" {
			segments = append(segments, segment)
		}
	}

	if ctxWindow := context.ContextWindow; ctxWindow != nil && ctxWindow.UsedPercentage != nil {
		pct := *ctxWindow.UsedPercentage
		segment := "🧠 " + progressBar(pct) + " " + paintf(usageColor(pct), "%.0f%%", pct)
		if tokens := contextTokens(ctxWindow, pct); tokens != "" {
			segment += " " + paint(CleanColor, "→ "+tokens)
		}
		if cacheCold(context.TranscriptPath) {
			segment += " (❄️)"
		}
		segments = append(segments, segment)
	}

	handoffDir := handoffsDir()
	if pending := handoffPendingCount(handoffDir); pending > 0 {
		count := hyperlink(editorURL(handoffDir), fmt.Sprintf("%d", pending))
		segments = append(segments, "📬 "+paint(SessionColor, count))
	}

	return segments
}

// saveUsage mirrors the quota windows to a file, because only the statusline
// receives them and the boot digest and a night shift pace on the weekly %.
// every session renders, so the write goes through a temp file and a rename:
// a reader never sees half a file.
func saveUsage(path string, limits any, now time.Time) error {
	data, err := json.Marshal(struct {
		WrittenAt  int64 `json:"written_at"`
		RateLimits any   `json:"rate_limits"`
	}{now.Unix(), limits})
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".usage-*.json")
	if err != nil {
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return err
	}
	tmp.Close()
	return os.Rename(tmp.Name(), path)
}
