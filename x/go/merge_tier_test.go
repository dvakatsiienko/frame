package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
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

// FRM-548 exit 3: a risky pr whose clean carries no security pass refuses, naming the pass and its stamp
func TestMergeAutoRefusesARiskyPrWithNoSecurityPass(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, ".github/workflows/ci.yml")
	write(t, w.store, `{"o/r#7":"`+w.head+`"}`)

	got := w.run(t, "7", "--apply")

	wait := tierRead(got).Wait
	if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(wait, "no security pass") || !strings.Contains(wait, "watch-pr.sh --verified o/r 7 "+w.head+" --security") {
		t.Fatalf("exit %d, wait %q, want a refusal naming the security pass and its stamp:\n%s", got.code, wait, got.stdout)
	}
}

// FRM-548 exit 3: the stamped pass lands on its head, and carries across a rebase that kept the code, as the clean does
func TestMergeAutoLandsARiskyPrOnItsSecurityPass(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		change func(t *testing.T, w *mergeWorld)
	}{
		{"on the head", func(*testing.T, *mergeWorld) {}},
		{"carried by a rebase", func(t *testing.T, w *mergeWorld) {
			w.mainMoves(t, "one.txt")
			w.moveHead(t)
		}},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, ".github/workflows/ci.yml")
			write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#7:security":"`+w.head+`"}`)
			c.change(t, w)

			if got := w.run(t, "7", "--apply"); got.code != 0 || len(w.hub.sent("PUT ")) != 1 {
				t.Fatalf("exit %d, want the merge on its security pass:\n%s", got.code, got.stdout)
			}
		})
	}
}

// FRM-548 exit 3: a pass on other code counts for nothing
func TestMergeAutoRefusesASecurityPassOnOtherCode(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, ".github/workflows/ci.yml")
	old := w.head
	write(t, filepath.Join(w.seed, "fix.ts"), "a change after the pass\n")
	gitT(t, w.seed, "add", ".")
	gitT(t, w.seed, "commit", "-q", "-m", "a change after the pass")
	w.moveHead(t)
	write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#7:security":"`+old+`"}`)

	got := w.run(t, "7", "--apply")

	if wait := tierRead(got).Wait; got.code != 1 || !strings.Contains(wait, "security pass") {
		t.Fatalf("exit %d, wait %q, want the moved pass refused:\n%s", got.code, wait, got.stdout)
	}
}

// FRM-548 exit 3: a pr that grew past docs into code asks the clean it needs today
func TestMergeAutoAsksTheCleanOfAPrThatGrewPastLight(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "docs/research/x.md", "x/go/foo.go")
	write(t, w.store, `{}`)

	got := w.run(t, "7", "--apply")

	if wait := tierRead(got).Wait; got.code != 1 || !strings.Contains(wait, "no clean recorded") {
		t.Fatalf("exit %d, wait %q, want the missing clean named:\n%s", got.code, wait, got.stdout)
	}
}

// FRM-548 exit 3: a self-path pr's dry run with no sign still prints its tier and checks
func TestMergeAutoPrintsTheChecksOfAnUnsignedSelfEdit(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")

	got := w.run(t, "7")

	read := tierRead(got)
	if got.code != 1 || read.Tier != "risky" || !slices.Contains(read.Asks, "security") || !strings.Contains(got.stdout, "self-edit") {
		t.Fatalf("exit %d, tier %q, asks %v, want the self-edit wait carrying the risky tier and its checks:\n%s", got.code, read.Tier, read.Asks, got.stdout)
	}
}

// the pr's comments, as /issues/7/comments answers: a github app posts as `<slug>[bot]`, type Bot
func (w *mergeWorld) comments(entries ...string) {
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/issues/7/comments"] = "[" + strings.Join(entries, ",") + "]"
}

func comment(login, kind, body string) string {
	return `{"user":{"login":"` + login + `","type":"` + kind + `"},"body":"` + body + `"}`
}

// FRM-548 exit 2: a memory path waits for clio's wishkeeper read, counted only from the clio app, on the head or an ancestor
func TestMergeAutoWaitsForClioWishkeeperRead(t *testing.T) {
	t.Parallel()
	clio := func(_ *mergeWorld, ancestor string) []string {
		return []string{comment("x-clio-cc[bot]", "Bot", "wishkeeper read "+ancestor+": 0 findings")}
	}
	for _, c := range []struct {
		name  string
		plant func(w *mergeWorld, ancestor string) []string
		lands bool
		after string
	}{
		{"no comment", func(*mergeWorld, string) []string { return nil }, false, ""},
		{"clio's read on an ancestor", clio, true, ""},
		{"clio's read before a memory edit", clio, false, "home/.claude/plugin-x/skills/foo/SKILL.md"},
		{"clio's read before a memory file moved off its path", clio, false, "rename"},
		{"clio's read before an edit to a memory path with a space", clio, false, "home/.claude/rules/new rule.md"},
		{"clio's read before an edit to a non-ascii memory path", clio, false, "home/.claude/rules/é.md"},
		{"the same text from codie's app", func(_ *mergeWorld, ancestor string) []string {
			return []string{comment("x-codie-cc[bot]", "Bot", "wishkeeper read "+ancestor+": 0 findings")}
		}, false, ""},
		{"a user named like the app", func(_ *mergeWorld, ancestor string) []string {
			return []string{comment("x-clio-cc[bot]", "User", "wishkeeper read "+ancestor+": 0 findings")}
		}, false, ""},
		{"clio's read on other code", func(*mergeWorld, string) []string {
			return []string{comment("x-clio-cc[bot]", "Bot", "wishkeeper read "+runSha(5)+": 0 findings")}
		}, false, ""},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "x/go/merge_auto.go", "home/.claude/plugin-x/skills/foo/SKILL.md", "home/.claude/rules/new rule.md", "home/.claude/rules/é.md")
			w.signs(t, "FRM-9", signedBody(signAbove, "merge: pre-approved\n", signAbove))
			ancestor := w.head
			if c.after == "rename" {
				gitT(t, w.seed, "mv", "home/.claude/plugin-x/skills/foo/SKILL.md", "moved.md")
			} else {
				write(t, filepath.Join(w.seed, cmp.Or(c.after, "fix.go")), "an edit after the read\n")
			}
			gitT(t, w.seed, "add", ".")
			gitT(t, w.seed, "commit", "-q", "-m", "a fix after the read")
			w.moveHead(t)
			write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#7:security":"`+w.head+`"}`)
			w.comments(c.plant(w, ancestor)...)

			got := w.run(t, "7", "--apply")

			landed := got.code == 0 && len(w.hub.sent("PUT ")) == 1
			if wait := tierRead(got).Wait; landed != c.lands || (!c.lands && !strings.Contains(wait, "wishkeeper read")) {
				t.Fatalf("exit %d, landed %v, wait %q, want landed %v, a wait naming the read:\n%s", got.code, landed, wait, c.lands, got.stdout)
			}
		})
	}
}

// the paths read after the pr head, so a push between them makes the tier newer than the merged head, never older
func TestMergeAutoReadsThePathsAfterThePrHead(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "docs/research/x.md")

	w.run(t, "7", "--apply")

	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	head, files := slices.Index(w.hub.calls, "GET "+repoPath+"/pulls/7"), slices.Index(w.hub.calls, "GET "+repoPath+"/pulls/7/files")
	if head < 0 || files < head {
		t.Fatalf("the pr read at %d, its files at %d, want the files after the head: %v", head, files, w.hub.calls)
	}
}

// FRM-548 exit 1: the lockfile, code beside a doc, and a doc an agent reads as instructions are never light
func TestMergeAutoNeverReadsTheseAsLight(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ path, tier string }{
		{"pnpm-lock.yaml", "normal"},
		{"docs/knowledge/x.md", "memory"},
		{"docs/research/review-model.md", "memory"},
		{"docs/research/claude.md", "risky"},
		{"docs/research/Agents.md", "risky"},
		{"docs/research/ftr.md", "memory"},
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

// github lists at most 3000 of a pr's files and says nothing of the rest, so a full list reads no tier
func TestMergeAutoRefusesAPrPastGithubsFileList(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "docs/research/x.md")
	files := make([]string, 3000)
	for i := range files {
		files[i] = fmt.Sprintf(`{"filename":"docs/research/x%d.md","status":"modified"}`, i)
	}
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7/files"] = "[" + strings.Join(files, ",") + "]"
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if e := envelopeOf(got).Error; got.code == 0 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(e, "3000") {
		t.Fatalf("exit %d, error %q, want a refusal naming github's 3000-file list:\n%s", got.code, e, got.stdout)
	}
}

// a push between the head read and the files read would tier one head and merge another, so a moved head refuses
func TestMergeAutoRefusesWhenTheHeadMovesWhileItsPathsAreRead(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "docs/research/x.md")
	w.hub.mu.Lock()
	w.hub.later = map[string]string{repoPath + "/pulls/7": strings.ReplaceAll(w.hub.pages[repoPath+"/pulls/7"], w.head, runSha(9))}
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if e := envelopeOf(got).Error; got.code == 0 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(e, "moved while its paths were read") {
		t.Fatalf("exit %d, error %q, want a refusal naming the moved head:\n%s", got.code, e, got.stdout)
	}
}
