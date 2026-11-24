package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

const (
	growthMod   = "home/.claude/plugin-x/mods/x-mod-alpha/hooks/main.ts"
	growthHerdr = "home/.config/herdr-app/mods/x-herdr-gamma/main.js"
	growthSkill = "home/.claude/plugin-x/skills/guide-delta/SKILL.md"
	growthVerb  = "x/go/lane.go"
)

// a fixture frame tree: a cc mod, a herdr mod, a skill and a verb family, each tracked, with the lines of its files
func growthWorld(t *testing.T) (root string, env []string) {
	t.Helper()
	root = repo(t)
	for path, lines := range map[string]int{growthMod: 100, growthHerdr: 60, growthSkill: 40, growthVerb: 80} {
		write(t, filepath.Join(root, path), strings.Repeat("x\n", lines))
	}
	write(t, filepath.Join(root, "x/go/lane_test.go"), strings.Repeat("x\n", 20))
	write(t, filepath.Join(root, "_clio/plugin-clio/skills/xq/SKILL.md"), strings.Repeat("x\n", 30))
	write(t, filepath.Join(root, "home/.claude/plugin-x/skills/gamma/SKILL.md"), strings.Repeat("x\n", 30))
	gitT(t, root, "add", "-A")
	gitT(t, root, "commit", "-q", "-m", "parts")
	return root, []string{"X_FRAME_ROOT=" + root, "X_STATE=" + t.TempDir(), "HOME=" + t.TempDir(), "TZ=UTC"}
}

// the clock a fixture reads: a run is «now» unless it says when
const growthNow = "2026-11-20T12:00:00Z"

func growth(t *testing.T, root string, env []string) growthData {
	t.Helper()
	return growthAt(t, root, env, growthNow)
}

func growthAt(t *testing.T, root string, env []string, now string) growthData {
	t.Helper()
	got := xIn(t, root, append(env, "X_NOW="+now), "fleet", "growth", "--json")
	if got.code != 0 {
		t.Fatalf("fleet growth exit %d\n%s", got.code, got.stdout)
	}
	var envelope struct {
		Data growthData `json:"data"`
	}
	if err := json.Unmarshal([]byte(got.stdout), &envelope); err != nil {
		t.Fatalf("%v\n%s", err, got.stdout)
	}
	return envelope.Data
}

// a crossing without its ask text, its first date and its dated counts, for the tests that compare what crossed
func bare(c growthCrossing) growthCrossing {
	c.Ask, c.First, c.Since, c.Week, c.ReportedBefore = "", "", "", 0, false
	return c
}

// each part's seeded lines, read off the baseline file the run left in the fixture's state dir
func seededLines(t *testing.T, env []string) map[string]int {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(strings.TrimPrefix(env[1], "X_STATE="), "fleet-growth", "baseline.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Parts map[string]struct {
			Lines int `json:"lines"`
		} `json:"parts"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	lines := map[string]int{}
	for part, entry := range file.Parts {
		lines[part] = entry.Lines
	}
	return lines
}

// exit 4: the first run seeds the baseline from today's sizes, lines of every file of a part counted with its tests, and names nothing
func TestFleetGrowthSeedsTheBaselineFromTodaysSizesAndNamesNothing(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)

	got := growth(t, root, env)

	if !got.Seeded || len(got.Crossings) != 0 {
		t.Errorf("seeded %v with %d crossings, want a seed and none", got.Seeded, len(got.Crossings))
	}
	baseline := seededLines(t, env)
	for part, want := range map[string]int{"x-mod-alpha": 100, "x-herdr-gamma": 60, "x:guide-delta": 40, "x lane": 100} {
		if baseline[part] != want {
			t.Errorf("%s seeded at %d lines, want %d: %v", part, baseline[part], want, baseline)
		}
	}
}

// exit 1: a part whose lines reach twice its baseline is named alone with lines then → now and the trigger «size»; a part born after the
// seed starts at its own size
func TestFleetGrowthNamesAPartAtTwiceItsBaseline(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		lines int
		named bool
	}{
		{"one line short of twice", 199, false},
		{"twice", 200, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			root, env := growthWorld(t)
			growth(t, root, env)
			write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", c.lines))
			write(t, filepath.Join(root, "home/.claude/plugin-x/mods/x-mod-born/main.ts"), strings.Repeat("x\n", 900))
			gitT(t, root, "add", "-A")

			got := growth(t, root, env)

			if born := seededLines(t, env)["x-mod-born"]; born != 900 {
				t.Errorf("a part born after the seed starts at %d lines, want its own 900", born)
			}
			if !c.named {
				if len(got.Crossings) != 0 {
					t.Errorf("%d crossings, want none: %+v", len(got.Crossings), got.Crossings)
				}
				return
			}
			want := growthCrossing{Part: "x-mod-alpha", Trigger: "size", Then: 100, Now: 200}
			if len(got.Crossings) != 1 || bare(got.Crossings[0]) != want {
				t.Errorf("crossings %+v, want only %+v", got.Crossings, want)
			}
		})
	}
}

// a commit of one new line under a part's directory, dated hoursAgo before growthNow
func fixCommit(t *testing.T, root, dir, subject string, hoursAgo int) {
	t.Helper()
	now, _ := time.Parse(time.RFC3339, growthNow)
	growthCommit(t, root, dir, subject, now.Add(-time.Duration(hoursAgo)*time.Hour).Format(time.RFC3339), 1)
}

// a commit of one new file of `lines` lines under a part's directory, dated at
func growthCommit(t *testing.T, root, dir, subject, at string, lines int) {
	t.Helper()
	write(t, filepath.Join(root, dir, fmt.Sprintf("note-%d.txt", time.Now().UnixNano())), strings.Repeat("x\n", lines))
	gitT(t, root, "add", "-A")
	c := exec.Command("git", "-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false", "commit", "-q", "-m", subject)
	c.Dir = root
	c.Env = append(cleanEnv(), "GIT_AUTHOR_DATE="+at, "GIT_COMMITTER_DATE="+at)
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("git commit: %v\n%s", err, out)
	}
}

// one day of his prompts log under the fixture HOME: each block is «HH:MM text»
func promptsDay(t *testing.T, env []string, day string, blocks ...string) {
	t.Helper()
	promptsFile(t, env, day+".md", blocks...)
}

// the same under a wing's own dir: `prompts/wing-<n>/<day>.md`
func promptsWingDay(t *testing.T, env []string, wing int, day string, blocks ...string) {
	t.Helper()
	promptsFile(t, env, fmt.Sprintf("wing-%d/%s.md", wing, day), blocks...)
}

func promptsFile(t *testing.T, env []string, name string, blocks ...string) {
	t.Helper()
	var body strings.Builder
	for _, block := range blocks {
		at, text, _ := strings.Cut(block, " ")
		fmt.Fprintf(&body, "## %s\n\n%s\n\n", at, text)
	}
	write(t, filepath.Join(strings.TrimPrefix(env[2], "HOME="), ".local/state/clio/prompts", name), body.String())
}

const (
	growthAlphaDir = "home/.claude/plugin-x/mods/x-mod-alpha"
	growthGammaDir = "home/.config/herdr-app/mods/x-herdr-gamma"
	growthDeltaDir = "home/.claude/plugin-x/skills/guide-delta"
	growthFix      = "🐞 x-mod-alpha: a fix"
)

// exit 2, the fixes half: 3 🐞 commits touching one part in 7 days name it «fixes», counted from the seed on; 2, other subjects,
// commits spread over parts, commits before the seed and commits past the window name nothing
func TestFleetGrowthNamesAPartWithThreeFixesInSevenDays(t *testing.T) {
	t.Parallel()
	type commit struct {
		dir, subject string
		hoursAgo     int
	}
	for _, c := range []struct {
		name    string
		seed    string
		commits []commit
		want    int
	}{
		{"three fixes after the seed", "2026-11-20T09:00:00Z", []commit{{growthAlphaDir, growthFix, 1}, {growthAlphaDir, growthFix, 2}, {growthAlphaDir, growthFix, 1}}, 3},
		{"the oldest six days old", "2026-11-01T09:00:00Z", []commit{{growthAlphaDir, growthFix, 1}, {growthAlphaDir, growthFix, 2}, {growthAlphaDir, growthFix, 144}}, 3},
		{"two fixes", "2026-11-20T09:00:00Z", []commit{{growthAlphaDir, growthFix, 1}, {growthAlphaDir, growthFix, 2}}, 0},
		{"two fixes and a refactor", "2026-11-20T09:00:00Z", []commit{{growthAlphaDir, growthFix, 1}, {growthAlphaDir, growthFix, 2}, {growthAlphaDir, "✨ x-mod-alpha: split", 1}}, 0},
		{"three fixes over three parts", "2026-11-20T09:00:00Z", []commit{{growthAlphaDir, growthFix, 1}, {growthGammaDir, growthFix, 2}, {growthDeltaDir, growthFix, 1}}, 0},
		{"three fixes before the seed", "2026-11-20T11:30:00Z", []commit{{growthAlphaDir, growthFix, 2}, {growthAlphaDir, growthFix, 3}, {growthAlphaDir, growthFix, 4}}, 0},
		{"two fixes and one eight days old", "2026-11-01T09:00:00Z", []commit{{growthAlphaDir, growthFix, 1}, {growthAlphaDir, growthFix, 2}, {growthAlphaDir, growthFix, 192}}, 0},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			root, env := growthWorld(t)
			if strings.Contains(c.name, "before the seed") {
				for _, k := range c.commits {
					fixCommit(t, root, k.dir, k.subject, k.hoursAgo)
				}
				growthAt(t, root, env, c.seed)
			} else {
				growthAt(t, root, env, c.seed)
				for _, k := range c.commits {
					fixCommit(t, root, k.dir, k.subject, k.hoursAgo)
				}
			}

			got := growth(t, root, env)

			if c.want == 0 {
				if len(got.Crossings) != 0 {
					t.Errorf("crossings %+v, want none", got.Crossings)
				}
				return
			}
			want := growthCrossing{Part: "x-mod-alpha", Trigger: "fixes", Count: c.want}
			if len(got.Crossings) != 1 || bare(got.Crossings[0]) != want {
				t.Errorf("crossings %+v, want only %+v", got.Crossings, want)
			}
		})
	}
}

// exit 2, the turns half: 3 of his prompt blocks naming one part on one day name it «turns (rough)»; 2, 3 over two days, 3 with one
// naming another part and 3 before the seed name nothing
func TestFleetGrowthNamesAPartWithThreeOfHisTurnsInOneDay(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		seed   string
		days   map[string][]string
		wantIn bool
	}{
		{"three turns in a day", "2026-11-20T09:00:00Z", map[string][]string{"2026-11-20": {"22:00 x-mod-alpha is slow", "22:05 the X-MOD-ALPHA band", "22:10 x-mod-alpha again"}}, true},
		{"two turns", "2026-11-20T09:00:00Z", map[string][]string{"2026-11-20": {"22:00 x-mod-alpha is slow", "22:05 x-mod-alpha again"}}, false},
		{"three turns over two days", "2026-11-01T09:00:00Z", map[string][]string{"2026-11-19": {"22:00 x-mod-alpha", "22:05 x-mod-alpha"}, "2026-11-20": {"22:00 x-mod-alpha"}}, false},
		{"one of three names another part", "2026-11-20T09:00:00Z", map[string][]string{"2026-11-20": {"22:00 x-mod-alpha", "22:05 x-mod-alpha", "22:10 x-mod-beta"}}, false},
		{"three turns before the seed", "2026-11-20T09:00:00Z", map[string][]string{"2026-11-20": {"05:00 x-mod-alpha", "05:05 x-mod-alpha", "05:10 x-mod-alpha"}}, false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			root, env := growthWorld(t)
			growthAt(t, root, env, c.seed)
			for day, blocks := range c.days {
				promptsDay(t, env, day, blocks...)
			}

			got := growth(t, root, env)

			want := growthCrossing{Part: "x-mod-alpha", Trigger: "turns (rough)", Count: 3}
			if c.wantIn && (len(got.Crossings) != 1 || bare(got.Crossings[0]) != want) {
				t.Errorf("crossings %+v, want only %+v", got.Crossings, want)
			}
			if !c.wantIn && len(got.Crossings) != 0 {
				t.Errorf("crossings %+v, want none", got.Crossings)
			}
		})
	}
}

func keepAt(t *testing.T, root string, env []string, now string, part string) ran {
	t.Helper()
	return xIn(t, root, append(env, "X_NOW="+now), "fleet", "growth", "--keep", part, "--json")
}

// FRM-701 exit 1: a size or fixes crossing prints on every run until it is kept, with the date it was first reported
func TestFleetGrowthPrintsAReportedCrossingOnEveryRunWithItsFirstDate(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 200))
	gitT(t, root, "add", "-A")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}

	for _, now := range []string{growthNow, "2026-11-21T12:00:00Z", "2026-11-22T12:00:00Z"} {
		got := growthAt(t, root, env, now)

		if len(got.Crossings) != 2 {
			t.Fatalf("run at %s: %+v, want the size and the fixes crossings", now, got.Crossings)
		}
		for _, c := range got.Crossings {
			if c.First != "2026-11-20" || c.Calmed {
				t.Errorf("run at %s: %+v, want first 2026-11-20 and not calmed", now, c)
			}
		}
	}
}

// the text prints the first date beside the ask, which stays the ask
func TestFleetGrowthPrintsTheFirstDateInItsText(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}

	got := xIn(t, root, append(env, "X_NOW="+growthNow), "fleet", "growth", "--board")

	if !strings.Contains(got.stdout, "first: 2026-11-20") || !strings.Contains(got.stdout, "keep, shrink or delete?") {
		t.Errorf("text %q, want the ask and «first: 2026-11-20»", got.stdout)
	}
}

// a crossing that fell back under its limit stays in the report until the keep, and says it calmed down
func TestFleetGrowthKeepsACalmedCrossingInTheReportUntilTheKeep(t *testing.T) {
	t.Parallel()
	t.Run("fixes", func(t *testing.T) {
		t.Parallel()
		root, env := growthWorld(t)
		growthAt(t, root, env, "2026-11-20T09:00:00Z")
		for range 3 {
			fixCommit(t, root, growthAlphaDir, growthFix, 1)
		}
		growth(t, root, env)

		got := growthAt(t, root, env, "2026-11-29T12:00:00Z")

		if len(got.Crossings) != 1 || got.Crossings[0].Trigger != "fixes" || !got.Crossings[0].Calmed || got.Crossings[0].First != "2026-11-20" {
			t.Fatalf("crossings %+v, want the fixes crossing, calmed, first 2026-11-20", got.Crossings)
		}
		if ask := got.Crossings[0].Ask; !strings.Contains(ask, "was over the limit, now 0") || !strings.Contains(ask, "calmed down") {
			t.Errorf("ask %q, want «was over the limit, now 0» and «calmed down»", ask)
		}
	})
	t.Run("size", func(t *testing.T) {
		t.Parallel()
		root, env := growthWorld(t)
		growthAt(t, root, env, "2026-11-20T09:00:00Z")
		write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 200))
		gitT(t, root, "add", "-A")
		growth(t, root, env)
		write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 150))
		gitT(t, root, "add", "-A")

		got := growthAt(t, root, env, "2026-11-21T12:00:00Z")

		if len(got.Crossings) != 1 || got.Crossings[0].Trigger != "size" || !got.Crossings[0].Calmed || got.Crossings[0].Now != 150 {
			t.Fatalf("crossings %+v, want the size crossing, calmed, at 150", got.Crossings)
		}
		if ask := got.Crossings[0].Ask; !strings.Contains(ask, "was over the limit, now 150") || !strings.Contains(ask, "calmed down") {
			t.Errorf("ask %q, want «was over the limit, now 150» and «calmed down»", ask)
		}
	})
}

// the rough turns trigger still prints once: six skills carry it today and six standing reds would be noise
func TestFleetGrowthPrintsTheRoughTurnsCrossingOnce(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	promptsDay(t, env, "2026-11-20", "22:00 x-mod-alpha is slow", "22:05 the X-MOD-ALPHA band", "22:10 x-mod-alpha again")
	if first := growth(t, root, env); len(first.Crossings) != 1 || first.Crossings[0].Trigger != "turns (rough)" || first.Crossings[0].First != "" {
		t.Fatalf("first run %+v, want the turns crossing with no first date", first.Crossings)
	}

	if again := growth(t, root, env); len(again.Crossings) != 0 {
		t.Errorf("second run %+v, want the reported turns crossing quiet", again.Crossings)
	}
}

// a baseline written before the first date existed: read whole and written back (a second part crosses new); a kind it reported
// before gets this run's day and says it was reported before, on every later run too; a new crossing is simply first
func TestFleetGrowthDatesAKindReportedBeforeTheFirstDateExisted(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	reportedAs(t, env, "x-mod-alpha", "fixes")
	reportedAs(t, env, "x-herdr-gamma", "size")
	write(t, filepath.Join(root, growthHerdr), strings.Repeat("x\n", 120))
	gitT(t, root, "add", "-A")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}
	write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 200))
	gitT(t, root, "add", "-A")
	before := len(seededLines(t, env))

	got := growth(t, root, env)

	byKind := map[string]growthCrossing{}
	for _, c := range got.Crossings {
		byKind[c.Part+" "+c.Trigger] = c
	}
	if len(got.Crossings) != 3 {
		t.Fatalf("crossings %+v, want the old fixes, the old size and the new size of x-mod-alpha", got.Crossings)
	}
	if c := byKind["x-mod-alpha fixes"]; c.First != "2026-11-20" || !c.ReportedBefore || c.Calmed {
		t.Errorf("old fixes crossing %+v, want first 2026-11-20, reported before", c)
	}
	if c := byKind["x-herdr-gamma size"]; c.First != "2026-11-20" || !c.ReportedBefore || c.Calmed || c.Now != 120 {
		t.Errorf("old size crossing %+v, want first 2026-11-20, reported before, at 120", c)
	}
	if c := byKind["x-mod-alpha size"]; c.First != "2026-11-20" || c.ReportedBefore {
		t.Errorf("new size crossing %+v, want first 2026-11-20 and not reported before", c)
	}
	raw, err := os.ReadFile(filepath.Join(strings.TrimPrefix(env[1], "X_STATE="), "fleet-growth", "baseline.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Parts map[string]struct {
			Reported []string          `json:"reported"`
			First    map[string]string `json:"first"`
			Before   []string          `json:"before"`
		} `json:"parts"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	if after := len(file.Parts); after != before {
		t.Errorf("%d parts in the rewritten baseline, want the %d it held", after, before)
	}
	if old := file.Parts["x-herdr-gamma"]; !slices.Equal(old.Reported, []string{"size"}) || old.First["size"] != "2026-11-20" || !slices.Equal(old.Before, []string{"size"}) {
		t.Errorf("x-herdr-gamma written back as %+v, want reported [size], first 2026-11-20, before [size]", old)
	}
	if mixed := file.Parts["x-mod-alpha"]; !slices.Equal(mixed.Reported, []string{"fixes", "size"}) || mixed.First["size"] != "2026-11-20" || !slices.Equal(mixed.Before, []string{"fixes"}) {
		t.Errorf("x-mod-alpha written back as %+v, want reported [fixes size], both dated, before [fixes] only", mixed)
	}

	later := growthAt(t, root, env, "2026-11-22T12:00:00Z")
	for _, c := range later.Crossings {
		if c.First != "2026-11-20" || c.ReportedBefore != (c.Part+" "+c.Trigger != "x-mod-alpha size") {
			t.Errorf("two days on: %+v, want the first date kept and «reported before» kept for the old kinds only", c)
		}
	}
	if text := xIn(t, root, append(env, "X_NOW=2026-11-22T12:00:00Z"), "fleet", "growth", "--board"); strings.Count(text.stdout, "first seen 2026-11-20, reported") != 2 || strings.Count(text.stdout, "first: 2026-11-20") != 1 {
		t.Errorf("text %q, want «first seen 2026-11-20, reported before» twice (the board wraps its last word) and «first: 2026-11-20» once", text.stdout)
	}
}

// a seed older than the week the git read covers: the since count says the date it really counts from
func TestFleetGrowthDatesTheSinceCountFromTheWeekWhenTheSeedIsOlder(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-01T09:00:00Z")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}

	got := growthAt(t, root, env, "2026-11-20T12:00:00Z")

	if len(got.Crossings) != 1 || got.Crossings[0].Since != "2026-11-13" {
		t.Fatalf("crossings %+v, want the fixes crossing counted since 2026-11-13", got.Crossings)
	}
	if ask := got.Crossings[0].Ask; !strings.Contains(ask, "fixes since 2026-11-13: 3, in 7 days: 3") {
		t.Errorf("ask %q, want «fixes since 2026-11-13: 3, in 7 days: 3»", ask)
	}
}

// a fixes read that fails says so and invents no calmed row: «now 0» would be a count nobody took
func TestFleetGrowthNamesNoCalmedFixesRowWhenItsGitReadFailed(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	reportedAs(t, env, "x-mod-alpha", "fixes")
	write(t, filepath.Join(root, ".git/HEAD"), "ref: refs/heads/no-such-branch\n")

	got := growthAt(t, root, env, "2026-11-28T12:00:00Z")

	if len(got.Crossings) != 0 || !strings.Contains(got.Error, "git log failed") {
		t.Errorf("crossings %+v, error %q, want no row and the failed read said", got.Crossings, got.Error)
	}
}

// the calmed text names both counts
func TestFleetGrowthCalmedTextNamesBothCounts(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}
	growth(t, root, env)
	fixCommit(t, root, growthAlphaDir, growthFix, 1)

	got := growthAt(t, root, env, "2026-11-29T12:00:00Z")

	if len(got.Crossings) != 1 || !got.Crossings[0].Calmed || !strings.Contains(got.Crossings[0].Ask, "now 0 fixes since 2026-11-22, 0 in 7 days") {
		t.Errorf("crossings %+v, want the calmed row naming 0 since 2026-11-22 and 0 in 7 days", got.Crossings)
	}
}

// a part reported for fixes, then no fix commit for 8 days: its row says it is under the limit now (the same fixture as the want line, less its 15 fixes)
func TestFleetGrowthSaysAReportedPartIsUnderItsLimitNow(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	reportedAs(t, env, "x-mod-alpha", "fixes")

	got := growthAt(t, root, env, "2026-11-28T12:00:00Z")

	if len(got.Crossings) != 1 || !got.Crossings[0].Calmed || !strings.Contains(got.Crossings[0].Ask, "was over the limit, now 0") {
		t.Errorf("crossings %+v, want the reported fixes row, calmed", got.Crossings)
	}
}

// the want line: x-mod-stash on 24 Nov, reported for fixes on 23 Nov, 15 fix commits since, and nothing printed that day
func TestFleetGrowthPrintsTheStashsFifteenFixesTheDayAfterItsReport(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	write(t, filepath.Join(root, "home/.claude/plugin-x/mods/x-mod-stash/hooks/main.ts"), strings.Repeat("x\n", 100))
	gitT(t, root, "add", "-A")
	gitT(t, root, "commit", "-q", "-m", "the stash")
	growthAt(t, root, env, "2026-11-23T16:36:00Z")
	reportedAs(t, env, "x-mod-stash", "fixes")
	for i := range 15 {
		growthCommit(t, root, "home/.claude/plugin-x/mods/x-mod-stash", "🐞 x-mod-stash: a fix", fmt.Sprintf("2026-11-24T%02d:%02d:00Z", 8+i/4, i%4*10), 1)
	}

	got := growthAt(t, root, env, "2026-11-24T18:00:00Z")

	want := growthCrossing{Part: "x-mod-stash", Trigger: "fixes", Count: 15}
	if len(got.Crossings) != 1 || bare(got.Crossings[0]) != want {
		t.Errorf("crossings %+v, want only %+v", got.Crossings, want)
	}
}

// a keep answers every kind at once: nothing prints after it, and the part prints again at twice its size at the keep
func TestFleetGrowthKeepSilencesEveryKindAndTheSizeStartsAgainFromTheKeep(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 200))
	gitT(t, root, "add", "-A")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}
	growth(t, root, env)
	keepAt(t, root, env, growthNow, "x-mod-alpha")

	if got := growthAt(t, root, env, "2026-11-21T12:00:00Z"); len(got.Crossings) != 0 {
		t.Fatalf("after the keep %+v, want nothing of any kind", got.Crossings)
	}

	write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 2*203))
	gitT(t, root, "add", "-A")
	got := growthAt(t, root, env, "2026-11-22T12:00:00Z")
	if len(got.Crossings) != 1 || got.Crossings[0].Trigger != "size" || got.Crossings[0].Then != 203 || got.Crossings[0].First != "2026-11-22" {
		t.Errorf("at twice the kept size %+v, want the size crossing from 203, first 2026-11-22", got.Crossings)
	}
}

// the fixes count runs from the seed or the keep, so the crossing names both it and the week's: «fixes since <date>: 3, in 7 days: 7»
func TestFleetGrowthNamesTheFixesSinceTheKeepAndInSevenDays(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	for range 4 {
		fixCommit(t, root, growthAlphaDir, growthFix, 5)
	}
	keepAt(t, root, env, growthNow, "x-mod-alpha")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, -1)
	}

	got := growthAt(t, root, env, "2026-11-21T12:00:00Z")

	if len(got.Crossings) != 1 {
		t.Fatalf("crossings %+v, want the fixes crossing alone", got.Crossings)
	}
	c := got.Crossings[0]
	if c.Trigger != "fixes" || c.Count != 3 || c.Week != 7 || c.Since != "2026-11-20" {
		t.Errorf("crossing %+v, want fixes, 3 since 2026-11-20, 7 in the week", c)
	}
	if !strings.Contains(c.Ask, "fixes since 2026-11-20: 3, in 7 days: 7") {
		t.Errorf("ask %q, want «fixes since 2026-11-20: 3, in 7 days: 7»", c.Ask)
	}
}

// the baseline as an older x wrote it: the kinds a part was reported for, with no dates
func reportedAs(t *testing.T, env []string, part string, kinds ...string) {
	t.Helper()
	file := filepath.Join(strings.TrimPrefix(env[1], "X_STATE="), "fleet-growth", "baseline.json")
	raw, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	var baseline struct {
		Parts map[string]map[string]any `json:"parts"`
	}
	if err := json.Unmarshal(raw, &baseline); err != nil {
		t.Fatal(err)
	}
	baseline.Parts[part]["reported"] = kinds
	out, _ := json.Marshal(baseline)
	write(t, file, string(out))
}

// exit 3, the second half: --keep re-seeds the part at today's size and stamps «kept at»; the 3 fixes still inside 7 days predate it, so
// nothing crosses, and 3 fixes after the keep make a new crossing
func TestFleetGrowthKeepForgetsTheFixesBeforeItAndCountsThreeAfter(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 200))
	gitT(t, root, "add", "-A")
	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}
	if first := growth(t, root, env); len(first.Crossings) != 2 {
		t.Fatalf("first run %+v, want the size and the fixes crossings", first.Crossings)
	}

	if got := keepAt(t, root, env, growthNow, "x-mod-alpha"); got.code != 0 {
		t.Fatalf("keep exit %d\n%s", got.code, got.stdout)
	}
	again := growthAt(t, root, env, "2026-11-20T12:30:00Z")
	if len(again.Crossings) != 0 {
		t.Errorf("after keep %+v, want nothing: the size is re-seeded and the fixes predate «kept at»", again.Crossings)
	}
	if lines := seededLines(t, env)["x-mod-alpha"]; lines != 203 {
		t.Errorf("kept at %d lines, want today's 203", lines)
	}

	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, -1)
	}
	got := growthAt(t, root, env, "2026-11-20T14:00:00Z")
	want := growthCrossing{Part: "x-mod-alpha", Trigger: "fixes", Count: 3}
	if len(got.Crossings) != 1 || bare(got.Crossings[0]) != want {
		t.Errorf("3 fixes after the keep %+v, want only %+v", got.Crossings, want)
	}
}

// a part that is not in the baseline is a usage error naming the way on
func TestFleetGrowthKeepNamesNoUnknownPart(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growth(t, root, env)

	got := keepAt(t, root, env, growthNow, "x-mod-nope")

	if got.code != 2 || !strings.Contains(got.next, "x fleet growth") {
		t.Errorf("exit %d next %q, want 2 and the verb to run", got.code, got.next)
	}
}

// exit 6, the want line (W14: «we was building a guard for 26 days, and only after i spotted an issue an raised»): the guard's
// history replayed, 932 lines on 6 Nov and 2,617 on 12 Nov; the reader at the 12 Nov point names x-mod-guard with the ask
func TestFleetGrowthNamesTheGuardBeforeDimaSpotsIt(t *testing.T) {
	t.Parallel()
	const guardDir = "home/.claude/plugin-x/mods/x-mod-guard"
	root, env := growthWorld(t)
	growthCommit(t, root, guardDir, "✨ x-mod-guard: the guard stands in for the permission prompt", "2026-11-06T10:00:00Z", 932)
	growthAt(t, root, env, "2026-11-06T12:00:00Z")
	growthCommit(t, root, guardDir, "🔧 x-mod-guard: the command rules", "2026-11-08T10:00:00Z", 900)
	for _, at := range []string{"2026-11-09T10:00:00Z", "2026-11-10T10:00:00Z", "2026-11-11T10:00:00Z"} {
		growthCommit(t, root, guardDir, "🐞 x-mod-guard: a refusal", at, 1)
	}
	growthCommit(t, root, guardDir, "🔧 x-mod-guard: the rest", "2026-11-12T10:00:00Z", 782)
	promptsDay(t, env, "2026-11-12", "13:00 x-mod-guard grew again", "13:05 the x-mod-guard story")

	got := growthAt(t, root, env, "2026-11-12T12:00:00Z")

	var ask string
	for _, c := range got.Crossings {
		if c.Part == "x-mod-guard" && c.Trigger == "size" {
			ask = c.Ask
		}
	}
	for _, want := range []string{"x-mod-guard", "932 → 2,617 lines", "first commit «✨ x-mod-guard: the guard stands in for the permission prompt» on 2026-11-06", "fixes since 2026-11-06: 3, in 7 days: 3", "his turns in a day (rough): 2", "keep, shrink or delete"} {
		if !strings.Contains(ask, want) {
			t.Errorf("the ask lacks %q:\n%s", want, ask)
		}
	}
}

// a block names a part by its own words: «nxq» and «5xq» are no `clio:xq`, a hyphenated mod's name is no `x:gamma` skill; a skill's
// bare name counts only when it holds a hyphen
func TestFleetGrowthCountsATurnOnlyOnAPartsOwnWords(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		blocks []string
		want   []growthCrossing
	}{
		{"nxq and 5xq are no clio:xq", []string{"22:00 nxq install", "22:05 at 5xq", "22:10 nxq run build"}, nil},
		{"a bare xq is no clio:xq", []string{"22:00 the xq skill", "22:05 xq review", "22:10 a xq"}, nil},
		{"a hyphenated name inside longer words", []string{"22:00 guide-deltaic", "22:05 preguide-delta", "22:10 the xguide-delta"}, nil},
		{"x-herdr-gamma is no x:gamma", []string{"22:00 x-herdr-gamma", "22:05 x-herdr-gamma again", "22:10 the x-herdr-gamma tab"}, []growthCrossing{{Part: "x-herdr-gamma", Trigger: "turns (rough)", Count: 3}}},
		{"the skill by its id", []string{"22:00 clio:xq", "22:05 `clio:xq` again", "22:10 use clio:xq."}, []growthCrossing{{Part: "clio:xq", Trigger: "turns (rough)", Count: 3}}},
		{"a hyphenated skill by its bare name", []string{"22:00 the guide-delta", "22:05 guide-delta", "22:10 guide-delta"}, []growthCrossing{{Part: "x:guide-delta", Trigger: "turns (rough)", Count: 3}}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			root, env := growthWorld(t)
			growthAt(t, root, env, "2026-11-20T09:00:00Z")
			promptsDay(t, env, "2026-11-20", c.blocks...)

			got := growth(t, root, env)

			var bareGot []growthCrossing
			for _, crossing := range got.Crossings {
				bareGot = append(bareGot, bare(crossing))
			}
			if fmt.Sprint(bareGot) != fmt.Sprint(c.want) {
				t.Errorf("crossings %+v, want %+v", bareGot, c.want)
			}
		})
	}
}

// his turns in a wing count too: two in the main's log and one in wing 2's make three
func TestFleetGrowthCountsHisTurnsInAWingToo(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	promptsDay(t, env, "2026-11-20", "22:00 x-mod-alpha", "22:05 x-mod-alpha")
	promptsWingDay(t, env, 2, "2026-11-20", "22:10 x-mod-alpha")

	got := growth(t, root, env)

	want := growthCrossing{Part: "x-mod-alpha", Trigger: "turns (rough)", Count: 3}
	if len(got.Crossings) != 1 || bare(got.Crossings[0]) != want {
		t.Errorf("crossings %+v, want only %+v", got.Crossings, want)
	}
}

// a baseline that exists and does not parse is left as it is: reseeding would drop every named kind and kept stamp
func TestFleetGrowthLeavesABaselineItCannotParse(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	file := filepath.Join(strings.TrimPrefix(env[1], "X_STATE="), "fleet-growth", "baseline.json")
	write(t, file, "{not json")

	got := xIn(t, root, append(env, "X_NOW="+growthNow), "fleet", "growth", "--json")

	if left, _ := os.ReadFile(file); got.code != 1 || string(left) != "{not json" || !strings.Contains(got.stdout, "baseline.json") {
		t.Errorf("exit %d, baseline %q, want exit 1, the file untouched and named:\n%s", got.code, left, got.stdout)
	}
}

// the reader never refuses: a tree git cannot read is said in `error`, exit 0
func TestFleetGrowthSaysWhatItCouldNotReadAndExitsZero(t *testing.T) {
	t.Parallel()
	_, env := growthWorld(t)
	env[0] = "X_FRAME_ROOT=" + t.TempDir()

	got := xIn(t, t.TempDir(), append(env, "X_NOW="+growthNow), "fleet", "growth", "--json")

	var envelope struct {
		Data growthData `json:"data"`
	}
	if err := json.Unmarshal([]byte(got.stdout), &envelope); err != nil {
		t.Fatalf("%v\n%s", err, got.stdout)
	}
	if got.code != 0 || envelope.Data.Error == "" || len(envelope.Data.Crossings) != 0 {
		t.Errorf("exit %d, data %+v, want exit 0, an error said and no crossing:\n%s", got.code, envelope.Data, got.stdout)
	}
}
