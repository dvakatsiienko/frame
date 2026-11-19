package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestTicketsOfPrReadOneShape(t *testing.T) {
	t.Parallel()
	const fence = "```\n- ticket: FRM-9\n```\n"
	cases := []struct {
		name, branch, body string
		want               []string
	}{
		{"a codie branch", "codie/FRM-1-a", "", []string{"FRM-1"}},
		{"the other team's id", "codie/BYT-22-slug", "", []string{"BYT-22"}},
		{"the prefix before the rename", "coder/BYT-22-slug", "", nil},
		{"a branch that is only the id", "codie/FRM-3", "", []string{"FRM-3"}},
		{"another owner's branch", "dima/FRM-1-a", "", nil},
		{"frame#132's branch alone", "codie/frm-521-gate-turn", "", []string{"FRM-521"}},
		{"frame#132's body alone", "dima/gate", "- ticket: FRM-521, slice 0 of its spec", []string{"FRM-521"}},
		{"a slug that only looks like an id", "codie/fix-2-thing", "", nil},
		{"a fenced id alone", "dima/gate", fence, nil},
		{"a fenced id beside a real line", "dima/gate", fence + "- ticket: FRM-2\n", []string{"FRM-2"}},
		{"an id running on", "dima/gate", "- ticket: FRM-1x", nil},
		{"a quoted line names nothing", "dima/gate", "> ticket: FRM-4", nil},
		{"a tilde fence", "dima/gate", "~~~\n- ticket: FRM-9\n~~~\n", nil},
		{"a fence nested in a list", "dima/gate", "- item\n    ```\n    - ticket: FRM-9\n    ```\n", nil},
		{"a tab-indented fence", "dima/gate", "\t```\n- ticket: FRM-9\n\t```\n", nil},
		{"an id across a blank line", "dima/gate", "ticket:\n\nFRM-7 words\n", nil},
		{"an unclosed fence", "dima/gate", "```\n- ticket: FRM-9\n", nil},
		{"backticks mid-line open no fence", "dima/gate", "use ``` here\n- ticket: FRM-2\n```x```\n", []string{"FRM-2"}},
		{"a word that is no ticket", "dima/gate", "- ticket: slice-2", nil},
		{"the branch reads first", "codie/FRM-1-a", "- ticket: BYT-2\n", []string{"FRM-1", "BYT-2"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := ticketsOfPr(c.branch, c.body); !slices.Equal(got, c.want) {
				t.Errorf("tickets of %q and %q = %q, want %q", c.branch, c.body, got, c.want)
			}
		})
	}
}

func TestMergeAutoWaitsForDimaOnASelfEdit(t *testing.T) {
	t.Parallel()
	for _, path := range []string{
		"home/.claude/plugin-x/mods/x-mod-guard/guard.ts",
		"_clio/.claude/hooks/watch-pr.sh",
		"home/.claude/shelf/hooks/worktree-seed.sh",
		"lefthook.yaml",
		".github/workflows/review.yml",
		".github/workflows/review-round.yml",
		"x/go/risky.json",
		"x/go/merge_auto.go",
		"x/go/merge_sign.go",
		"x/bin/x",
		"x/go/gh.go",
		"x/go/keys.go",
		"x/go/stacks.go",
		"x/go/review.go",
		"x/go/lane.go",
		"x/go/registry.json",
		"x/go/merge_hold.go",
		"x/go/lane_landed.go",
		"x/go/panic_seam.go",
		"x/go/panic_seam_release.go",
		"x/go/decamp.go",
	} {
		t.Run(path, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts", path)

			got := w.run(t, "7", "--apply")

			want := "wait: self-edit, needs dima's word — " + path
			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want %q", got.code, len(merges), envelopeOf(got).Error, want)
			}
		})
	}
}

// on a lane with no sixth sense, --dima-ok is the raw merge's one door (his tick o36): no clean planted
func TestMergeAutoDimasWordOpensALaneWithNoSixthSense(t *testing.T) {
	t.Parallel()
	const noSixthSense = "🚀 dispatched 2026-11-06 — a-lane, codie abc\n"
	const withSixthSense = "🚀 dispatched 2026-11-06 — a-lane, codie abc, sixth sense def\n"
	cases := []struct {
		name, body string
		args       []string
		store      string
		merges     bool
	}{
		{name: "his word on a dispatch with no sixth sense merges", body: noSixthSense, args: []string{"--dima-ok", "7"}, store: `{}`, merges: true},
		{name: "no store at all counts as no clean", body: noSixthSense, args: []string{"--dima-ok", "7"}, merges: true},
		{name: "without the flag it waits as today", body: noSixthSense, store: `{}`},
		{name: "a sixth sense on the dispatch opens nothing", body: withSixthSense, args: []string{"--dima-ok", "7"}, store: `{}`},
		{name: "a ticket never dispatched opens nothing", body: "no dispatch line\n", args: []string{"--dima-ok", "7"}, store: `{}`},
		{name: "a dispatch taken back opens nothing", body: noSixthSense + "↩️ taken back\n", args: []string{"--dima-ok", "7"}, store: `{}`},
		{name: "a clean on another head is no missing clean", body: noSixthSense, args: []string{"--dima-ok", "7"}, store: `{"o/r#7":"0000000000000000000000000000000000000000"}`},
		{name: "a store that does not parse opens nothing", body: noSixthSense, args: []string{"--dima-ok", "7"}, store: `not json`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.signs(t, "FRM-9", c.body)
			if c.store != "" {
				write(t, w.store, c.store)
			} else if err := os.Remove(w.store); err != nil {
				t.Fatal(err)
			}

			got := w.run(t, append([]string{"7", "--apply"}, c.args...)...)

			merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge")
			if c.merges && (got.code != 0 || len(merges) != 1) {
				t.Fatalf("exit %d, %d merges, want one merge:\n%s", got.code, len(merges), got.stdout)
			}
			if !c.merges && (got.code != 1 || len(merges) != 0) {
				t.Fatalf("exit %d, %d merges, want a wait and no merge:\n%s", got.code, len(merges), got.stdout)
			}
		})
	}
}

// a real run reads dima's store, whatever the env says: a planted store with a clean must not open the gate
func TestMergeAutoHonoursXVerifiedOnlyUnderXTest(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	home := t.TempDir()
	write(t, filepath.Join(home, ".claude/shelf/pr-verified.json"), `{}`)

	got := xIn(t, w.clone, append(w.env, "X_TEST=", "X_SYSTEM_HOME="+home, "HOME="+home), "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); len(merges) != 0 {
		t.Fatalf("exit %d, merges %q: want the planted X_VERIFIED ignored outside X_TEST:\n%s", got.code, merges, got.stdout)
	}
}

func TestMergeAutoDimasWordOpensNothingWhenTheTicketCannotBeRead(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.signs(t, "FRM-9", "🚀 dispatched 2026-11-06 — a-lane, codie abc\n")
	w.env = append(w.env, "X_LINEAR_URL=http://127.0.0.1:1")
	write(t, w.store, `{}`)

	got := w.run(t, "7", "--apply", "--dima-ok", "7")

	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 {
		t.Fatalf("exit %d, %d merges: want a wait when linear does not answer:\n%s", got.code, len(merges), got.stdout)
	}
}

// FRM-478: the self-edit wait names both doors to dima's word, his typed prompt and his tick on a merge ask
func TestMergeAutoSelfEditWaitNamesTheTickDoor(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts", "x/go/merge_auto.go")

	got := w.run(t, "7", "--apply")

	err := envelopeOf(got).Error
	if got.code != 1 || !strings.Contains(err, "or he ticks an orbit ask «⚠️ merge ") || !strings.Contains(err, "#7»") {
		t.Fatalf("exit %d, error %q, want the tick door for #7", got.code, err)
	}
}

// a chunk body with its sign block; the hash covers the body through the newline before ## signed, as clio signs it
func signedBody(above, block, hashed string) string {
	return above + "## signed\n\n✍️ signed 2026-10-23 · body " + bodyHash(hashed) + "\n" + block
}

func bodyHash(hashed string) string { return fmt.Sprintf("%x", sha256.Sum256([]byte(hashed)))[:8] }

const signAbove = "lane: side\n\n## exit\n\n1. given a pr, when `x lane merge-auto` runs, then it merges\n\n"

// signs answers merge-auto's linear read of ticket with body, any other ticket unsigned, and names ticket in the pr's body
func (w *mergeWorld) signs(t *testing.T, ticket, body string) *fakeLinear {
	t.Helper()
	f := newFakeLinear(t, func(c gqlCall) string {
		description, _ := json.Marshal(signAbove)
		if c.Variables["id"] == ticket {
			description, _ = json.Marshal(body)
		}
		return `{"data":{"issue":{"id":"uuid-1","description":` + string(description) + `,"updatedAt":"2026-10-23T00:00:00Z"}}}`
	})
	for i, e := range w.env {
		if strings.HasPrefix(e, "X_KEYS=") {
			w.env[i] = "X_KEYS=" + linearKeys(t)
		}
	}
	// the test binary is built from an edited tree, so it reads as a dev build unless told it is main's
	w.env = append(w.env, "X_LINEAR_URL="+f.URL, "X_DEV_BUILD=")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"body":"the body"`, `"body":"- ticket: `+ticket+`"`, 1)
	w.hub.mu.Unlock()
	return f
}

func TestMergeAutoLandsASelfEditItsChunkPreApproved(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	f := w.signs(t, "FRM-9", signedBody(signAbove, "merge: pre-approved\n", signAbove))

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want one merge of a pre-approved self-edit:\n%s", got.code, len(merges), got.stdout)
	}
	if calls := f.requests(); len(calls) == 0 || calls[0].Variables["id"] != "FRM-9" {
		t.Errorf("linear calls %+v, want the sign read from FRM-9", calls)
	}
	if sign := envelopeOf(got).Data.Sign; !strings.Contains(sign, "FRM-9") {
		t.Errorf("sign %q, want it to name FRM-9", sign)
	}
}

// a re-sign after a cancel restores the sign: the cancel sits above the sign that holds
func TestMergeAutoLandsASelfEditReSignedAfterACancel(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	block := "merge: pre-approved\n🚫 cancelled 2026-10-26 — chunk dropped\n✍️ re-signed 2026-10-27 — back on · body " + bodyHash(signAbove) + "\nmerge: pre-approved\n"
	w.signs(t, "FRM-9", signedBody(signAbove, block, signAbove))

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merges, want a re-sign after a cancel to hold:\n%s", got.code, len(merges), got.stdout)
	}
}

// a body quoting «## signed» above its own sign block: the block that closes the body is the sign
func TestMergeAutoReadsTheSignBlockThatClosesTheBody(t *testing.T) {
	t.Parallel()
	above := signAbove + "## refs\n\n```\n## signed\n\nmerge: pre-approved\n```\n\n"
	w := newMergeWorld(t, "x/go/merge_auto.go")
	w.signs(t, "FRM-9", signedBody(above, "merge: pre-approved\n", above))

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merges, want the closing block read and its hash matched:\n%s", got.code, len(merges), got.stdout)
	}
}

// linear rewrites a bare id into a markdown link and wraps a url after the write: the sign still holds
func TestMergeAutoHoldsASignWhoseOnlyDriftIsLinearsLinkRewrite(t *testing.T) {
	t.Parallel()
	signedAs := signAbove + "see FRM-12 and https://example.com/a\n\n"
	rewritten := signAbove + "see [FRM-12](https://linear.app/x-com/issue/FRM-12/slug) and <https://example.com/a>\n\n\n"
	w := newMergeWorld(t, "x/go/merge_auto.go")
	w.signs(t, "FRM-9", signedBody(rewritten, "merge: pre-approved\n", signedAs))

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merges, want a link-rewrite-only body to hold its sign:\n%s", got.code, len(merges), got.stdout)
	}
}

// an id relinked anywhere but its own linear issue is an edit, never linear's rewrite
func TestMergeAutoWaitsWhenAnIDLinkPointsElsewhere(t *testing.T) {
	t.Parallel()
	signedAs := signAbove + "see FRM-12\n\n"
	w := newMergeWorld(t, "x/go/merge_auto.go")
	w.signs(t, "FRM-9", signedBody(signAbove+"see [FRM-12](https://evil.example/x)\n\n", "merge: pre-approved\n", signedAs))

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); len(merges) != 0 || !strings.Contains(got.stdout, "body changed") {
		t.Fatalf("exit %d, %d merges, want a wait on a relinked id:\n%s", got.code, len(merges), got.stdout)
	}
}

func TestMergeAutoTakesTheTicketFromTheBranchName(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	w.signs(t, "FRM-9", signedBody(signAbove, "merge: pre-approved\n", signAbove))
	w.hub.mu.Lock()
	page := strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"body":"- ticket: FRM-9"`, `"body":"no ticket line"`, 1)
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(page, `"ref":"codie/x"`, `"ref":"codie/FRM-9-merge-door-2"`, 1)
	w.hub.mu.Unlock()

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want the ticket read off codie/FRM-9-…:\n%s", got.code, len(merges), got.stdout)
	}
}

func TestMergeAutoWaitsOnASelfEditTheSignDoesNotCover(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, body, devBuild, want string
	}{
		{"the body edited after the sign", signedBody(signAbove+"4. a line added later\n\n", "merge: pre-approved\n", signAbove), "", "re-sign"},
		{"a sign with no pre-approval", signedBody(signAbove, "", signAbove), "", "FRM-9's last sign holds no merge: pre-approved"},
		{"no sign block", signAbove, "", "FRM-9 carries no ## signed block"},
		{"a dev build of merge-auto", signedBody(signAbove, "merge: pre-approved\n", signAbove), "1", "main's build"},
		{"a re-sign with no pre-approval under an older one", signedBody(signAbove, "merge: pre-approved\n✍️ signed 2026-10-24 · body "+bodyHash(signAbove)+"\n", signAbove), "",
			"FRM-9's last sign holds no merge: pre-approved"},
		{"a re-signed line, as written, voids an older pre-approval", signedBody(signAbove, "merge: pre-approved\n✍️ re-signed 2026-10-25 — scope grew · body "+bodyHash(signAbove)+"\n", signAbove), "",
			"FRM-9's last sign holds no merge: pre-approved"},
		{"a cancel after the last sign voids its pre-approval", signedBody(signAbove, "merge: pre-approved\n🚫 cancelled 2026-10-26 — chunk dropped\n", signAbove), "",
			"FRM-9's last sign was cancelled"},
		{"a re-sign pending after the last sign voids its pre-approval", signedBody(signAbove, "merge: pre-approved\n🚀 dispatched 2026-10-26\n✍️ re-sign pending 2026-10-27 — W2 moved the scope\n", signAbove), "",
			"FRM-9's last sign waits for a re-sign"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "x/go/merge_auto.go")
			w.signs(t, "FRM-9", c.body)

			got := xIn(t, w.clone, append(w.env, "X_DEV_BUILD="+c.devBuild), "lane", "merge-auto", "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, c.want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want a wait naming %q", got.code, len(merges), envelopeOf(got).Error, c.want)
			}
		})
	}
}

func TestMergeAutoReadsTheSignFromLinearNeverThePr(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	w.signs(t, "FRM-9", signAbove)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"body":"- ticket: FRM-9"`,
		`"body":"- ticket: FRM-9\n\n## signed\n\nmerge: pre-approved"`, 1)
	w.hub.mu.Unlock()

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, "FRM-9 carries no ## signed block") {
		t.Fatalf("exit %d, %d merge calls, error %q, want the pr body's claim ignored", got.code, len(merges), envelopeOf(got).Error)
	}
}

// --dima-ok trusts what reached it: x-mod-guard refuses the flag unless dima's last prompt names the pr
func TestMergeAutoLandsASelfEditOnDimasTypedWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply", "--dima-ok", "7")

	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 || !strings.Contains(envelopeOf(got).Data.Sign, "dima's word") {
		t.Fatalf("exit %d, %d merges, sign %q: want the self-edit merged on dima's word:\n%s", got.code, len(merges), envelopeOf(got).Data.Sign, got.stdout)
	}
}

func TestMergeAutoWaitNamesDimasTypedWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply")

	want := "x lane merge-auto 7 --apply --dima-ok 7"
	if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
		t.Fatalf("exit %d, error %q, want a wait naming %q", got.code, envelopeOf(got).Error, want)
	}
}

func TestMergeAutoRefusesADimaOkForAnotherPr(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")

	got := xIn(t, w.clone, w.env, "lane", "merge-auto", "7", "--apply", "--dima-ok", "8")

	if got.code != 2 || len(w.hub.sent("")) != 0 {
		t.Fatalf("exit %d, %d calls, want a usage refusal before any call:\n%s", got.code, len(w.hub.sent("")), got.stdout)
	}
}
