package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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
	gitT(t, root, "add", "-A")
	gitT(t, root, "commit", "-q", "-m", "parts")
	return root, []string{"X_FRAME_ROOT=" + root, "X_STATE=" + t.TempDir(), "HOME=" + t.TempDir()}
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

// a crossing without its ask text, for the tests that compare what crossed
func bare(c growthCrossing) growthCrossing {
	c.Ask = ""
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
	var body strings.Builder
	for _, block := range blocks {
		at, text, _ := strings.Cut(block, " ")
		fmt.Fprintf(&body, "## %s\n\n%s\n\n", at, text)
	}
	write(t, filepath.Join(strings.TrimPrefix(env[2], "HOME="), ".local/state/clio/prompts", day+".md"), body.String())
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

// exit 3, the first half: a crossing is a part plus a trigger kind and is named once; another kind on the same part is a new crossing
func TestFleetGrowthNamesACrossingOnce(t *testing.T) {
	t.Parallel()
	root, env := growthWorld(t)
	growthAt(t, root, env, "2026-11-20T09:00:00Z")
	write(t, filepath.Join(root, growthMod), strings.Repeat("x\n", 200))
	gitT(t, root, "add", "-A")
	if first := growth(t, root, env); len(first.Crossings) != 1 || first.Crossings[0].Trigger != "size" {
		t.Fatalf("first run %+v, want the size crossing", first.Crossings)
	}

	if again := growth(t, root, env); len(again.Crossings) != 0 {
		t.Errorf("second run %+v, want the reported size crossing quiet", again.Crossings)
	}

	for range 3 {
		fixCommit(t, root, growthAlphaDir, growthFix, 1)
	}
	got := growth(t, root, env)
	if len(got.Crossings) != 1 || got.Crossings[0].Trigger != "fixes" {
		t.Errorf("after 3 fixes %+v, want only the new «fixes» crossing", got.Crossings)
	}
}

// exit 3, the second half: --keep re-seeds the part at today's size and stamps «kept at»; the 3 fixes still inside 7 days predate it, so
// nothing crosses, and 3 fixes after the keep make a new crossing
func TestFleetGrowthKeepAnswersACrossing(t *testing.T) {
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
	for _, want := range []string{"x-mod-guard", "932 → 2,617 lines", "first commit «✨ x-mod-guard: the guard stands in for the permission prompt» on 2026-11-06", "fixes in 7 days: 3", "his turns in a day (rough): 2", "keep, shrink or delete"} {
		if !strings.Contains(ask, want) {
			t.Errorf("the ask lacks %q:\n%s", want, ask)
		}
	}
}
