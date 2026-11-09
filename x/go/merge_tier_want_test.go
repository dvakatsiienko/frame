package main

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
)

// frame's last 20 merged prs and the escapes of docs/test-drive/wisphunter.md round 6, their paths snapshotted once
type tierSnapshot struct {
	Chunks []struct {
		PR    int      `json:"pr"`
		Title string   `json:"title"`
		Paths []string `json:"paths"`
	} `json:"chunks"`
	Escapes []struct {
		Name  string   `json:"name"`
		Paths []string `json:"paths"`
	} `json:"escapes"`
}

func readTierSnapshot(t *testing.T) tierSnapshot {
	t.Helper()
	raw, err := os.ReadFile("testdata/review-tiers.json")
	if err != nil {
		t.Fatal(err)
	}
	var snap tierSnapshot
	if err := json.Unmarshal(raw, &snap); err != nil {
		t.Fatal(err)
	}
	if len(snap.Chunks) != 20 || len(snap.Escapes) == 0 {
		t.Fatalf("snapshot holds %d chunks and %d escapes, want 20 and some", len(snap.Chunks), len(snap.Escapes))
	}
	return snap
}

// FRM-548 exit 6, the want line: no recorded escape reads light, so each keeps its sixth sense
func TestTiersKeepTheSixthSenseOnEveryRecordedEscape(t *testing.T) {
	t.Parallel()
	for _, e := range readTierSnapshot(t).Escapes {
		if got := tierOf(e.Paths); got.Tier == "light" || !slices.Contains(got.Asks, "sixth-sense") {
			t.Errorf("%s reads %s asking %v, want its sixth sense kept", e.Name, got.Tier, got.Asks)
		}
	}
}

// FRM-548 exit 6: over the last 20 chunks, none drops its sixth sense, since none was docs-only
func TestTiersOverFramesLastTwentyChunks(t *testing.T) {
	t.Parallel()
	for _, c := range readTierSnapshot(t).Chunks {
		got := tierOf(c.Paths)
		t.Logf("#%d %s: %s", c.PR, got.Tier, got.shown())
		if !slices.Contains(got.Asks, "sixth-sense") {
			t.Errorf("#%d %q drops its sixth sense as %s", c.PR, c.Title, got.Tier)
		}
	}
}

// FRM-548 exit 6: a docs-only pr asks none, a guard pr the security pass, a skill pr the wishkeeper read; the guard and
// skill prs are snapshotted ones, the docs-only one is made up, since none of the 20 was
func TestTiersAskWhatEachKindOfPrNeeds(t *testing.T) {
	t.Parallel()
	snap := readTierSnapshot(t)
	pathsOf := func(pr int) []string {
		i := slices.IndexFunc(snap.Chunks, func(c struct {
			PR    int      `json:"pr"`
			Title string   `json:"title"`
			Paths []string `json:"paths"`
		}) bool {
			return c.PR == pr
		})
		if i < 0 {
			t.Fatalf("#%d is not in the snapshot", pr)
		}
		return snap.Chunks[i].Paths
	}
	for _, c := range []struct {
		name  string
		paths []string
		asks  string
		lacks string
	}{
		{"a docs-only pr, made up", []string{"docs/research/x.md", "docs/test-drive/y.md"}, "", "sixth-sense"},
		{"the guard pr FRM-425 escaped through", snap.Escapes[0].Paths, "security", ""},
		{"the skill pr #130", pathsOf(130), "wishkeeper", ""},
	} {
		got := tierOf(c.paths)
		switch {
		case c.asks == "" && len(got.Asks) != 0:
			t.Errorf("%s asks %v, want none", c.name, got.Asks)
		case c.asks != "" && !slices.Contains(got.Asks, c.asks):
			t.Errorf("%s asks %v, want %s among them", c.name, got.Asks, c.asks)
		case c.lacks != "" && slices.Contains(got.Asks, c.lacks):
			t.Errorf("%s asks %v, want no %s", c.name, got.Asks, c.lacks)
		}
	}
}
