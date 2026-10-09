package main

import (
	"cmp"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// the handoff store: a flat dir of CSTs, named by one grammar (script/lib/handoff-names.json holds its
// cases). nothing here deletes by age — a stale CST is dima's to see and decide about

var audiences = []string{"any", "ccli", "cclio", "ccrow", "coder", "cw", "designer", "verifier"}

const staleAfter = 7 * 24 * time.Hour

var timestamp = regexp.MustCompile(`^\d{8}T\d{4,6}Z$`)

type name struct {
	Audience string `json:"audience"`
	Author   string `json:"author"`
	Lane     string `json:"lane"`
	Shared   bool   `json:"shared"`
	Slug     string `json:"slug"`
	TS       string `json:"ts"`
}

type stored struct {
	name
	file  string
	path  string
	mtime time.Time
	size  int64
}

func storeRoot() string {
	if root := os.Getenv("HANDOFF_STORE_ROOT"); root != "" {
		return root
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude", "shelf", "handoffs")
}

// `<for>--<lane>--<topic>--by-<author>--<utc-ts>[-shared].md`, plus the two legacy shapes still in the
// store; a name it cannot fully parse still lists, so no file turns invisible
func parseName(file string) (name, bool) {
	stem, isMD := strings.CutSuffix(file, ".md")
	if !isMD {
		return name{}, false
	}
	stem, shared := strings.CutSuffix(stem, "-shared")
	if parsed, ok := parseCurrent(stem, shared); ok {
		return parsed, true
	}
	return parseLegacy(stem, shared)
}

func parseCurrent(stem string, shared bool) (name, bool) {
	parts := strings.Split(stem, "--")
	if len(parts) != 5 || !timestamp.MatchString(parts[4]) {
		return name{}, false
	}
	author, _ := strings.CutPrefix(parts[3], "by-")
	return name{
		Audience: audienceOr(parts[0]),
		Author:   cmp.Or(author, "any"),
		Lane:     cmp.Or(parts[1], "any"),
		Shared:   shared,
		Slug:     cmp.Or(parts[2], "handoff"),
		TS:       parts[4],
	}, true
}

func parseLegacy(stem string, shared bool) (name, bool) {
	var parts []string
	for part := range strings.SplitSeq(stem, "-") {
		if part != "" {
			parts = append(parts, part)
		}
	}
	if len(parts) == 0 {
		return name{}, false
	}
	legacy := name{Audience: "any", Author: "any", Lane: "any", Shared: shared}
	if timestamp.MatchString(parts[0]) {
		rest := parts[1:]
		if len(rest) > 0 && slices.Contains(audiences, rest[0]) {
			legacy.Audience, rest = rest[0], rest[1:]
		}
		legacy.Slug, legacy.TS = strings.Join(rest, "-"), parts[0]
		return legacy, true
	}
	body := parts
	if last := parts[len(parts)-1]; timestamp.MatchString(last) {
		body, legacy.TS = parts[:len(parts)-1], last
	}
	// the audience is positional: a two-segment name has none, its first token is the slug
	if len(body) > 1 && slices.Contains(audiences, body[0]) {
		legacy.Audience, body = body[0], body[1:]
	}
	legacy.Slug = strings.Join(body, "-")
	return legacy, true
}

func audienceOr(token string) string {
	if slices.Contains(audiences, token) {
		return token
	}
	return "any"
}

// a file addressed to another agent is never pulled by accident
func readableBy(audience, reader string) bool { return audience == "any" || audience == reader }

func listStore(root string) []stored {
	found, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	var entries []stored
	for _, one := range found {
		parsed, ok := parseName(one.Name())
		if !ok || !one.Type().IsRegular() {
			continue
		}
		// the store is shared: a file can vanish between the read and the stat, another thread pulled it
		info, err := one.Info()
		if err != nil {
			continue
		}
		entries = append(entries, stored{parsed, one.Name(), filepath.Join(root, one.Name()), info.ModTime(), info.Size()})
	}
	slices.SortStableFunc(entries, func(a, b stored) int { return b.mtime.Compare(a.mtime) })
	return entries
}

type age struct {
	label string
	stale bool
}

func ageOf(mtime, now time.Time) age {
	elapsed := max(now.Sub(mtime), 0)
	minutes := math.Round(elapsed.Minutes())
	label := fmt.Sprintf("%.0fm", minutes)
	switch {
	case minutes >= 60*36:
		label = fmt.Sprintf("%.0fd", math.Round(minutes/1440))
	case minutes >= 90:
		label = fmt.Sprintf("%.0fh", math.Round(minutes/60))
	}
	return age{label, elapsed > staleAfter}
}

// every verb addressing one file by slug refuses rather than guesses
func pickEntry(slug string, entries []stored) (stored, error) {
	matches := entries
	if slug != "" {
		matches = nil
		for _, e := range entries {
			if strings.Contains(strings.ToLower(e.file), strings.ToLower(slug)) {
				matches = append(matches, e)
			}
		}
	}
	switch {
	case len(matches) == 1:
		return matches[0], nil
	case len(entries) == 0:
		return stored{}, usageFail("handoff store is clean — nothing pending.", "x handoff list")
	case len(matches) == 0:
		return stored{}, usageFail(fmt.Sprintf("no pending handoff matches %q. pending:\n%s", slug, describe(entries)), "x handoff list")
	}
	return stored{}, usageFail("several pending handoffs match — pick one with a slug that is unique:\n"+describe(matches), "x handoff list")
}

func describe(entries []stored) string {
	lines := make([]string, len(entries))
	for i, e := range entries {
		lines[i] = fmt.Sprintf("- %s — for %s · %s lane · by %s · %s old", e.Slug, e.Audience, e.Lane, e.Author, ageOf(e.mtime, time.Now()).label)
	}
	return strings.Join(lines, "\n")
}

// META is the head of a CST and ends where the next top-level heading begins: «run id» also occurs in
// prose further down, and a whole-file search would report one of those
var (
	metaHeading = regexp.MustCompile(`(?i)^#\s+META\b`)
	topHeading  = regexp.MustCompile(`^#\s`)
	// the label is plain, bold or backticked in the CSTs out there; the value is whatever reads as a run
	// id after it (`<surface>·<date>·<slug>`, any ·-joined words), so «none» or prose is no run id at all
	runIDLabel = regexp.MustCompile(`(?i)run\s*(?:id|marker)`)
	runIDValue = regexp.MustCompile(`[\p{L}\p{N}_-]+(?:·[\p{L}\p{N}_-]+)+`)
)

func metaBlock(cst string) *string {
	lines := strings.Split(cst, "\n")
	start := slices.IndexFunc(lines, metaHeading.MatchString)
	if start == -1 {
		return nil
	}
	rest := lines[start+1:]
	if end := slices.IndexFunc(rest, topHeading.MatchString); end != -1 {
		rest = rest[:end]
	}
	block := strings.TrimSpace(strings.Join(append([]string{lines[start]}, rest...), "\n"))
	return &block
}

func parseRunID(meta *string) *string {
	if meta == nil {
		return nil
	}
	for line := range strings.SplitSeq(*meta, "\n") {
		label := runIDLabel.FindStringIndex(line)
		if label == nil {
			continue
		}
		if id := runIDValue.FindString(line[label[1]:]); id != "" {
			return &id
		}
	}
	return nil
}

func readMeta(path string) *string {
	body, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	return metaBlock(string(body))
}

var notSlug = regexp.MustCompile(`[^a-z0-9]+`)

// a field is kebab-cased so it can never carry the `--` that cuts fields, nor smuggle in a -shared suffix
func sanitize(field string) string {
	kebab := strings.Trim(notSlug.ReplaceAllString(strings.ToLower(field), "-"), "-")
	return cmp.Or(strings.TrimSuffix(kebab, "-shared"), "handoff")
}

func buildName(n name) string {
	stem := strings.Join([]string{n.Audience, sanitize(cmp.Or(n.Lane, "any")), sanitize(n.Slug),
		"by-" + sanitize(cmp.Or(n.Author, "any")), n.TS}, "--")
	if n.Shared {
		stem += "-shared"
	}
	return stem + ".md"
}

func utcStamp(at time.Time) string { return at.UTC().Format("20060102T150405Z") }

// a file another thread already pulled is gone, which is all a removal wanted
func discardIfThere(path string) error {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil
	}
	return discard(path)
}

// a pulled CST goes to the macos trash, so it stays recoverable; a test run never fills the trash
func discard(path string) error {
	if os.Getenv("X_TEST") != "" {
		return os.Remove(path)
	}
	if out, err := exec.Command("trash", path).CombinedOutput(); err != nil {
		return fmt.Errorf("trash %s: %v %s", path, err, strings.TrimSpace(string(out)))
	}
	return nil
}
