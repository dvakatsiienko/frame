package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// x with a CST on stdin, against its own store
func xStore(t *testing.T, root, stdin string, args ...string) ran {
	t.Helper()
	c := exec.Command(xbin, args...)
	c.Dir = t.TempDir()
	c.Env = append(cleanEnv(), "X_TEST=1", "HANDOFF_STORE_ROOT="+root)
	c.Stdin = strings.NewReader(stdin)
	var stdout bytes.Buffer
	c.Stdout = &stdout
	code := exitOf(c.Run())
	var envelope struct {
		Data map[string]any `json:"data"`
		Next string         `json:"next"`
	}
	_ = json.Unmarshal(stdout.Bytes(), &envelope)
	return ran{code, stdout.String(), envelope.Data, envelope.Next}
}

func storeFiles(root string) []string {
	var files []string
	for _, e := range listStore(root) {
		files = append(files, e.file)
	}
	return files
}

func TestWriteLandsOnePrivateFileUnderTheGrammarsName(t *testing.T) {
	root := filepath.Join(t.TempDir(), "store")

	got := xStore(t, root, "# META\n\nbody\n", "handoff", "write", "--audience", "cclio", "--slug", "Pm Overhaul!", "--lane", "pm", "--author", "ccli")

	files := storeFiles(root)
	if got.code != 0 || len(files) != 1 {
		t.Fatalf("exit %d, files %v: %s", got.code, files, got.stdout)
	}
	parsed, _ := parseName(files[0])
	if parsed.Audience != "cclio" || parsed.Lane != "pm" || parsed.Slug != "pm-overhaul" || parsed.Author != "ccli" || parsed.Shared {
		t.Errorf("name %s parsed as %+v", files[0], parsed)
	}
	path := filepath.Join(root, files[0])
	if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 || read(t, path) != "# META\n\nbody\n" {
		t.Errorf("mode %v, body %q", info.Mode().Perm(), read(t, path))
	}
}

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

func TestIngestWithNoReaderRefuses(t *testing.T) {
	root := t.TempDir()
	write(t, filepath.Join(root, "cw--pm--a--by-ccli--20261007T100000Z.md"), "# META\n")

	for _, argv := range [][]string{{"handoff", "ingest"}, {"handoff", "ingest", "a"}} {
		got := xStore(t, root, "", argv...)

		if got.code != 2 || len(storeFiles(root)) != 1 || !strings.Contains(got.next, "--for") {
			t.Fatalf("%v names no reader, so it must refuse and keep the file: exit %d, next %q", argv, got.code, got.next)
		}
	}
}

func TestWriteReplacesLeavesExactlyOneFile(t *testing.T) {
	root := t.TempDir()
	write(t, filepath.Join(root, "any--code--old-thread--by-cw--20261001T120000Z-shared.md"), "# META\nold\n")
	write(t, filepath.Join(root, "any--code--other--by-cw--20261001T120000Z.md"), "# META\nother\n")

	got := xStore(t, root, "# META\nnew\n", "handoff", "write", "--slug", "new-thread", "--replaces", "old-thread")

	files := storeFiles(root)
	if got.code != 0 || len(files) != 2 || got.data["replaced"] != "any--code--old-thread--by-cw--20261001T120000Z-shared.md" {
		t.Fatalf("exit %d, files %v: %s", got.code, files, got.stdout)
	}
	if !slices.ContainsFunc(files, func(f string) bool {
		return strings.HasPrefix(f, "any--any--new-thread--") && strings.HasSuffix(f, "-shared.md")
	}) {
		t.Errorf("the replacement must inherit -shared: %v", files)
	}
}

func TestWriteReplacingNothingWritesNothing(t *testing.T) {
	root := t.TempDir()
	write(t, filepath.Join(root, "any--code--other--by-cw--20261001T120000Z.md"), "# META\n")

	got := xStore(t, root, "# META\nnew\n", "handoff", "write", "--slug", "new", "--replaces", "missing")

	if got.code != 2 || len(storeFiles(root)) != 1 {
		t.Fatalf("a replace that matches nothing must refuse: exit %d, files %v", got.code, storeFiles(root))
	}
}

func threeStored(t *testing.T) string {
	root := t.TempDir()
	for _, file := range []string{"any--code--one--by-cw--20261001T120000Z.md", "cclio--pm--two--by-cw--20261001T120000Z.md",
		"any--code--three--by-cw--20261001T120000Z-shared.md"} {
		write(t, filepath.Join(root, file), "# META\n")
	}
	return root
}

func TestDeleteAllTakesSharedFilesToo(t *testing.T) {
	root := threeStored(t)

	got := xStore(t, root, "", "handoff", "delete", "--all")

	if got.code != 0 || len(storeFiles(root)) != 0 {
		t.Fatalf("exit %d, left %v: %s", got.code, storeFiles(root), got.stdout)
	}
}

func TestDeleteOneSlugLeavesTheRestAlone(t *testing.T) {
	root := threeStored(t)

	got := xStore(t, root, "", "handoff", "delete", "three")

	if left := storeFiles(root); got.code != 0 || len(left) != 2 || slices.ContainsFunc(left, func(f string) bool { return strings.Contains(f, "three") }) {
		t.Fatalf("exit %d, left %v: %s", got.code, left, got.stdout)
	}
}

func TestDeleteWithNoTargetRefuses(t *testing.T) {
	root := t.TempDir()
	write(t, filepath.Join(root, "any--code--only--by-cw--20261001T120000Z.md"), "# META\n")

	if got := xStore(t, root, "", "handoff", "delete"); got.code != 2 || len(storeFiles(root)) != 1 {
		t.Fatalf("a bare delete must name a slug or --all: exit %d", got.code)
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
		"# META\n\nrun id: cc·20261007·plain":                    "cc·20261007·plain",
		"# META\n\n- **run marker** — run id: **cc·x**":          "cc·x",
		"# META\n\nrun id: **cc·20260831·probe**":                "cc·20260831·probe",
		"# META\n\n- **run marker** — run id: **cc·20261006·x**": "cc·20261006·x",
		"# META\n\n- **run marker** — `cc·20261007·spec`":        "cc·20261007·spec",
		"# META\n\n- **run marker** — cc·20261007·bare-dash":     "cc·20261007·bare-dash",
		"# META\n\n**Run marker:** `cc·old·shape`":               "cc·old·shape",
		"# META\n\n- **run marker** — none, no tracker run":      "",
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

	refused := xIn(t, root, env, "handoff", "ingest", "--for", "cw")
	if refused.code != 2 || len(listStore(root)) != 1 {
		t.Fatalf("a bare pull took a foreign file: exit %d", refused.code)
	}
	forced := xIn(t, root, env, "handoff", "ingest", "--for", "cw", "theirs")
	if forced.code != 0 || len(listStore(root)) != 0 {
		t.Fatalf("naming the slug must force it: exit %d", forced.code)
	}
}
