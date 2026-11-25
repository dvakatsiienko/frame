package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

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
	command := "hc run --bg --no-parent --no-notify --name 'the claude codie' --cwd " + w.repo + " -- claude -n '🌗 🔧 cli | FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"

	got := w.summon(t, command, "HC_TERMINAL_ID=t9")

	sid, _ := got.data["sessionId"].(string)
	display, _ := got.data["display"].(string)
	want := strings.Replace(strings.Replace(command, "-n '🌗 🔧 cli | FRM-1'", "-n '"+display+"'", 1), "-- claude ", "-- claude --session-id "+sid+" --settings '{\"promptSuggestionEnabled\":false}' ", 1)
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

// FRM-600 exit 2: the command's own -n must be the name x draws; --area is what moves the area word
func TestBriefSummonRefusesANameThatIsNotTheDrawnOne(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, typed string
		extra       []string
		want        string
	}{
		{"a name typed by hand", "🌗 🔧 codie: FRM-1", nil, "x draws «🌗 🔧 cli | FRM-1»"},
		{"the project word when an area is given", "🌗 🔧 cli | FRM-1", []string{"--area", "stray"}, "x draws «🌗 🐕 stray | chores»"},
		{"the drawn name", "🌗 🔧 cli | FRM-1", nil, ""},
		{"the drawn name of an area", "🌗 🐕 stray | chores", []string{"--area", "stray"}, ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			brief := w.brief(t, goodBrief, true)
			command := strings.Replace(codieArgv(w.repo, brief), "🌗 🔧 cli | FRM-1", c.typed, 1)

			got := w.summonWith(t, command, append([]string{"--apply", "--area", "cli"}, c.extra...), "X_THREADS="+filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS="+t.TempDir())

			if c.want == "" {
				if got.code != 0 {
					t.Fatalf("exit %d, want the summon to pass:\n%s", got.code, got.stdout)
				}
				return
			}
			if got.code != 1 || !strings.Contains(got.stdout, "-n names «"+c.typed+"»") || !strings.Contains(got.stdout, c.want) || !strings.Contains(got.next, "x brief summon") {
				t.Errorf("exit %d next %q, want a refusal naming both names:\n%s", got.code, got.next, got.stdout)
			}
		})
	}
}

// FRM-600 exit 3: a check prints the argv and writes no record; the --apply that follows records the id the check printed
func TestBriefSummonCheckWritesNoRecordAndApplyRecordsItsPrintedID(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	store := filepath.Join(t.TempDir(), "threads.json")
	env := []string{"X_THREADS=" + store, "X_SESSIONS=" + t.TempDir()}
	command := codieArgv(w.repo, w.brief(t, goodBrief, true))

	check := w.summonWith(t, command, []string{"--area", "cli"}, env...)
	var planned struct {
		Plan struct{ Argv, SessionID string } `json:"plan"`
	}
	_ = json.Unmarshal([]byte(check.stdout), &planned)
	afterCheck, _ := readThreadStore(store)
	applied := w.summon(t, command, env...)
	afterApply, _ := readThreadStore(store)

	if check.code != 4 || planned.Plan.SessionID == "" || !strings.Contains(planned.Plan.Argv, "--session-id "+planned.Plan.SessionID+" ") {
		t.Fatalf("a check: exit %d, want 4 printing an argv with its session id:\n%s", check.code, check.stdout)
	}
	if len(afterCheck.Threads) != 0 {
		t.Errorf("a check wrote %+v", afterCheck.Threads)
	}
	if applied.code != 0 || len(afterApply.Threads) != 1 || afterApply.Threads[0].SessionID != planned.Plan.SessionID || applied.data["argv"] != planned.Plan.Argv {
		t.Errorf("--apply: exit %d, records %+v, want the one record under the printed id %s and the printed argv:\n%s", applied.code, afterApply.Threads, planned.Plan.SessionID, applied.stdout)
	}
}

// the id of an identical summon line never repeats one cc already ran under, though its record is gone
func TestBriefSummonSkipsAnIDASessionOrTranscriptHolds(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions := t.TempDir()
	env := []string{"X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS=" + sessions}
	command := codieArgv(w.repo, w.brief(t, goodBrief, true))
	idOf := func() string {
		got := w.summonWith(t, command, []string{"--area", "cli"}, env...)
		var planned struct {
			Plan struct{ SessionID string } `json:"plan"`
		}
		_ = json.Unmarshal([]byte(got.stdout), &planned)
		return planned.Plan.SessionID
	}

	first := idOf()
	write(t, filepath.Join(sessions, "old.json"), `{"sessionId":"`+first+`"}`)
	second := idOf()
	write(t, filepath.Join(w.home, ".claude/projects/-some-dir", second+".jsonl"), "{}\n")
	third := idOf()

	if first == "" || second == first || third == first || third == second {
		t.Errorf("ids %q %q %q, want three different: one past a session file, one past a transcript", first, second, third)
	}
}
