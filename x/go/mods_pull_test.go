package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// FRM-621 follow-up: a re-pull never overwrites a copy that holds an edit; --over is the one way past it
func TestModsEditPullRefusesToOverwriteAnEditedCopy(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copied := pullCopy(t, dir, env, modTestA)
	write(t, copied, "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "pull", modTestA)

	if got.code == 0 || readFile(t, copied) != "green, edited\n" {
		t.Fatalf("the pull ran over the edit: exit %d, copy %q\n%s", got.code, readFile(t, copied), got.stdout)
	}
	if got.next != "x mods edit pull --over "+modTestA {
		t.Errorf("next = %q", got.next)
	}
}

func TestModsEditPullOverReplacesAnEditedCopy(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copied := pullCopy(t, dir, env, modTestA)
	repoBody := readFile(t, copied)
	write(t, copied, "green, edited\n")

	got := xIn(t, dir, env, "mods", "edit", "pull", "--over", modTestA)

	if got.code != 0 || readFile(t, copied) != repoBody {
		t.Fatalf("--over kept the edit: exit %d, copy %q\n%s", got.code, readFile(t, copied), got.stdout)
	}
}

func TestModsEditPullRefreshesAnUneditedCopy(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copied := pullCopy(t, dir, env, modTestA)
	write(t, filepath.Join(dir, modTestA), "green, moved in the repo\n")

	pullCopy(t, dir, env, modTestA)

	if body := readFile(t, copied); !strings.Contains(body, "moved in the repo") {
		t.Errorf("an unedited copy kept the old bytes: %q", body)
	}
}

func TestModsEditPullRefusesAnEditedNewFile(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	newPath := modsDir + "m/tests/c.test.ts"
	copied := pullCopy(t, dir, env, newPath)
	write(t, copied, "green\n")

	if got := xIn(t, dir, env, "mods", "edit", "pull", newPath); got.code == 0 || readFile(t, copied) != "green\n" {
		t.Fatalf("the pull ran over a new file's edit: exit %d\n%s", got.code, got.stdout)
	}
	if got := xIn(t, dir, env, "mods", "edit", "pull", "--over", newPath); got.code != 0 || exists(copied) {
		t.Errorf("--over kept a new file's copy: exit %d, exists %v\n%s", got.code, exists(copied), got.stdout)
	}
}

// a refusal on a later path copies none before it, so the refused pull leaves scratch as it was
func TestModsEditPullRefusedOnALaterPathCopiesNone(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	write(t, pullCopy(t, dir, env, modTestB), "green, edited\n")
	scratch, _ := xIn(t, dir, env, "mods", "edit", "status").data["scratch"].(string)
	before := snapshot(t, scratch)

	if got := xIn(t, dir, env, "mods", "edit", "pull", modTestA, modTestB); got.code == 0 {
		t.Fatalf("the pull ran over b's edit\n%s", got.stdout)
	}
	if !sameFiles(before, snapshot(t, scratch)) {
		t.Errorf("a refused pull changed scratch")
	}
}

func TestModsEditDriftRefusalNamesTheCopyBeforeOver(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copied := pullCopy(t, dir, env, modTestA)
	write(t, copied, "green, edited\n")
	write(t, filepath.Join(dir, modTestA), "green, moved in the repo\n")

	got := xIn(t, dir, env, "mods", "edit", "push")

	if got.code == 0 || !strings.Contains(got.stdout, "copy "+copied+" aside") || got.next != "x mods edit pull --over "+modTestA {
		t.Errorf("exit %d, next %q\n%s", got.code, got.next, got.stdout)
	}
}

// a file gone from the repo leaves no base behind its re-pull, so the new copy lands as a new file
func TestModsEditPullOverOfAGoneFileDropsItsBase(t *testing.T) {
	t.Parallel()
	dir, env := modsFixture(t)
	copied := pullCopy(t, dir, env, modTestA)
	write(t, copied, "green, edited\n")
	if err := os.Remove(filepath.Join(dir, modTestA)); err != nil {
		t.Fatal(err)
	}

	if got := xIn(t, dir, env, "mods", "edit", "pull", "--over", modTestA); got.code != 0 {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
	write(t, copied, "green, new again\n")

	if got := xIn(t, dir, env, "mods", "edit", "push"); got.code != 0 || readFile(t, filepath.Join(dir, modTestA)) != "green, new again\n" {
		t.Errorf("a stale base refused the new file: exit %d\n%s", got.code, got.stdout)
	}
}
