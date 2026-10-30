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

func (w summonWorld) summon(t *testing.T, command string, env ...string) ran {
	t.Helper()
	return xIn(t, w.repo, append([]string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame}, env...), "brief", "summon", command)
}

// a bytes checkout is known by its essentials script; this one fails every app
func (w summonWorld) bytesHome(t *testing.T) string {
	t.Helper()
	bytes := filepath.Join(w.repo, "bytes")
	write(t, filepath.Join(bytes, "script/apps-essentials.ts"), "process.exit(1)\n")
	claudeJSON, _ := json.Marshal(map[string]any{"projects": map[string]any{bytes: map[string]any{"hasTrustDialogAccepted": true}}})
	write(t, filepath.Join(w.home, ".claude.json"), string(claudeJSON))
	return bytes
}

func codieArgv(repo, brief string) string {
	return "cd " + repo + " && claude --bg -n '🌗 🔧 codie: FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"
}

func sixthArgv(w summonWorld, tail string) string {
	return "cd " + w.repo + " && claude --bg -n '🌗 🔎 sixth sense: #7' --model opus --effort medium '/x:crew-sixth-sense FRM-1 https://github.com/o/r/pull/7 codie clio" + tail + " trials: tdd' --remote-control"
}

func TestBriefSummonPassesACommandThatMeetsEveryStep(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		command func(t *testing.T, w summonWorld) string
	}{
		{"a codie brief", func(t *testing.T, w summonWorld) string { return codieArgv(w.repo, w.brief(t, goodBrief, true)) }},
		{"a sixth sense argv with spec:", func(_ *testing.T, w summonWorld) string { return sixthArgv(w, " spec: .scratch/lane-1/spec.md") }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			command := c.command(t, w)

			got := w.summon(t, command)

			if got.code != 0 || got.data["argv"] != command {
				t.Errorf("exit %d, want 0 printing the argv:\n%s", got.code, got.stdout)
			}
		})
	}
}

func TestBriefSummonRefusesABriefThatSkipsAStep(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, step string
		command    func(t *testing.T, w summonWorld) string
		env        []string
	}{
		{"-n after the prompt", "argv", func(t *testing.T, w summonWorld) string {
			return "cd " + w.repo + " && claude --bg \"$(cat " + w.brief(t, goodBrief, true) + ")\" -n 'x' --remote-control"
		}, nil},
		{"a spare older than a day", "spare", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, goodBrief, true))
		}, []string{"X_SPARES=1-02:03:04 claude bg-spare\n"}},
		{"a bytes app that fails its essentials", "essentials", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.bytesHome(t), w.brief(t, goodBrief+"\nthe app: apps/atelier/\n", true))
		}, nil},
		{"no cd, so the cwd is the home, untrusted", "trust", func(t *testing.T, w summonWorld) string {
			write(t, filepath.Join(w.home, ".claude.json"), `{"projects":{}}`)
			return "claude --bg -n 'x' \"$(cat " + w.brief(t, goodBrief, true) + ")\" --remote-control"
		}, nil},
		{"no role skill on its first line", "role", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "/x:crew-codie ", "", 1), true))
		}, nil},
		{"no wish in its first 10 lines", "wish", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "wish: none\n", "", 1), true))
		}, nil},
		{"no brief check stamp for its bytes", "stamp", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, goodBrief, false))
		}, nil},
		{"a fitting trial neither named nor skipped", "trials", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "- `tdd`: each exit line red first\n", "", 1), true))
		}, nil},
		{"the prompt after --remote-control", "argv", func(t *testing.T, w summonWorld) string {
			brief := w.brief(t, goodBrief, true)
			return "cd " + w.repo + " && claude --bg -n '🌗 🔧 codie: FRM-1' --remote-control \"$(cat " + brief + ")\""
		}, nil},
		{"a summon home without its trust key", "trust", func(t *testing.T, w summonWorld) string {
			write(t, filepath.Join(w.home, ".claude.json"), `{"projects":{}}`)
			return codieArgv(w.repo, w.brief(t, goodBrief, true))
		}, nil},
		{"a sixth sense argv missing spec:", "sixth sense", func(_ *testing.T, w summonWorld) string {
			return sixthArgv(w, "")
		}, nil},
		{"an inline codie prompt no brief check saw", "stamp", func(_ *testing.T, w summonWorld) string {
			return "cd " + w.repo + " && claude --bg -n c '/x:crew-codie FRM-1 build it' --remote-control"
		}, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)

			got := w.summon(t, c.command(t, w), c.env...)

			if got.code == 0 || !strings.Contains(got.stdout, "step "+c.step+":") {
				t.Errorf("exit %d, want a refusal naming step %q:\n%s", got.code, c.step, got.stdout)
			}
		})
	}
}
