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
