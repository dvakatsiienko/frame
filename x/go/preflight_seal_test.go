package main

import (
	"strings"
	"testing"
)

const (
	sealStamp  = "⸻ 🪪 stamp — please keep 🙏\n\n"
	sealHeader = "lane: quick\n\n## want\n\na thing\n\n"
)

// FRM-700: the dispatch's own lines are no scope, so the hash leaves them out; every other line counts
func TestBodySignHashLeavesTheDispatchMarksOut(t *testing.T) {
	t.Parallel()
	plain := sealHeader + sealStamp + "## signed\n\n✍️ signed · body x\n"
	for _, c := range []struct {
		name, marks string
		same        bool
	}{
		{"a 🚀 line above the stamp", "🚀 dispatched 2026-11-24 — l, codie s, main:abc1234\n\n", true},
		{"a ↩️ line", "↩️ taken back 2026-11-24, the lane moved\n\n", true},
		{"both", "🚀 dispatched 2026-11-23 — l, codie s\n\n↩️ taken back\n\n🚀 dispatched 2026-11-24 — l2, codie s2\n\n", true},
		{"a 🚀 inside a sentence", "the 🚀 dispatched line is clio's\n\n", false},
		{"another line that opens with a rocket", "🚀 launched with the lane\n\n", false},
		{"a ↩️ inside a bullet", "- ↩️ the old way\n\n", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			with := sealHeader + c.marks + sealStamp + "## signed\n\n✍️ signed · body x\n"

			if same := bodySignHash(with) == bodySignHash(plain); same != c.same {
				t.Errorf("hash of %q equals the plain one: %v, want %v", c.marks, same, c.same)
			}
		})
	}
	// a mark mid-line is text: taking it out would leave «note: » in its place, which this hash must tell from the text with the mark
	midline := sealHeader + "note: 🚀 dispatched by hand\n\n" + sealStamp + "## signed\n\n✍️ signed · body x\n"
	if bodySignHash(midline) == bodySignHash(sealHeader+"note: "+sealStamp+"## signed\n\n✍️ signed · body x\n") {
		t.Error("a 🚀 mid-line was taken out of the hash")
	}
	if got, want := bodySignHash(plain), bodyHash(sealHeader+sealStamp); got != want {
		t.Errorf("the plain hash is %s, want the normalized text's %s", got, want)
	}
}

// the sign reader passes a stored hash of the raw, the normalized, the legacy or the stripped text
func TestBodySignReadsAHashOfTheStrippedTextAsAMatch(t *testing.T) {
	t.Parallel()
	mark := "🚀 dispatched 2026-11-24 — l, codie s\n\n"
	// the stamp is followed by two blank lines, so a text's raw and normalized hashes differ
	above := sealHeader + mark + sealStamp + "\n"
	stripped := sealHeader + sealStamp + "\n"
	for name, stored := range map[string]string{
		"the raw text":                  bodyHash(above),
		"the normalized text":           bodyHash(strings.TrimRight(above, "\n") + "\n\n"),
		"the stripped text, raw":        bodyHash(stripped),
		"the stripped text, normalized": bodyHash(strings.TrimRight(stripped, "\n") + "\n\n"),
	} {
		body := above + "## signed\n\n✍️ signed · body " + stored + "\n"

		if state, _, _ := bodySign(body); state != signMatch {
			t.Errorf("a hash of %s reads %s, want %s", name, state, signMatch)
		}
	}
}

// a quick ticket sealed, dispatched, then signed again: the stamp the re-sign writes is the hash the old seal holds
func TestAQuickTicketReSignedAfterItsDispatchLineKeepsItsSeal(t *testing.T) {
	t.Parallel()
	sealed := bodyHash(sealHeader + sealStamp)
	dispatched := sealHeader + "🚀 dispatched 2026-11-24 — l, codie s, main:abc1234\n\n" + sealStamp + "## signed\n\n✍️ re-signed 2026-11-24 · body 00000000\n"

	stamped := withSignHash(dispatched, bodySignHash(dispatched))

	if state, stored, _ := bodySign(stamped); state != signMatch || stored != sealed {
		t.Errorf("the re-signed body reads %s with %s, want a match on the seal's %s", state, stored, sealed)
	}
	if line, recorded, now := sealDrift("wish: FRM-1 · body "+sealed+"\n", stamped); recorded != "" {
		t.Errorf("seal drift at line %d: %s against %s, want none", line, recorded, now)
	}
}
