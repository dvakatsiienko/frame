package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

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

			got := w.summonStanding(t, "coordinator", env, "--role", c.role, paneArgv(w, c.want))
			sid, _ := got.data["sessionId"].(string)
			show := xIn(t, t.TempDir(), env, "thread", "show", sid)

			argv, _ := got.data["argv"].(string)
			if got.code != 0 || show.code != 0 || show.data["display"] != c.want {
				t.Fatalf("exit %d/%d, x thread show draws %v, want %q:\n%s", got.code, show.code, show.data["display"], c.want, got.stdout)
			}
			if !strings.Contains(argv, "-- claude --session-id "+sid+" ") || !strings.Contains(argv, " -n '"+c.want+"' ") {
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

// forks (dima's tick, 14:56): on his word the coordinator records a fork as a wing; the fork's own call gets nothing
func TestBriefSummonRecordsAForkAsAWingOnlyFromTheCoordinator(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	sessions, store := t.TempDir(), filepath.Join(t.TempDir(), "threads.json")
	env := []string{"X_THREADS=" + store, "X_SESSIONS=" + sessions}
	// the fork is x's caller, its registry file on the test's pid; no record, so the gate reads no role
	write(t, filepath.Join(sessions, strconv.Itoa(os.Getpid())+".json"), `{"sessionId":"sid-fork"}`)
	self := xIn(t, w.repo, append(env, "HOME="+w.home), "brief", "summon", "--apply", "--role", "wing:2", "--session", "sid-fork")
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

func TestBriefSummonRoleFlagTakesOnlyAStandingRole(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	for _, args := range [][]string{
		{"--role", "bogus", paneArgv(w, "any name")},
		{"--role", "codie", paneArgv(w, "any name")},
		{"--role", "wing", paneArgv(w, "any name")},
		{"--role", "wing:0", paneArgv(w, "any name")},
		{"--role", "adviser:2", paneArgv(w, "any name")},
		{"--session", "sid-1"},
		{"--role", "adviser", "--session", "sid-1", paneArgv(w, "any name")},
	} {
		if got := w.summonStanding(t, "coordinator", nil, args...); got.code != 2 {
			t.Errorf("%v: exit %d, want a usage refusal:\n%s", args, got.code, got.stdout)
		}
	}
}

// a standing role draws its whole display from roles.json: a scope or a lane kind for it is refused, never ignored
func TestBriefSummonRefusesALaneKindOrAreaOnAStandingRole(t *testing.T) {
	t.Parallel()
	w := newSummonWorld(t)
	for _, flag := range [][]string{{"--lane-kind", "quick"}, {"--area", "cli"}} {
		got := w.summonStanding(t, "coordinator", []string{"X_THREADS=" + filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS=" + t.TempDir()}, append([]string{"--role", "adviser", paneArgv(w, "🐦‍⬛ crow")}, flag...)...)

		if got.code != 2 || !strings.Contains(got.stdout, "a standing role draws its whole display") {
			t.Errorf("%v: exit %d, want a usage refusal:\n%s", flag, got.code, got.stdout)
		}
	}
}
