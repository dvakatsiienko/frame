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
