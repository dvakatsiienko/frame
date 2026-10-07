package main

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// the cases of the TS hook's tests, one for one; DOT-159's history is its verbatim capture (2026-08-22)
var (
	todo    = &stateRef{"todo-id", "Todo", "unstarted"}
	started = &stateRef{"started-id", "In Progress", "started"}
	done    = &stateRef{"done-id", "Done", "completed"}
	dima    = &named{"Dima Vakatsiienko"}
	dot159  = []historyNode{
		{"2026-08-22T17:10:57.096Z", todo, started, nil},
		{"2026-08-22T17:10:57.096Z", nil, nil, dima},
		{"2026-08-22T17:10:57.096Z", nil, nil, nil},
		{"2026-08-22T17:10:23.382Z", started, todo, nil},
		{"2026-08-22T17:07:05.778Z", todo, started, nil},
		{"2026-08-22T17:07:05.778Z", nil, nil, dima},
		{"2026-08-22T17:07:05.778Z", nil, nil, nil},
		{"2026-08-22T14:25:59.617Z", nil, nil, nil},
	}
)

func at(iso string) time.Time { t, _ := time.Parse(time.RFC3339, iso); return t }

func TestPushedRefsDropADeletedRef(t *testing.T) {
	refs := parsePushedRefs("refs/heads/main aaa refs/heads/main bbb\nrefs/heads/gone " + strings.Repeat("0", 40) + " refs/heads/gone ccc\n")
	if len(refs) != 1 || refs[0].LocalRef != "refs/heads/main" {
		t.Errorf("refs %v", refs)
	}
}

func TestPushRangeBoundsANewBranchByTheOtherRemotes(t *testing.T) {
	if got := pushRange(pushedRef{"r", "aaa", "r", "bbb"}); !slices.Equal(got, []string{"bbb..aaa"}) {
		t.Errorf("an existing branch: %v", got)
	}
	if got := pushRange(pushedRef{"r", "aaa", "r", strings.Repeat("0", 40)}); !slices.Equal(got, []string{"aaa", "--not", "--remotes"}) {
		t.Errorf("a new branch: %v", got)
	}
}

func TestRemoteOwnershipFailsClosed(t *testing.T) {
	for _, url := range []string{"git@github.com:dvakatsiienko/frame.git", "https://github.com/dvakatsiienko/frame",
		"https://github.com/dvakatsiienko/frame.git", "ssh://git@github.com/dvakatsiienko/frame.git"} {
		if remote, reason := parseRemote(url); reason != "" || remote != (pushRemote{"github.com", "dvakatsiienko", "frame"}) {
			t.Errorf("%s: %v %q", url, remote, reason)
		}
	}
	for _, url := range []string{"git@github.com:someone-else/their-repo.git", "git@gitlab.com:dvakatsiienko/mirror.git", "./remote/r.git", ""} {
		if _, reason := parseRemote(url); reason == "" {
			t.Errorf("%q passed the ownership guard", url)
		}
	}
}

func TestMagicWordsReadWhatLinearReads(t *testing.T) {
	cases := []struct {
		messages []string
		want     []magicRef
	}{
		{[]string{"- ref DOT-145"}, []magicRef{{"DOT-145", false}}},
		{[]string{"Closes DOT-1", "part of BYT-2"}, []magicRef{{"DOT-1", true}, {"BYT-2", false}}},
		{[]string{"one push carrying a plain `- ref DOT-159` wrote"}, []magicRef{{"DOT-159", false}}},
		{[]string{"- ref DOT-9", "fixes DOT-9"}, []magicRef{{"DOT-9", true}}},
		{[]string{"refactor DOT-3", "DOT-4 alone", "relates to DOT-5"}, nil},
		{[]string{"- ticket: DOT-210"}, nil},
	}
	for _, c := range cases {
		if got := magicRefsIn(c.messages); !slices.Equal(got, c.want) {
			t.Errorf("%q → %v, want %v", c.messages, got, c.want)
		}
	}
}

func TestOurLinkLineGroupsCommitsByTicket(t *testing.T) {
	commit := func(sha, body string) pushCommit { return pushCommit{sha, strings.Split(body, "\n")[0], body, "main"} }
	ids := func(targets []linkTarget) (out []string) {
		for _, target := range targets {
			out = append(out, target.ID)
		}
		return out
	}
	if got := ids(linkTargetsIn([]pushCommit{commit("a1", "subject\n\n- ticket: DOT-210"), commit("b2", "subject\n\n* ticket: BYT-7")})); !slices.Equal(got, []string{"DOT-210", "BYT-7"}) {
		t.Errorf("the form: %v", got)
	}
	if got := ids(linkTargetsIn([]pushCommit{commit("c3", "subject\n\n- ticket: FRM-26"), commit("d4", "subject\n\n- ticket: DOT-26")})); !slices.Equal(got, []string{"FRM-26", "DOT-26"}) {
		t.Errorf("both team keys: %v", got)
	}
	grouped := linkTargetsIn([]pushCommit{commit("a1", "s\n\n- ticket: DOT-1"), commit("b2", "s\n\n- ticket: DOT-1")})
	if len(grouped) != 1 || len(grouped[0].Commits) != 2 {
		t.Errorf("several commits on one ticket: %v", grouped)
	}
	if once := linkTargetsIn([]pushCommit{commit("a1", "s\n\n- ticket: DOT-1\n- ticket: DOT-1")}); len(once) != 1 || len(once[0].Commits) != 1 {
		t.Errorf("a repeated line: %v", once)
	}
	if none := linkTargetsIn([]pushCommit{commit("a1", "DOT-1 alone\nsee DOT-2\nthe ticket: DOT-3 is open")}); len(none) != 0 {
		t.Errorf("a mention linked: %v", none)
	}
	if branch := branchOf(pushedRef{"refs/heads/main", "a", "refs/heads/probe-linear-forms", "b"}); branch != "probe-linear-forms" {
		t.Errorf("branch %q", branch)
	}
}

func TestRevertPlanTouchesOnlyWhatTheIntegrationWrote(t *testing.T) {
	pushed := at("2026-08-22T17:07:00Z")
	cases := []struct {
		name     string
		closing  bool
		current  string
		history  []historyNode
		pushedAt time.Time
		want     []revertStep
	}{
		{"a write after the push is the integration — both halves", false, started.ID, dot159, pushed,
			[]revertStep{{Kind: "unassign"}, {"state", todo.ID, todo.Name}}},
		{"a write before the push is dima's", false, started.ID, dot159, at("2026-08-22T17:11:00Z"), nil},
		{"a closing keyword keeps its state move", true, started.ID, dot159, pushed, []revertStep{{Kind: "unassign"}}},
		{"a state already back is left alone", false, todo.ID, dot159, pushed, []revertStep{{Kind: "unassign"}}},
		{"a completed state is never reopened", false, done.ID, []historyNode{{"2026-08-22T17:07:05.778Z", started, done, nil}}, pushed, nil},
	}
	for _, c := range cases {
		if got := planRevert(c.closing, c.current, c.history, c.pushedAt); !slices.Equal(got.Reverts, c.want) {
			t.Errorf("%s: %v, want %v", c.name, got.Reverts, c.want)
		}
	}
	if reasons := planRevert(false, started.ID, dot159, at("2026-08-22T17:11:00Z")).Reasons; len(reasons) != 1 {
		t.Errorf("a plan that does nothing still says why: %v", reasons)
	}
}

func hookRun(t *testing.T, dir string, env []string, stdin string, argv ...string) (string, int) {
	t.Helper()
	cmd := exec.Command(xbin, append([]string{"linear", "push"}, argv...)...)
	cmd.Dir = dir
	cmd.Env = append(append(cleanEnv(), "X_TEST=1", "X_PUSH_FAST=1"), env...)
	cmd.Stdin = strings.NewReader(stdin)
	var stderr, stdout bytes.Buffer
	cmd.Stderr, cmd.Stdout = &stderr, &stdout
	code := exitOf(cmd.Run())
	return stderr.String() + stdout.String(), code
}

func TestPushHookStandsDownOutsideOurRepos(t *testing.T) {
	server := newFakeLinear(t, okAnswer)
	said, code := hookRun(t, t.TempDir(), []string{"X_LINEAR_URL=" + server.URL, "X_KEYS=" + linearKeys(t)},
		"refs/heads/main aaa refs/heads/main bbb\n", "origin", "git@github.com:someone-else/repo.git")
	if code != 0 || !strings.Contains(said, "standing down") || len(server.requests()) != 0 {
		t.Errorf("exit %d, %q, %d requests", code, said, len(server.requests()))
	}
}

func TestPushRunByHandOnATerminalDoesNotWaitForStdin(t *testing.T) {
	out, code := runTTY(t, xbin, world(t), call{ID: "linear-push-tty", Mode: "tty", Cols: 100,
		Argv: []string{"linear", "push", "origin", "git@github.com:dvakatsiienko/frame.git"}, Env: map[string]string{"X_TEST": "1"}})
	if code != 0 {
		t.Errorf("exit %d:\n%s", code, out)
	}
}

func TestPushLinksTheTicketAndUndoesTheAutoAssignOnceThePushLands(t *testing.T) {
	bare, repo := filepath.Join(t.TempDir(), "remote.git"), t.TempDir()
	gitT(t, repo, "init", "-q", "-b", "main")
	gitT(t, repo, "init", "-q", "--bare", bare)
	write(t, filepath.Join(repo, "a.txt"), "a")
	gitT(t, repo, "add", "a.txt")
	gitT(t, repo, "commit", "-q", "-m", "🔧 x: a thing\n\n- ticket: FRM-1\nref FRM-2")
	sha := gitT(t, repo, "rev-parse", "HEAD")
	gitT(t, repo, "push", "-q", bare, "main")

	server := newFakeLinear(t, func(call gqlCall) string {
		switch {
		case strings.Contains(call.Query, "history("):
			return fmt.Sprintf(`{"data":{"issue":{"state":{"id":"s-ip"},"history":{"nodes":[{"createdAt":%q,"fromState":null,"toState":null,"toAssignee":{"name":"Dima"}}]}}}}`,
				time.Now().UTC().Format(time.RFC3339Nano))
		case strings.Contains(call.Query, "attachmentCreate"):
			return `{"data":{"attachmentCreate":{"success":true}}}`
		}
		return `{"data":{"issueUpdate":{"success":true}}}`
	})
	stdin := fmt.Sprintf("refs/heads/main %s refs/heads/main %s\n", sha, strings.Repeat("0", 40))
	said, code := hookRun(t, repo, []string{"X_LINEAR_URL=" + server.URL, "X_KEYS=" + linearKeys(t)}, stdin, bare, "git@github.com:dvakatsiienko/frame.git")
	if code != 0 || !strings.Contains(said, "linking 1 commit to FRM-1") {
		t.Fatalf("exit %d, %q", code, said)
	}
	deadline := time.Now().Add(15 * time.Second)
	var link, unassign *gqlCall
	for time.Now().Before(deadline) && (link == nil || unassign == nil) {
		for _, call := range server.requests() {
			input, _ := call.Variables["input"].(map[string]any)
			switch {
			case strings.Contains(call.Query, "attachmentCreate"):
				link = &call
			case strings.Contains(call.Query, "issueUpdate") && call.Variables["id"] == "FRM-2" && input != nil && input["assigneeId"] == nil:
				unassign = &call
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	if link == nil {
		t.Fatal("the run half never linked the commit")
	}
	input := link.Variables["input"].(map[string]any)
	if input["issueId"] != "FRM-1" || input["url"] != "https://github.com/dvakatsiienko/frame/commit/"+sha {
		t.Errorf("the link sent %v", input)
	}
	if unassign == nil {
		t.Error("the auto-assign on FRM-2 was never undone")
	}
}
