package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// the overlay is HEAD plus this session's own edits: a peer's half-done work in the mod, staged or only edited, never reaches it
// (FRM-572 line 17; the untracked file alone was dropped before)
func TestModsEditOverlayLeavesAPeersDirtWhereGitSeesIt(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		dirty func(t *testing.T, dir string)
		skip  string
	}{
		{"a staged new test file", func(t *testing.T, dir string) {
			write(t, filepath.Join(dir, modsDir, "m", "tests", "peer.test.ts"), "RED, a peer's staged file\n")
			gitT(t, dir, "add", modsDir+"m/tests/peer.test.ts")
		}, "tests/peer.test.ts"},
		{"an uncommitted edit of a tracked test file", func(t *testing.T, dir string) {
			write(t, filepath.Join(dir, modTestB), "RED, a peer's half edit\n")
		}, "tests/b.test.ts"},
		{"a tracked test file deleted in the tree", func(t *testing.T, dir string) {
			if err := os.Remove(filepath.Join(dir, modTestB)); err != nil {
				t.Fatal(err)
			}
		}, "tests/b.test.ts"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env := modsFixture(t)
			c.dirty(t, dir)
			write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")

			got := xIn(t, dir, env, "mods", "edit", "test")

			if got.code != 0 || !strings.Contains(got.stdout, `"passed":2`) {
				t.Errorf("exit %d, want the two tracked tests at HEAD green and the peer's work unread\n%s", got.code, got.stdout)
			}
			if !strings.Contains(got.stdout, `"skipped":[`) || !strings.Contains(got.stdout, c.skip+", not yours") {
				t.Errorf("want %q named as skipped, not yours\n%s", c.skip, got.stdout)
			}
		})
	}
}

// a file the session wrote from Bash holds nothing, so the overlay resets it to HEAD: the summary line says so beside its pass count,
// where a red own test would otherwise read green with one stderr line (the independent read of 4aeda287)
func TestModsEditSummaryCountsWhatTheOverlayLeftAtHead(t *testing.T) {
	t.Parallel()
	reports := []modReport{
		{Mod: "m", Validate: "ok", Passed: 2, Skipped: []string{"tests/b.test.ts, not yours"}},
		{Mod: "n", Validate: "ok", Passed: 5},
	}
	if got, want := reportLine(reports), "m: 2 pass, 1 skipped (not yours) · n: 5 pass"; got != want {
		t.Errorf("summary %q, want %q", got, want)
	}
	red := []modReport{{Mod: "m", Validate: "ok", Failed: []string{"a"}, Skipped: []string{"x, not yours"}}}
	if got := reportLine(red); !strings.Contains(got, "1 skipped (not yours)") {
		t.Errorf("a red mod's summary %q lost its skipped count", got)
	}
}

// a file this session's own hold names is its edit (it wrote it straight in the tree), so the overlay keeps it
func TestModsEditOverlayKeepsAFileTheSessionHolds(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	file := filepath.Join(dir, modTestB)
	write(t, file, "RED, my own edit\n")
	store := t.TempDir()
	raw, _ := json.Marshal(map[string]any{
		"hold:mine:" + strings.ToLower(file): map[string]any{"at": time.Now().Add(-2 * time.Minute).UnixMilli(), "file": file, "landed": false},
		"holder:mine":                        map[string]any{"idleSince": nil},
	})
	write(t, filepath.Join(store, "x-mod-holds_inline-abc.json"), string(raw))
	env = append(env, "X_HOLDS="+store, "CLAUDE_CODE_SESSION_ID=mine")
	write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "test")

	if got.code == 0 || !strings.Contains(got.stdout, "b.test.ts") {
		t.Errorf("exit %d, want the held, red b.test.ts run and named\n%s", got.code, got.stdout)
	}
	if strings.Contains(got.stdout, "tests/b.test.ts, not yours") {
		t.Errorf("a file the session holds is its own\n%s", got.stdout)
	}
}

// a run that left a peer's work at HEAD tested bytes the tree does not hold: its green stamps nothing and records no mod green, or the
// commit hook's --skip-tested would pass the peer's red file unrun (the wisphunter read of 4aeda287)
func TestModsEditARunThatSkippedAPeerProvesNothingForTheTree(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name     string
		peerEdit bool
		want     bool
	}{
		{"a peer's edit left at HEAD", true, false},
		{"no peer work in the mod", false, true},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			fresh := func() (string, []string, string) {
				dir, env := modsFixture(t)
				state := t.TempDir()
				env = append(env, "X_STATE="+state)
				if c.peerEdit {
					write(t, filepath.Join(dir, modTestB), "RED, a peer's half edit\n")
				}
				write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")
				return dir, env, state
			}
			dir, env, _ := fresh()
			if got := xIn(t, dir, env, "mods", "edit", "test"); got.code != 0 {
				t.Fatalf("test exit %d\n%s", got.code, got.stdout)
			}
			scratch, _ := xIn(t, dir, env, "mods", "edit", "status").data["scratch"].(string)
			if stamped := exists(filepath.Join(scratch, scratchTested)); stamped != c.want {
				t.Errorf("a green test left its stamp %v, want %v", stamped, c.want)
			}

			dir, env, state := fresh()
			if got := xIn(t, dir, env, "mods", "edit", "push", modTestA); got.code != 0 {
				t.Fatalf("push exit %d\n%s", got.code, got.stdout)
			}
			if recorded := strings.Contains(readFile(t, filepath.Join(state, "gates-green.tsv")), "mod m"); recorded != c.want {
				t.Errorf("a push recorded the mod green %v, want %v", recorded, c.want)
			}
		})
	}
}

// a peer's `git rm --cached` file reads «D» and «??» at once, and an intent-to-add file reads « A»: HEAD, not the letters, decides
func TestModsEditOverlayDecidesByHeadNotByStatusLetters(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	gitT(t, dir, "rm", "-q", "--cached", modTestB)
	write(t, filepath.Join(dir, modsDir, "m", "tests", "new.test.ts"), "RED, intent to add\n")
	gitT(t, dir, "add", "-N", modsDir+"m/tests/new.test.ts")
	write(t, pullCopy(t, dir, env, modTestA), "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "test")

	if got.code != 0 || !strings.Contains(got.stdout, `"passed":2`) {
		t.Fatalf("exit %d, want HEAD's two tests, b restored and the intent-to-add file out\n%s", got.code, got.stdout)
	}
	if strings.Count(got.stdout, "tests/b.test.ts, not yours") != 1 {
		t.Errorf("want b named once\n%s", got.stdout)
	}
}
