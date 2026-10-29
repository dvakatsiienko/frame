package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// FRM-399: a member's session acts as codie without --as; a ticket's size is a word, XS · S · M

func sessionsFixture(t *testing.T, name string) []string {
	t.Helper()
	dir := t.TempDir()
	write(t, filepath.Join(dir, "4242.json"), `{"sessionId":"s-1","name":"`+name+`","pid":4242}`)
	return []string{"X_SESSIONS=" + dir, "CLAUDE_CODE_SESSION_ID=s-1"}
}

func TestTheDefaultActorFollowsTheSessionsRegistryName(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, session, want string }{
		{"a member session acts as codie", "⚡ 🔧 codie: FRM-399", "codie"},
		{"sixth sense is a member too", "⚡ 🔎 sixth sense: FRM-399", "codie"},
		{"clio stays clio", "🦉 clio", "clio"},
		{"clio as the registry stores her keeps clio", "🦉  clio", "clio"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			server := newFakeLinear(t, func(gqlCall) string {
				return `{"data":{"commentCreate":{"success":true,"comment":{"url":"https://linear.app/x-com/issue/FRM-1#comment-1"}}}}`
			})
			file := filepath.Join(t.TempDir(), "c.md")
			write(t, file, "done\n")
			envelope, got := runLinear(t, server, sessionsFixture(t, c.session), "linear", "comment", "FRM-1", "--body-file", file)
			if data, _ := envelope["data"].(map[string]any); got.code != 0 || data["actor"] != c.want {
				t.Errorf("exit %d, actor %v, want %s\n%s", got.code, data["actor"], c.want, got.stdout)
			}
		})
	}
}

func TestSetTakesASizeWordForTheEstimate(t *testing.T) {
	t.Parallel()
	cases := []struct {
		given string
		want  float64
	}{{"XS", 1}, {"S", 2}, {"m", 3}, {"2", 2}}
	for _, c := range cases {
		t.Run(c.given, func(t *testing.T) {
			server := setServer(t)
			if _, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--estimate", c.given); got.code != 0 {
				t.Fatalf("exit %d\n%s%s", got.code, got.stdout, got.stderr)
			}
			if input := updateInput(t, server); input["estimate"] != c.want {
				t.Errorf("estimate %v, want %v", input["estimate"], c.want)
			}
		})
	}
}

func TestSetRefusesASizeItDoesNotKnowNamingTheSizes(t *testing.T) {
	t.Parallel()
	server := setServer(t)
	_, got := runLinear(t, server, nil, "linear", "set", "FRM-1", "--estimate", "L")
	if got.code != 2 || !strings.Contains(got.stdout, "XS · S · M") || len(server.requests()) > 1 {
		t.Errorf("exit %d, %d requests\n%s", got.code, len(server.requests()), got.stdout)
	}
}

func TestReadPrintsTheSizeWord(t *testing.T) {
	t.Parallel()
	server := newFakeLinear(t, readAnswer(map[string]issue{"FRM-1": {id: "FRM-1", title: "a sized ticket"}}))
	envelope, got := runLinear(t, server, nil, "linear", "read", "FRM-1")
	tickets, _ := envelope["data"].(map[string]any)["tickets"].([]any)
	if got.code != 0 || len(tickets) != 1 || tickets[0].(map[string]any)["size"] != "M" {
		t.Errorf("exit %d\n%s", got.code, got.stdout)
	}
}

// a ts test shelling to x under X_TEST inherits the caller's session id; it must never read the live registry
func TestUnderXTestWithoutXSessionsTheLiveRegistryIsNeverRead(t *testing.T) {
	t.Parallel()
	home := t.TempDir()
	write(t, filepath.Join(home, ".claude/sessions/1.json"), `{"sessionId":"s-1","name":"⚡ 🔧 codie: FRM-399","pid":1}`)
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"commentCreate":{"success":true,"comment":{"url":"https://linear.app/x-com/issue/FRM-1#comment-1"}}}}`
	})
	file := filepath.Join(t.TempDir(), "c.md")
	write(t, file, "done\n")
	envelope, got := runLinear(t, server, []string{"HOME=" + home, "CLAUDE_CODE_SESSION_ID=s-1"}, "linear", "comment", "FRM-1", "--body-file", file)
	if data, _ := envelope["data"].(map[string]any); got.code != 0 || data["actor"] != "clio" {
		t.Errorf("exit %d, actor %v\n%s", got.code, data["actor"], got.stdout)
	}
}
