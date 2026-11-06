package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// landedWorld is a merged lane: a repo whose origin/main carries FRM-1's commit, the lane spec under
// .scratch/lane-1/, and a state dir for the traces
type landedWorld struct {
	repo, state string
	server      *fakeLinear
	comments    *string // the ticket's comments as linear's json nodes
	body        *string // the ticket's body
	milestone   *string // the ticket's projectMilestone as linear's json
}

// the head of a done report, as crew-codie's how-you-work.md shapes it
const lookCardComment = `[{"body":"- **what**: the verb\n- **proven**: go test ok\n- **not checked**: dima's eyes"}]`

func newLandedWorld(t *testing.T) landedWorld {
	t.Helper()
	w := landedWorld{repo: repo(t), state: t.TempDir(), comments: new(string), body: new(string), milestone: new(string)}
	*w.comments = "[]"
	*w.milestone = "null"
	*w.body = landedBody
	write(t, filepath.Join(w.repo, "x.txt"), "the change\n")
	gitT(t, w.repo, "add", "x.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "the change", "-m", "- ticket: FRM-1")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	write(t, filepath.Join(w.repo, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — the chunk\n\n### exit lines\n\n1. `x lane unlock` prints ok\n")
	w.server = newFakeLinear(t, func(gqlCall) string {
		body, _ := json.Marshal(*w.body)
		return `{"data":{"issue":{"id":"uuid-1","projectMilestone":` + *w.milestone + `,"description":` + string(body) + `,"updatedAt":"2026-10-30T00:00:00.000Z","comments":{"nodes":` + *w.comments + `}}}}`
	})
	return w
}

const (
	landedBody = "## wish\n\n* W1 (2026-10-30, dima): a thing\n* W2 (2026-10-30, dima): another\n\n## signed\n\n🚀 dispatched 2026-10-30 — lane-1, codie s1, sixth sense s2\n"
	lookSent   = "👀 look sent 2026-10-30\n"
)

// done fills every line but the ones a case leaves out
func (w landedWorld) done(t *testing.T) {
	t.Helper()
	write(t, filepath.Join(w.repo, "docs/test-drive/review-rounds.md"), "- FRM-1 · codie · 2 rounds\n")
	*w.comments = lookCardComment
	*w.body += lookSent
}

func (w landedWorld) landed(t *testing.T, args ...string) (map[string]any, asRun) {
	t.Helper()
	return runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)}, append([]string{"lane", "landed", "FRM-1", "--repo", w.repo}, args...)...)
}

func linesOf(envelope map[string]any) string {
	return jsonOf(envelope["plan"]) + jsonOf(envelope["data"]) + jsonOf(envelope["error"])
}

func TestLandedRedsEveryGapAndWritesNothing(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	// a comment naming both words is no look card, and neither is a card missing its «not checked:» field
	*w.comments = `[{"body":"not proven, not checked yet: the card comes with the done report"},{"body":"- **what**: the verb\n- **proven**: go test ok"}]`

	envelope, got := w.landed(t)

	out := linesOf(envelope)
	for _, want := range []string{"🔴 spec", "🔴 review-rounds", "🔴 look", "✅ merged", "✅ wish"} {
		if !strings.Contains(out, want) {
			t.Errorf("want %q in:\n%s", want, out)
		}
	}
	plan, _ := envelope["plan"].(map[string]any)
	lines, _ := plan["lines"].([]any)
	for _, line := range lines {
		text, _ := line.(string)
		if _, named, _ := strings.Cut(text, "· fix: "); strings.HasPrefix(text, "🔴") && strings.TrimSpace(named) == "" {
			t.Errorf("a red line names no fix: %s", text)
		}
	}
	if got.code != 4 {
		t.Errorf("exit %d, want 4: x's apply gate prints the list and writes nothing", got.code)
	}
	if !exists(filepath.Join(w.repo, ".scratch/lane-1/spec.md")) {
		t.Error("the spec moved without --apply")
	}
}

func TestLandedApplyArchivesTheSpecAndNothingElse(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, got := w.landed(t, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md")) || exists(filepath.Join(w.repo, ".scratch/lane-1")) {
		t.Fatalf("the spec dir did not move into the archive:\n%s", got.stdout)
	}
	out := linesOf(envelope)
	if !strings.Contains(out, "✅ spec") || !strings.Contains(out, "🔴 review-rounds") || got.code != 1 {
		t.Errorf("exit %d, want the spec green and the other gaps still red:\n%s", got.code, out)
	}
}

func TestLandedApplyDecampsOnlyTheCleanTrees(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	// worktrees share info/exclude, so a gitignored .scratch/ hides from git status as it does in frame
	write(t, filepath.Join(w.repo, ".git/info/exclude"), ".scratch/\n")
	trees := map[string]string{}
	for _, name := range []string{"clean", "emptied", "loose", "scratch", "unpushed"} {
		trees[name] = w.laneTree(t, name)
	}
	if err := os.MkdirAll(filepath.Join(trees["emptied"], ".scratch/lane"), 0o755); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(trees["loose"], "loose.txt"), "not committed\n")
	write(t, filepath.Join(trees["scratch"], ".scratch/notes.md"), "a plan\n")
	write(t, filepath.Join(trees["unpushed"], "y.txt"), "local only\n")
	gitT(t, trees["unpushed"], "add", "y.txt")
	gitT(t, trees["unpushed"], "commit", "-q", "-m", "local only")
	// hooksHome runs lefthook install through pnpm; the fixture has no node_modules
	envelope, got := runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)},
		"lane", "landed", "FRM-1", "--repo", w.repo, "--apply")

	out := linesOf(envelope)
	for _, name := range []string{"clean", "emptied"} {
		if exists(trees[name]) || strings.Contains(gitT(t, w.repo, "worktree", "list"), trees[name]) {
			t.Errorf("the %s tree was not decamped:\n%s", name, out)
		}
	}
	for name, reason := range map[string]string{"loose": "loose.txt", "scratch": "holds a file in .scratch/", "unpushed": "on no remote"} {
		if !exists(trees[name]) {
			t.Errorf("the %s tree was removed", name)
		}
		if !strings.Contains(out, reason) {
			t.Errorf("want the %s tree's reason %q in:\n%s", name, reason, out)
		}
	}
	if got.code != 1 {
		t.Errorf("exit %d, want 1: three trees still stand", got.code)
	}
}

// laneTree adds a tree on branch codie/FRM-1-<name> under the repo's .claude/worktrees/
func (w landedWorld) laneTree(t *testing.T, name string) string {
	t.Helper()
	tree := filepath.Join(w.repo, ".claude/worktrees", name)
	gitT(t, w.repo, "worktree", "add", "-q", tree, "-b", "codie/FRM-1-"+name)
	return tree
}

// a tree the merge left for its live session goes at a later landed, once that session ended
func TestLandedApplyTakesATreeOnceItsSessionEnded(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	w.done(t)
	tree := w.laneTree(t, "stayed")
	sessions := t.TempDir()
	session := filepath.Join(sessions, "1.json")
	body, _ := json.Marshal(map[string]any{"cwd": tree, "pid": processIn(t, tree)})
	write(t, session, string(body))
	env := []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, "X_SESSIONS=" + sessions, stubPnpm(t)}

	envelope, _ := runLinear(t, w.server, env, "lane", "landed", "FRM-1", "--repo", w.repo, "--apply")
	if !exists(tree) || !strings.Contains(linesOf(envelope), "a live session sits in it") {
		t.Fatalf("a live session's tree was taken:\n%s", linesOf(envelope))
	}

	body, _ = json.Marshal(map[string]any{"cwd": tree, "pid": 99999999})
	write(t, session, string(body))
	envelope, _ = runLinear(t, w.server, env, "lane", "landed", "FRM-1", "--repo", w.repo, "--apply")
	if exists(tree) {
		t.Fatalf("the clean tree stayed:\n%s", linesOf(envelope))
	}
}

// a siesta and the halt own retros: the close reads none, with a file there or not
func TestLandedNamesNoRetros(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, got := w.landed(t)

	if out := linesOf(envelope) + got.stdout + got.stderr; strings.Contains(out, "retro") {
		t.Errorf("want no retros line and no retros in the read step:\n%s", out)
	}
}

func TestLandedLookIsGreenOnlyOnTheLookSentLine(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	*w.comments = lookCardComment

	envelope, _ := w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "🔴 look") || !strings.Contains(out, "👀 look sent") {
		t.Errorf("the look card alone must read red and name the line:\n%s", out)
	}

	// a ticket quoting the line is no line
	*w.body += "* the proposal: a `👀 look sent <date>` line\n"
	envelope, _ = w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "🔴 look") {
		t.Errorf("a quoted line must stay red:\n%s", out)
	}

	*w.body += lookSent
	envelope, _ = w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "✅ look") {
		t.Errorf("the look sent line must read green:\n%s", out)
	}
}

func TestLandedWishLineClosesInThisTurnOnceTheDoneTestRan(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)

	envelope, _ := w.landed(t)
	if out := linesOf(envelope); strings.Contains(out, "close in this turn") || strings.Contains(out, "close proposal") {
		t.Errorf("no look card, so no done test read:\n%s", out)
	}

	*w.comments = lookCardComment
	envelope, _ = w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "close in this turn") {
		t.Errorf("want «close in this turn»:\n%s", out)
	}
}

func TestLandedCountsWishLinesInTheFullIdShape(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	*w.body = "## wish\n\n* FRM-1:W1 (2026-10-30, dima): a thing\n* [FRM-1](https://linear.app/x/issue/FRM-1):W2 (2026-10-30, dima): another\n* W3 (2026-10-30, dima): an old bare line\n\n## signed\n\n🚀 dispatched 2026-10-30 — lane-1, codie s1, sixth sense s2\n"

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "3 W-lines") {
		t.Errorf("want all three wish lines counted:\n%s", out)
	}
}

// a quick lane's commits carry no id: its merged reads the range from the dispatch's base to the verified sha
func quickWorld(t *testing.T) (landedWorld, string) {
	t.Helper()
	w := newLandedWorld(t)
	base := gitT(t, w.repo, "rev-parse", "HEAD")
	write(t, filepath.Join(w.repo, "q.txt"), "the quick change\n")
	gitT(t, w.repo, "add", "q.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 x: no id anywhere")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	*w.body = "lane: quick\n\n🚀 dispatched 2026-10-30 — q, codie s1, main:" + short(base) + ", sixth sense s2\n"
	return w, gitT(t, w.repo, "rev-parse", "HEAD")
}

func TestLandedRefusesAQuickLaneMidVerify(t *testing.T) {
	t.Parallel()
	w, _ := quickWorld(t)
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")

	envelope, got := w.landed(t, "--apply")

	if out := linesOf(envelope); got.code != 1 || !strings.Contains(out, "mid-verify") {
		t.Fatalf("exit %d, want a refusal naming the verify:\n%s", got.code, out)
	}
	if !exists(filepath.Join(w.repo, ".scratch/lane-1/spec.md")) {
		t.Error("the spec was archived mid-verify")
	}
}

func TestLandedReadsAQuickLaneRangeUpToTheVerifiedSha(t *testing.T) {
	t.Parallel()
	w, head := quickWorld(t)
	body, _ := json.Marshal("verdict: clean · verified: " + short(head))
	*w.comments = `[{"body":` + string(body) + `}]`

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "✅ merged — 1 commit from main:") {
		t.Errorf("the range holds the quick commit:\n%s", out)
	}
}

func TestLandedWaitsForTheDoneCommentWithNoSixthSense(t *testing.T) {
	t.Parallel()
	w, _ := quickWorld(t)
	*w.body = strings.ReplaceAll(*w.body, ", sixth sense s2", "")

	envelope, _ := w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "🔴 merged") {
		t.Errorf("a rival's commit on main must not read merged:\n%s", out)
	}

	*w.comments = lookCardComment
	envelope, _ = w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "🔴 merged") || !strings.Contains(out, "verified:") {
		t.Errorf("a done comment with no verified: line bounds nothing:\n%s", out)
	}
}

// with no sixth sense a done comment's verified: line bounds the range; with none, main past the lane is nobody's count
func TestLandedNeverCountsAnotherLanesCommitsOnAQuickLaneWithNoSixthSense(t *testing.T) {
	t.Parallel()
	w, head := quickWorld(t)
	*w.body = strings.ReplaceAll(*w.body, ", sixth sense s2", "")
	write(t, filepath.Join(w.repo, "other.txt"), "another lane\n")
	gitT(t, w.repo, "add", "other.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 another lane's commit")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")

	*w.comments = lookCardComment
	envelope, _ := w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "🔴 merged") || strings.Contains(out, "2 commits") {
		t.Errorf("another lane's commits never turn it green:\n%s", out)
	}

	for _, line := range []string{"verified: ", "- **verified**: "} {
		body, _ := json.Marshal("- **proven**: go test ok\n- **not checked**: his eyes\n" + line + short(head))
		*w.comments = `[{"body":` + string(body) + `}]`
		envelope, _ = w.landed(t)
		if out := linesOf(envelope); !strings.Contains(out, "✅ merged — 1 commit from main:") {
			t.Errorf("%q: the done comment's verified sha stops the range:\n%s", line, out)
		}
	}
}

func TestLandedReadsADispatchTakenBackAsNone(t *testing.T) {
	t.Parallel()
	w, _ := quickWorld(t)
	*w.body += "↩️ taken back 2026-10-30\n"

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); strings.Contains(out, "mid-verify") {
		t.Errorf("a dispatch taken back is not mid-verify:\n%s", out)
	}
}

func TestLandedReadsAProseArrowAsNoTakeBack(t *testing.T) {
	t.Parallel()
	w, _ := quickWorld(t)
	*w.body += "✏️ changed: the ↩️ line reworded\n"

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "mid-verify") {
		t.Errorf("a ↩️ inside a sentence takes nothing back, the lane is still mid-verify:\n%s", out)
	}
}

// a lane with no sixth sense has no verify tree: a clean one at a commit in its open range is another lane's
func TestLandedLeavesAnotherLanesVerifyTreeOnAQuickLaneWithNoSixthSense(t *testing.T) {
	t.Parallel()
	w, head := quickWorld(t)
	*w.body = strings.ReplaceAll(*w.body, ", sixth sense s2", "")
	*w.comments = lookCardComment
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+short(head))
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, head)

	envelope, _ := w.landed(t, "--apply")

	if out := linesOf(envelope); !exists(verify) || !strings.Contains(out, "names no verified: sha") {
		t.Errorf("tree there: %v, want it kept and the refusal naming the missing verified sha:\n%s", exists(verify), out)
	}
}

func TestLandedReadsABytesTicketFromBytesWithNoRepoLine(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	home := t.TempDir()
	bytesRepo := filepath.Join(home, "projects/bytes")
	gitT(t, filepath.Dir(w.repo), "init", "-q", "-b", "main", bytesRepo)
	write(t, filepath.Join(bytesRepo, "b.txt"), "bytes\n")
	gitT(t, bytesRepo, "add", "b.txt")
	gitT(t, bytesRepo, "commit", "-q", "-m", "the change", "-m", "- ticket: BYT-1")
	gitT(t, bytesRepo, "update-ref", "refs/remotes/origin/main", "HEAD")

	envelope, _ := runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, "HOME=" + home, stubPnpm(t)}, "lane", "landed", "BYT-1")

	if out := linesOf(envelope); !strings.Contains(out, "✅ merged") {
		t.Errorf("a BYT ticket must read the bytes repo:\n%s", out)
	}
}

func TestLandedRedsAVerifiedShaNotOnMain(t *testing.T) {
	t.Parallel()
	w, head := quickWorld(t)
	body, _ := json.Marshal("verified: " + short(head))
	*w.comments = `[{"body":` + string(body) + `}]`
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "🔴 merged") {
		t.Errorf("a verified sha off main has not landed:\n%s", out)
	}
}

func TestLandedReadsTheRepoOfTheTicket(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	*w.body = "lane: side\nrepo: bytes\n\n" + landedBody
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	home := t.TempDir()
	bytesRepo := filepath.Join(home, "projects/bytes")
	gitT(t, filepath.Dir(w.repo), "init", "-q", "-b", "main", bytesRepo)
	write(t, filepath.Join(bytesRepo, "b.txt"), "bytes\n")
	gitT(t, bytesRepo, "add", "b.txt")
	gitT(t, bytesRepo, "commit", "-q", "-m", "the change", "-m", "- ticket: FRM-1")
	gitT(t, bytesRepo, "update-ref", "refs/remotes/origin/main", "HEAD")

	envelope, _ := runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, "HOME=" + home, stubPnpm(t)}, "lane", "landed", "FRM-1")

	if out := linesOf(envelope); !strings.Contains(out, "✅ merged") {
		t.Errorf("a bytes ticket must read the bytes repo:\n%s", out)
	}
}

func TestLandedWiredLine(t *testing.T) {
	t.Parallel()
	const openMate = `{"issues":{"nodes":[{"identifier":"FRM-1","state":{"type":"completed"}},{"identifier":"FRM-2","state":{"type":"started"}}]}}`
	const allDone = `{"issues":{"nodes":[{"identifier":"FRM-1","state":{"type":"completed"}},{"identifier":"FRM-2","state":{"type":"canceled"}}]}}`
	cases := []struct {
		name, milestone string
		calls           int
		want            string
	}{
		{"at the merge", openMate, 0, "✅ wired — wired: unmeasured yet"},
		{"no milestone", "null", 0, "✅ wired — wired: unmeasured yet"},
		{"this ticket the last one open", `{"issues":{"nodes":[{"identifier":"FRM-1","state":{"type":"started"}},{"identifier":"FRM-2","state":{"type":"completed"}}]}}`, 0, "✅ wired — wired: unmeasured yet"},
		{"at the close with no call", allDone, 0, "🔴 wired"},
		{"at the close with a call", allDone, 2, "✅ wired — 2 calls"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			*w.milestone = c.milestone
			*w.body = "## ⚖️ worth it\n\n* new verb: `x lane landed`\n* cheaper door turned down: `x stats --days 30`\n\n" + landedBody
			lines := make([]planted, c.calls)
			for i := range lines {
				lines[i] = planted{name: "lane landed", ms: 1, caller: "cc"}
			}
			plant(t, w.state, 0, lines...)

			envelope, _ := w.landed(t)

			if out := linesOf(envelope); !strings.Contains(out, c.want) {
				t.Errorf("want %q in:\n%s", c.want, out)
			}
		})
	}
}

func TestLandedReadsEveryShapeOfANewVerbLine(t *testing.T) {
	t.Parallel()
	const stats, landed, nameless = "0 calls of x stats", "0 calls of x lane landed", "names no x verb"
	cases := []struct {
		line string
		want []string
		not  []string
	}{
		{"**new verb:** `x stats`", []string{stats}, []string{nameless}},
		{"**new verb**: `x stats`", []string{stats}, []string{nameless}},
		{"new verb: `x stats`, `x lane landed`", []string{stats, landed}, []string{nameless}},
		{"new verb: x stats, x lane landed", []string{stats, landed}, []string{nameless}},
		{"new verb: x lane landed, the door", []string{landed}, []string{nameless}},
		{"new verb: `x stats` — not `x lane landed`", []string{stats}, []string{landed, nameless}},
		{"new verb: nosuch thing", []string{"🔴 wired", "nosuch thing " + nameless}, nil},
		{"new verb: `x stats`, `x nosuch`", []string{stats, "x nosuch " + nameless}, nil},
		{"**new verb: x stats**", []string{stats}, []string{nameless}},
		{"new verb: **x stats**", []string{stats}, []string{nameless}},
		{"new verb: `x stats`, with `--days`", []string{stats}, []string{nameless}},
		{"new verb: `x stats --days 30`", []string{stats}, []string{nameless}},
		{"new verb: x stats, x lane landd", []string{stats, "x lane landd " + nameless}, nil},
		{"new verb: `x stats dayly`", []string{"x stats dayly " + nameless}, []string{stats}},
		{"new verb: x lane landed now wired", []string{landed}, []string{nameless}},
		{"new verb: x stats, with `--days`", []string{stats}, []string{nameless}},
		{"new verb: x stats (`--verb` flag)", []string{stats}, []string{nameless}},
		{"new verb: x stats and x lane landed", []string{stats, landed}, []string{nameless}},
		{"new verbs: x stats, x lane landed", []string{stats, landed}, []string{nameless}},
		{"New verb: x stats", []string{stats}, []string{nameless}},
		{"1. new verb: x stats", []string{stats}, []string{nameless}},
		{"new verb: none (a fix)", nil, []string{"wired"}},
		{"new verb: **none**", nil, []string{"wired"}},
		{"new verb:", nil, []string{"wired"}},
	}
	for _, c := range cases {
		t.Run(c.line, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			*w.milestone = `{"issues":{"nodes":[{"identifier":"FRM-1","state":{"type":"completed"}}]}}`
			*w.body = "## ⚖️ worth it\n\n* " + c.line + "\n\n" + landedBody

			envelope, _ := w.landed(t)

			out := linesOf(envelope)
			for _, want := range c.want {
				if !strings.Contains(out, want) {
					t.Errorf("want %q in:\n%s", want, out)
				}
			}
			for _, not := range c.not {
				if strings.Contains(out, not) {
					t.Errorf("want no %q in:\n%s", not, out)
				}
			}
		})
	}
}

// main interleaves lanes, so past the verified tip only a commit's own step line says whose it is
func TestLandedCountsOnlyTheLanesCommitsInsideTheRange(t *testing.T) {
	t.Parallel()
	w, _ := quickWorld(t)
	commit := func(file string, message ...string) string {
		write(t, filepath.Join(w.repo, file), file+"\n")
		gitT(t, w.repo, "add", file)
		args := []string{"commit", "-q"}
		for _, m := range message {
			args = append(args, "-m", m)
		}
		gitT(t, w.repo, args...)
		return short(gitT(t, w.repo, "rev-parse", "HEAD"))
	}
	foreign := commit("foreign.txt", "🔧 another lane's commit", "step 1 of FRM-12: theirs")
	step := commit("step.txt", "🔧 this lane's step", "step 2 of FRM-1: ours")
	tip := commit("tip.txt", "🐞 the last fix")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	body, _ := json.Marshal("verdict: clean · verified: " + tip)
	*w.comments = `[{"body":` + string(body) + `}]`

	envelope, _ := w.landed(t)

	out := linesOf(envelope)
	if !strings.Contains(out, "✅ merged — 2 commits from main:") || !strings.Contains(out, "2 name no step of FRM-1") {
		t.Errorf("want the tip and the step counted, the rest named:\n%s", out)
	}
	// these shas feed the verify trees' match, so another lane's never joins them
	var issue landedRead
	issue.Comments.Nodes = append(issue.Comments.Nodes, struct{ Body string }{"verified: " + tip})
	commits, _ := quickMerged(w.repo, "FRM-1", dispatchOf(*w.body).base, issue)
	joined := strings.Join(commits, "\n")
	if len(commits) != 2 || !strings.Contains(joined, tip) || !strings.Contains(joined, step) || strings.Contains(joined, foreign) {
		t.Errorf("want %s and %s, never %s:\n%s", tip, step, foreign, joined)
	}
}

func TestLandedPrintsNoWiredLineWhenNoNewVerbIsNamed(t *testing.T) {
	t.Parallel()
	for _, line := range []string{"new surface: none — a fix, `x stats`", "new surface: one verb, `x lane landed`", "the prose names `x lane landed` as new", "a new verb: `x lane landed`, in a sentence", "new verb: none", "new verb: none — a fix"} {
		t.Run(line, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			*w.body = "## ⚖️ worth it\n\n* " + line + "\n* cheaper door turned down: `x lane push`\n\n" + landedBody

			envelope, _ := w.landed(t)

			if out := linesOf(envelope); strings.Contains(out, "wired") {
				t.Errorf("no new verb, no wired line:\n%s", out)
			}
		})
	}
}

func TestLandedPrintsOneWiredLinePerNewVerb(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	*w.milestone = `{"issues":{"nodes":[{"identifier":"FRM-1","state":{"type":"completed"}}]}}`
	*w.body = "## ⚖️ worth it\n\n* new verb: `x lane landed` — the close\n* new verb: lane push (the door)\n\n" + landedBody
	plant(t, w.state, 0, planted{name: "lane landed", ms: 1, caller: "cc"})

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "✅ wired — 1 call of x lane landed") || !strings.Contains(out, "🔴 wired — 0 calls of x lane push in 30 days") {
		t.Errorf("want a line per verb:\n%s", out)
	}
}

func stubPnpm(t *testing.T) string {
	t.Helper()
	bin := t.TempDir()
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\nexit 0\n")
	return "PATH=" + bin + ":" + os.Getenv("PATH")
}

func TestLandedApplyDecampsASquashMergedTreeWhoseBranchIsGone(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	gitT(t, w.repo, "remote", "add", "origin", "https://github.com/o/r.git")
	// the pr's branch: squash-merged, then deleted on origin, so its commit sits on no remote
	squashed := w.laneTree(t, "squashed")
	write(t, filepath.Join(squashed, "y.txt"), "the pr\n")
	gitT(t, squashed, "add", "y.txt")
	gitT(t, squashed, "commit", "-q", "-m", "the pr")
	merged := gitT(t, squashed, "rev-parse", "HEAD")
	// sixth sense's verify trees: one only at the pr's head, one only by its frame name
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-at-head")
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, merged)
	named := filepath.Join(w.repo, ".claude/worktrees/verify-pr-7")
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", named, "origin/main")
	// a second tree of the lane with work the pr never carried
	local := w.laneTree(t, "local")
	write(t, filepath.Join(local, "z.txt"), "local only\n")
	gitT(t, local, "add", "z.txt")
	gitT(t, local, "commit", "-q", "-m", "local only")
	server, _ := fakeGithub(t, map[string]string{repoPath + "/pulls/7": `{"merged":true,"head":{"ref":"codie/FRM-1-squashed","sha":"` + merged + `"}}`})
	keys := keysFixture(t, map[string]string{
		"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder",
		"keychain:x-token-linear-codie:x":  farFuture + ":tok-codie",
		"keychain:x-token-linear-clio:x":   farFuture + ":tok-clio",
	})

	got := runAs(t, []string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL, "X_LINEAR_URL=" + w.server.URL, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)},
		"lane", "landed", "FRM-1", "--repo", w.repo, "--pr", "7", "--apply")

	if exists(squashed) {
		t.Errorf("the squash-merged tree at the pr's head was kept:\n%s", got.stdout)
	}
	if exists(verify) {
		t.Errorf("the detached verify tree at the merged head was kept:\n%s", got.stdout)
	}
	if exists(named) {
		t.Errorf("the detached verify-pr-7 tree was kept:\n%s", got.stdout)
	}
	if !exists(local) || !strings.Contains(got.stdout, "1 commit on no remote") {
		t.Errorf("the tree with a local-only commit must stay and say why:\n%s", got.stdout)
	}
}

func TestLandedReadsTheSpecFromFrameAndTheMergeFromTheLanesRepo(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	// a bytes lane: its commit lands in its own repo, its spec stays in frame
	lane := repo(t)
	write(t, filepath.Join(lane, "app.txt"), "the app change\n")
	gitT(t, lane, "add", "app.txt")
	gitT(t, lane, "commit", "-q", "-m", "the app change", "-m", "- ticket: FRM-1")
	gitT(t, lane, "update-ref", "refs/remotes/origin/main", "HEAD")
	tree := filepath.Join(lane, ".claude/worktrees/app")
	gitT(t, lane, "worktree", "add", "-q", tree, "-b", "codie/FRM-1-app")

	envelope, _ := runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)},
		"lane", "landed", "FRM-1", "--repo", lane, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md")) {
		t.Errorf("frame's spec did not archive for a lane merged in another repo:\n%s", linesOf(envelope))
	}
	if exists(tree) {
		t.Errorf("the lane repo's clean tree was not decamped:\n%s", linesOf(envelope))
	}
}

func TestLandedKeepsASpecWhoseSiblingChunkIsStillBuilding(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — landed\n\n## FRM-2 — still building\n")

	envelope, got := w.landed(t, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/lane-1/spec.md")) {
		t.Fatal("the spec moved while FRM-2 has no commit on origin/main")
	}
	if out := linesOf(envelope); !strings.Contains(out, "waits on FRM-2") || got.code != 1 {
		t.Errorf("exit %d, want the spec line red naming FRM-2:\n%s", got.code, out)
	}
}

func TestLandedArchivesASpecWhoseSiblingChunkMergedToo(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — landed\n\n## FRM-2 — landed in the same squash\n")
	write(t, filepath.Join(w.repo, "z.txt"), "the squash\n")
	gitT(t, w.repo, "add", "z.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "the squash", "-m", "- ticket: FRM-2")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")

	w.landed(t, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md")) {
		t.Error("the spec stayed though every chunk has a commit on origin/main")
	}
}

func TestLandedDecampsAVerifyTreeNamedForTheTicket(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	// a bytes-style verify tree, no --pr to match it by
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-FRM-1")
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, "origin/main")

	_, got := w.landed(t, "--apply")

	if exists(verify) {
		t.Errorf("the verify-FRM-1 tree was not decamped:\n%s", got.stdout)
	}
}

func (w landedWorld) lanePlan(t *testing.T, text string) string {
	t.Helper()
	path := filepath.Join(w.state, "lanes/lane-1/lane-plan.md")
	write(t, path, text)
	return path
}

func TestLandedReadsAChunksClosingSlice(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, plan string
		want       []string
		absent     string
	}{
		{"no closing slice reds and names the line to add", "- [x] 01 · FRM-1 the build\n",
			[]string{"🔴 closing", "- [ ] NN · FRM-1 reviewed and closed"}, ""},
		{"an open closing slice reds with the apply door", "- [x] 01 · FRM-1 the build\n- [ ] 02 · FRM-1 reviewed and closed\n",
			[]string{"🔴 closing", "x lane landed FRM-1 --apply"}, ""},
		{"a ticked closing slice is met", "- [x] 01 · FRM-1 the build\n- [x] 02 · FRM-1 reviewed and closed\n",
			[]string{"✅ closing"}, ""},
		{"another chunk's closing slice never stands in", "- [x] 01 · FRM-1 the build\n- [x] 02 · FRM-11 reviewed and closed\n",
			[]string{"🔴 closing"}, ""},
		{"a plan with no slice of this chunk says nothing", "- [ ] 01 · FRM-2 the build\n", nil, "closing"},
		{"a slice that only mentions the words is no closing slice", "- [x] 01 · FRM-1 reviewed and closed the door\n",
			[]string{"🔴 closing"}, ""},
		{"a second round's own closing line is the one read", "- [x] 01 · FRM-1 reviewed and closed\n- [ ] 02 · FRM-1 round 3 reviewed and closed\n",
			[]string{"🔴 closing", "is open"}, ""},
		{"a plan's own closing wording reads", "- [x] 01 · FRM-1 FRM-1 closes\n",
			[]string{"✅ closing"}, ""},
		{"a build line ending in a closing word is no closer when steps follow it", "- [x] 01 · FRM-1 the sheet closes\n- [x] 02 · FRM-1 the rest\n",
			[]string{"🔴 closing", "holds no closing slice"}, ""},
		{"an open closer ahead of the last one reds, naming it", "- [ ] 01 · FRM-1 reviewed and closed\n- [x] 02 · FRM-1 round 3 reviewed and closed\n",
			[]string{"🔴 closing", "sits open ahead"}, ""},
		{"a chunk named mid-line still needs its closing slice", "- [x] 01 · quiet reads FRM-1\n",
			[]string{"🔴 closing", "holds no closing slice"}, ""},
		{"a line that leads with another ticket is that ticket's", "- [ ] 01 · FRM-2 fixes FRM-1\n", nil, "closing"},
		{"a crlf plan reads its closing slice", "- [x] 01 · FRM-1 the build\r\n- [x] 02 · FRM-1 reviewed and closed\r\n",
			[]string{"✅ closing"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			w.lanePlan(t, c.plan)
			envelope, _ := w.landed(t)
			out := linesOf(envelope)
			for _, want := range c.want {
				if !strings.Contains(out, want) {
					t.Errorf("want %q in:\n%s", want, out)
				}
			}
			if c.absent != "" && strings.Contains(out, c.absent) {
				t.Errorf("want no %q in:\n%s", c.absent, out)
			}
		})
	}
}

func TestLandedPrintsNoClosingLineWithNoLanePlan(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	envelope, _ := w.landed(t)
	if out := linesOf(envelope); strings.Contains(out, "closing") {
		t.Errorf("a lane with no plan has no closing line:\n%s", out)
	}
}

func TestLandedReadsThePlanOfTheSpecThatHasOne(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, ".scratch/a-old/spec.md"), "# old\n\n## FRM-1 — the chunk\n")
	w.lanePlan(t, "- [x] 01 · FRM-1 reviewed and closed\n")
	envelope, _ := w.landed(t)
	if out := linesOf(envelope); !strings.Contains(out, "✅ closing") {
		t.Errorf("a stale spec with no plan must not hide the live one:\n%s", out)
	}
}

func TestLandedApplyTicksTheClosingSliceEvenWhenTheArchiveRefuses(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md"), "# an older run\n")
	path := w.lanePlan(t, "- [ ] 01 · FRM-1 reviewed and closed\n")
	w.landed(t, "--apply")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "[x]") {
		t.Errorf("the tick must land ahead of the archive:\n%s", raw)
	}
}

func TestLandedApplyTicksOnlyTheClosingSlice(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	w.done(t)
	path := w.lanePlan(t, "# plan\n\n- [ ] 01 · FRM-1 the pr reviewed and closed\n- [ ] 02 · FRM-1 reviewed and closed\n- [ ] 03 · FRM-2 reviewed and closed\n")

	envelope, _ := w.landed(t, "--apply")

	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	want := "# plan\n\n- [ ] 01 · FRM-1 the pr reviewed and closed\n- [x] 02 · FRM-1 reviewed and closed\n- [ ] 03 · FRM-2 reviewed and closed\n"
	if string(raw) != want {
		t.Errorf("plan after --apply:\n%s", raw)
	}
	if out := linesOf(envelope); !strings.Contains(out, "sits open ahead") {
		t.Errorf("the open line ahead must still read red after the tick:\n%s", out)
	}
}

func TestLandedApplyTicksNothingBeforeTheMerge(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	path := w.lanePlan(t, "- [ ] 01 · FRM-1 reviewed and closed\n")
	w.landed(t, "--apply")
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "[x]") {
		t.Errorf("an unmerged lane's closing slice stays open:\n%s", raw)
	}
}

func TestLandedReadsAQuickLaneStepLineAsMerged(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	gitT(t, w.repo, "reset", "-q", "--hard", "HEAD~1")
	write(t, filepath.Join(w.repo, "q.txt"), "the quick change\n")
	gitT(t, w.repo, "add", "q.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 x-mod-guard: a rule refuses", "-m", "step 3 of FRM-1: the rule\n\nAgent: codie · Claude Opus 5.5")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "✅ merged") {
		t.Errorf("a quick lane's step line must read merged:\n%s", out)
	}
}

func TestLandedReadsAQuickLaneMergedAndDecampsItsVerifyTree(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	// a quick lane's commit, the shape on main: the id in the subject's parenthetical, no ticket line
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	gitT(t, w.repo, "reset", "-q", "--hard", "HEAD~1")
	write(t, filepath.Join(w.repo, "q.txt"), "the quick change\n")
	gitT(t, w.repo, "add", "q.txt")
	gitT(t, w.repo, "commit", "-q", "-m", "🔧 x-mod-guard: a rule refuses (FRM-2 and FRM-1 review)", "-m", "- both rules leave WARN_ONLY\n\nAgent: codie · Claude Sonnet 5.5")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD")
	sha := gitT(t, w.repo, "rev-parse", "HEAD")
	verify := filepath.Join(w.repo, ".claude/worktrees/verify-"+sha[:7])
	gitT(t, w.repo, "worktree", "add", "-q", "--detach", verify, sha)

	envelope, _ := w.landed(t, "--apply")

	if out := linesOf(envelope); !strings.Contains(out, "✅ merged") {
		t.Errorf("a quick lane's subject-named commit must read merged:\n%s", out)
	}
	if exists(verify) {
		t.Errorf("the quick lane's verify-<sha> tree was not decamped:\n%s", linesOf(envelope))
	}
}

func TestLandedRefusesAPrThatIsNotTheTickets(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, body string
		refused    bool
	}{
		{"another ticket's pr", `- ticket: FRM-2`, true},
		{"FRM-1 only inside a fence", "- ticket: FRM-2\\n\\n```text\\n- ticket: FRM-1\\n```", true},
		{"a longer id that starts FRM-1", `- ticket: FRM-1x\n- ticket: FRM-12`, true},
		// a joined chunk: the pr's branch is the lane's first ticket, its body names FRM-1 too
		{"a joined chunk's pr, named in its body", `- ticket: FRM-2\n- ticket: FRM-1`, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newLandedWorld(t)
			gitT(t, w.repo, "remote", "add", "origin", "https://github.com/o/r.git")
			other := filepath.Join(w.repo, ".claude/worktrees/other")
			gitT(t, w.repo, "worktree", "add", "-q", other, "-b", "codie/FRM-2-other")
			server, _ := fakeGithub(t, map[string]string{repoPath + "/pulls/8": `{"merged":true,"body":"` + c.body + `","head":{"ref":"codie/FRM-2-other","sha":"abc"}}`})
			keys := keysFixture(t, map[string]string{
				"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder",
				"keychain:x-token-linear-codie:x":  farFuture + ":tok-codie",
				"keychain:x-token-linear-clio:x":   farFuture + ":tok-clio",
			})

			got := runAs(t, []string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL, "X_LINEAR_URL=" + w.server.URL, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)},
				"lane", "landed", "FRM-1", "--repo", w.repo, "--pr", "8", "--apply")

			if refused := strings.Contains(got.stdout, "is not FRM-1's pr"); refused != c.refused {
				t.Errorf("refused %v, want %v:\n%s", refused, c.refused, got.stdout)
			}
			if c.refused && (!exists(other) || got.code == 0) {
				t.Errorf("exit %d, a refused pr must keep FRM-2's tree:\n%s", got.code, got.stdout)
			}
		})
	}
}

func TestLandedDecampsOnlyBuildAndSeedOutputAmongIgnoredFiles(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	write(t, filepath.Join(w.repo, ".git/info/exclude"), ".env.local\nnode_modules/\ndist/\n.DS_Store\n.worktree-offset\nnotes/\n")
	write(t, filepath.Join(w.repo, ".env.local"), "KEY=the main checkout's\n")
	// an ignored dir no build makes: its notes are dima's
	notes := w.laneTree(t, "notes")
	write(t, filepath.Join(notes, "notes/notes.md"), "a thought\n")
	// an env file edited in the tree, no longer the seed's copy
	env := w.laneTree(t, "env")
	write(t, filepath.Join(env, ".env.local"), "KEY=a value only dima typed\n")
	// what a seed, an install, a build and finder leave in a bytes tree
	built := w.laneTree(t, "built")
	write(t, filepath.Join(built, ".env.local"), "KEY=the main checkout's\n")
	write(t, filepath.Join(built, "node_modules/pkg/index.js"), "module.exports = 1\n")
	write(t, filepath.Join(built, "dist/app.js"), "built\n")
	write(t, filepath.Join(built, ".DS_Store"), "finder\n")
	write(t, filepath.Join(built, ".worktree-offset"), "3\n")

	_, got := w.landed(t, "--apply")

	for tree, file := range map[string]string{notes: "notes/", env: ".env.local"} {
		if !exists(tree) || !strings.Contains(got.stdout, "ignored files no build or seed makes: "+file) {
			t.Errorf("the tree holding %s must stay and name it:\n%s", file, got.stdout)
		}
	}
	if exists(built) {
		t.Errorf("a tree holding only build output and a seed's copy must decamp:\n%s", got.stdout)
	}
}

func TestLandedRedsTheLinearLinesForATicketLinearDoesNotKnow(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	w.server = newFakeLinear(t, func(gqlCall) string { return `{"data":{"issue":null}}` })

	envelope, _ := w.landed(t)

	if out := linesOf(envelope); !strings.Contains(out, "🔴 wish") || !strings.Contains(out, "linear sent no issue FRM-1") {
		t.Errorf("a null issue must red the wish line, never read as no W-lines:\n%s", out)
	}
}

func TestLandedKeepsATreeALiveSessionLocked(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	tree := w.laneTree(t, "held")
	gitT(t, w.repo, "worktree", "lock", "--reason", "claude session 5a21e87f", tree)

	_, got := w.landed(t, "--apply")

	if !exists(tree) || !strings.Contains(got.stdout, "a live session holds it") {
		t.Errorf("a locked tree must stay, named as held:\n%s", got.stdout)
	}
}

func TestLandedApplyRefusesALaneThatHasNotMerged(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", "HEAD~1")
	tree := w.laneTree(t, "early")

	envelope, got := w.landed(t, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/lane-1/spec.md")) || !exists(tree) {
		t.Fatal("--apply wrote before the lane merged")
	}
	if !strings.Contains(jsonOf(envelope["error"]), "has not landed") || got.code == 0 {
		t.Errorf("exit %d, want a refusal naming the missing merge:\n%s", got.code, got.stdout)
	}
}

func TestLandedArchivesTheMainCheckoutsSpecFromALaneTree(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	tree := w.laneTree(t, "copy")
	write(t, filepath.Join(tree, ".scratch/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — the chunk\n")

	runLinear(t, w.server, []string{"X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)}, "lane", "landed", "FRM-1", "--repo", tree, "--apply")

	if !exists(filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md")) || exists(filepath.Join(tree, ".scratch/_archive")) {
		t.Error("the main checkout's spec must move into its own archive, never the tree's copy")
	}
}

func TestLandedKeepsTheTreeXRunsFrom(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	tree := w.laneTree(t, "here")

	got := xIn(t, tree, []string{"X_KEYS=" + linearKeys(t), "X_LINEAR_URL=" + w.server.URL, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)},
		"lane", "landed", "FRM-1", "--repo", w.repo, "--apply")

	if !exists(tree) || !strings.Contains(got.stdout, "x runs from it") {
		t.Errorf("the cwd tree must stay, named as the one x runs from:\n%s", got.stdout)
	}
}

func TestLandedPassesWhenEveryLineIsMet(t *testing.T) {
	t.Parallel()
	w := newLandedWorld(t)
	w.done(t)
	write(t, filepath.Join(w.repo, ".scratch/_archive/lane-1/spec.md"), "# lane 1\n\n## FRM-1 — the chunk\n")
	if err := os.RemoveAll(filepath.Join(w.repo, ".scratch/lane-1")); err != nil {
		t.Fatal(err)
	}

	envelope, got := w.landed(t, "--apply")

	if out := linesOf(envelope); got.code != 0 || strings.Contains(out, "🔴") {
		t.Errorf("exit %d, want 0 with every line ✅:\n%s", got.code, out)
	}
}
