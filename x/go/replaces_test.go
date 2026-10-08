package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// history records what happened and never calls anything (an ADR's amendments, the gazette, the
// pocket, the flawlog, jev's verbatim observed prompts, a research answer, and the test drives whose
// dated rounds and baselines quote a door that has since died); the registry names the doors on purpose
var notCallers = []string{":!x/go/registry.json", ":!docs/adr", ":!cclio/gazette", ":!cclio/pocket.md", ":!home/.claude/shelf/flawlog",
	":!home/.claude/shelf/jev/fixtures", ":!docs/research", ":!docs/test-drive/ctx7.md", ":!docs/test-drive/pocket.md",
	":!docs/test-drive/sifter.md"}

// a verb is done when its old door is dead: the file it replaces is gone and nothing tracked still calls it
func TestReplacedDoorsAreDead(t *testing.T) {
	root, _ := filepath.Abs("../..")
	checked := map[string]bool{}
	for _, verb := range verbs {
		for _, door := range verb.Replaces {
			if checked[door] {
				continue
			}
			checked[door] = true
			if _, err := os.Stat(filepath.Join(root, door)); strings.Contains(door, "/") && err == nil {
				t.Errorf("%s replaces %s, and the file still exists", verb.Name, door)
			}
			// the basename, because a caller may build the path in parts: join(frame, 'script', '<name>')
			c := exec.Command("git", append([]string{"grep", "-l", "-F", "-e", filepath.Base(door), "--", "."}, notCallers...)...)
			c.Dir, c.Env = root, cleanEnv()
			out, err := c.Output()
			// git grep exits 1 for «no match»; anything else is a broken search, never a pass
			if exit, ok := errors.AsType[*exec.ExitError](err); err != nil && (!ok || exit.ExitCode() != 1) {
				t.Fatalf("git grep %s: %v", door, err)
			}
			if len(out) > 0 {
				t.Errorf("%s replaces %s, and these still call it:\n%s", verb.Name, door, out)
			}
		}
	}
	if len(checked) == 0 {
		t.Fatal("no verb names what it replaces — the check would pass by having nothing to check")
	}
}
