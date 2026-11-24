package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
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
		{"a first line that only starts with lane: main", dispatchState{body: signedBody("lane: mainstream\n\n"+dispatchAbove, "", "lane: mainstream\n\n"+dispatchAbove) + "\n⸻ 🪪 stamp", state: "Todo", labels: []string{"agent", "signed"}}, nil, append([]string{"FRM-1"}, sealLane...), []string{"FRM-1", "no spec section"}},
		{"a 🚀 inside a sentence is no start to repeat", dispatchState{body: signedBody(dispatchAbove, "see the note: 🚀 dispatched 2026-11-24 — feat, codie s1, main:abc1234\n", dispatchAbove) + "\n⸻ 🪪 stamp", state: "In Progress", delegate: "codie"}, nil, append([]string{"FRM-1"}, sealLane...), []string{"FRM-1", "no spec section"}},
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
			// a preflight reds on a moved text and prints ok for no section or no hash, so those name the command that prints the hash
			wantNext := "x linear sign-check FRM-1 --body-file <the ticket's text, above its ## signed>"
			if strings.Contains(strings.Join(c.want, " "), "moved since the seal") {
				wantNext = "x brief preflight FRM-1"
			}
			if next := envelope["next"]; next != wantNext {
				t.Errorf("next %q, want %q", next, wantNext)
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

	if plan := jsonOf(envelope["plan"]); got.code != 4 || !strings.Contains(plan, "2 spec sections") {
		t.Fatalf("exit %d, want 4 with the two sections as a warning:\n%s", got.code, got.stdout)
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

// FRM-700 review: a re-sign writes a newer section beside the old one; every section is read, the newest binds
func TestDispatchReadsEverySectionOfATicketAndTheNewestBinds(t *testing.T) {
	t.Parallel()
	good, stale := sealedSection(wishOf("FRM-1", dispatchAbove)), sealedSection("wish: FRM-1 · body 00000000")
	noHash := sealedSection("wish: FRM-1")
	for _, c := range []struct {
		name, older, newer string
		refused            string
	}{
		{"an older match and a newer other hash", good, stale, ""},
		{"a newer match and an older other hash", stale, good, ""},
		{"an older match never passes a newer section with no hash", good, noHash, "no seal hash"},
		{"no section matches", stale, sealedSection("wish: FRM-1 · body 11111111"), "moved since the seal"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			frame, _ := frameAtBase(t)
			for i, section := range []string{c.older, c.newer} {
				path := filepath.Join(frame, ".scratch", []string{"older", "newer"}[i], "spec.md")
				write(t, path, "# spec\n\n## FRM-1 — the chunk\n\n"+section)
				when := time.Now().Add(time.Duration(i-2) * time.Hour)
				if err := os.Chtimes(path, when, when); err != nil {
					t.Fatal(err)
				}
			}
			server := dispatchServer(t, undispatched)

			envelope, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1"}, sealLane...)...)

			text := got.stdout + jsonOf(envelope["error"])
			if c.refused == "" {
				plan := jsonOf(envelope["plan"])
				if got.code != 4 || !strings.Contains(plan, "2 spec sections") {
					t.Fatalf("exit %d, want 4 with the two sections as a warning:\n%s", got.code, got.stdout)
				}
				return
			}
			if got.code != 1 || !strings.Contains(text, c.refused) {
				t.Fatalf("exit %d, want a refusal naming %q:\n%s", got.code, c.refused, got.stdout)
			}
		})
	}
}

func TestDispatchReadsASectionHeadingRepeatedInOneSpec(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	write(t, filepath.Join(frame, ".scratch/feat/spec.md"), "# spec\n\n## FRM-1 — the chunk\n\n"+sealedSection(wishOf("FRM-1", dispatchAbove))+"\n## FRM-1 — the chunk again\n\n"+sealedSection("wish: FRM-1"))
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1"}, sealLane...)...)

	if text := got.stdout + jsonOf(envelope["error"]); got.code != 1 || !strings.Contains(text, "no seal hash") {
		t.Fatalf("exit %d, want the later section's missing hash refused:\n%s", got.code, got.stdout)
	}
}

// FRM-700 review: the seal is read before the lane-mismatch refusal, and a repo lookup that fails is a warning
func TestDispatchRefusesAnUnsealedChunkBeforeTheOneLaneCheck(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	write(t, filepath.Join(frame, ".scratch/feat-a/spec.md"), "# feat a\n\n## FRM-1 — one\n\n"+sealedSection("wish: FRM-1"))
	write(t, filepath.Join(frame, ".scratch/feat-b/spec.md"), "# feat b\n\n## FRM-2 — two\n\n"+sealedSection("wish: FRM-2"))
	server := dispatchServer(t, undispatched)

	envelope, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1", "FRM-2"}, sealLane...)...)

	if text := got.stdout + jsonOf(envelope["error"]); got.code != 1 || !strings.Contains(text, "no seal hash") || strings.Contains(text, "one dispatch is one lane") {
		t.Fatalf("exit %d, want the seal refusal first:\n%s", got.code, got.stdout)
	}
}

func TestDispatchWarnsWhenTheTicketsRepoHasNoCheckout(t *testing.T) {
	t.Parallel()
	frame, _ := frameAtBase(t)
	above := "lane: side\nrepo: nowhere-here\n\n## 🎯 done test\n\ngiven a ticket, when it runs, then it holds\n\n"
	body := signedBody(above, "", above) + "\n⸻ 🪪 stamp — please keep 🙏"
	specWith(t, frame, map[string]string{"FRM-1": sealedSection(wishOf("FRM-1", body))})
	server := dispatchServer(t, dispatchState{body: body, state: "Todo", labels: []string{"agent", "signed"}})

	envelope, got := runDispatchUnsealed(t, server, frame, append([]string{"FRM-1"}, sealLane...)...)

	if plan := jsonOf(envelope["plan"]); got.code != 4 || !strings.Contains(plan, "nowhere-here") || !strings.Contains(plan, "warnings") {
		t.Fatalf("exit %d, want 4 with the missing checkout as a warning:\n%s", got.code, got.stdout)
	}
}
