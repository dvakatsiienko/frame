package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDecampPointsTheHookShimsBackAtTheMainCheckout(t *testing.T) {
	main := repo(t)
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, main, "worktree", "add", "-q", tree, "-b", "side")
	tree, _ = filepath.EvalSymlinks(tree)
	shim := filepath.Join(main, ".git/hooks/pre-commit")
	// what a pnpm run in the worktree leaves behind
	write(t, shim, "#!/bin/sh\n"+tree+"/node_modules/.bin/lefthook run pre-commit\n")
	// lefthook install writes the shim against the dir it runs in
	bin := t.TempDir()
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\nprintf '#!/bin/sh\\n%s/node_modules/.bin/lefthook run pre-commit\\n' \"$PWD\" > \"$PWD/.git/hooks/pre-commit\"\n")
	if err := os.Chmod(filepath.Join(bin, "pnpm"), 0o755); err != nil {
		t.Fatal(err)
	}

	got := xIn(t, main, []string{"PATH=" + bin + ":" + os.Getenv("PATH")}, "lane", "decamp", tree, "--apply")

	body, _ := os.ReadFile(shim)
	if got.code != 0 || exists(tree) {
		t.Fatalf("exit %d, tree still there: %v\n%s", got.code, exists(tree), got.stdout)
	}
	if strings.Contains(string(body), tree) || !strings.Contains(string(body), main+"/node_modules") {
		t.Errorf("the shim does not point at the main checkout:\n%s", body)
	}
}
