package main

import (
	"encoding/json"
	"slices"
	"testing"
)

// what merge-auto read, from a plan (exit 4), a wait or a refusal (exit 1): the tier rides each
func tierRead(got ran) mergeDecision {
	var envelope struct {
		Data mergeDecision `json:"data"`
		Plan mergeDecision `json:"plan"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	if envelope.Plan.Tier != "" {
		return envelope.Plan
	}
	return envelope.Data
}

// FRM-548 exit 1: an all-light pr asks no sixth sense, so it lands with no clean recorded
func TestMergeAutoAsksNoSixthSenseOfALightPr(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "docs/research/x.md")
	write(t, w.store, `{}`)

	got := w.run(t, "7")

	read := tierRead(got)
	sixthSense := slices.ContainsFunc(read.Checks, func(c mergeCheck) bool { return c.Name == "sixth-sense" })
	if got.code != 4 || read.Tier != "light" || slices.Contains(read.Asks, "sixth-sense") || sixthSense {
		t.Fatalf("exit %d, tier %q, asks %v, want a light plan with no sixth sense asked:\n%s", got.code, read.Tier, read.Asks, got.stdout)
	}
}

// FRM-548 exit 1: the lockfile, code beside a doc, and a doc an agent reads as instructions are never light
func TestMergeAutoNeverReadsTheseAsLight(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ path, tier string }{
		{"pnpm-lock.yaml", "normal"},
		{"docs/knowledge/x.md", "memory"},
		{"docs/research/review-model.md", "memory"},
		{"docs/test-drive/gate-speed/analyze.mjs", "normal"},
		{".claude/rules/scripts.md", "memory"},
		{"brand/avatars/make.ts", "normal"},
		{"assets/x.js", "normal"},
		{"brand/x.tsx", "normal"},
		{"assets/x.cjs", "normal"},
		{"brand/x.jsx", "normal"},
		{"assets/x.mts", "normal"},
		{"assets/x.rb", "normal"},
		{"assets/README.txt", "normal"},
	} {
		t.Run(c.path, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, c.path)

			got := w.run(t, "7")

			if read := tierRead(got); read.Tier != c.tier || !slices.Contains(read.Asks, "sixth-sense") {
				t.Fatalf("exit %d, tier %q, asks %v, want %s asking the sixth sense:\n%s", got.code, read.Tier, read.Asks, c.tier, got.stdout)
			}
		})
	}
}

// the checks are the union over the paths: one light doc beside code asks what the code asks
func TestMergeAutoAsksTheUnionOfItsPathsChecks(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name  string
		paths []string
		tier  string
		asks  []string
	}{
		{"light beside normal", []string{"docs/research/x.md", "script/foo.ts"}, "normal", []string{"sixth-sense"}},
		{"memory beside light", []string{"docs/research/x.md", "home/.claude/plugin-x/skills/foo/SKILL.md"}, "memory", []string{"sixth-sense", "wishkeeper"}},
		{"risky beside memory", []string{".github/workflows/ci.yml", "docs/knowledge/x.md"}, "risky", []string{"sixth-sense", "security", "wishkeeper"}},
		{"an assets image", []string{"assets/badges/x.svg"}, "light", []string{}},
		{"brand media", []string{"brand/avatars/x.png", "assets/clips/x.mp4", "assets/fonts/x.woff2"}, "light", []string{}},
		{"a secret under assets", []string{"assets/.env"}, "risky", []string{"sixth-sense", "security"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, c.paths...)

			got := w.run(t, "7")

			if read := tierRead(got); read.Tier != c.tier || !slices.Equal(read.Asks, c.asks) {
				t.Fatalf("exit %d, tier %q, asks %v, want %s asking %v:\n%s", got.code, read.Tier, read.Asks, c.tier, c.asks, got.stdout)
			}
		})
	}
}
