package main

import (
	"path/filepath"
	"strings"
	"testing"
)

// FRM-700: a lane starts only from a chunk whose spec section is sealed on the ticket's current text

const sealedExit = "\n\n### exit lines\n\n1. given a ticket, when `x lane dispatch` runs, then it holds\n"

// a spec section as its seal leaves it: the wish line, then an exit line a lane can grade
func sealedSection(wish string) string { return wish + sealedExit }

func wishOf(id, body string) string { return "wish: " + id + " · body " + bodySignHash(body) }

func specWith(t *testing.T, frame string, sections map[string]string) {
	t.Helper()
	text := "# feat\n\n"
	for _, id := range []string{"FRM-1", "FRM-2"} {
		if section, ok := sections[id]; ok {
			text += "## " + id + " — the chunk\n\n" + section + "\n"
		}
	}
	write(t, filepath.Join(frame, ".scratch/feat/spec.md"), text)
}

var sealLane = []string{"--session", "s1", "--area", "cli", "--lane", "feat"}

func TestDispatchRefusesAChunkThatIsNotSealed(t *testing.T) {
	t.Parallel()
	staleVoices := "lane: quick\nrepo: frame\n\n* install few other best top rated speechify voices\n\n⸻ 🪪 stamp — please keep 🙏\n\n## signed\n\n✍️ signed 2026-11-24 · body " + bodyHash("lane: quick\nrepo: frame\n\n") + "\n✏️ changed 2026-11-24 — voices added\n"
	sealed := undispatched.body
	quick := dispatchState{body: quickTicket, state: "Todo", labels: []string{"agent"}}
	for _, c := range []struct {
		name  string
		state dispatchState
		spec  map[string]string
		args  []string
		want  []string
	}{
		{"no spec section, dry", undispatched, nil, append([]string{"FRM-1"}, sealLane...), []string{"FRM-1", "no spec section"}},
		{"no spec section, apply", undispatched, nil, append([]string{"FRM-1", "--apply"}, sealLane...), []string{"FRM-1", "no spec section"}},
		{"no spec section, quick", quick, nil, append([]string{"--quick", "FRM-1", "--apply"}, sealLane...), []string{"FRM-1", "no spec section"}},
		{"a section with no seal hash", undispatched, map[string]string{"FRM-1": sealedSection("wish: FRM-1")}, append([]string{"FRM-1"}, sealLane...), []string{"FRM-1", "no seal hash"}},
		{"a hash that is not the text's", undispatched, map[string]string{"FRM-1": sealedSection("wish: FRM-1 · body 00000000")}, append([]string{"FRM-1"}, sealLane...), []string{"FRM-1", "moved since the seal", "00000000", bodySignHash(sealed)}},
		{"two unsealed tickets in one call", undispatched, nil, append([]string{"FRM-1", "FRM-2"}, sealLane...), []string{"FRM-1", "FRM-2", "no spec section"}},
		{"a quick ticket edited under a ✏️ line after its seal", dispatchState{body: staleVoices, state: "Todo", labels: []string{"agent"}}, map[string]string{"FRM-1": sealedSection(wishOf("FRM-1", "lane: quick\nrepo: frame\n\n"))}, append([]string{"--quick", "FRM-1"}, sealLane...), []string{"FRM-1", "moved since the seal"}},
		{"a start for another lane than the 🚀 line's", dispatchState{body: signedBody(dispatchAbove, "🚀 dispatched 2026-11-24 — l, codie s1, main:abc1234\n", dispatchAbove) + "\n⸻ 🪪 stamp", state: "In Progress", delegate: "codie"}, nil, []string{"FRM-1", "--session", "s2", "--area", "cli", "--lane", "other"}, []string{"FRM-1", "no spec section"}},
		{"a start after a ↩️ line", dispatchState{body: signedBody(dispatchAbove, "🚀 dispatched 2026-11-24 — l, codie s1, main:abc1234\n↩️ taken back 2026-11-24, the lane moved\n", dispatchAbove) + "\n⸻ 🪪 stamp", state: "In Progress", delegate: "codie", labels: []string{"signed"}}, nil, []string{"FRM-1", "--session", "s1", "--area", "cli", "--lane", "l"}, []string{"FRM-1", "no spec section"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			frame, _ := frameAtBase(t)
			specWith(t, frame, c.spec)
			server := dispatchServer(t, c.state)

			envelope, got := runDispatchUnsealed(t, server, frame, c.args...)

			text := got.stdout + jsonOf(envelope["error"])
			if got.code != 1 {
				t.Fatalf("exit %d, want a refusal:\n%s", got.code, got.stdout)
			}
			for _, want := range c.want {
				if !strings.Contains(text, want) {
					t.Errorf("the refusal does not name %q:\n%s", want, text)
				}
			}
			if next := envelope["next"]; next != "x brief preflight FRM-1" {
				t.Errorf("next %q, want the preflight of the first ticket refused", next)
			}
			if n := len(mutations(server)); n != 0 {
				t.Errorf("%d mutations behind a refusal", n)
			}
		})
	}
}

func TestDispatchStartsASealedChunk(t *testing.T) {
	t.Parallel()
	rerunBody := signedBody(dispatchAbove, "🚀 dispatched 2026-11-24 — feat, codie s1, main:abc1234\n", dispatchAbove) + "\n⸻ 🪪 stamp"
	mainBody := "lane: main\n\n" + dispatchAbove
	for _, c := range []struct {
		name  string
		state dispatchState
		spec  map[string]string
		args  []string
		code  int
	}{
		{"a sealed ticket, dry", undispatched, map[string]string{"FRM-1": sealedSection(wishOf("FRM-1", dispatchAbove))}, append([]string{"FRM-1"}, sealLane...), 4},
		{"a sealed ticket, apply", undispatched, map[string]string{"FRM-1": sealedSection(wishOf("FRM-1", dispatchAbove))}, append([]string{"FRM-1", "--apply"}, sealLane...), 0},
		{"a re-run for the lane of its 🚀 line, no spec", dispatchState{body: rerunBody, state: "In Progress", delegate: "codie"}, nil, append([]string{"FRM-1"}, sealLane...), 4},
		{"a lane: main ticket, no spec", dispatchState{body: signedBody(mainBody, "", mainBody) + "\n⸻ 🪪 stamp", state: "Todo", labels: []string{"agent", "signed"}}, nil, append([]string{"FRM-1"}, sealLane...), 4},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			frame, _ := frameAtBase(t)
			specWith(t, frame, c.spec)
			server := dispatchServer(t, c.state)

			_, got := runDispatchUnsealed(t, server, frame, c.args...)

			if got.code != c.code {
				t.Fatalf("exit %d, want %d:\n%s", got.code, c.code, got.stdout)
			}
		})
	}
}

func TestDispatchPrintsAnotherFindingOfASealedChunkAsAWarning(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	// main already carries a commit for the ticket: a chunk may start on landed ground, so it is no warning
	gitT(t, frame, "commit", "-q", "--allow-empty", "-m", "🔧 x: a first step\n\nstep 1 of FRM-1: the half that landed")
	gitT(t, frame, "update-ref", "refs/remotes/origin/main", "HEAD")
	specWith(t, frame, map[string]string{"FRM-1": wishOf("FRM-1", dispatchAbove) + "\n\n### exit lines\n\n- given a thing, then it holds\n"})
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1"}, sealLane...)...)

	plan, _ := envelope["plan"].(map[string]any)
	warnings, _ := plan["warnings"].([]any)
	if got.code != 4 || len(warnings) == 0 || !strings.Contains(jsonOf(warnings), "FRM-1") || !strings.Contains(jsonOf(warnings), "has no number") {
		t.Fatalf("exit %d, want 4 with a warning for the unnumbered exit line:\n%s", got.code, got.stdout)
	}
	if strings.Contains(jsonOf(warnings), "already carries") {
		t.Errorf("a commit on main for the ticket is a warning:\n%s", jsonOf(warnings))
	}
}

func TestDispatchWarnsOfAChunkWhoseSpecSitsInTwoFiles(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	section := sealedSection(wishOf("FRM-1", dispatchAbove))
	specWith(t, frame, map[string]string{"FRM-1": section})
	write(t, filepath.Join(frame, ".scratch/old/spec.md"), "# old\n\n## FRM-1 — a stale copy\n\n"+section)
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1"}, sealLane...)...)

	if plan := jsonOf(envelope["plan"]); got.code != 4 || !strings.Contains(plan, "one spec binds a ticket") {
		t.Fatalf("exit %d, want 4 with the two-spec finding as a warning:\n%s", got.code, got.stdout)
	}
}

func TestDispatchSaysPlainlyWhenLinearIsUnreachable(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	server := newFakeLinear(t, func(gqlCall) string { return `{"errors":[{"message":"down"}]}` })

	_, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1"}, sealLane...)...)

	if got.code != 1 || !strings.Contains(got.stdout, "down") || len(mutations(server)) != 0 {
		t.Fatalf("exit %d, want linear's own words and no write:\n%s", got.code, got.stdout)
	}
}

// FRM-700 review: a bytes chunk's spec sits in bytes' .scratch, which frame's search never read
func TestDispatchFindsASpecInAnotherCheckoutUnderProjects(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, above string }{
		{"the ticket names no repo", dispatchAbove},
		{"a repo: bytes line", "lane: side\nrepo: bytes\n\n## 🎯 done test\n\ngiven a ticket, when it runs, then it holds\n\n"},
		{"a repo line a bullet and a clause hide", "lane: side\n\n* repo: bytes, after the engine chunk\n\n## 🎯 done test\n\ngiven a ticket, when it runs, then it holds\n\n"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			frame, _ := frameAtBase(t)
			home := t.TempDir()
			body := signedBody(c.above, "", c.above) + "\n⸻ 🪪 stamp — please keep 🙏"
			write(t, filepath.Join(home, "projects/bytes/.scratch/speak/spec.md"), "# speak\n\n## FRM-1 — the chunk\n\n"+sealedSection(wishOf("FRM-1", body)))
			server := dispatchServer(t, dispatchState{body: body, state: "Todo", labels: []string{"agent", "signed"}})

			envelope, got := runLinearUnsealed(t, server, []string{"HOME=" + home, "X_FRAME_ROOT=" + frame}, append([]string{"lane", "dispatch", "FRM-1"}, sealLane...)...)

			if plan := jsonOf(envelope["plan"]); got.code != 4 || !strings.Contains(plan, "lanes/speak/issues/") {
				t.Fatalf("exit %d, want 4 naming the bytes spec's feature as the slices dir:\n%s", got.code, got.stdout)
			}
		})
	}
}
