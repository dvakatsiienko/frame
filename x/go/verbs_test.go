package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// every verb answers --help with its usage and schema with its own entry, both in the envelope
func TestEveryVerbHasHelpAndSchema(t *testing.T) {
	dir := repo(t)
	for _, verb := range verbs {
		help := xIn(t, dir, nil, append(strings.Fields(verb.Name), "--help", "--json")...)
		if help.code != 0 || help.data["usage"] != verb.Usage {
			t.Errorf("%s --help: exit %d, usage %v", verb.Name, help.code, help.data["usage"])
		}
		schema := xIn(t, dir, nil, append([]string{"schema"}, strings.Fields(verb.Name)...)...)
		listed, _ := schema.data["verbs"].([]any)
		if schema.code != 0 || len(listed) == 0 || listed[0].(map[string]any)["name"] != verb.Name {
			t.Errorf("schema %s: exit %d, %d entries", verb.Name, schema.code, len(listed))
		}
	}
}

// a repo whose pre-commit hook fails while the untracked wip file exists, and records what it saw
func gatedRepo(t *testing.T, hook string) (dir, seen string) {
	dir = repo(t)
	write(t, filepath.Join(dir, "tracked.txt"), "committed\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "tracked")
	write(t, filepath.Join(dir, "tracked.txt"), "wip edit\n")
	write(t, filepath.Join(dir, "wip/draft.txt"), "wip\n")
	write(t, filepath.Join(dir, "readme.txt"), "the change\n")
	seen = filepath.Join(t.TempDir(), "seen")
	write(t, filepath.Join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\ncat tracked.txt > "+seen+"\n"+hook+"\n")
	return dir, seen
}

func read(t *testing.T, path string) string {
	t.Helper()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func TestHoldUnstagedHidesOtherWorkFromTheHooks(t *testing.T) {
	gate := "test -e wip/draft.txt && exit 1; exit 0"
	without, _ := gatedRepo(t, gate)
	if got := xIn(t, without, nil, "lane", "commit", message(t), "--", "readme.txt"); got.code != 1 {
		t.Fatalf("the gate should refuse while the wip file is in the tree: exit %d", got.code)
	}

	dir, seen := gatedRepo(t, gate)
	got := xIn(t, dir, nil, "lane", "commit", "--hold-unstaged", message(t), "--", "readme.txt")

	if got.code != 0 {
		t.Fatalf("exit %d", got.code)
	}
	if read(t, seen) != "committed\n" {
		t.Errorf("the hook saw %q, want the index version", read(t, seen))
	}
	if read(t, filepath.Join(dir, "tracked.txt")) != "wip edit\n" || read(t, filepath.Join(dir, "wip/draft.txt")) != "wip\n" {
		t.Error("the held files did not come back")
	}
	if status := gitT(t, dir, "status", "--porcelain"); status != " M tracked.txt\n?? wip/" && status != "M tracked.txt\n?? wip/" {
		t.Errorf("status after: %q", status)
	}
}

func TestHoldUnstagedPutsFilesBackWhenTheHookRefuses(t *testing.T) {
	dir, _ := gatedRepo(t, "exit 1")

	got := xIn(t, dir, nil, "lane", "commit", "--hold-unstaged", message(t), "--", "readme.txt")

	if got.code != 1 {
		t.Fatalf("exit %d, want the refusal", got.code)
	}
	if read(t, filepath.Join(dir, "tracked.txt")) != "wip edit\n" || read(t, filepath.Join(dir, "wip/draft.txt")) != "wip\n" {
		t.Error("a refused commit left the held files aside")
	}
}

func TestBriefLintRules(t *testing.T) {
	cases := []struct {
		name, brief string
		finds       bool
	}{
		{"a rate with no n", "- passes in 95% of runs\n", true},
		{"a rate with its n", "- passes in 95% of 40 runs\n", false},
		{"an exit line with no surface", "## exit\n\n- the board looks right\n", true},
		{"an exit line naming a file", "## exit\n\n- the board in `x/go/boards.go` looks right\n", false},
		{"an exit line naming a port", "## exit lines\n\n- localhost:7373 serves the map\n", false},
		{"an exit line into cclio", "## exit\n\n- `cclio/docs/recipes/x.md` holds it\n", true},
		{"a prose line into cclio", "the recipe sits in `cclio/docs`\n", false},
		{"a relayed approval with no time", "dima approved the cut\n", true},
		{"a relayed approval with its time", "dima approved the cut at 14:59\n", false},
		{"jev with no budget", "route it through jev\n", true},
		{"jev with a budget", "route it through jev, budget 200 calls\n", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if found := lint(briefLines(c.brief)); (len(found) > 0) != c.finds {
				t.Errorf("found %+v", found)
			}
		})
	}
}

func TestBriefCheckNamesATicketLinearCannotFind(t *testing.T) {
	bin := t.TempDir()
	write(t, filepath.Join(bin, "linear"), "#!/bin/sh\necho '{\"errors\":[{\"message\":\"Entity not found: Issue\",\"path\":[\"t1\"]}],\"data\":null}'\n")
	brief := filepath.Join(t.TempDir(), "brief.md")
	write(t, brief, "see FRM-1 and FRM-99999\n")

	got := xIn(t, repo(t), []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_STATE=" + t.TempDir()}, "brief", "check", brief)

	if got.code != 1 || !strings.Contains(got.stdout, "ticket FRM-99999") || strings.Contains(got.stdout, "ticket FRM-1 ") {
		t.Fatalf("exit %d: %s", got.code, got.stdout)
	}
}

func TestBriefCheckStampsAPass(t *testing.T) {
	state, brief := t.TempDir(), filepath.Join(t.TempDir(), "brief.md")
	write(t, brief, "read `readme.txt`\n")

	got := xIn(t, repo(t), []string{"X_STATE=" + state}, "brief", "check", brief)

	if stamp, _ := got.data["stamp"].(string); got.code != 0 || !strings.HasPrefix(stamp, state) || read(t, stamp) == "" {
		t.Fatalf("exit %d, data %v", got.code, got.data)
	}
}

func TestBriefCheckNamesAMissingPath(t *testing.T) {
	brief := filepath.Join(t.TempDir(), "brief.md")
	write(t, brief, "read `readme.txt` and `docs/gone.md`\n")

	got := xIn(t, repo(t), []string{"X_STATE=" + t.TempDir()}, "brief", "check", brief)

	if got.code != 1 || !strings.Contains(got.stdout, "line 1: path docs/gone.md") || strings.Contains(got.stdout, "readme.txt —") {
		t.Fatalf("exit %d: %s", got.code, got.stdout)
	}
}

// the fixture world's fake claude logs `<cwd> <argv>` per call
func claudeCalls(t *testing.T, dir string) []string {
	return strings.Split(strings.TrimSpace(read(t, filepath.Join(dir, "claude.log"))), "\n")
}

func TestProbeBareAsksWithNoSetupFromOutsideAnyRepo(t *testing.T) {
	dir := world(t)
	env := []string{"PATH=" + dir + "/bin:" + os.Getenv("PATH")}

	if got := xIn(t, filepath.Join(dir, "repo"), env, "probe", "bare", "is it us?"); got.code != 0 {
		t.Fatalf("exit %d: %s", got.code, got.stdout)
	}

	call := claudeCalls(t, dir)[0]
	cwd, argv, _ := strings.Cut(call, " ")
	for _, flag := range []string{"-p", "--model haiku", "--safe-mode", "--strict-mcp-config", "--no-session-persistence", "is it us?"} {
		if !strings.Contains(argv, flag) {
			t.Errorf("claude ran without %s: %s", flag, argv)
		}
	}
	if strings.HasPrefix(cwd, dir) || exists(cwd) {
		t.Errorf("claude ran in %s; want a temp dir outside the repo, gone after", cwd)
	}
}

func TestProbeSessionResumesItsOwnSession(t *testing.T) {
	dir := world(t)
	env := []string{"PATH=" + dir + "/bin:" + os.Getenv("PATH"), "X_STATE=" + filepath.Join(dir, "state")}
	settings := filepath.Join(dir, "probe-settings.json")

	first := xIn(t, dir, env, "probe", "session", "canary", settings, "remember plum")
	second := xIn(t, dir, env, "probe", "session", "canary", settings, "which word?")

	calls := claudeCalls(t, dir)
	id, _ := first.data["sessionId"].(string)
	if first.code != 0 || second.code != 0 || second.data["resumed"] != true {
		t.Fatalf("exits %d %d, second %v", first.code, second.code, second.data)
	}
	if !strings.Contains(calls[0], "--session-id") || !strings.Contains(calls[1], "--resume") {
		t.Errorf("want a new session, then a resume: %v", calls)
	}
	want, _ := filepath.EvalSymlinks(filepath.Join(dir, "state/probes/canary"))
	if !strings.HasPrefix(calls[1], want+" ") || !strings.Contains(calls[1], "--settings "+settings) {
		t.Errorf("the resume ran as %q, want cwd %s and the settings %s (session %s)", calls[1], want, settings, id)
	}
}

func TestKnowledgeReadLogsTheRead(t *testing.T) {
	state := t.TempDir()
	root, _ := filepath.Abs("../fixtures/knowledge")

	got := xIn(t, repo(t), []string{"X_STATE=" + state, "X_KNOWLEDGE_ROOT=" + root}, "knowledge", "read", "models")

	if got.code != 0 || !strings.Contains(read(t, filepath.Join(state, "knowledge-reads.jsonl")), `"name":"models"`) {
		t.Fatalf("exit %d, no read logged", got.code)
	}
}
