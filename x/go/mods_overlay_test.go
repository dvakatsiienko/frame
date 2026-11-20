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
