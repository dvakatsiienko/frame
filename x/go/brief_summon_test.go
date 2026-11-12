package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/creack/pty"
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

// the summon reads its ticket's project from linear for the display's area word: a fake answers `cli`
func (w summonWorld) summon(t *testing.T, command string, env ...string) ran {
	t.Helper()
	server := newFakeLinear(t, func(gqlCall) string { return `{"data":{"issue":{"project":{"name":"cli"}}}}` })
	base := []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID=", "X_KEYS=" + linearKeys(t), "X_LINEAR_URL=" + server.URL}
	return xIn(t, w.repo, asCaller(t, append(base, env...), "coordinator"), "brief", "summon", command)
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
// the summon x prints: the session id after the claude it runs, and -n the display it drew from the record
func withSessionID(command string, got ran) string {
	sid, _ := got.data["sessionId"].(string)
	display, _ := got.data["display"].(string)
	named := regexp.MustCompile(`-n '[^']*'`).ReplaceAllLiteralString(command, "-n '"+display+"'")
	return strings.Replace(named, "claude ", "claude --session-id "+sid+" ", 1)
}

// exit 27: the registry name a summon starts with is the display x thread show draws from the same record; FRM-579
// exit 5: its area is the ticket's project (cli), never the lane name's first word (thread)
func TestBriefSummonNamesTheThreadByItsRecord(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")
	env := []string{"X_THREADS=" + store, "X_SESSIONS=" + t.TempDir()}
	brief := w.brief(t, goodBrief+"\nthe spec: /f/.scratch/thread-records/spec.md\n", true)

	got := w.summon(t, codieArgv(w.repo, brief), env...)
	sid, _ := got.data["sessionId"].(string)
	show := xIn(t, t.TempDir(), env, "thread", "show", sid)

	argv, _ := got.data["argv"].(string)
	display, _ := show.data["display"].(string)
	if got.code != 0 || show.code != 0 || display != "🌗 🔧 cli | FRM-1" || !strings.Contains(argv, " -n '"+display+"' ") {
		t.Fatalf("exit %d/%d, x thread show draws %q, argv %q", got.code, show.code, display, argv)
	}
	if strings.Contains(argv, "codie: FRM-1") {
		t.Errorf("the argv keeps the name the command typed: %q", argv)
	}
}

// a quoted name holding the word claude comes before the call: the id goes after the claude x runs, never into the name
func TestBriefSummonAddsTheSessionIDAfterTheClaudeItRuns(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	brief := w.brief(t, goodBrief, true)
	command := "hc run --bg --no-parent --no-notify --name 'the claude codie' --cwd " + w.repo + " -- claude -n '🌗 🔧 codie: FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"

	got := w.summon(t, command, "HC_TERMINAL_ID=t9")

	sid, _ := got.data["sessionId"].(string)
	display, _ := got.data["display"].(string)
	want := strings.Replace(strings.Replace(command, "-n '🌗 🔧 codie: FRM-1'", "-n '"+display+"'", 1), "-- claude ", "-- claude --session-id "+sid+" ", 1)
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
	want := map[string]string{ids[0]: "🌗 🔧 cli | FRM-1", ids[1]: "🌗 🔧 cli | FRM-1", ids[2]: "🌗 🔎 cli | FRM-1"}
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

// FRM-579 exit 1: a standing role starts through summon, its record drawing the pretty name from roles.json
func (w summonWorld) summonStanding(t *testing.T, caller string, env []string, args ...string) ran {
	t.Helper()
	base := []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID="}
	return xIn(t, w.repo, asCaller(t, append(base, env...), caller), append([]string{"brief", "summon"}, args...)...)
}

func paneArgv(w summonWorld) string {
	return "hc run --bg --no-parent --no-notify --name boot --cwd " + w.repo + " -- claude -n 'any name' --model opus 'boot'"
}

func TestBriefSummonStartsEachStandingRoleUnderItsPrettyName(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ role, want string }{
		{"coordinator", "🦉 clio"},
		{"wing:3", "🦉🪽 clio: wing 3"},
		{"adviser", "🐦‍⬛ crow"},
		{"copyist", "🎀 helga"},
	} {
		t.Run(c.role, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			env := []string{"X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS=" + t.TempDir()}

			got := w.summonStanding(t, "coordinator", env, "--role", c.role, paneArgv(w))
			sid, _ := got.data["sessionId"].(string)
			show := xIn(t, t.TempDir(), env, "thread", "show", sid)

			argv, _ := got.data["argv"].(string)
			if got.code != 0 || show.code != 0 || show.data["display"] != c.want {
				t.Fatalf("exit %d/%d, x thread show draws %v, want %q:\n%s", got.code, show.code, show.data["display"], c.want, got.stdout)
			}
			if !strings.Contains(argv, "-- claude --session-id "+sid+" -n '"+c.want+"' ") {
				t.Errorf("argv %q, want the minted id and the pretty name", argv)
			}
		})
	}
}

// cc's --bg ignores --session-id: the door starts it, reads its job's session id back, and records it through --session
func TestBriefSummonRecordsABgThreadByItsSessionID(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions := t.TempDir()
	write(t, filepath.Join(sessions, "crow.json"), fmt.Sprintf(`{"sessionId":"sid-crow","pid":%d,"kind":"bg","jobId":"sid"}`, os.Getpid()))
	env := []string{"X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS=" + sessions}

	bg := w.summonStanding(t, "coordinator", env, "--role", "adviser", "cd "+w.repo+" && claude --bg -n 'any name' 'boot'")
	got := w.summonStanding(t, "coordinator", env, "--role", "adviser", "--session", "sid-crow")
	show := xIn(t, t.TempDir(), env, "thread", "show", "sid-crow")

	if bg.code != 1 || !strings.Contains(bg.stdout, "--session <sid>") {
		t.Errorf("a --bg argv: exit %d, want a refusal naming the --session form:\n%s", bg.code, bg.stdout)
	}
	if got.code != 0 || show.code != 0 || show.data["display"] != "🐦‍⬛ crow" || show.data["role"] != "adviser" {
		t.Fatalf("exit %d/%d, x thread show %v:\n%s", got.code, show.code, show.data, got.stdout)
	}
}

// the caller gate: only dima's terminal or a coordinator's record gives a standing role; a record-less session (a fork)
// or a member gets none, by either form
func TestBriefSummonGivesAStandingRoleOnlyFromTheCoordinator(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, caller string }{{"a session with no record", ""}, {"a codie", "codie"}, {"a sixth sense", "sixth-sense"}} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))
			// the real clio's record sits in the store: another session's role is never the caller's
			write(t, store, `{"v":1,"threads":[{"sessionId":"sid-real-clio","role":"coordinator"}]}`)
			env := []string{"X_THREADS=" + store, "X_SESSIONS=" + sessions}

			pane := w.summonStanding(t, c.caller, env, "--role", "coordinator", paneArgv(w))
			record := w.summonStanding(t, c.caller, env, "--role", "wing:1", "--session", "sid-fork")

			written, _ := readThreadStore(store)
			for _, got := range []ran{pane, record} {
				if got.code != 1 || !strings.Contains(got.stdout, "only the coordinator or dima") {
					t.Errorf("exit %d, want the coordinator's refusal:\n%s", got.code, got.stdout)
				}
			}
			if len(written.Threads) != 1 {
				t.Errorf("records %+v, want only the real clio's", written.Threads)
			}
		})
	}
}

// forks (dima's tick, 14:56): on his word the coordinator records a fork as a wing; the fork's own call gets nothing
func TestBriefSummonRecordsAForkAsAWingOnlyFromTheCoordinator(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	env := []string{"X_THREADS=" + store, "X_SESSIONS=" + sessions}
	// the fork is x's caller, its registry file on the test's pid; no record, so the gate reads no role
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-fork"}`)
	self := xIn(t, w.repo, append(env, "HOME="+w.home), "brief", "summon", "--role", "wing:2", "--session", "sid-fork")
	write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))

	byClio := w.summonStanding(t, "coordinator", env, "--role", "wing:2", "--session", "sid-fork")
	show := xIn(t, t.TempDir(), env, "thread", "show", "sid-fork")

	if self.code != 1 || !strings.Contains(self.stdout, "only the coordinator or dima") {
		t.Errorf("the fork's own call: exit %d, want the coordinator's refusal:\n%s", self.code, self.stdout)
	}
	if byClio.code != 0 || show.data["display"] != "🦉🪽 clio: wing 2" {
		t.Fatalf("exit %d, x thread show %v, want wing 2:\n%s", byClio.code, show.data, byClio.stdout)
	}
}

// a /clear mints a new id in the same process: the coordinator's record still names her by her pid and start
func TestBriefSummonReadsTheCoordinatorAcrossAClear(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions, callers := t.TempDir(), filepath.Join(t.TempDir(), "caller-threads.json")
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-after-clear"}`)
	write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))
	write(t, callers, fmt.Sprintf(`{"v":1,"threads":[{"sessionId":"sid-before-clear","pid":%d,"procStart":%q,"role":"coordinator"}]}`, os.Getpid(), ownProcStart(t)))
	env := []string{"HOME=" + w.home, "X_SESSIONS=" + sessions, "X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_CALLER_THREADS=" + callers}

	got := xIn(t, w.repo, env, "brief", "summon", "--role", "wing:1", "--session", "sid-fork")

	if got.code != 0 {
		t.Fatalf("exit %d, want the coordinator found by her pid and start:\n%s", got.code, got.stdout)
	}
}

// a torn registry file on x's nearest claude stands as a session with no record: the walk never reaches clio above it
func TestBriefSummonReadsATornRegistryFileAsNoCoordinator(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions, callers := t.TempDir(), filepath.Join(t.TempDir(), "caller-threads.json")
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-mem`)
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getppid())+".json"), `{"sessionId":"sid-clio"}`)
	write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d}`, os.Getpid()))
	write(t, callers, `{"v":1,"threads":[{"sessionId":"sid-clio","role":"coordinator"}]}`)
	env := []string{"HOME=" + w.home, "X_SESSIONS=" + sessions, "X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_CALLER_THREADS=" + callers}

	got := xIn(t, w.repo, env, "brief", "summon", "--role", "wing:1", "--session", "sid-fork")

	if got.code != 1 || !strings.Contains(got.stdout, "only the coordinator or dima") {
		t.Fatalf("exit %d, want the coordinator's refusal:\n%s", got.code, got.stdout)
	}
}

// round 1 P0: a line's X_SESSIONS or X_THREADS never aims a real build's refresh at another registry or store; under
// X_TEST a real build reads none at all
func TestAFixtureEnvNeverMovesARealBuildsStore(t *testing.T) {
	t.Parallel()
	real := storePathOf(false, "/tmp/forged", false, ".claude/sessions")
	underTest := storePathOf(false, "/tmp/forged", true, ".claude/sessions")
	if real == "/tmp/forged" || !strings.HasSuffix(real, "/.claude/sessions") || underTest != "" {
		t.Errorf("a real build reads %q, under X_TEST %q: want the real registry, then none", real, underTest)
	}
}

// exit 4's tty row on x's actor: a member under a pty with its agent env stripped still signs as codie, never as dima
func TestLinearUnderScriptActsAsTheMemberAboveIt(t *testing.T) {
	t.Parallel()
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"commentCreate":{"success":true,"comment":{"url":"https://linear.app/x-com/issue/FRM-1#comment-1"}}}}`
	})
	file := filepath.Join(t.TempDir(), "c.md")
	write(t, file, "done\n")
	env := append(asCaller(t, nil, "codie"), "X_KEYS="+linearKeys(t), "X_LINEAR_URL="+server.URL)

	got := scriptX(t, env, "linear", "comment", "FRM-1", "--body-file", file)

	if got.code != 0 || !strings.Contains(got.out, `"actor":"codie"`) {
		t.Fatalf("exit %d, want the codie actor:\n%s", got.code, got.out)
	}
}

// the backfill: dima's own terminal, no claude above x, records a live thread by the session id he read
func TestBriefSummonFromDimasTerminalRecordsALiveSession(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	write(t, filepath.Join(sessions, "other.json"), fmt.Sprintf(`{"sessionId":"sid-other","pid":%d}`, os.Getpid()))
	env := []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}

	got := scriptX(t, env, "brief", "summon", "--role", "coordinator", "--session", "sid-other")

	written, _ := readThreadStore(store)
	if got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Role != "coordinator" {
		t.Fatalf("exit %d, records %+v, want sid-other recorded as the coordinator:\n%s", got.code, written.Threads, got.out)
	}
}

// exit 4's tty row: a member that strips its agent env and wraps x in a pty still runs under its own registered thread
func TestBriefSummonUnderScriptReadsTheMemberAboveIt(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	write(t, filepath.Join(sessions, "other.json"), fmt.Sprintf(`{"sessionId":"sid-other","pid":%d}`, os.Getpid()))
	env := asCaller(t, []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}, "codie")

	got := scriptX(t, env, "brief", "summon", "--role", "coordinator", "--session", "sid-other")

	written, _ := readThreadStore(store)
	if got.code != 1 || !strings.Contains(got.out, "only the coordinator or dima") || len(written.Threads) != 0 {
		t.Fatalf("exit %d, records %+v, want the coordinator's refusal and no record:\n%s", got.code, written.Threads, got.out)
	}
}

// exit 7, the cutover: a clio started before the merge has no record, so her coordinator-only call refuses until dima's
// terminal backfills her by the session id he read; then it passes
func TestTheBackfillLetsAClioStartedBeforeTheMergeSummonAgain(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	brief := w.brief(t, goodBrief, true)
	// her registry as her own process sees it (x's parent is her), and as dima's terminal sees it (no claude above x)
	hers, dimas, store := t.TempDir(), t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	live := fmt.Sprintf(`{"sessionId":"sid-clio","pid":%d}`, os.Getpid())
	write(t, filepath.Join(hers, strconv.Itoa(os.Getpid())+".json"), live)
	write(t, filepath.Join(dimas, "clio.json"), live)
	env := []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID=", "X_THREADS=" + store}
	asClio := func() ran {
		return xIn(t, w.repo, append(env, "X_SESSIONS="+hers), "brief", "summon", codieArgv(w.repo, brief))
	}

	before := asClio()
	backfill := scriptX(t, append(env, "X_SESSIONS="+dimas), "brief", "summon", "--role", "coordinator", "--session", "sid-clio")
	after := asClio()

	if before.code != 1 || backfill.code != 0 || after.code != 0 {
		t.Fatalf("before %d, backfill %d, after %d: want 1, 0, 0:\n%s\n%s", before.code, backfill.code, after.code, backfill.out, after.stdout)
	}
}

// exit 5: a rename on dima's word lands in the record, x thread show draws it, and a later refresh keeps it; a member
// renames nothing
func TestThreadRenameSticksAcrossARefresh(t *testing.T) {
	t.Parallel()
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	write(t, filepath.Join(sessions, "w.json"), fmt.Sprintf(`{"sessionId":"sid-wing","pid":%d}`, os.Getpid()))
	write(t, store, `{"v":1,"threads":[{"sessionId":"sid-wing","role":"wing","wing":2}]}`)
	env := []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}

	byCodie := xIn(t, t.TempDir(), asCaller(t, env, "codie"), "thread", "rename", "sid-wing", "🌌 nova")
	byClio := xIn(t, t.TempDir(), asCaller(t, env, "coordinator"), "thread", "rename", "sid-wing", "🌌 nova")
	_ = xIn(t, t.TempDir(), env, "thread", "list")
	show := xIn(t, t.TempDir(), env, "thread", "show", "sid-wing")

	if byCodie.code != 1 || !strings.Contains(byCodie.stdout, "only the coordinator or dima") {
		t.Errorf("a codie's rename: exit %d, want the coordinator's refusal:\n%s", byCodie.code, byCodie.stdout)
	}
	if byClio.code != 0 || show.data["display"] != "🌌 nova" || show.data["role"] != "wing" {
		t.Fatalf("exit %d, after a refresh x thread show %v, want «🌌 nova», still a wing:\n%s", byClio.code, show.data, byClio.stdout)
	}
}

// exit 5: a role table line changed, every display follows, no reader's power moves
func TestARoleTableRenameMovesTheDisplayNotThePower(t *testing.T) {
	t.Parallel()
	table := slices.Clone(roles)
	i := slices.IndexFunc(table, func(r role) bool { return r.ID == "coordinator" })
	table[i].Display = "🦊 fox"
	if got := displayFrom(table, thread{SessionID: "s", Role: "coordinator"}); got != "🦊 fox" {
		t.Errorf("display %q, want the table's new line", got)
	}
	if !roleIn(table, "coordinator").IsCoordinator || roleIn(table, "codie").IsCoordinator {
		t.Error("a display rename moved who coordinates")
	}
}

// round 2: a herdr terminal with no claude above x looks like dima's own, a member's `hc run` pane too; it gets no
// coordinator or wing record, while a sidecar's still lands
func TestBriefSummonGivesNoCoordinatorRecordToABareHerdrPane(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		role string
		code int
	}{{"coordinator", 1}, {"wing:2", 1}, {"adviser", 0}} {
		t.Run(c.role, func(t *testing.T) {
			t.Parallel()
			sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "other.json"), fmt.Sprintf(`{"sessionId":"sid-other","pid":%d}`, os.Getpid()))

			got := scriptX(t, []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store, "HC_TERMINAL_ID=t9"}, "brief", "summon", "--role", c.role, "--session", "sid-other")

			if got.code != c.code {
				t.Fatalf("exit %d, want %d:\n%s", got.code, c.code, got.out)
			}
		})
	}
}

type scripted struct {
	code int
	out  string
}

// x on a pty, the agent env stripped: what a member's `env -u CLAUDECODE -u AI_AGENT script -q /dev/null x …` runs
// (script(1) itself takes other flags on linux, so the test opens the pty)
func scriptX(t *testing.T, env []string, args ...string) scripted {
	t.Helper()
	c := exec.Command(xbin, append(args, "--json")...)
	c.Env = append(append(cleanEnv(), "X_TEST=1", "HC_TERMINAL_ID="), env...)
	ptmx, err := pty.Start(c)
	if err != nil {
		t.Fatal(err)
	}
	defer ptmx.Close()
	out, _ := io.ReadAll(ptmx)
	return scripted{exitOf(c.Wait()), string(out)}
}

func TestBriefSummonRoleFlagTakesOnlyAStandingRole(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	for _, args := range [][]string{
		{"--role", "bogus", paneArgv(w)},
		{"--role", "codie", paneArgv(w)},
		{"--role", "wing", paneArgv(w)},
		{"--role", "wing:0", paneArgv(w)},
		{"--role", "adviser:2", paneArgv(w)},
		{"--session", "sid-1"},
		{"--role", "adviser", "--session", "sid-1", paneArgv(w)},
	} {
		if got := w.summonStanding(t, "coordinator", nil, args...); got.code != 2 {
			t.Errorf("%v: exit %d, want a usage refusal:\n%s", args, got.code, got.stdout)
		}
	}
}
