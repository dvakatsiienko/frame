package main

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

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

// dima, 15:47: with no live coordinator record, today's name check still seats clio, marked fallback; one record
// anywhere and the name seats nothing
func TestTheNameFallbackSeatsClioOnlyWhileNoCoordinatorRecordLives(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, records string
		want          any
	}{
		{"no record anywhere", `{"v":1,"threads":[]}`, "coordinator"},
		{"a real clio's record lives", fmt.Sprintf(`{"v":1,"threads":[{"sessionId":"sid-real","pid":%d,"role":"coordinator"}]}`, os.Getpid()), nil},
		{"an earlier refresh's fallback row beside a real record", fmt.Sprintf(`{"v":1,"threads":[{"sessionId":"sid-fork","pid":%d,"role":"coordinator","fallback":true},{"sessionId":"sid-real","pid":%d,"role":"coordinator"}]}`, os.Getpid(), os.Getpid()), nil},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
			write(t, filepath.Join(sessions, "fork.json"), fmt.Sprintf(`{"sessionId":"sid-fork","pid":%d,"name":"🦉 clio"}`, os.Getpid()))
			write(t, filepath.Join(sessions, "real.json"), fmt.Sprintf(`{"sessionId":"sid-real","pid":%d,"name":"any"}`, os.Getpid()))
			write(t, store, c.records)
			env := []string{"X_SESSIONS=" + sessions, "X_THREADS=" + store}

			show := xIn(t, t.TempDir(), env, "thread", "show", "sid-fork")

			if show.data["role"] != c.want {
				t.Fatalf("role %v, want %v:\n%s", show.data["role"], c.want, show.stdout)
			}
		})
	}
}
