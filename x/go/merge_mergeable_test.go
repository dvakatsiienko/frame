package main

import (
	"strings"
	"testing"
	"time"
)

// the pr's own page with github's mergeable read swapped in; a missing field drops both keys
func withMergeable(page, mergeable, state string) string {
	fields := ""
	if mergeable != "" {
		fields += `"mergeable":` + mergeable + `,`
	}
	if state != "" {
		fields += `"mergeable_state":"` + state + `",`
	}
	return strings.Replace(page, `"mergeable":true,"mergeable_state":"clean",`, fields, 1)
}

func (w *mergeWorld) mergeableIs(n, mergeable, state string) {
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	w.hub.pages[repoPath+"/pulls/"+n] = withMergeable(w.hub.pages[repoPath+"/pulls/"+n], mergeable, state)
}

// exit lines 1 and 6: a state github would refuse waits before the merge call, naming the door that fixes it
func TestMergeAutoWaitsOnGithubsMergeableState(t *testing.T) {
	t.Parallel()
	for _, c := range []struct{ name, mergeable, state, says string }{
		{"a conflict with main", "false", "dirty", "conflicts with main → x lane merge-main"},
		{"branch protection", "true", "blocked", "github's branch protection holds it"},
		{"a draft", "true", "draft", "draft"},
		{"a hook", "true", "has_hooks", "has_hooks"},
		{"behind main", "true", "behind", "is behind main → x lane merge-main"},
		{"no state at all", "true", "", "no mergeable state"},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mergeableIs("7", c.mergeable, c.state)

			assertMergeableWait(t, w, "7", c.says)
		})
	}
}

func assertMergeableWait(t *testing.T, w *mergeWorld, n, says string) {
	t.Helper()
	got := w.run(t, n, "--apply")

	if merges := w.hub.sent("PUT "); got.code == 0 || len(merges) != 0 || !strings.Contains(got.stdout, says) {
		t.Fatalf("exit %d, %d merge calls, want a wait naming %q:\n%s", got.code, len(merges), says, got.stdout)
	}
	if !strings.Contains(got.stdout, "mergeable") {
		t.Errorf("the wait does not name the mergeable check:\n%s", got.stdout)
	}
}

// exit line 1: clean and unstable pass the row; unstable is only a check no branch rule requires
func TestMergeAutoMergesACleanOrUnstablePr(t *testing.T) {
	t.Parallel()
	for _, state := range []string{"clean", "unstable"} {
		t.Run(state, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			w.mergeableIs("7", "true", state)

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 {
				t.Fatalf("exit %d, %d merge calls, want one merge:\n%s", got.code, len(merges), got.stdout)
			}
		})
	}
}

// exit line 2: github computes mergeable after a push, so a null is read again on the fake clock, never a real wait
func TestMergeAutoReadsANullMergeableAgain(t *testing.T) {
	t.Parallel()
	// a known mergeable beside an unknown state is still github computing; each run takes 2 waits of 2 s, so a real sleep shows
	for _, mergeable := range []string{"null", "true"} {
		w := newMergeWorld(t, "script/foo.ts")
		w.mergeableIs("7", mergeable, "unknown")
		w.env = append(w.env, "X_FAKE_SLEEP=1")

		started := time.Now()
		got := w.run(t, "7", "--apply")
		// the tier reads the pr twice around its paths, then the mergeable read waits twice
		if reads := w.hub.reads[repoPath+"/pulls/7"]; got.code == 0 || !strings.Contains(got.stdout, "github is still computing") || reads != 4 {
			t.Fatalf("mergeable %s: exit %d, %d reads, want a wait «github is still computing» after 4 reads:\n%s", mergeable, got.code, reads, got.stdout)
		}
		if took := time.Since(started); took > 3*time.Second {
			t.Fatalf("mergeable %s: the run took %s, want the fake clock's waits, never a real sleep", mergeable, took)
		}
	}

	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.later = map[string]string{repoPath + "/pulls/7": w.hub.pages[repoPath+"/pulls/7"]}
	w.hub.mu.Unlock()
	w.mergeableIs("7", "null", "unknown")
	w.env = append(w.env, "X_FAKE_SLEEP=1")

	got := w.run(t, "7", "--apply")
	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want the second read's clean to merge:\n%s", got.code, len(merges), got.stdout)
	}
}

// exit line 3: ci's own wait outranks github's, since a pending required check is what blocked means here
func TestMergeAutoNamesCisWaitBeforeBranchProtection(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mergeableIs("7", "true", "blocked")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/commits/"+w.head+"/check-runs"] = `{"total_count":2,"check_runs":[
		{"name":"test","status":"in_progress","conclusion":null,"html_url":"https://ci/1"},
		{"name":"build","status":"completed","conclusion":"success","html_url":"https://ci/2"}]}`
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	// the mergeable row still reads, in the checks; the wait is the one reason that holds the merge
	if wait := envelopeOf(got).Data.Wait; got.code == 0 || strings.Contains(wait, "branch protection") || !strings.Contains(wait, "test is in_progress") {
		t.Fatalf("exit %d, wait %q, want ci's wait on test, never branch protection:\n%s", got.code, wait, got.stdout)
	}
}
