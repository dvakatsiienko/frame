//go:build !nostacks

package main

import (
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestOverrideOpensALowerLayersChecksNeverItsHold(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		held   bool
		merges int
	}{
		{name: "a lower layer with no clean and a failed thread read lands", merges: 1},
		{name: "a held lower layer stops it", held: true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := linkedMergeWorld(t)
			store := filepath.Join(t.TempDir(), "operator-override.json")
			write(t, store, prsOn())
			w.env = append(w.env, "X_OVERRIDE_STORE="+store)
			write(t, w.store, `{}`)
			w.hub.pages["graphql"] = `{"errors":[{"message":"Something went wrong"}]}`
			if c.held {
				write(t, holdRecordOf(w), `{"prs":["7"]}`)
			}

			got := w.run(t, "8", "--apply")

			if asyncs := w.hub.sent("PUT " + repoPath + "/pulls/8/merge-async"); len(asyncs) != c.merges {
				t.Fatalf("exit %d, %d async merges, want %d\n%s", got.code, len(asyncs), c.merges, got.stdout)
			}
			if !c.held && envelopeOf(got).Data.Override == nil {
				t.Errorf("the output names no override:\n%s", got.stdout)
			}
		})
	}
}

func TestMergeAutoHoldsAStackOnALowerLayersGate(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, reason string
		fail         func(w *mergeWorld)
	}{
		{"no clean record", "sixth-sense", func(w *mergeWorld) { write(t, w.store, `{"o/r#8":"`+w.head+`"}`) }},
		{"a self-edit waiting for dima", "self-edit", func(w *mergeWorld) {
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":"x/go/merge_auto.go","status":"modified"}]`
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := linkedMergeWorld(t)
			c.fail(w)

			got := w.run(t, "8", "--apply")

			if got.code == 0 || !strings.Contains(got.stdout, "#7") || !strings.Contains(got.stdout, c.reason) || len(w.hub.sent("PUT")) != 0 {
				t.Fatalf("exit %d, puts %q: want no merge and a wait naming #7 and %q\n%s", got.code, w.hub.sent("PUT"), c.reason, got.stdout)
			}
		})
	}
}

func TestMergeAutoReadsEachLayersOwnRound(t *testing.T) {
	t.Parallel()
	upper := `{"id":2,"head_branch":"codie/x-2","head_sha":"%s","status":"completed","conclusion":"success"}`
	lower := `{"id":1,"head_branch":"codie/x","head_sha":"%s","status":"completed","conclusion":"success"}`
	cases := []struct {
		name string
		runs []string
		code int
	}{
		{"both layers hold a round", []string{upper, lower}, 4},
		{"the lower layer holds none", []string{upper}, 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := linkedMergeWorld(t)
			w.env = append(w.env, "X_ROUND_REPO=o/r")
			gitT(t, w.seed, "push", "-q", "origin", "codie/x:codie/x-2")
			var runs []string
			for _, run := range c.runs {
				runs = append(runs, strings.ReplaceAll(run, "%s", w.head))
			}
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/7"] = `{"mergeable":true,"mergeable_state":"clean","number":7,"title":"part 1","state":"open","merged":false,"body":"b",
				"head":{"sha":"` + w.head + `","ref":"codie/x"},"base":{"ref":"main"}}`
			w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[` + strings.Join(runs, ",") + `]}`
			w.hub.pages[repoPath+"/actions/runs/1/jobs"] = jobOf("success", "")
			w.hub.pages[repoPath+"/actions/runs/2/jobs"] = jobOf("success", "")
			w.hub.mu.Unlock()

			got := w.run(t, "8")

			if got.code != c.code {
				t.Fatalf("exit %d, want %d:\n%s", got.code, c.code, got.stdout)
			}
			if c.code == 1 && !strings.Contains(got.stdout, "#7") {
				t.Errorf("the wait does not name #7:\n%s", got.stdout)
			}
		})
	}
}

// a stack's lower layer goes through the same gate as the pr merged on top of it
func TestMergeAutoPassesARenovateLowerLayerWithNoClean(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.renovatePr(t, "x-renovate[bot]", `[`+renovateCommit+`]`)
	write(t, w.store, `{"o/r#8":"`+w.head+`"}`)

	if got := w.run(t, "8"); got.code != 4 {
		t.Fatalf("exit %d, want the plan to merge past the renovate layer:\n%s", got.code, got.stdout)
	}
}

func TestMergeAutoLetsDimasWordOpenALowerLayersMissingClean(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.signs(t, "FRM-9", "🚀 dispatched 2026-11-06 — a-lane, codie abc\n")
	write(t, w.store, `{"o/r#8":"`+w.head+`"}`)

	waits, word := w.run(t, "8"), w.run(t, "8", "--dima-ok", "8")

	if waits.code != 1 || word.code != 4 {
		t.Fatalf("exits %d and %d, want a wait with no word and a plan on his word:\n%s\n%s", waits.code, word.code, waits.stdout, word.stdout)
	}
}

// a linked stack whose two layers both edit merge-auto, #7 naming FRM-9 (pre-approved) and #8 naming upper
func selfEditStack(t *testing.T, upper string) (*mergeWorld, *fakeLinear) {
	t.Helper()
	w := linkedMergeWorld(t)
	f := w.signs(t, "FRM-9", signedBody(signAbove, "merge: pre-approved\n", signAbove))
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":"x/go/merge_auto.go","status":"modified"}]`
	w.hub.pages[repoPath+"/pulls/8/files"] = w.hub.pages[repoPath+"/pulls/7/files"]
	w.hub.pages[repoPath+"/pulls/8"] = strings.Replace(w.hub.pages[repoPath+"/pulls/8"], `"body":"b"`, `"body":"- ticket: `+upper+`"`, 1)
	return w, f
}

// FRM-548: a layer lands with the stack, so its own risky path asks its own security pass
func TestMergeAutoWaitsOnALowerLayersSecurityPass(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":".github/workflows/ci.yml","status":"modified"}]`
	w.hub.mu.Unlock()
	write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#8":"`+w.head+`"}`)

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(msg, "#7") || !strings.Contains(msg, "no security pass") {
		t.Fatalf("exit %d, error %q, want the stack held on #7's missing security pass:\n%s", got.code, msg, got.stdout)
	}
}

func TestMergeAutoLandsAStackItsChunkPreApproved(t *testing.T) {
	t.Parallel()
	w, f := selfEditStack(t, "FRM-9")

	got := w.run(t, "8", "--apply")

	if asyncs := w.hub.sent("PUT " + repoPath + "/pulls/8/merge-async"); got.code != 0 || len(asyncs) != 1 {
		t.Fatalf("exit %d, %d async merges, want the pre-approved stack landed in one call:\n%s", got.code, len(asyncs), got.stdout)
	}
	if reads := len(f.requests()); reads != 1 {
		t.Errorf("%d linear reads, want the chunk's sign read once for both layers", reads)
	}
}

func TestMergeAutoHoldsAStackWhoseLayerNamesAnUnsignedTicket(t *testing.T) {
	t.Parallel()
	w, _ := selfEditStack(t, "FRM-10")

	got := w.run(t, "8", "--apply")

	if asyncs := w.hub.sent("PUT " + repoPath + "/pulls/8/merge-async"); got.code != 1 || len(asyncs) != 0 || !strings.Contains(envelopeOf(got).Error, "FRM-10 carries no ## signed block") {
		t.Fatalf("exit %d, %d async merges, error %q: want the unsigned layer's wait", got.code, len(asyncs), envelopeOf(got).Error)
	}
}

func TestMergeAutoNamesALowerLayersRiskyPaths(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7/files"] = `[{"filename":".github/workflows/ci.yml","status":"modified"}]`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply", "--json")

	if got.code != 0 || !slices.Contains(envelopeOf(got).Data.Risky, "#7 .github/workflows/ci.yml") {
		t.Fatalf("exit %d, risky %q: want #7's workflow named\n%s", got.code, envelopeOf(got).Data.Risky, got.stdout)
	}
}

// a top's merge lands every layer under it
func TestMergeAutoRefusesATopOverAHeldLowerLayer(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	plantHold(t, w, "7")

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "#7") || !strings.Contains(msg, "held") || got.next != "x lane merge-auto 8 --apply --dima-ok 8" || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, error %q, next %q, puts %q: want no merge and a refusal naming held #7", got.code, msg, got.next, w.hub.sent("PUT "))
	}
}

func TestMergeAutoLandsATopOverAHeldLowerLayerOnDimasWord(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	plantHold(t, w, "7", "8")

	got := w.run(t, "8", "--apply", "--dima-ok", "8")

	if got.code != 0 || len(w.hub.sent("PUT "+repoPath+"/pulls/8/merge-async")) != 1 {
		t.Fatalf("exit %d, puts %q: want his word on the top to land the held stack\n%s", got.code, w.hub.sent("PUT"), got.stdout)
	}
	if exists(holdRecordOf(w)) {
		t.Errorf("held %q: want every landed layer's mark off and the record gone", heldPrs(t, w))
	}
}

// dima holds a stack by its top: the layers under it land with it, so they hold with it
func TestMergeAutoHoldOnATopMarksTheLayersUnderIt(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)

	got := w.run(t, "8", "--hold", "--apply")

	held := heldPrs(t, w)
	slices.Sort(held)
	if got.code != 0 || !slices.Equal(held, []string{"7", "8"}) {
		t.Fatalf("exit %d, held %q: want the top and the layer under it marked\n%s", got.code, held, got.stdout)
	}
}
