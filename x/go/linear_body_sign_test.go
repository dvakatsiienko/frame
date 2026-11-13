package main

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"
	"testing"
)

// linear's save as the fake rewrites it: a number per ordered item, and the escapes a save adds (`_` and `~`, never twice)
var (
	signedItem   = regexp.MustCompile(`(?m)^\d+\. `)
	savedEscapes = regexp.MustCompile("([^\\\\])([_~])")
)

// renumbered writes an ordered list as 1, 1+n, 1+2n …: n 1 is linear's renumbering, a larger n a save that moves every time
func renumbered(text string, n int) string {
	at := 0
	return signedItem.ReplaceAllStringFunc(text, func(string) string {
		at++
		return fmt.Sprintf("%d. ", 1+(at-1)*n)
	})
}

func cosmeticSave(text string, _ int) string {
	return savedEscapes.ReplaceAllString(renumbered(text, 1), `$1\$2`)
}

const (
	newTicket = "## why\n\n1. one\n1. two\n1. three\n\nan_id lasts ~50 min\n\n"
	noteLine  = "<!-- keep: a note -->\n"
)

// stamped is a body signed the way ticket-sign.ts signs it: the sign block closing it, over x's own hash of the text above
func stamped(above string) string {
	return above + "## signed\n\n✍️ signed 2026-11-13 · body " + bodySignHash(above) + "\n"
}

// rewritingServer holds one ticket; every write is stored as save(text, the write's number), like a linear that rewrites
func rewritingServer(t *testing.T, first string, save func(text string, writes int) string) (*fakeLinear, func() string) {
	return rewritingServerAt(t, first, save, func(writes int) int { return writes })
}

// rewritingServerAt answers a read with the updatedAt minute readAt gives for the writes so far: a peer's edit moves it past the write's own
func rewritingServerAt(t *testing.T, first string, save func(text string, writes int) string, readAt func(writes int) int) (*fakeLinear, func() string) {
	var current atomic.Value
	var writes atomic.Int32
	current.Store(first)
	server := newFakeLinear(t, func(call gqlCall) string {
		if strings.Contains(call.Query, "issueUpdate") {
			input, _ := call.Variables["input"].(map[string]any)
			current.Store(save(fmt.Sprint(input["description"]), int(writes.Add(1))))
			return fmt.Sprintf(`{"data":{"issueUpdate":{"success":true,"issue":{"updatedAt":"2026-11-13T10:%02d:00.000Z"}}}}`, writes.Load())
		}
		return fmt.Sprintf(`{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":%q,"updatedAt":"2026-11-13T10:%02d:00.000Z"}}}`, current.Load(), readAt(int(writes.Load())))
	})
	return server, func() string { return fmt.Sprint(current.Load()) }
}

// setSigned pulls FRM-1, writes the edit over the pulled file and sets it back; the file comes back with the envelope
func setSigned(t *testing.T, server *fakeLinear, edit string, flags ...string) (data map[string]any, got asRun, file string) {
	t.Helper()
	state, file := t.TempDir(), filepath.Join(t.TempDir(), "body.md")
	if _, pulled := runBody(t, server, state, "FRM-1", "--to", file); pulled.code != 0 {
		t.Fatalf("the pull: exit %d\n%s%s", pulled.code, pulled.stdout, pulled.stderr)
	}
	write(t, file, edit)
	envelope, got := runBody(t, server, state, append([]string{"FRM-1", "--set", file}, flags...)...)
	data, _ = envelope["data"].(map[string]any)
	return data, got, file
}

func signLineOf(body string) string {
	last := ""
	for line := range strings.Lines(body) {
		if signedBodyHash.MatchString(strings.TrimRight(line, "\n")) {
			last = line
		}
	}
	return last
}

// FRM-603 exit 1: a sign stamped before linear's save is re-stamped on the saved text, in one more write
func TestBodySetRestampsASignLinearsSaveBroke(t *testing.T) {
	t.Parallel()
	server, saved := rewritingServer(t, newTicket, cosmeticSave)
	sent := stamped(newTicket)

	data, got, file := setSigned(t, server, sent, "--restamp-sign")

	final := saved()
	if got.code != 0 || data["sign"] != signMatch || data["restamped"] != true || len(mutations(server)) != 2 {
		t.Fatalf("exit %d, %d writes, data %v, want match, restamped, two writes:\n%s", got.code, len(mutations(server)), data, got.stdout)
	}
	if state, stored, _ := bodySign(final); state != signMatch || stored != bodySignHash(final) || stored == bodySignHash(sent) {
		t.Errorf("the saved body reads %s with stamp %s, want match on the saved text's own hash:\n%s", state, stored, final)
	}
	if local := readFile(t, file); local != final {
		t.Errorf("the local file differs from the saved text:\n%s", local)
	}
}

// FRM-603 exit 2: a re-stamp covers only linear's cosmetic rewrite; an edit after the sign, or a line linear dropped, stays drifted
func TestBodySetRestampsNothingBeyondACosmeticRewrite(t *testing.T) {
	t.Parallel()
	dropsNote := func(text string, n int) string {
		return cosmeticSave(strings.ReplaceAll(text, noteLine, ""), n)
	}
	for _, c := range []struct {
		name, above, hash string
		save              func(string, int) string
		want              string
	}{
		{"a hash of neither text", newTicket, "00000000", cosmeticSave, "an edit after the sign"},
		{"a line linear dropped", newTicket + noteLine, "", dropsNote, "− " + strings.TrimSpace(noteLine)},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server, saved := rewritingServer(t, newTicket, c.save)
			sent := stamped(c.above)
			if c.hash != "" {
				sent = strings.Replace(sent, bodySignHash(c.above), c.hash, 1)
			}

			data, got, _ := setSigned(t, server, sent, "--restamp-sign")

			if got.code != 0 || data["sign"] != signDrifted || data["restamped"] != false || len(mutations(server)) != 1 || !strings.Contains(fmt.Sprint(data["reason"]), c.want) {
				t.Errorf("exit %d, %d writes, data %v, want drifted, nothing re-stamped, one write, a reason holding %q:\n%s", got.code, len(mutations(server)), data, c.want, got.stdout)
			}
			if signLineOf(saved()) != signLineOf(sent) {
				t.Errorf("the sign line moved: %q → %q", signLineOf(sent), signLineOf(saved()))
			}
		})
	}
}

// FRM-603 exit 3: with no flag no sign line changes, and the read-back says what linear's save did
func TestBodySetWithoutTheFlagReportsTheSignAndChangesNoSignLine(t *testing.T) {
	t.Parallel()
	keepsText := func(text string, _ int) string { return text }
	for _, c := range []struct {
		name  string
		save  func(string, int) string
		state string
	}{
		{"linear rewrites the text", cosmeticSave, signDrifted},
		{"linear keeps the text", keepsText, signMatch},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server, saved := rewritingServer(t, newTicket, c.save)
			sent := stamped(newTicket)

			data, got, _ := setSigned(t, server, sent)

			if got.code != 0 || data["sign"] != c.state || data["restamped"] != false || len(mutations(server)) != 1 || signLineOf(saved()) != signLineOf(sent) {
				t.Errorf("exit %d, %d writes, data %v, sign line %q, want %s, one write and the sign line as sent %q:\n%s", got.code, len(mutations(server)), data, signLineOf(saved()), c.state, signLineOf(sent), got.stdout)
			}
		})
	}
}

// FRM-603 exit 4: a linear that rewrites on every save gets two writes at most, and the drift is reported with its reason
func TestBodySetRestampsOnceWhenLinearRewritesEverySave(t *testing.T) {
	t.Parallel()
	server, _ := rewritingServer(t, newTicket, renumbered)

	data, got, _ := setSigned(t, server, stamped(newTicket), "--restamp-sign")

	if got.code != 0 || data["sign"] != signDrifted || len(mutations(server)) != 2 || !strings.Contains(fmt.Sprint(data["reason"]), "rewrote the text again") {
		t.Errorf("exit %d, %d writes, data %v, want drifted after two writes, the reason naming the second rewrite:\n%s", got.code, len(mutations(server)), data, got.stdout)
	}
}

// FRM-603 exit 5 replay: FRM-602's first sign — a body whose `~50 min` linear saved as `\~50 min` — reads match after one write, its sign line as sent
func TestBodySetReadsFRM602sFirstSignAsMatch(t *testing.T) {
	t.Parallel()
	above := "lane: quick\n\n## ⚖️ worth it\n\n* removes: a lane's 🛼 glide card opened by clio's memory alone; on 2026-11-13 both lanes ran ~50 min with no card until dima caught it\n* upkeep: one reader of the dispatch record in x-mod-stash, beside the glide store\n\n## 🎯 done test\n\n* given a second dispatch into the same lane, then the card keeps one copy and gains the new steps\n\n"
	sent := stamped(above)

	for _, flags := range [][]string{nil, {"--restamp-sign"}} {
		server, saved := rewritingServer(t, "lane: quick\n", cosmeticSave)

		data, got, _ := setSigned(t, server, sent, flags...)

		if got.code != 0 || data["sign"] != signMatch || data["restamped"] != false || signLineOf(saved()) != signLineOf(sent) || len(mutations(server)) != 1 {
			t.Errorf("%v: exit %d, %d writes, data %v, sign line %q, want match after one write with the sign line as sent:\n%s", flags, got.code, len(mutations(server)), data, signLineOf(saved()), got.stdout)
		}
	}
}

func TestBodyRestampSignBelongsToSet(t *testing.T) {
	t.Parallel()
	server, _ := rewritingServer(t, newTicket, cosmeticSave)

	_, got := runBody(t, server, t.TempDir(), "FRM-1", "--restamp-sign")

	if got.code != 2 || len(mutations(server)) != 0 {
		t.Errorf("exit %d, %d writes, want a usage refusal and no write:\n%s", got.code, len(mutations(server)), got.stdout)
	}
}

// a body whose hash matched neither text before the write says so, with or without the flag, never «use --restamp-sign»
func TestBodySetNamesAnEditAfterTheSignWithoutTheFlag(t *testing.T) {
	t.Parallel()
	server, _ := rewritingServer(t, newTicket, cosmeticSave)
	sent := strings.Replace(stamped(newTicket), bodySignHash(newTicket), "00000000", 1)

	data, got, _ := setSigned(t, server, sent)

	if got.code != 0 || data["sign"] != signDrifted || !strings.Contains(fmt.Sprint(data["reason"]), "an edit after the sign") || strings.Contains(fmt.Sprint(data["reason"]), "--restamp-sign re-stamps") {
		t.Errorf("exit %d, data %v, want drifted with the reason «an edit after the sign»:\n%s", got.code, data, got.stdout)
	}
}

// a ticket a peer changed between the first write and the re-stamp is never written over
func TestBodySetSkipsTheRestampWhenTheTicketMovedAfterTheFirstWrite(t *testing.T) {
	t.Parallel()
	server, _ := rewritingServerAt(t, newTicket, cosmeticSave, func(writes int) int { return writes + 30 })

	data, got, _ := setSigned(t, server, stamped(newTicket), "--restamp-sign")

	if got.code != 0 || data["sign"] != signDrifted || data["restamped"] != false || len(mutations(server)) != 1 || !strings.Contains(fmt.Sprint(data["reason"]), "changed since the first write") {
		t.Errorf("exit %d, %d writes, data %v, want drifted, one write, «changed since the first write»:\n%s", got.code, len(mutations(server)), data, got.stdout)
	}
}

// linear changing a list's first number is as cosmetic as renumbering the rest
func TestBodySetRestampsAListWhoseFirstNumberLinearChanged(t *testing.T) {
	t.Parallel()
	shiftsFirst := func(text string, _ int) string {
		return savedEscapes.ReplaceAllString(strings.Replace(renumbered(text, 1), "1. one", "3. one", 1), `$1\$2`)
	}
	server, saved := rewritingServer(t, newTicket, shiftsFirst)

	data, got, _ := setSigned(t, server, stamped(newTicket), "--restamp-sign")

	if got.code != 0 || data["sign"] != signMatch || data["restamped"] != true || bodySignHash(saved()) == bodySignHash(newTicket) {
		t.Errorf("exit %d, data %v, want a re-stamp on the saved text:\n%s\n%s", got.code, data, got.stdout, saved())
	}
}
