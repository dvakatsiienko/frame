package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// summonWorld is a frame root holding the trial script and one live codie trial, a home whose ~/.claude.json
// trusts the summon home, and a state dir for brief stamps
type summonWorld struct {
	frame, home, state, repo string
}

func newSummonWorld(t *testing.T) summonWorld {
	t.Helper()
	w := summonWorld{frame: t.TempDir(), home: t.TempDir(), state: t.TempDir(), repo: t.TempDir()}
	script, err := os.ReadFile("../../script/test-drive-list.ts")
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(w.frame, "script/test-drive-list.ts"), string(script))
	write(t, filepath.Join(w.frame, "docs/test-drive/tdd.md"), "---\nstatus: live\nuntil: 2099-01-01\nfits: codie\n---\n\n# tdd\n")
	write(t, filepath.Join(w.frame, "docs/test-drive/gone.md"), "---\nstatus: dropped\nfits: codie\n---\n\n# gone\n")
	claudeJSON, _ := json.Marshal(map[string]any{"projects": map[string]any{w.repo: map[string]any{"hasTrustDialogAccepted": true}}})
	write(t, filepath.Join(w.home, ".claude.json"), string(claudeJSON))
	return w
}

const goodBrief = "/x:crew-codie FRM-1 a job coordinator: 🦉 clio\nwish: none\n\nlane: side\n\n## trials\n\n- `tdd`: each exit line red first\n"

// brief writes a brief, stamps it as a passing x brief check would unless told not to, and returns its path
func (w summonWorld) brief(t *testing.T, text string, stamped bool) string {
	t.Helper()
	path := filepath.Join(w.repo, "brief.md")
	write(t, path, text)
	if stamped {
		sum := fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
		write(t, filepath.Join(w.state, "briefs", sum+".json"), `{"sha256":"`+sum+`"}`)
	}
	return path
}

func (w summonWorld) summon(t *testing.T, command string) ran {
	t.Helper()
	return xIn(t, w.repo, []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame}, "brief", "summon", command)
}

func codieArgv(repo, brief string) string {
	return "cd " + repo + " && claude --bg -n '🌗 🔧 codie: FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"
}

func TestBriefSummonPassesABriefThatMeetsEveryStep(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	command := codieArgv(w.repo, w.brief(t, goodBrief, true))

	got := w.summon(t, command)

	if got.code != 0 || got.data["argv"] != command {
		t.Fatalf("exit %d, want 0 printing the argv:\n%s", got.code, got.stdout)
	}
}

func TestBriefSummonRefusesABriefThatSkipsAStep(t *testing.T) {
	t.Parallel()
	sixth := func(w summonWorld, tail string) string {
		return "cd " + w.repo + " && claude --bg -n '🌗 🔎 sixth sense: #7' --model opus --effort medium '/x:crew-sixth-sense FRM-1 https://github.com/o/r/pull/7 codie clio" + tail + " trials: tdd' --remote-control"
	}
	cases := []struct {
		name, step string
		command    func(t *testing.T, w summonWorld) string
	}{
		{"no role skill on its first line", "role", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "/x:crew-codie ", "", 1), true))
		}},
		{"no wish in its first 10 lines", "wish", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "wish: none\n", "", 1), true))
		}},
		{"no brief check stamp for its bytes", "stamp", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, goodBrief, false))
		}},
		{"a fitting trial neither named nor skipped", "trials", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "- `tdd`: each exit line red first\n", "", 1), true))
		}},
		{"the prompt after --remote-control", "argv", func(t *testing.T, w summonWorld) string {
			brief := w.brief(t, goodBrief, true)
			return "cd " + w.repo + " && claude --bg -n '🌗 🔧 codie: FRM-1' --remote-control \"$(cat " + brief + ")\""
		}},
		{"a summon home without its trust key", "trust", func(t *testing.T, w summonWorld) string {
			write(t, filepath.Join(w.home, ".claude.json"), `{"projects":{}}`)
			return codieArgv(w.repo, w.brief(t, goodBrief, true))
		}},
		{"a sixth sense argv missing spec:", "sixth sense", func(_ *testing.T, w summonWorld) string {
			return sixth(w, "")
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)

			got := w.summon(t, c.command(t, w))

			if got.code == 0 || !strings.Contains(got.stdout, "step "+c.step+":") {
				t.Errorf("exit %d, want a refusal naming step %q:\n%s", got.code, c.step, got.stdout)
			}
		})
	}
	t.Run("a sixth sense argv with spec: passes", func(t *testing.T) {
		t.Parallel()
		w := newSummonWorld(t)
		if got := w.summon(t, sixth(w, " spec: .scratch/lane-1/spec.md")); got.code != 0 {
			t.Errorf("exit %d, want a full sixth sense argv to pass:\n%s", got.code, got.stdout)
		}
	})
}
