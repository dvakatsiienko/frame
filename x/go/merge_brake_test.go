package main

import (
	"bytes"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// merge-auto in agent mode, with its stderr: where a human line goes beside the json
func mergeAutoStderr(t *testing.T, w *mergeWorld, args ...string) (int, string, string) {
	t.Helper()
	c := exec.Command(xbin, append([]string{"lane", "merge-auto"}, args...)...)
	c.Dir = w.clone
	c.Env = append(append(cleanEnv(), "X_TEST=1"), w.env...)
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	return exitOf(c.Run()), stdout.String(), stderr.String()
}

// FRM-631 done test: his override lifts the brake and one human warning line names it, in agent mode too
func TestOverrideLiftingTheBrakePrintsOneWarningLine(t *testing.T) {
	t.Parallel()
	w, _ := overrideWorld(t, prsOn(), "script/foo.ts")
	revert := brakeOnFor(t, w)
	w.env = append(w.env, "X_NOW="+brakeNow)

	code, stdout, stderr := mergeAutoStderr(t, w, "7", "--apply")

	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merges: want the pr landed past the lifted brake\n%s\n%s", code, len(merges), stdout, stderr)
	}
	if n := strings.Count(stderr, "⚠ brake lifted by operator-override prs: revert "+short(revert)); n != 1 {
		t.Errorf("%d warning lines on stderr, want one naming revert %s:\n%s", n, short(revert), stderr)
	}
}

// FRM-631: a brake label on the pr itself stops it at once, while github's label list does not show it yet
func TestMergeAutoReadsABrakeLabelOnThePrBeforeTheListShowsIt(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.pages[repoPath+"/issues/7/labels"] = `[{"name":"` + brakeLabel + `"}]`

	got := w.run(t, "7")

	if msg := envelopeOf(got).Error; got.code == 0 || !strings.Contains(msg, "#7 wears the "+brakeLabel+" label") || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, error %q: want the brake on from the pr's own label\n%s", got.code, msg, got.stdout)
	}
}

// brakeOnFor lands a merge-auto merge and its git revert inside brakeNow's 7 days, so the brake is on; it returns the revert
func brakeOnFor(t *testing.T, w *mergeWorld) string {
	t.Helper()
	write(t, filepath.Join(w.seed, "merged.txt"), "an earlier pr\n")
	gitT(t, w.seed, "add", "merged.txt")
	merged := commitAt(t, w, "2026-10-17T12:00:00Z", "commit", "-q", "-m", "an earlier pr (#5)\n\nthe body\n\n"+mergeTrailer)
	return gitRevert(t, w, merged, "2026-10-18T12:00:00Z")
}

// commitAt lands a commit on seed's main at a fixed committer date and pushes it
func commitAt(t *testing.T, w *mergeWorld, date string, args ...string) string {
	t.Helper()
	gitT(t, w.seed, "switch", "-q", "main")
	c := exec.Command("git", append([]string{"-c", "commit.gpgsign=false"}, args...)...)
	c.Dir = w.seed
	c.Env = append(cleanEnv(), "GIT_COMMITTER_DATE="+date, "GIT_AUTHOR_DATE="+date)
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	gitT(t, w.seed, "push", "-q", "origin", "main")
	sha := gitT(t, w.seed, "rev-parse", "HEAD")
	gitT(t, w.seed, "switch", "-q", "codie/x")
	return sha
}

const brakeNow = "2026-10-22T12:00:00Z"

func TestMergeAutoBrakesForSevenDaysAfterARevertOfItsMerge(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		revertAt string
		revert   func(t *testing.T, w *mergeWorld, merged, at string) string
		brake    bool
	}{
		{"git revert 4 days ago", "2026-10-18T12:00:00Z", gitRevert, true},
		{"github's revert pr 6 days ago", "2026-10-16T12:00:00Z", githubRevert, true},
		{"git revert 8 days ago", "2026-10-14T11:59:00Z", gitRevert, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			write(t, filepath.Join(w.seed, "merged.txt"), "an earlier pr\n")
			gitT(t, w.seed, "add", "merged.txt")
			merged := commitAt(t, w, "2026-10-12T12:00:00Z", "commit", "-q", "-m", "an earlier pr (#5)\n\nthe body\n\n"+mergeTrailer)
			revert := c.revert(t, w, merged, c.revertAt)

			got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

			merges := w.hub.sent("PUT ")
			if !c.brake {
				if got.code != 0 || len(merges) != 1 {
					t.Fatalf("exit %d, %d merge calls, want the brake off after 7 days:\n%s", got.code, len(merges), got.stdout)
				}
				return
			}
			want := "wait: brake on, needs dima's word — " + short(revert)
			if got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want %q", got.code, len(merges), envelopeOf(got).Error, want)
			}
		})
	}
}

// a stack lands through github's async merge, which takes no message, so its squash carries no trailer;
// the brake finds it by the label merge-auto set on its pr
func TestMergeAutoBrakesAfterARevertOfALabelledMerge(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		revert func(t *testing.T, w *mergeWorld, merged, at string) string
	}{
		{"git revert", gitRevert},
		{"github's revert pr", githubRevert},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			write(t, filepath.Join(w.seed, "merged.txt"), "a stack layer\n")
			gitT(t, w.seed, "add", "merged.txt")
			merged := commitAt(t, w, "2026-10-17T12:00:00Z", "commit", "-q", "-m", "an earlier pr (#5)\n\nthe body")
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/commits/"+merged+"/pulls"] = `[{"number":5,"labels":[{"name":"` + mergedLabel + `"}]}]`
			w.hub.pages[repoPath+"/pulls/5"] = `{"number":5,"state":"closed","merged":true,"labels":[{"name":"` + mergedLabel + `"}]}`
			w.hub.mu.Unlock()
			revert := c.revert(t, w, merged, "2026-10-18T12:00:00Z")

			got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

			want := "wait: brake on, needs dima's word — " + short(revert)
			if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
				t.Fatalf("exit %d, error %q, want %q", got.code, envelopeOf(got).Error, want)
			}
		})
	}
}

// a hub page holding this answers 500
const serverDown = "<500>"

func TestMergeAutoRefusesWhenTheBrakeCannotAskGithub(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, filepath.Join(w.seed, "merged.txt"), "a stack layer\n")
	gitT(t, w.seed, "add", "merged.txt")
	merged := commitAt(t, w, "2026-10-17T12:00:00Z", "commit", "-q", "-m", "an earlier pr (#5)")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/commits/"+merged+"/pulls"] = serverDown
	w.hub.mu.Unlock()
	gitRevert(t, w, merged, "2026-10-18T12:00:00Z")

	got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

	if got.code == 0 || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, puts %q: want a refusal when the brake's lookup fails, never a merge\n%s", got.code, w.hub.sent("PUT "), got.stdout)
	}
}

func TestMergeAutoIgnoresARevertOfAHandMerge(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, filepath.Join(w.seed, "merged.txt"), "a hand merge\n")
	gitT(t, w.seed, "add", "merged.txt")
	merged := commitAt(t, w, "2026-10-20T12:00:00Z", "commit", "-q", "-m", "a hand merge (#4)")
	gitRevert(t, w, merged, "2026-10-21T12:00:00Z")

	got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want no brake for a merge merge-auto never made:\n%s", got.code, len(merges), got.stdout)
	}
}

func gitRevert(t *testing.T, w *mergeWorld, merged, at string) string {
	return commitAt(t, w, at, "revert", "--no-edit", merged)
}

// github's revert button squashes into `Revert "<subject>" (#n)`, the reverted sha nowhere in it
func githubRevert(t *testing.T, w *mergeWorld, _, at string) string {
	gitT(t, w.seed, "switch", "-q", "main")
	gitT(t, w.seed, "rm", "-q", "merged.txt")
	return commitAt(t, w, at, "commit", "-q", "-m", "Revert \"an earlier pr (#5)\" (#6)\n\nReverts o/r#5")
}

// a merge that landed another head than the gated one leaves its pr labelled; every next merge waits on it
func TestMergeAutoWaitsWhileAPrWearsTheBrakeLabel(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/issues"] = `[{"number":8,"labels":[{"name":"` + brakeLabel + `"}]}]`
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	want := "x lane merge-auto 8 --release-brake --dima-ok 8"
	if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(envelopeOf(got).Error, "brake on") || !strings.Contains(envelopeOf(got).Error, want) {
		t.Fatalf("exit %d, error %q, want the brake's wait naming #8 and %q", got.code, envelopeOf(got).Error, want)
	}
}

// a brake merge-auto cannot read must never read as off
func TestMergeAutoRefusesWhenTheBrakeLabelCannotBeRead(t *testing.T) {
	t.Parallel()
	for _, page := range []string{serverDown, ""} {
		w := newMergeWorld(t, "script/foo.ts")
		w.hub.mu.Lock()
		if page == "" {
			delete(w.hub.pages, repoPath+"/issues")
		} else {
			w.hub.pages[repoPath+"/issues"] = page
		}
		w.hub.mu.Unlock()

		got := w.run(t, "7", "--apply")

		if got.code == 0 || len(w.hub.sent("PUT ")) != 0 {
			t.Fatalf("issues page %q: exit %d, puts %q, want no merge while the brake label is unread", page, got.code, w.hub.sent("PUT "))
		}
	}
}

func TestMergeAutoReleasesTheBrakeOnDimasTypedWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/issues"] = `[{"number":8,"labels":[{"name":"` + brakeLabel + `"}]}]`
	w.hub.pages[repoPath+"/issues/8/labels/"+brakeLabel] = `[]`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply", "--release-brake", "--dima-ok", "8")

	if released := w.hub.sent("DELETE " + repoPath + "/issues/8/labels/" + brakeLabel); got.code != 0 || len(released) != 1 || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, deletes %q, puts %q: want the label removed and no merge:\n%s", got.code, released, w.hub.sent("PUT "), got.stdout)
	}
}

// the record names its pr; dima's typed release through the same door takes it off with the label
func TestMergeAutoReleaseClearsTheBrakesOwnRecord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	record := filepath.Join(w.state, "merge-brake", "o_r.json")
	write(t, record, `{"pr":"8","why":"merged a head its gate never read"}`)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/issues/8/labels/"+brakeLabel] = `[]`
	w.hub.mu.Unlock()

	held := w.run(t, "7", "--apply")
	got := w.run(t, "8", "--apply", "--release-brake", "--dima-ok", "8")

	if held.code != 1 || !strings.Contains(envelopeOf(held).Error, "brake on") {
		t.Fatalf("exit %d, error %q: want the record to hold #7", held.code, envelopeOf(held).Error)
	}
	if got.code != 0 || exists(record) {
		t.Fatalf("exit %d, record kept %v: want the release to take the record off\n%s", got.code, exists(record), got.stdout)
	}
}

// a release names its pr: another pr's record stays, and so does its brake
func TestMergeAutoReleaseKeepsAnotherPrsRecord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	record := filepath.Join(w.state, "merge-brake", "o_r.json")
	write(t, record, `{"pr":"8","why":"merged a head its gate never read"}`)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/issues/9/labels/"+brakeLabel] = `[]`
	w.hub.mu.Unlock()

	got := w.run(t, "9", "--apply", "--release-brake", "--dima-ok", "9")

	if got.code != 0 || !exists(record) {
		t.Fatalf("exit %d, record kept %v: want #9's release to leave #8's record\n%s", got.code, exists(record), got.stdout)
	}
}

// a record merge-auto cannot read never reads as off
func TestMergeAutoRefusesWhenTheBrakesOwnRecordIsUnreadable(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, filepath.Join(w.state, "merge-brake", "o_r.json"), "not json")

	got := w.run(t, "7", "--apply")

	if got.code == 0 || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, puts %q: want no merge while the brake record is unreadable", got.code, w.hub.sent("PUT "))
	}
}

func TestMergeAutoReleasesTheBrakeOnlyOnDimasWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")

	got := w.run(t, "8", "--apply", "--release-brake")

	if got.code != 2 || len(w.hub.sent("DELETE ")) != 0 || !strings.Contains(envelopeOf(got).Error, "only on dima's typed word") || got.next != "x lane merge-auto 8 --release-brake --dima-ok 8" {
		t.Fatalf("exit %d, deletes %q, error %q, next %q: want the refusal naming dima's word and the exact release", got.code, w.hub.sent("DELETE "), envelopeOf(got).Error, got.next)
	}
}

func TestMergeAutoBrakeOutranksDimasTypedWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	brakeOnFor(t, w)

	got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply", "--dima-ok", "7")

	if got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(envelopeOf(got).Error, "brake on") {
		t.Fatalf("exit %d, error %q, want the brake's wait over dima's typed word", got.code, envelopeOf(got).Error)
	}
}

func TestMergeAutoBrakeOutranksAPreApprovedSign(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "x/go/merge_auto.go")
	w.signs(t, "FRM-9", signedBody(signAbove, "merge: pre-approved\n", signAbove))
	revert := brakeOnFor(t, w)

	got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

	want := "wait: brake on, needs dima's word — " + short(revert)
	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
		t.Fatalf("exit %d, %d merge calls, error %q, want %q over the sign", got.code, len(merges), envelopeOf(got).Error, want)
	}
}

// the run and the merge result print the decision's summary: a lifted brake is one more line there
func TestMergeDecisionSummaryCarriesALiftedBrake(t *testing.T) {
	t.Parallel()
	d := &mergeDecision{Checks: []mergeCheck{{Name: "ci", OK: true, Detail: "green"}}, Override: &overrideUsed{Scope: "prs"}, Brake: "revert e4020ab reverts 3c83764"}

	got := d.summary()

	if want := "✓ ci: green\n⚠ brake lifted by operator-override prs: revert e4020ab reverts 3c83764"; got != want {
		t.Fatalf("summary %q, want %q", got, want)
	}
}
