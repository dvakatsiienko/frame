package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func holdRecordOf(w *mergeWorld) string { return filepath.Join(w.state, "merge-hold", "o_r.json") }

func plantHold(t *testing.T, w *mergeWorld, prs ...string) {
	t.Helper()
	raw, err := json.Marshal(map[string][]string{"prs": prs})
	if err != nil {
		t.Fatal(err)
	}
	write(t, holdRecordOf(w), string(raw))
}

func heldPrs(t *testing.T, w *mergeWorld) []string {
	t.Helper()
	raw, err := os.ReadFile(holdRecordOf(w))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		t.Fatal(err)
	}
	var note struct {
		PRs []string `json:"prs"`
	}
	if err := json.Unmarshal(raw, &note); err != nil {
		t.Fatal(err)
	}
	return note.PRs
}

func TestMergeAutoRefusesAHeldPrNamingTheHold(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	plantHold(t, w, "7")

	got := w.run(t, "7", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "held") || got.next != "x lane merge-auto 7 --apply --dima-ok 7" || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, error %q, next %q, puts %q: want no merge and a refusal naming the hold and his word", got.code, msg, got.next, w.hub.sent("PUT "))
	}
}

func TestMergeAutoTakesALandedPrsMarkOff(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	plantHold(t, w, "7", "9")

	got := w.run(t, "7", "--apply", "--dima-ok", "7")

	if got.code != 0 || len(w.hub.sent("PUT "+repoPath+"/pulls/7/merge")) != 1 {
		t.Fatalf("exit %d, puts %q: want his word to merge the held pr\n%s", got.code, w.hub.sent("PUT "), got.stdout)
	}
	if held := heldPrs(t, w); !slices.Equal(held, []string{"9"}) {
		t.Errorf("held %q, want only #9's mark left", held)
	}
}

// an env var in a real run would swap the record the gate reads, the way X_VERIFIED once swapped the clean store
func TestMergeAutoHonoursXStateForTheHoldOnlyUnderXTest(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	home := t.TempDir()
	write(t, filepath.Join(home, ".local/state/x/merge-hold/o_r.json"), `{"prs":["7"]}`)

	got := xIn(t, w.clone, append(w.env, "X_TEST=", "X_SYSTEM_HOME="+home, "HOME="+home), "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code == 0 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, "held") {
		t.Fatalf("exit %d, error %q, merges %q: want the real record read past X_STATE", got.code, envelopeOf(got).Error, merges)
	}
}

// a hold set after the plan read still stops the merge
func TestMergeAutoReadsAHoldSetAfterItsPlan(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.onRead = func(path string) {
		if strings.HasSuffix(path, "/pulls/7/files") {
			write(t, holdRecordOf(w), `{"prs":["7"]}`)
		}
	}

	got := w.run(t, "7", "--apply")

	if msg := envelopeOf(got).Error; got.code != 1 || len(w.hub.sent("PUT ")) != 0 || !strings.Contains(msg, "held") {
		t.Fatalf("exit %d, puts %q, error %q: want the late hold to stop the merge", got.code, w.hub.sent("PUT "), msg)
	}
}

func TestMergeAutoLeavesAPrWithNoMarkAlone(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	plantHold(t, w, "9")

	got := w.run(t, "7", "--apply")

	if got.code != 0 || len(w.hub.sent("PUT "+repoPath+"/pulls/7/merge")) != 1 {
		t.Fatalf("exit %d, puts %q: want another pr's mark to change nothing\n%s", got.code, w.hub.sent("PUT "), got.stdout)
	}
}

func TestMergeAutoReadsAnUnreadableMarkAsHeld(t *testing.T) {
	t.Parallel()
	for _, record := range []string{"not json", "null", `{"prs":null}`, `{"other":1}`} {
		t.Run(record, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			write(t, holdRecordOf(w), record)

			got := w.run(t, "7", "--apply")

			if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "unreadable") {
				t.Fatalf("exit %d, error %q: want a record with no list to read as held", got.code, msg)
			}
		})
	}
}

func TestMergeAutoLandsOverAnUnreadableMarkOnDimasWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, holdRecordOf(w), "not json")

	got := w.run(t, "7", "--apply")
	word := w.run(t, "7", "--apply", "--dima-ok", "7")

	if msg := envelopeOf(got).Error; got.code != 1 || !strings.Contains(msg, "unreadable") || !strings.Contains(msg, "held") {
		t.Fatalf("exit %d, error %q: want a failed read to read as held", got.code, msg)
	}
	if word.code != 0 || !strings.Contains(word.stdout, "unreadable") {
		t.Fatalf("exit %d: want his word to pass a mark that reads as held, and the bad record named\n%s", word.code, word.stdout)
	}
	if !exists(holdRecordOf(w)) {
		t.Errorf("the unreadable record went with a merge: only a release takes it")
	}
}

func TestMergeAutoHoldWritesTheMarkOnlyOnApply(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")

	dry := w.run(t, "7", "--hold")
	if dry.code != 4 || exists(holdRecordOf(w)) {
		t.Fatalf("exit %d, record %v: want exit 4 and no record before --apply", dry.code, exists(holdRecordOf(w)))
	}
	got := w.run(t, "7", "--hold", "--apply")
	if held := heldPrs(t, w); got.code != 0 || !slices.Equal(held, []string{"7"}) || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, held %q, puts %q: want #7 marked and no merge\n%s", got.code, held, w.hub.sent("PUT "), got.stdout)
	}
	if next := w.run(t, "7", "--apply"); next.code != 1 {
		t.Fatalf("exit %d: want the written mark to stop the merge", next.code)
	}
}

func TestMergeAutoHoldRefusesAPrThatIsNotOpen(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"state":"open","merged":false`, `"state":"closed","merged":true`, 1)
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--hold", "--apply")

	if got.code != 1 || exists(holdRecordOf(w)) {
		t.Fatalf("exit %d, record %v: want a merged pr refused and no record", got.code, exists(holdRecordOf(w)))
	}
}

func TestMergeAutoReleasesAHoldOnlyOnDimasWord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	plantHold(t, w, "7", "9")

	bare := w.run(t, "7", "--release-hold", "--apply")
	if bare.code != 2 || !slices.Equal(heldPrs(t, w), []string{"7", "9"}) || bare.next != "x lane merge-auto 7 --release-hold --dima-ok 7 --apply" {
		t.Fatalf("exit %d, held %q, next %q: want a refusal and the marks kept", bare.code, heldPrs(t, w), bare.next)
	}
	got := w.run(t, "7", "--release-hold", "--dima-ok", "7", "--apply")
	if got.code != 0 || !slices.Equal(heldPrs(t, w), []string{"9"}) || len(w.hub.sent("PUT ")) != 0 {
		t.Fatalf("exit %d, held %q, puts %q: want #7's mark off and no merge\n%s", got.code, heldPrs(t, w), w.hub.sent("PUT "), got.stdout)
	}
	if next := w.run(t, "7", "--apply"); next.code != 0 {
		t.Fatalf("exit %d: want the released pr to merge\n%s", next.code, next.stdout)
	}
}

func TestMergeAutoReleaseTakesAnUnreadableRecord(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, holdRecordOf(w), "not json")

	got := w.run(t, "7", "--release-hold", "--dima-ok", "7", "--apply")

	if got.code != 0 || exists(holdRecordOf(w)) {
		t.Fatalf("exit %d, record %v: want the release to take the unreadable record\n%s", got.code, exists(holdRecordOf(w)), got.stdout)
	}
}

func TestMergeAutoRefusesHoldAndReleaseTogether(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")

	got := w.run(t, "7", "--hold", "--release-hold", "--dima-ok", "7", "--apply")

	if got.code != 2 || exists(holdRecordOf(w)) {
		t.Fatalf("exit %d, record %v: want a usage refusal and no record", got.code, exists(holdRecordOf(w)))
	}
}

// X_TEST is an env var any Bash line can set: past it, a real binary would read the hold and the clean out of a dir the line names
func TestMergeAutoReleaseBuildIgnoresTheTestEnv(t *testing.T) {
	t.Parallel()
	bin := filepath.Join(t.TempDir(), "x-release")
	if out, err := exec.Command("go", "build", "-ldflags", "-X main.systemHomeAtBuild="+t.TempDir(), "-o", bin, ".").CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}
	release := func(w *mergeWorld, home string) (int, string) {
		c := exec.Command(bin, "lane", "merge-auto", "7", "--apply")
		c.Dir = w.clone
		c.Env = append(append(append(cleanEnv(), "X_TEST=1"), w.env...), "HOME="+home)
		var stdout bytes.Buffer
		c.Stdout = &stdout
		code := exitOf(c.Run())
		return code, stdout.String()
	}
	t.Run("a sign comes from the real linear, past X_LINEAR_URL", func(t *testing.T) {
		t.Parallel()
		w := newMergeWorld(t, "x/go/gh.go")
		w.env = append(w.env, "X_LINEAR_URL=http://127.0.0.1:1")

		code, stdout := release(w, t.TempDir())

		if merges := w.hub.sent("PUT "); code == 0 || len(merges) != 0 || !strings.Contains(stdout, "X_LINEAR_URL") {
			t.Fatalf("exit %d, merges %q: want a forged linear named, no sign read\n%s", code, merges, stdout)
		}
	})
	t.Run("the clean comes from the real store, past X_VERIFIED", func(t *testing.T) {
		t.Parallel()
		w := newMergeWorld(t, "script/foo.ts")

		code, stdout := release(w, t.TempDir())

		if merges := w.hub.sent("PUT "); code == 0 || len(merges) != 0 || !strings.Contains(stdout, "sixth") {
			t.Fatalf("exit %d, merges %q: want the planted clean ignored\n%s", code, merges, stdout)
		}
	})
}
