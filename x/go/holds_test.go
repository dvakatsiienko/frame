package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// holdsStore plants x-mod-holds' store file: session «other» holds readme.txt, landed or not, with the holder record given
func holdsStore(t *testing.T, dir string, landed bool, holder any) string {
	t.Helper()
	store := t.TempDir()
	key := "hold:other-session-id:" + strings.ToLower(filepath.Join(dir, "readme.txt"))
	body := map[string]any{key: map[string]any{"at": time.Now().Add(-4 * time.Minute).UnixMilli(), "file": filepath.Join(dir, "readme.txt"), "landed": landed}}
	if holder != nil {
		body["holder:other-session-id"] = holder
	}
	raw, _ := json.Marshal(body)
	write(t, filepath.Join(store, "x-mod-holds_inline-abc.json"), string(raw))
	return store
}

func TestCommitRefusesAPathAnotherSessionHolds(t *testing.T) {
	live := map[string]any{"idleSince": nil}
	cases := []struct {
		name, named, held string
		landed            bool
	}{
		{"the held file named", "readme.txt", "readme.txt", false},
		{"a dir holding the held file", ".", "readme.txt", false},
		{"a landed hold still dirty", "readme.txt", "readme.txt", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := repo(t)
			write(t, filepath.Join(dir, "readme.txt"), "two\n")
			store := holdsStore(t, dir, c.landed, live)

			got := xIn(t, dir, []string{"X_HOLDS=" + store, "CLAUDE_CODE_SESSION_ID=mine"}, "lane", "commit", message(t), "--", c.named)

			if got.code != 1 || !strings.Contains(got.stdout, c.held+" is held by session other-se") {
				t.Fatalf("exit %d: %s", got.code, got.stdout)
			}
			if staged := gitT(t, dir, "diff", "--cached", "--name-only"); staged != "" {
				t.Errorf("a refused commit staged %q", staged)
			}
		})
	}
}

func TestCommitPassesAHoldThatNoLongerHolds(t *testing.T) {
	idle := time.Now().Add(-31 * time.Minute).UnixMilli()
	live := map[string]any{"idleSince": nil}
	cases := []struct {
		name    string
		session string
		landed  bool
		holder  any
	}{
		{"the session's own hold", "other-session-id", false, live},
		{"a holder idle past 30 min", "mine", false, map[string]any{"idleSince": idle}},
		{"a holder with no record", "mine", false, nil},
		{"a dead holder pid", "mine", false, map[string]any{"pid": 999999, "start": "Thu Jan  1 00:00:00 1970", "idleSince": nil}},
		{"a landed hold clean in git", "mine", true, live},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := repo(t)
			// readme.txt stays clean, so only a released hold under the named dir lets new.txt through
			write(t, filepath.Join(dir, "new.txt"), "new\n")
			store := holdsStore(t, dir, c.landed, c.holder)

			got := xIn(t, dir, []string{"X_HOLDS=" + store, "CLAUDE_CODE_SESSION_ID=" + c.session}, "lane", "commit", message(t), "--", ".")

			if got.code != 0 {
				t.Fatalf("exit %d: %s", got.code, got.stdout)
			}
		})
	}
}

// macos's temp dir sits behind the /var → /private/var symlink, as the mod's realPath sees it
func TestHeldKeyResolvesTheDirOfAFileNotWrittenYet(t *testing.T) {
	dir := t.TempDir()
	real, _ := filepath.EvalSymlinks(dir)
	want := strings.ToLower(filepath.Join(real, "New/File.ts"))
	if got := heldKey(filepath.Join(dir, "New/File.ts")); got != want {
		t.Errorf("heldKey = %q, want %q", got, want)
	}
}
