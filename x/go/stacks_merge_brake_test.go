//go:build !nostacks

package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// github merged a head the gate never read: loud on stderr, and the brake goes on for every next merge
func TestMergeAutoBrakesWhenTheStackMergedAnotherHead(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	moved := strings.Repeat("d", 40)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + moved + `"}}`
	w.hub.mu.Unlock()

	c := exec.Command(xbin, "lane", "merge-auto", "8", "--apply")
	c.Dir = w.clone
	c.Env = append(append(cleanEnv(), "X_TEST=1"), w.env...)
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	code := exitOf(c.Run())

	labelled := w.hub.sent("POST " + repoPath + "/issues/8/labels")
	if code != 1 || !strings.Contains(stderr.String(), short(moved)) || !strings.Contains(stderr.String(), short(w.head)) {
		t.Fatalf("exit %d, stderr %q: want a loud mismatch naming %s and %s", code, stderr.String(), short(moved), short(w.head))
	}
	if !slices.ContainsFunc(labelled, func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
		t.Errorf("label calls %q, want #8 marked %s", labelled, brakeLabel)
	}
}

// the pending answer may be the only one naming the head github took; the poll's answer must not erase it
func TestMergeAutoBrakesOnTheHeadThePendingAnswerNamed(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async"] = `{"status":"pending","details":{"uuid":"u1","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":""}}`
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if got.code != 1 || !strings.Contains(envelopeOf(got).Error, "brake is on") {
		t.Fatalf("exit %d, error %q: want the pending answer's head mismatch to brake", got.code, envelopeOf(got).Error)
	}
}

// a mismatch whose label github refused still brakes: this mac's own record holds it, and the hand label step is named
func TestMergeAutoBrakesFromItsOwnRecordWhenTheLabelFailed(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	// the merged-by-x labels land before the merge; only the brake label after it fails
	w.hub.pages["labels:"+brakeLabel] = serverDown
	w.hub.mu.Unlock()

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "this mac's record") || got.next != "gh pr edit 8 --add-label "+brakeLabel {
		t.Fatalf("exit %d, error %q, next %q: want the brake on from the record and the hand label step", got.code, msg, got.next)
	}
	puts := len(w.hub.sent("PUT "))

	next := w.run(t, "7", "--apply")

	if msg := envelopeOf(next).Error; next.code != 1 || !strings.Contains(msg, "brake on") || !strings.Contains(msg, releaseBrake("8")) || len(w.hub.sent("PUT ")) != puts {
		t.Fatalf("exit %d, error %q: want the next merge held by the recorded brake, naming its release", next.code, msg)
	}
}

// github's answer named no head it took and did not say nothing merged, so the gated head is unverified: said on
// stderr, and the brake goes on
func TestMergeAutoBrakesWhenTheStackMergeNamesNoHead(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, answer string }{
		{"merged", `{"status":"merged","details":{"sha":"` + mergedSha + `"}}`},
		{"enqueued", `{"status":"enqueued","details":{}}`},
		{"still pending at the budget", `{"status":"pending","details":{"uuid":"u1"}}`},
		{"a status x does not know", `{"status":"queued","details":{}}`},
		{"a poll that failed", serverDown},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := linkedMergeWorld(t)
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = c.answer
			w.hub.mu.Unlock()

			cmd := exec.Command(xbin, "lane", "merge-auto", "8", "--apply")
			cmd.Dir = w.clone
			cmd.Env = append(append(cleanEnv(), "X_TEST=1", "X_FAKE_SLEEP=1"), w.env...)
			var stdout, stderr bytes.Buffer
			cmd.Stdout, cmd.Stderr = &stdout, &stderr
			code := exitOf(cmd.Run())

			labelled := w.hub.sent("POST " + repoPath + "/issues/8/labels")
			if code != 1 || !strings.Contains(stderr.String(), "unverified") || !slices.ContainsFunc(labelled, func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
				t.Fatalf("exit %d, stderr %q, label calls %q: want the merge called unverified and #8 marked %s", code, stderr.String(), labelled, brakeLabel)
			}
			if !strings.Contains(stdout.String(), releaseBrake("8")) {
				t.Errorf("want the release named as the next step\n%s", stdout.String())
			}
		})
	}
}

// a submit github answered with no 2xx may still have taken the merge, so the gated head is unverified and the brake
// goes on; only a 404, no async merge in the repo at all, takes nothing
func TestMergeAutoBrakesWhenTheStackMergeSubmitFails(t *testing.T) {
	t.Parallel()
	for _, answer := range []string{serverDown, "<status 422>", "<status 502>"} {
		t.Run(answer, func(t *testing.T) {
			w := linkedMergeWorld(t)
			w.hub.mu.Lock()
			w.hub.pages[repoPath+"/pulls/8/merge-async"] = answer
			w.hub.mu.Unlock()

			cmd := exec.Command(xbin, "lane", "merge-auto", "8", "--apply")
			cmd.Dir = w.clone
			cmd.Env = append(append(cleanEnv(), "X_TEST=1"), w.env...)
			var stdout, stderr bytes.Buffer
			cmd.Stdout, cmd.Stderr = &stdout, &stderr
			code := exitOf(cmd.Run())

			labelled := w.hub.sent("POST " + repoPath + "/issues/8/labels")
			if code != 1 || !strings.Contains(stderr.String(), "unverified") || !slices.ContainsFunc(labelled, func(call string) bool { return strings.Contains(call, `"`+brakeLabel+`"`) }) {
				t.Fatalf("exit %d, stderr %q, label calls %q: want the submit called unverified and #8 marked %s", code, stderr.String(), labelled, brakeLabel)
			}
			if !strings.Contains(stdout.String(), releaseBrake("8")) {
				t.Errorf("want the release named as the next step\n%s", stdout.String())
			}
		})
	}
}

// with the label refused and the record unwritable, nothing holds the brake: the message says so and names the hand step
func TestMergeAutoSaysTheBrakeIsOffWhenItsRecordFailedToo(t *testing.T) {
	t.Parallel()
	w := linkedMergeWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8/merge-async/u1"] = `{"status":"merged","details":{"sha":"` + mergedSha + `","expected_head_sha":"` + strings.Repeat("d", 40) + `"}}`
	w.hub.pages["labels:"+brakeLabel] = serverDown
	w.hub.mu.Unlock()
	// the record's dir reads as empty and takes no write
	dir := filepath.Join(w.state, "merge-brake")
	if err := os.MkdirAll(dir, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.Chmod(dir, 0o755) })

	got := w.run(t, "8", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "NOT on") || got.next != "gh pr edit 8 --add-label "+brakeLabel {
		t.Fatalf("exit %d, error %q, next %q: want the brake named off and the hand label step", got.code, msg, got.next)
	}
}
