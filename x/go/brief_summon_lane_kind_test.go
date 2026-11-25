package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// a member is born with its ticket's mode: the ticket's lane: line outranks the brief's and a stale lane record
func TestBriefSummonTakesTheLaneKindFromItsTicket(t *testing.T) {
	t.Parallel()
	sideLane := `{"v":1,"threads":[{"sessionId":"s1","role":"codie","lane":"lane-1","laneKind":"side","ticket":"FRM-9","area":"cli"}]}`
	for _, c := range []struct {
		name, ticket, flag, want string
		isSixthSense             bool
	}{
		{"a quick ticket's codie, its brief saying side", "lane: quick\nrepo: frame\n", "", "⚡ 🔧 cli | FRM-1", false},
		{"a quick ticket's sixth sense, its lane's codie recorded side", "lane: quick\n", "", "⚡ 🔎 cli | FRM-1", true},
		{"a shift ticket's sixth sense", "lane: shift\n", "", "🌘 🔎 cli | FRM-1", true},
		{"--lane-kind outranks the ticket", "lane: quick\n", "shift", "🌘 🔧 cli | FRM-1", false},
		{"a ticket naming no mode leaves the brief's", "## wish\n", "", "🌗 🔧 cli | FRM-1", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			w.ticket = c.ticket
			store := filepath.Join(t.TempDir(), "threads.json")
			write(t, store, sideLane)
			command := strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "🌗 🔧 cli | FRM-1", c.want, 1)
			if c.isSixthSense {
				command = strings.Replace(sixthArgv(w, " spec: .scratch/lane-1/spec.md"), "🌗 🔎 cli | FRM-1", c.want, 1)
			}

			flags := []string{"--apply", "--area", "cli"}
			if c.flag != "" {
				flags = append(flags, "--lane-kind", c.flag)
			}

			got := w.summonWith(t, command, flags, "X_THREADS="+store, "X_SESSIONS="+t.TempDir())

			if got.code != 0 || got.data["display"] != c.want {
				t.Errorf("exit %d display %v, want exit 0 and %q:\n%s", got.code, got.data["display"], c.want, got.stdout)
			}
		})
	}
}

// FRM-617 exit 2: a member summoned onto a dispatched ticket with no spec: line is born in the 🚀 line's lane, so a
// fresh codie never sits laneless beside its own sixth sense
func TestBriefSummonTakesTheLaneFromItsTicketsDispatchLine(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, ticket, want string }{
		{"a dispatched ticket", "lane: quick\n\n🚀 dispatched 2026-11-16 — herdr-lane-2, codie s0\n", "herdr-lane-2"},
		{"a dispatch taken back", "lane: quick\n\n🚀 dispatched 2026-11-16 — herdr-lane-2, codie s0\n↩️ back to Todo 2026-11-16\n", ""},
		{"an undispatched ticket", "lane: quick\n", ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			w.ticket = c.ticket
			store := filepath.Join(t.TempDir(), "threads.json")

			got := w.summonWith(t, strings.Replace(codieArgv(w.repo, w.brief(t, goodBrief, true)), "🌗 🔧 cli | FRM-1", "⚡ 🔧 cli | FRM-1", 1), []string{"--apply", "--area", "cli"}, "X_THREADS="+store, "X_SESSIONS="+t.TempDir())

			written, err := readThreadStore(store)
			if err != nil || got.code != 0 || len(written.Threads) != 1 || written.Threads[0].Lane != c.want {
				t.Errorf("exit %d, records %+v, want one codie in lane %q:\n%s", got.code, written.Threads, c.want, got.stdout)
			}
		})
	}
}

// a ticket linear does not answer for leaves the name without its mode: the summon refuses and names the flag
func TestBriefSummonRefusesWhenItsTicketsLaneKindIsUnread(t *testing.T) {
	t.Parallel()
	unknown := newFakeLinear(t, func(gqlCall) string { return `{"data":{"issue":null}}` })
	for _, c := range []struct{ name, url string }{
		{"linear down", "http://127.0.0.1:1"},
		{"a ticket linear does not know", unknown.URL},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			store := filepath.Join(t.TempDir(), "threads.json")

			got := w.summon(t, codieArgv(w.repo, w.brief(t, goodBrief, true)), "X_THREADS="+store, "X_SESSIONS="+t.TempDir(), "X_LINEAR_URL="+c.url)

			if got.code != 1 || !strings.Contains(got.stdout, "--area cli --lane-kind <side|quick|shift> --apply") || exists(store) {
				t.Errorf("exit %d, want 1 with a next that runs as printed and no record:\n%s", got.code, got.stdout)
			}
		})
	}
}

// the mode leads the name from birth: --lane-kind gives it when the brief's lane: line does not
func TestBriefSummonTakesTheLaneKindFromAFlag(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, kind, typed string
		wantCode          int
	}{
		{"quick", "quick", "⚡ 🐕 stray | chores", 0},
		{"side beats nothing", "side", "🌗 🐕 stray | chores", 0},
		{"a kind that is no mode", "later", "🌗 🐕 stray | chores", 2},
		{"a name without the mode", "quick", "🐕 stray | chores", 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newSummonWorld(t)
			command := strings.Replace(codieArgv(w.repo, w.brief(t, strings.Replace(goodBrief, "lane: side\n", "", 1), true)), "🌗 🔧 cli | FRM-1", c.typed, 1)

			got := w.summonWith(t, command, []string{"--apply", "--area", "stray", "--lane-kind", c.kind}, "X_THREADS="+filepath.Join(t.TempDir(), "threads.json"), "X_SESSIONS="+t.TempDir())

			if got.code != c.wantCode || (c.wantCode == 0 && got.data["display"] != c.typed) {
				t.Errorf("exit %d display %v, want exit %d and %q:\n%s", got.code, got.data["display"], c.wantCode, c.typed, got.stdout)
			}
		})
	}
}
