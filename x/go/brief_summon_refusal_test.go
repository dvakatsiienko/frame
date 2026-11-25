package main

import (
	"encoding/json"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestBriefSummonPassesACommandThatMeetsEveryStep(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name    string
		command func(t *testing.T, w summonWorld) string
	}{
		{"a codie brief", func(t *testing.T, w summonWorld) string { return codieArgv(w.repo, w.brief(t, goodBrief, true)) }},
		{"a sixth sense argv with spec:", func(_ *testing.T, w summonWorld) string {
			// no codie record holds its lane, so its display carries no mode mark
			return strings.Replace(sixthArgv(w, " spec: .scratch/lane-1/spec.md"), "🌗 🔎", "🔎", 1)
		}},
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
			return "cd " + w.repo + " && claude --bg -n '🌗 🔧 cli | FRM-1' --remote-control \"$(cat " + brief + ")\""
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

// FRM-579 security review: an area word reaches the printed argv, so only a word of scopes.json passes (FRM-600)
func TestBriefSummonTakesNoAreaThatIsNotAScope(t *testing.T) {
	t.Parallel()
	for i, area := range []string{"x';touch${IFS}pwned;'#", "Dima's Lab", "$(id)", "Mods", "strays", "fleet"} {
		// the name is no word: a test dir takes the test's name, so a subtest is named by its number
		t.Run("area "+strconv.Itoa(i), func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			store := filepath.Join(t.TempDir(), "threads.json")

			got := w.summonWith(t, codieArgv(w.repo, w.brief(t, goodBrief, true)), []string{"--apply", "--area", area}, "X_THREADS="+store, "X_SESSIONS="+t.TempDir())

			written, _ := readThreadStore(store)
			if got.code != 2 || !strings.Contains(got.stdout, "one of: chords, cli, herdr, mods, speak, stray, trophy-sys") || len(written.Threads) != 0 {
				t.Errorf("exit %d, records %+v, want a usage refusal naming the table's words:\n%s", got.code, written.Threads, got.stdout)
			}
		})
	}
}

// FRM-600: a lane member names its scope, and no project word stands in
func TestBriefSummonWantsAScopeForALaneMember(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")

	got := w.summonWith(t, codieArgv(w.repo, w.brief(t, goodBrief, true)), []string{"--apply"}, "X_THREADS="+store, "X_SESSIONS="+t.TempDir())

	written, _ := readThreadStore(store)
	if got.code != 2 || !strings.Contains(got.stdout, "names its scope: --area <word>") || len(written.Threads) != 0 {
		t.Errorf("exit %d, records %+v, want a usage refusal asking for --area:\n%s", got.code, written.Threads, got.stdout)
	}
}

// FRM-572 exit 8: a member starts in a herdr pane, so summon's schema never shows the retired `claude --bg` line
func TestBriefSummonSchemaShowsThePaneShape(t *testing.T) {
	t.Parallel()
	got := xIn(t, t.TempDir(), nil, "schema", "brief summon")
	if strings.Contains(got.stdout, "claude --bg") || !strings.Contains(got.stdout, "hc run --bg --no-parent") {
		t.Fatalf("summon's schema, want the hc run shape and no claude --bg:\n%s", got.stdout)
	}
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
