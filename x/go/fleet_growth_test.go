package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
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
	return root, []string{"X_FRAME_ROOT=" + root, "X_STATE=" + t.TempDir()}
}

func growth(t *testing.T, root string, env []string) growthData {
	t.Helper()
	got := xIn(t, root, env, "fleet", "growth", "--json")
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
			if len(got.Crossings) != 1 || got.Crossings[0] != want {
				t.Errorf("crossings %+v, want only %+v", got.Crossings, want)
			}
		})
	}
}
