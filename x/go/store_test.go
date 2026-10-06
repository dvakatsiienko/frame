package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestParseNameReadsTheSharedGrammar(t *testing.T) {
	raw, err := os.ReadFile("../../script/lib/handoff-names.json")
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Cases []struct {
			File   string `json:"file"`
			Parsed *name  `json:"parsed"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	for _, c := range file.Cases {
		got, ok := parseName(c.File)
		if c.Parsed == nil {
			if ok {
				t.Errorf("%s: parsed as %+v, want not a handoff", c.File, got)
			}
			continue
		}
		if !ok || got != *c.Parsed {
			t.Errorf("%s: got %+v, want %+v", c.File, got, *c.Parsed)
		}
	}
}

func TestAgeReadsMinutesThenHoursThenDays(t *testing.T) {
	now := time.Now()
	cases := []struct {
		ago   time.Duration
		label string
		stale bool
	}{
		{20 * time.Minute, "20m", false},
		{5 * time.Hour, "5h", false},
		{3 * 24 * time.Hour, "3d", false},
		{staleAfter - time.Minute, "7d", false},
		{staleAfter + time.Minute, "7d", true},
	}
	for _, c := range cases {
		if got := ageOf(now.Add(-c.ago), now); got.label != c.label || got.stale != c.stale {
			t.Errorf("%v ago: got %+v, want %s stale=%v", c.ago, got, c.label, c.stale)
		}
	}
}

func TestRunIDReadsTheValueNotTheMarkerLabel(t *testing.T) {
	cases := map[string]string{
		"# META\n\nrun id: **cc·20260831·probe**":                "cc·20260831·probe",
		"# META\n\n- **run marker** — run id: **cc·20261006·x**": "cc·20261006·x",
		"# META\n\n**Run marker:** `cc·old·shape`":               "cc·old·shape",
		"# META\n\nno marker here":                               "",
	}
	for meta, want := range cases {
		got := parseRunID(&meta)
		if (got == nil && want != "") || (got != nil && *got != want) {
			t.Errorf("%q: got %v, want %q", meta, got, want)
		}
	}
}

func TestMetaBlockEndsAtTheNextTopHeading(t *testing.T) {
	meta := metaBlock("# META\n\nrun id: **cc·x**\n\n# G\n\ngoal.\n")
	if meta == nil || *meta != "# META\n\nrun id: **cc·x**" {
		t.Fatalf("got %v", meta)
	}
	if metaBlock("# G\n\ngoal only.\n") != nil {
		t.Error("a CST with no META must say so, not guess one")
	}
}

func TestListingKeepsHandoffsOnlyNewestFirst(t *testing.T) {
	root := t.TempDir()
	now := time.Now()
	for file, ago := range map[string]time.Duration{"cclio-first-20260831T120000Z.md": 30 * time.Minute, "any-second-20260831T120000Z.md": 5 * time.Minute} {
		path := filepath.Join(root, file)
		write(t, path, "# META\n")
		_ = os.Chtimes(path, now.Add(-ago), now.Add(-ago))
	}
	write(t, filepath.Join(root, ".DS_Store"), "junk")
	_ = os.Mkdir(filepath.Join(root, "superseded.md"), 0o755)

	var slugs []string
	for _, e := range listStore(root) {
		slugs = append(slugs, e.Slug)
	}
	if len(slugs) != 2 || slugs[0] != "second" || slugs[1] != "first" {
		t.Fatalf("got %v", slugs)
	}
	if listStore(filepath.Join(root, "nope")) != nil {
		t.Error("a missing store lists as empty")
	}
}

func TestIngestNeverTakesAnotherAgentsHandoffUnnamed(t *testing.T) {
	root := t.TempDir()
	write(t, filepath.Join(root, "cclio-theirs-20260831T120000Z.md"), "# META\n")
	env := []string{"HANDOFF_STORE_ROOT=" + root}

	refused := xIn(t, root, env, "handoffs", "ingest", "--for", "cw")
	if refused.code != 2 || len(listStore(root)) != 1 {
		t.Fatalf("a bare pull took a foreign file: exit %d", refused.code)
	}
	forced := xIn(t, root, env, "handoffs", "ingest", "--for", "cw", "theirs")
	if forced.code != 0 || len(listStore(root)) != 0 {
		t.Fatalf("naming the slug must force it: exit %d", forced.code)
	}
}
