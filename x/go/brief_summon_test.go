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
	return xIn(t, w.repo, asCaller(t, append([]string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID="}, env...), "🦉 clio"), "brief", "summon", command)
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

			if got.code != 0 || got.data["argv"] != withSessionID(command, got) {
				t.Errorf("exit %d, want 0 printing the argv with its session id:\n%s", got.code, got.stdout)
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

// herdrArgv is the herdr-native summon line x:crew-lead § preflight names
func herdrArgv(repo, brief string) string {
	return "hc run --bg --no-parent --no-notify --name codie --cwd " + repo + " -- claude -n '🌗 🔧 codie: FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"
}

func TestBriefSummonFromAHerdrThreadWantsTheHcRunLine(t *testing.T) {
	t.Parallel()
	herdr := []string{"HC_TERMINAL_ID=t9"}
	cases := []struct {
		name    string
		command func(t *testing.T, w summonWorld) string
		env     []string
		isOk    bool
	}{
		{"a claude --bg line from a herdr thread", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, goodBrief, true))
		}, herdr, false},
		{"an hc run line from a herdr thread", func(t *testing.T, w summonWorld) string {
			return herdrArgv(w.repo, w.brief(t, goodBrief, true))
		}, herdr, true},
		{"a quoted 'claude' from a herdr thread", func(t *testing.T, w summonWorld) string {
			return strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "&& claude", "&& 'claude'", 1)
		}, herdr, false},
		{"a claude --bg line outside herdr", func(t *testing.T, w summonWorld) string {
			return codieArgv(w.repo, w.brief(t, goodBrief, true))
		}, nil, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			command := c.command(t, w)

			got := w.summon(t, command, c.env...)

			switch {
			case c.isOk && (got.code != 0 || got.data["argv"] != withSessionID(command, got)):
				t.Errorf("exit %d, want 0 printing the argv with only its session id added:\n%s", got.code, got.stdout)
			case !c.isOk && (got.code == 0 || !strings.Contains(got.stdout, "step herdr:") || !strings.Contains(got.next, "hc run --bg --no-parent --no-notify --name <short> --cwd "+w.repo+" -- claude -n ") || strings.Contains(got.next, "claude --bg")):
				t.Errorf("exit %d next %q, want a refusal naming step herdr and the hc run line:\n%s", got.code, got.next, got.stdout)
			}
		})
	}
}

// the argv a passing summon prints: the command with its minted --session-id right after claude
func withSessionID(command string, got ran) string {
	sid, _ := got.data["sessionId"].(string)
	return strings.Replace(command, "claude ", "claude --session-id "+sid+" ", 1)
}

// a quoted name holding the word claude comes before the call: the id goes after the claude x runs, never into the name
func TestBriefSummonAddsTheSessionIDAfterTheClaudeItRuns(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	brief := w.brief(t, goodBrief, true)
	command := "hc run --bg --no-parent --no-notify --name 'the claude codie' --cwd " + w.repo + " -- claude -n '🌗 🔧 codie: FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"

	got := w.summon(t, command, "HC_TERMINAL_ID=t9")

	sid, _ := got.data["sessionId"].(string)
	want := strings.Replace(command, "-- claude ", "-- claude --session-id "+sid+" ", 1)
	if got.code != 0 || got.data["argv"] != want {
		t.Fatalf("exit %d argv %v, want %q:\n%s", got.code, got.data["argv"], want, got.stdout)
	}
}

// the lane is the summon's own spec, never another lane's spec the brief mentions first
func TestBriefSummonNamesTheLaneByItsOwnSpec(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")
	brief := w.brief(t, goodBrief+"\nbuilt on what .scratch/mods-lane-6/spec.md shipped\nthe spec: /f/.scratch/cli-lane-8/spec.md\n", true)

	got := w.summon(t, codieArgv(w.repo, brief), "X_THREADS="+store, "X_SESSIONS="+t.TempDir())

	written, _ := readThreadStore(store)
	if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Lane != "cli-lane-8" {
		t.Fatalf("exit %d, records %+v, want lane cli-lane-8:\n%s", got.code, written.Threads, got.stdout)
	}
}

// exit 14: a summoned codie and sixth sense each leave their role, lane and ticket under the id their argv carries
func TestBriefSummonWritesTheThreadRecordUnderItsSessionID(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")
	env := []string{"X_THREADS=" + store, "X_SESSIONS=" + t.TempDir()}
	brief := w.brief(t, goodBrief+"\nthe spec: /f/.scratch/cli-lane-8/spec.md\n", true)

	codie := w.summon(t, codieArgv(w.repo, brief), env...)
	again := w.summon(t, codieArgv(w.repo, brief), env...)
	sixth := w.summon(t, sixthArgv(w, " spec: .scratch/cli-lane-8/spec.md"), env...)
	list := xIn(t, t.TempDir(), env, "thread", "list")

	ids := []string{}
	for _, got := range []ran{codie, again, sixth} {
		sid, _ := got.data["sessionId"].(string)
		argv, _ := got.data["argv"].(string)
		if got.code != 0 || len(sid) != 36 || !strings.Contains(argv, "claude --session-id "+sid+" ") {
			t.Fatalf("exit %d, want the argv to carry the minted id %q:\n%s", got.code, sid, got.stdout)
		}
		ids = append(ids, sid)
	}
	if ids[0] == ids[1] {
		t.Errorf("a second summon of the same line reused %s", ids[0])
	}
	want := map[string]string{ids[0]: "🌗 🔧 cli | FRM-1", ids[1]: "🌗 🔧 cli | FRM-1", ids[2]: "🔎 cli | FRM-1"}
	shown := map[string]string{}
	threads, _ := list.data["threads"].([]any)
	for _, th := range threads {
		m, _ := th.(map[string]any)
		sid, _ := m["sessionId"].(string)
		shown[sid], _ = m["display"].(string)
	}
	if list.code != 0 || len(shown) != 3 || shown[ids[0]] != want[ids[0]] || shown[ids[1]] != want[ids[1]] || shown[ids[2]] != want[ids[2]] {
		t.Errorf("thread list shows %v, want %v:\n%s", shown, want, list.stdout)
	}
}
