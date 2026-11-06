package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const dryNamed = "named.txt"

// a repo on a branch, so no ci job runs, holding the hook and one edit of a named path
func dryFixture(t *testing.T, hook string) (string, []string, string) {
	t.Helper()
	dir, env := gateFixture(t, hook)
	gitT(t, dir, "checkout", "-q", "-b", "codie/dry")
	write(t, filepath.Join(dir, dryNamed), "HEAD\n")
	gitT(t, dir, "add", dryNamed)
	gitT(t, dir, "commit", "-q", "-m", "named")
	write(t, filepath.Join(dir, dryNamed), "EDIT\n")
	return dir, env, message(t)
}

func TestCommitDryRedsTheGateACommitWould(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, hook, gate string }{
		{"a pre-commit gate", "pre-commit:\n  commands:\n    the-gate:\n      run: exit 1\n", "the-gate"},
		{"a commit-msg gate", "commit-msg:\n  commands:\n    the-gate:\n      run: exit 1\n", "the-gate"},
		{"a gate x cannot run", "pre-commit:\n  commands:\n    the-gate:\n      skip: merge\n      run: exit 0\n", "skip"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			dir, env, msg := dryFixture(t, c.hook)
			head := gitT(t, dir, "rev-parse", "HEAD")
			got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed)
			if got.code != 1 || !strings.Contains(got.stdout, c.gate) {
				t.Errorf("exit %d, want 1 naming %s:\n%s", got.code, c.gate, got.stdout)
			}
			if !strings.Contains(got.next, "--dry") {
				t.Errorf("a red's next move, %q, skips the dry run", got.next)
			}
			if gitT(t, dir, "rev-parse", "HEAD") != head {
				t.Error("a dry run moved HEAD")
			}
		})
	}
}

func TestCommitDryLeavesHeadAndTheIndexAsTheyWere(t *testing.T) {
	t.Parallel()
	dir, env, msg := dryFixture(t, `pre-commit:
  commands:
    bytes:
      run: script/index-run.sh sh -c 'grep -q EDIT named.txt && test ! -f peer.txt'
    only-speak:
      glob: "speak/**"
      run: exit 1
commit-msg:
  commands:
    edits:
      run: echo edited >> {1}
    reads-the-edit:
      run: grep -q edited {1}
`)
	write(t, filepath.Join(dir, "peer.txt"), "a peer's\n")
	gitT(t, dir, "add", "peer.txt")
	head, staged := gitT(t, dir, "rev-parse", "HEAD"), gitT(t, dir, "diff", "--cached", "--name-only")
	body := readFile(t, msg)

	got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed)

	if got.code != 0 {
		t.Fatalf("exit %d:\n%s", got.code, got.stdout)
	}
	want := map[string]string{"bytes": gateGreen, "only-speak": gateNoPath, "edits": gateGreen, "reads-the-edit": gateGreen}
	verdicts := verdictsOf(got)
	for name, verdict := range want {
		if verdicts[name] != verdict {
			t.Errorf("%s reads %q, want %q", name, verdicts[name], verdict)
		}
	}
	if gitT(t, dir, "rev-parse", "HEAD") != head {
		t.Error("a dry run moved HEAD")
	}
	if after := gitT(t, dir, "diff", "--cached", "--name-only"); after != staged {
		t.Errorf("the index moved: %q, was %q", after, staged)
	}
	if readFile(t, msg) != body {
		t.Error("a commit-msg gate edited the caller's message")
	}
}

// the real lefthook behind real hook shims, counting a gate that reads the index copy and one that does not
func dryOnRealLefthook(t *testing.T) (string, []string, string, func(string) int) {
	t.Helper()
	return realLefthookWith(t, "")
}

func realLefthookWith(t *testing.T, gate string) (string, []string, string, func(string) int) {
	t.Helper()
	dir, env, msg := dryFixture(t, `pre-commit:
  commands:
    suite:
      run: script/index-run.sh sh -c 'echo suite >> "$X_SUITE_RAN"'
    reads-the-tree:
      run: echo tree >> "$X_SUITE_RAN"
`+gate+`commit-msg:
  commands:
    msg:
      run: echo msg >> "$X_SUITE_RAN"
`)
	lefthook, err := filepath.Abs("../../node_modules/.bin/lefthook")
	if err != nil {
		t.Fatal(err)
	}
	for _, hook := range []string{"pre-commit", "commit-msg"} {
		write(t, filepath.Join(dir, ".git/hooks", hook), "#!/bin/sh\nexec "+lefthook+" run "+hook+" --no-auto-install \"$@\"\n")
	}
	return dir, env, msg, func(gate string) int {
		ran, _ := os.ReadFile(envValue(env, "X_SUITE_RAN"))
		n := 0
		for _, line := range nonBlank(string(ran)) {
			if line == gate {
				n++
			}
		}
		return n
	}
}

func TestCommitAfterAGreenDryRunsItsTestsNoSecondTime(t *testing.T) {
	t.Parallel()
	dir, env, msg, ran := dryOnRealLefthook(t)
	if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("dry: exit %d\n%s", got.code, got.stdout)
	}
	if got := xIn(t, dir, env, "lane", "commit", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	for gate, want := range map[string]int{"suite": 1, "tree": 2, "msg": 2} {
		if ran(gate) != want {
			t.Errorf("%s ran %d times, want %d", gate, ran(gate), want)
		}
	}
}

func TestCommitAfterADryOnOtherBytesRunsItsTests(t *testing.T) {
	t.Parallel()
	dir, env, msg, ran := dryOnRealLefthook(t)
	if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("dry: exit %d\n%s", got.code, got.stdout)
	}
	write(t, filepath.Join(dir, dryNamed), "OTHER\n")
	if got := xIn(t, dir, env, "lane", "commit", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if ran("suite") != 2 {
		t.Errorf("the suite ran %d times, want 2: other bytes run it again", ran("suite"))
	}
}

func TestCommitDryRunsAGlobLessGateOnADeleteOnlyCommit(t *testing.T) {
	t.Parallel()
	dir, env, msg := dryFixture(t, "pre-commit:\n  commands:\n    the-gate:\n      run: exit 1\n    a-glob:\n      glob: \"*.txt\"\n      run: exit 1\n    a-template:\n      run: echo {staged_files}\n")
	if err := os.Remove(filepath.Join(dir, dryNamed)); err != nil {
		t.Fatal(err)
	}
	got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed)
	if got.code != 1 || !strings.Contains(got.stdout, "the-gate") || strings.Contains(got.stdout, "a-glob (") {
		t.Errorf("exit %d, want 1 naming the-gate alone:\n%s", got.code, got.stdout)
	}
}

func TestCommitDryReadsTheIndexItOwnsPastAPeersLock(t *testing.T) {
	t.Parallel()
	dir, env, msg := dryFixture(t, "pre-commit:\n  commands:\n    g:\n      run: exit 0\n")
	write(t, filepath.Join(dir, ".git/index.lock"), "")
	if got := xIn(t, dir, append(env, "X_LOCK_WAIT=10ms"), "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
		t.Errorf("exit %d, a peer's lock on the real index stopped a dry run:\n%s", got.code, got.stdout)
	}
}

func TestCommitAfterAGateChangedRunsItAgain(t *testing.T) {
	t.Parallel()
	dir, env, msg, ran := dryOnRealLefthook(t)
	if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("dry: exit %d\n%s", got.code, got.stdout)
	}
	hook := readFile(t, filepath.Join(dir, "lefthook.yaml"))
	write(t, filepath.Join(dir, "lefthook.yaml"), strings.Replace(hook, "echo suite >>", "echo suite  >>", 1))
	if got := xIn(t, dir, env, "lane", "commit", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if ran("suite") != 2 {
		t.Errorf("the suite ran %d times, want 2: its run line changed since the green", ran("suite"))
	}
}

// a peer's commit lands while this commit waits out its lock: the same tree on another HEAD proves nothing
func TestCommitAfterAPeerMovedHeadRunsItsTests(t *testing.T) {
	t.Parallel()
	dir, env, msg, ran := dryOnRealLefthook(t)
	if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("dry: exit %d\n%s", got.code, got.stdout)
	}
	peer := gitT(t, dir, "commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "a peer's")
	lock := filepath.Join(dir, ".git/index.lock")
	write(t, lock, "")
	landed := make(chan error, 1)
	go func() {
		time.Sleep(500 * time.Millisecond)
		err := os.WriteFile(filepath.Join(dir, ".git/refs/heads/codie/dry"), []byte(peer+"\n"), 0o644)
		landed <- errors.Join(err, os.Remove(lock))
	}()
	got := xIn(t, dir, env, "lane", "commit", msg, "--", dryNamed)
	if err := <-landed; err != nil {
		t.Fatal(err)
	}
	if got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if ran("suite") != 2 {
		t.Errorf("the suite ran %d times, want 2: HEAD moved under the proof", ran("suite"))
	}
}

// a timeout-only red retries the commit; a peer's commit landed meanwhile, so the retry's tree carries no proof
func TestCommitRetryAfterAPeerMovedHeadRunsItsTests(t *testing.T) {
	t.Parallel()
	dir, env, msg, ran := realLefthookWith(t, `    test:
      run: |
        if [ -e "$X_ARM" ]; then
          git update-ref HEAD "$(cat "$X_ARM")"
          rm "$X_ARM"
          printf '(fail) a row [5002.31ms]\n  Error: timed out after 5000 ms\n'
          exit 1
        fi
`)
	arm := filepath.Join(t.TempDir(), "arm")
	env = append(env, "X_ARM="+arm)
	if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("dry: exit %d\n%s", got.code, got.stdout)
	}
	if ran("suite") != 1 {
		t.Fatalf("the dry run ran the suite %d times", ran("suite"))
	}
	write(t, arm, gitT(t, dir, "commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "a peer's")+"\n")
	if got := xIn(t, dir, env, "lane", "commit", msg, "--", dryNamed); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if ran("suite") != 2 {
		t.Errorf("the suite ran %d times, want 2: the retry sits on a HEAD no gate read", ran("suite"))
	}
}

func TestCommitDryRedsAPathARealCommitRefuses(t *testing.T) {
	t.Parallel()
	dir, env, msg := dryFixture(t, "pre-commit:\n  commands:\n    g:\n      run: exit 0\n")
	got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed, "no-such-path")
	if got.code != 1 || !strings.Contains(got.stdout, "no-such-path") {
		t.Errorf("exit %d, want 1 naming the path:\n%s", got.code, got.stdout)
	}
}

func TestCommitDryRefusesAHookItCannotMirror(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "lefthook.yaml"), "pre-commit:\n  jobs:\n    - name: a\n      run: exit 0\n")
	gitT(t, dir, "add", "lefthook.yaml")
	gitT(t, dir, "commit", "-q", "-m", "hook")
	write(t, filepath.Join(dir, "readme.txt"), "edited\n")
	got := xIn(t, dir, nil, "lane", "commit", "--dry", message(t), "--", "readme.txt")
	if got.code != 2 || !strings.Contains(got.stdout, "frame-shaped") {
		t.Errorf("exit %d, want 2 naming a frame-shaped hook:\n%s", got.code, got.stdout)
	}
}

func TestCommitAfterAGreenOverlayRunsItsTestsNoSecondTime(t *testing.T) {
	t.Parallel()
	dir, env, msg, ran := dryOnRealLefthook(t)
	edited(t, dir, env, modHooks, "export const register = () => 1;\n")
	testOverlay(t, dir, env)
	pushOverlay(t, dir, env)
	if got := xIn(t, dir, env, "lane", "commit", msg, "--", modHooks); got.code != 0 {
		t.Fatalf("commit: exit %d\n%s", got.code, got.stdout)
	}
	if ran("suite") != 1 {
		t.Errorf("the suite ran %d times, want 1", ran("suite"))
	}
}

func TestCommitDryRefusesWhatItCannotMirror(t *testing.T) {
	t.Parallel()
	for _, state := range []string{"CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge/head-name", "rebase-apply/next"} {
		t.Run(state, func(t *testing.T) {
			t.Parallel()
			dir, env, msg := dryFixture(t, "pre-commit:\n  commands:\n    g:\n      run: exit 0\n")
			write(t, filepath.Join(dir, ".git", state), "x\n")
			if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 2 {
				t.Errorf("exit %d, want 2:\n%s", got.code, got.stdout)
			}
		})
	}
	t.Run("--repo", func(t *testing.T) {
		t.Parallel()
		dir, env, msg := dryFixture(t, "pre-commit:\n  commands:\n    g:\n      run: exit 0\n")
		if got := xIn(t, dir, env, "lane", "commit", "--dry", "--repo", dir, msg, "--", dryNamed); got.code != 2 {
			t.Errorf("exit %d, want 2:\n%s", got.code, got.stdout)
		}
	})
	t.Run("mid-merge", func(t *testing.T) {
		t.Parallel()
		dir, env, msg := dryFixture(t, "pre-commit:\n  commands:\n    g:\n      run: exit 0\n")
		write(t, filepath.Join(dir, ".git/MERGE_HEAD"), gitT(t, dir, "rev-parse", "HEAD")+"\n")
		if got := xIn(t, dir, env, "lane", "commit", "--dry", msg, "--", dryNamed); got.code != 2 {
			t.Errorf("exit %d, want 2:\n%s", got.code, got.stdout)
		}
	})
}
