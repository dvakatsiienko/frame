package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"
)

const signCheckBody = "## why\n\nthe want\n\n## signed\n\n✍️ signed 2026-11-10 · body 3d67a5b5\n"

func signServer(t *testing.T, current string) *fakeLinear {
	desc, _ := json.Marshal(current)
	return newFakeLinear(t, func(call gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-1","identifier":"FRM-1","description":` + string(desc) + `,"updatedAt":"2026-11-11T10:00:00.000Z"}}}`
	})
}

// x-mod-guard's body-set judge: its own sign-line and grant copies go, so each of their rows lives here
func TestLinearSignCheckRefusesABodyAddingDimasWord(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, current, file, want string
		reads                     int
	}{
		{name: "no sign line and no grant reads nothing", current: signCheckBody, file: "## why\n\nthe want, edited\n"},
		{name: "the same sign lines pass", current: signCheckBody, file: strings.Replace(signCheckBody, "the want", "the want, edited", 1), reads: 1},
		{name: "a new sign line", current: signCheckBody, file: signCheckBody + "✍️ re-signed 2026-11-11 · body 429c0cdb\n", want: "a sign line the ticket's body lacks", reads: 1},
		{name: "an old sign line redated", current: signCheckBody, file: strings.Replace(signCheckBody, "2026-11-10", "2026-11-09", 1), want: "a sign line the ticket's body lacks", reads: 1},
		{name: "a pre-approval added", current: signCheckBody, file: signCheckBody + "merge: pre-approved\n", want: "a merge grant", reads: 1},
		{name: "a cancel deleted", current: signCheckBody + "merge: pre-approved\n🚫 cancelled 2026-11-11\n", file: signCheckBody + "merge: pre-approved\n", want: "a merge grant", reads: 1},
		{name: "a grant moved to another sign", current: "## why\n\n✍️ re-signed 2026-11-11 · body aaaaaaaa\n\n" + signCheckBody + "merge: pre-approved\n", file: "## why\n\n" + signCheckBody + "✍️ re-signed 2026-11-11 · body aaaaaaaa\nmerge: pre-approved\n", want: "a merge grant", reads: 1},
		{name: "a grant with no sign line", current: "## why\n\nthe want\n", file: "## why\n\nthe want\n\n## signed\n\nmerge: pre-approved\n", want: "a merge grant", reads: 1},
		{name: "a grant kept as it was", current: signCheckBody + "merge: pre-approved\n", file: signCheckBody + "merge: pre-approved\n", reads: 1},
		{name: "a pre-approval added under a re-sign that follows a cancel", current: signCheckBody + "🚫 cancelled 2026-11-11\n✍️ re-signed 2026-11-11 · body bbbbbbbb\n", file: signCheckBody + "🚫 cancelled 2026-11-11\n✍️ re-signed 2026-11-11 · body bbbbbbbb\nmerge: pre-approved\n", want: "a merge grant", reads: 1},
		{name: "a re-sign pending line deleted", current: signCheckBody + "merge: pre-approved\n✍️ re-sign pending — scope moved\n", file: signCheckBody + "merge: pre-approved\n", want: "a merge grant", reads: 1},
		{name: "the sign line deleted under a pre-approval, a tiny line kept", current: signCheckBody + "merge: pre-approved\n", file: "## why\n\nthe want\n\n## signed\n\nmerge: pre-approved\n✏️ changed 1970-01-01 — tiny\n", want: "a merge grant", reads: 1},
		{name: "a cancel line added under a grant", current: signCheckBody + "merge: pre-approved\n", file: signCheckBody + "merge: pre-approved\n🚫 cancelled 2026-11-11\n", reads: 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			server := signServer(t, c.current)
			file := filepath.Join(t.TempDir(), "body.md")
			write(t, file, c.file)

			_, got := runLinear(t, server, nil, "linear", "sign-check", "FRM-1", "--body-file", file)

			if reads := len(server.requests()); reads != c.reads {
				t.Errorf("%d reads of linear, want %d", reads, c.reads)
			}
			if c.want == "" {
				if got.code != 0 {
					t.Fatalf("exit %d, want 0:\n%s", got.code, got.stdout)
				}
				return
			}
			if got.code != 1 || !strings.Contains(got.stdout, c.want) {
				t.Fatalf("exit %d, want 1 naming %q:\n%s", got.code, c.want, got.stdout)
			}
		})
	}
}

func TestLinearSignCheckCountsAnUnreadBodyAsNew(t *testing.T) {
	t.Parallel()
	server := newFakeLinear(t, func(gqlCall) string { return `{"errors":[{"message":"down"}]}` })
	file := filepath.Join(t.TempDir(), "body.md")
	write(t, file, signCheckBody)

	_, got := runLinear(t, server, nil, "linear", "sign-check", "FRM-1", "--body-file", file)

	if got.code != 1 || !strings.Contains(got.stdout, "did not read") {
		t.Fatalf("exit %d, want 1 naming the unread body:\n%s", got.code, got.stdout)
	}
}

func TestLinearSignCheckWantsABodyFile(t *testing.T) {
	t.Parallel()
	for _, argv := range [][]string{{"FRM-1"}, {"FRM-1", "--body-file", "/no/such/file"}, {"nope", "--body-file", "/dev/null"}} {
		_, got := runLinear(t, signServer(t, signCheckBody), nil, append([]string{"linear", "sign-check"}, argv...)...)
		if got.code != 2 {
			t.Errorf("%v: exit %d, want 2:\n%s", argv, got.code, got.stdout)
		}
	}
}

func signCheckHash(t *testing.T, text string) string {
	t.Helper()
	file := filepath.Join(t.TempDir(), "body.md")
	write(t, file, text)
	envelope, got := runLinear(t, signServer(t, signCheckBody), nil, "linear", "sign-check", "FRM-1", "--body-file", file)
	if got.code != 0 {
		t.Fatalf("exit %d, want 0:\n%s", got.code, got.stdout)
	}
	hash, _ := envelope["data"].(map[string]any)["hash"].(string)
	return hash
}

func TestLinearSignCheckPrintsTheHashXsSignReaderCompares(t *testing.T) {
	t.Parallel()
	local := "lane: side\n\ncost ~5, see FRM-12\n\n"
	stored := "lane: side\n\ncost \\~5, see [FRM-12](https://linear.app/x-com/issue/FRM-12)\n\n"
	hash := signCheckHash(t, local)
	if hash == "" {
		t.Fatal("sign-check printed no data.hash")
	}
	body := stored + "## signed\n\n✍️ signed 2026-11-13 · body " + hash + "\n"
	row := signedListRow(t, body)
	if row["sign"] != signMatch {
		t.Errorf("sign %v, want %q for a hash x printed", row["sign"], signMatch)
	}
}

func TestLinearSignCheckPrintsTheHashWithNoSignLineToo(t *testing.T) {
	t.Parallel()
	text := "lane: side\n\nthe want\n"
	if got, want := signCheckHash(t, text), signCheckHash(t, text+"\n\n"); got == "" || got != want {
		t.Errorf("hash %q, want a non-empty one equal to %q for the same text with a longer end", got, want)
	}
	if signCheckHash(t, text) != signCheckHash(t, text+"## signed\n\na note\n") {
		t.Error("a hash covers the text above the closing ## signed heading only")
	}
}
