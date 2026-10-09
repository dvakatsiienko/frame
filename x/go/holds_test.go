package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// holdsStore plants x-mod-holds' store file: session «other» holds readme.txt, with the holder record given
func holdsStore(t *testing.T, dir string, holder any) string {
	t.Helper()
	store := t.TempDir()
	key := "hold:other-session-id:" + strings.ToLower(filepath.Join(dir, "readme.txt"))
	body := map[string]any{key: map[string]any{"at": time.Now().Add(-4 * time.Minute).UnixMilli(), "file": filepath.Join(dir, "readme.txt")}}
	if holder != nil {
		body["holder:other-session-id"] = holder
	}
	raw, _ := json.Marshal(body)
	write(t, filepath.Join(store, "x-mod-holds_inline-abc.json"), string(raw))
	return store
}

func TestCommitRefusesAPathAnotherSessionHolds(t *testing.T) {
	dir := repo(t)
	write(t, filepath.Join(dir, "readme.txt"), "two\n")
	store := holdsStore(t, dir, map[string]any{"idleSince": nil})

	got := xIn(t, dir, []string{"X_HOLDS=" + store, "CLAUDE_CODE_SESSION_ID=mine"}, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 1 || !strings.Contains(got.stdout, "readme.txt is held by session other-se") {
		t.Fatalf("exit %d: %s", got.code, got.stdout)
	}
	if staged := gitT(t, dir, "diff", "--cached", "--name-only"); staged != "" {
		t.Errorf("a refused commit staged %q", staged)
	}
}

func TestCommitPassesAHoldThatNoLongerHolds(t *testing.T) {
	idle := time.Now().Add(-31 * time.Minute).UnixMilli()
	cases := []struct {
		name    string
		session string
		holder  any
	}{
		{"the session's own hold", "other-session-id", map[string]any{"idleSince": nil}},
		{"a holder idle past 30 min", "mine", map[string]any{"idleSince": idle}},
		{"a holder with no record", "mine", nil},
		{"a dead holder pid", "mine", map[string]any{"pid": 999999, "start": "Thu Jan  1 00:00:00 1970", "idleSince": nil}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := repo(t)
			write(t, filepath.Join(dir, "readme.txt"), "two\n")
			store := holdsStore(t, dir, c.holder)

			got := xIn(t, dir, []string{"X_HOLDS=" + store, "CLAUDE_CODE_SESSION_ID=" + c.session}, "lane", "commit", message(t), "--", "readme.txt")

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
