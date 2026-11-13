package main

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

// a fixture of the main checkout: a bare origin, a clone on main holding the shim and a tiny x/go whose marker.txt is
// what a fake `go` bakes into the binary it «builds», so a run prints which tree it was built from
type pushedWorld struct {
	base, origin, tree, calls, gitCalls string
	env                                 []string
}

const fakeGo = `#!/bin/sh
echo "$PWD" >> "$GO_CALLS"
case "$PWD" in *x-pushed*) [ -n "$GO_FAIL_PUSHED" ] && exit 1 ;; esac
sleep "${GO_SLEEP:-0}"
out=
while [ $# -gt 0 ]; do [ "$1" = "-o" ] && out=$2; shift; done
printf '#!/bin/sh\necho %s\n' "$(cat marker.txt)" > "$out"
chmod +x "$out"
`

func newPushedWorld(t *testing.T) pushedWorld {
	t.Helper()
	base, _ := filepath.EvalSymlinks(t.TempDir())
	w := pushedWorld{base: base, origin: filepath.Join(base, "origin.git"), tree: filepath.Join(base, "main"), calls: filepath.Join(base, "calls"), gitCalls: filepath.Join(base, "git-calls")}
	gitT(t, base, "init", "-q", "--bare", "-b", "main", w.origin)
	gitT(t, base, "init", "-q", "-b", "main", w.tree)
	shim, err := os.ReadFile("../bin/x")
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(w.tree, "x/bin/x"), string(shim))
	write(t, filepath.Join(w.tree, "x/go/go.mod"), "module x\n")
	write(t, filepath.Join(w.tree, "x/go/marker.txt"), "pushed-v1\n")
	write(t, filepath.Join(w.tree, ".gitignore"), "x/go/bin/\n")
	realGit, err := exec.LookPath("git")
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(base, "bin/go"), fakeGo)
	write(t, filepath.Join(base, "bin/git"), "#!/bin/sh\necho \"$@\" >> \"$GIT_CALLS\"\nexec "+realGit+" \"$@\"\n")
	for _, file := range []string{filepath.Join(w.tree, "x/bin/x"), filepath.Join(base, "bin/go"), filepath.Join(base, "bin/git")} {
		if err := os.Chmod(file, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	gitT(t, w.tree, "add", ".")
	gitT(t, w.tree, "commit", "-q", "-m", "x")
	gitT(t, w.tree, "remote", "add", "origin", w.origin)
	gitT(t, w.tree, "push", "-q", "origin", "main")
	// the source older than any binary built after it, as fakeTree does: the shim's newer-than test reads mtimes
	past := time.Now().Add(-2 * time.Minute)
	_ = os.Chtimes(filepath.Join(w.tree, "x/go/go.mod"), past, past)
	if err := os.MkdirAll(filepath.Join(base, "tmp"), 0o755); err != nil {
		t.Fatal(err)
	}
	w.env = []string{"PATH=" + filepath.Join(base, "bin") + ":" + os.Getenv("PATH"), "GO_CALLS=" + w.calls, "GIT_CALLS=" + w.gitCalls, "HOME=" + t.TempDir(), "TMPDIR=" + filepath.Join(base, "tmp")}
	return w
}

// an unpushed commit on x/go: the main checkout now reads dev
func (w pushedWorld) goDev(t *testing.T) {
	t.Helper()
	write(t, filepath.Join(w.tree, "x/go/marker.txt"), "local-v2\n")
	gitT(t, w.tree, "commit", "-q", "-am", "unpushed")
}

// a push from another clone moves origin/main's x/go, and the main checkout learns of it by a fetch
func (w pushedWorld) originMoves(t *testing.T, marker string) {
	t.Helper()
	other := filepath.Join(w.base, "other-"+marker)
	gitT(t, w.base, "clone", "-q", w.origin, other)
	write(t, filepath.Join(other, "x/go/marker.txt"), marker+"\n")
	gitT(t, other, "commit", "-q", "-am", "push "+marker)
	gitT(t, other, "push", "-q", "origin", "main")
	gitT(t, w.tree, "fetch", "-q", "origin")
}

type shimRun struct {
	out, errs string
	err       error
}

// run starts the shim of the main checkout from cwd, under a 5 s limit a caller never exceeds
func (w pushedWorld) run(t *testing.T, cwd string, env ...string) shimRun {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	c := exec.CommandContext(ctx, filepath.Join(w.tree, "x/bin/x"))
	var out, errs bytes.Buffer
	c.Dir, c.Stdout, c.Stderr = cwd, &out, &errs
	c.Env = append(append(slices.DeleteFunc(cleanEnv(), func(pair string) bool { return strings.HasPrefix(pair, "X_DEV=") }), w.env...), env...)
	err := c.Run()
	return shimRun{strings.TrimSpace(out.String()), errs.String(), err}
}

func (w pushedWorld) pushedBuilds(t *testing.T) int {
	t.Helper()
	return strings.Count(readFile(t, w.calls), "x-pushed")
}

func (w pushedWorld) allBuilds(t *testing.T) int {
	t.Helper()
	return strings.Count(readFile(t, w.calls), "\n")
}

// waitFor polls a file until it holds want, ending the wait at ten seconds
func waitFor(t *testing.T, path, want string) {
	t.Helper()
	for deadline := time.Now().Add(10 * time.Second); time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
		if strings.TrimSpace(readFile(t, path)) == want {
			return
		}
	}
	t.Fatalf("%s never held %q: %q", path, want, readFile(t, path))
}

func (w pushedWorld) pushedTree(t *testing.T) string {
	t.Helper()
	return strings.TrimSpace(gitT(t, w.tree, "rev-parse", "origin/main:x/go"))
}

func (w pushedWorld) stamp() string { return filepath.Join(w.tree, "x/go/bin/x-pushed.stamp") }

// FRM-624 exit 1: the main checkout reading dev runs the build of origin/main's x/go; the first call, with none built yet,
// runs the working tree's build with one stderr line and starts the pushed one
func TestShimRunsThePushedBuildWhileTheMainCheckoutReadsDev(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)
	w.goDev(t)

	first := w.run(t, w.tree)
	waitFor(t, w.stamp(), w.pushedTree(t))
	for deadline := time.Now().Add(10 * time.Second); exists(filepath.Join(w.tree, "x/go/bin/.x-pushed.lock")) && time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
	}
	second := w.run(t, w.base)

	if left, _ := os.ReadDir(filepath.Join(w.base, "tmp")); len(left) != 0 {
		t.Errorf("the build left %d entries in its temp dir", len(left))
	}
	if first.out != "local-v2" || strings.Count(first.errs, "no pushed build yet") != 1 {
		t.Errorf("the first call: %q, stderr %q, want the working tree's build with one line", first.out, first.errs)
	}
	if second.out != "pushed-v1" || second.errs != "" {
		t.Errorf("the second call: %q, stderr %q, want the pushed build, quiet", second.out, second.errs)
	}
}

// FRM-624 exit 2: X_DEV=1 runs the working tree's build and builds no pushed one
func TestShimXDevRunsTheWorkingTreeBuild(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)
	w.goDev(t)

	got := w.run(t, w.tree, "X_DEV=1")

	if got.out != "local-v2" || w.allBuilds(t) != 1 || exists(w.stamp()) {
		t.Errorf("%q after %d builds, want the working tree's build and no pushed one", got.out, w.allBuilds(t))
	}
}

// FRM-624 exit 3: a worktree with its own x/go edit runs its own build, as today
func TestShimRunsAWorktreesOwnEdit(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)
	w.goDev(t)
	tree := filepath.Join(w.base, "wt")
	gitT(t, w.tree, "worktree", "add", "-q", "-b", "wt-branch", tree)
	write(t, filepath.Join(tree, "x/go/marker.txt"), "wt-edit\n")

	got := w.run(t, tree)

	if got.out != "wt-edit" || exists(w.stamp()) || strings.Contains(got.errs, "pushed") {
		t.Errorf("%q, stderr %q, want the worktree's own build and no pushed one", got.out, got.errs)
	}
}

// FRM-624 exit 4: the main checkout not dev does what it did: one binary, no pushed build
func TestShimLeavesAMainCheckoutThatIsNotDevAlone(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)

	got := w.run(t, w.tree)
	_ = os.Remove(w.gitCalls)
	again := w.run(t, w.base)

	if exists(w.gitCalls) {
		t.Errorf("a main checkout not dev ran git on a call that needed no rebuild: %q", readFile(t, w.gitCalls))
	}
	if got.out != "pushed-v1" || again.out != "pushed-v1" || w.allBuilds(t) != 1 || exists(w.stamp()) || exists(filepath.Join(w.tree, "x/go/bin/x-pushed")) {
		t.Errorf("%q, %q after %d builds, want one working-tree build and no x-pushed", got.out, again.out, w.allBuilds(t))
	}
}

// FRM-624 exit 5: a push moves origin/main's x/go, and the next calls rebuild the pushed binary once, running the last meanwhile
func TestShimRebuildsThePushedBuildOnceWhenOriginMoves(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)
	w.goDev(t)
	w.run(t, w.tree)
	waitFor(t, w.stamp(), w.pushedTree(t))
	w.originMoves(t, "pushed-v3")

	meanwhile := w.run(t, w.base, "GO_SLEEP=1")
	alsoMeanwhile := w.run(t, w.base, "GO_SLEEP=1")
	waitFor(t, w.stamp(), w.pushedTree(t))
	after := w.run(t, w.base)

	if meanwhile.out != "pushed-v1" || alsoMeanwhile.out != "pushed-v1" || after.out != "pushed-v3" || w.pushedBuilds(t) != 2 {
		t.Errorf("%q, %q, then %q after %d pushed builds, want the old build twice, the new one after, two builds in all", meanwhile.out, alsoMeanwhile.out, after.out, w.pushedBuilds(t))
	}
}

// FRM-624 exit 0: five shells at once right after a push start one build, and every one returns inside its limit
func TestShimFiveShellsAtOnceStartOneBuild(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)
	w.goDev(t)
	w.run(t, w.tree)
	waitFor(t, w.stamp(), w.pushedTree(t))
	w.originMoves(t, "pushed-v3")

	var wg sync.WaitGroup
	results := make([]shimRun, 5)
	for i := range results {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i] = w.run(t, w.base, "GO_SLEEP=1")
		}()
	}
	wg.Wait()
	waitFor(t, w.stamp(), w.pushedTree(t))

	for i, got := range results {
		if got.err != nil || (got.out != "pushed-v1" && got.out != "pushed-v3") {
			t.Errorf("shell %d: %v, %q", i, got.err, got.out)
		}
	}
	if w.pushedBuilds(t) != 2 {
		t.Errorf("%d pushed builds in all, want the first one and one for the push", w.pushedBuilds(t))
	}
}

// FRM-624 exit 6: a failing pushed build leaves the last pushed binary running with one stderr line, never a second try for the
// same tree; with none built, the working tree's build runs with one line naming it
func TestShimFallsBackWhenThePushedBuildFails(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, want, line string
		hasLast          bool
	}{
		{"a last pushed build exists", "pushed-v1", "running the last pushed build", true},
		{"none was ever built", "local-v2", "running the working tree's build", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newPushedWorld(t)
			w.goDev(t)
			if c.hasLast {
				w.run(t, w.tree)
				waitFor(t, w.stamp(), w.pushedTree(t))
				w.originMoves(t, "pushed-v3")
			}
			w.run(t, w.base, "GO_FAIL_PUSHED=1")
			waitFor(t, filepath.Join(w.tree, "x/go/bin/x-pushed.failed"), w.pushedTree(t))
			before := w.pushedBuilds(t)

			got := w.run(t, w.base, "GO_FAIL_PUSHED=1")

			if got.out != c.want || strings.Count(got.errs, "x: ") != 1 || !strings.Contains(got.errs, c.line) || w.pushedBuilds(t) != before {
				t.Errorf("%q, stderr %q, %d→%d pushed builds, want %q, one line holding %q, no new build", got.out, got.errs, before, w.pushedBuilds(t), c.want, c.line)
			}
		})
	}
}

// a lock older than 5 min (a build killed mid-way) is taken over, and a fresh one is left to its holder
func TestShimTakesOverAStaleLockOnly(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name   string
		age    time.Duration
		builds int
	}{
		{"a lock older than 5 min", 6 * time.Minute, 1},
		{"a fresh lock", time.Minute, 0},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newPushedWorld(t)
			w.goDev(t)
			w.run(t, w.tree)
			waitFor(t, w.stamp(), w.pushedTree(t))
			w.originMoves(t, "pushed-v3")
			lock := filepath.Join(w.tree, "x/go/bin/.x-pushed.lock")
			if err := os.MkdirAll(lock, 0o755); err != nil {
				t.Fatal(err)
			}
			old := time.Now().Add(-c.age)
			_ = os.Chtimes(lock, old, old)
			before := w.pushedBuilds(t)

			got := w.run(t, w.base, "GO_SLEEP=1")
			time.Sleep(500 * time.Millisecond)

			if got.out != "pushed-v1" || w.pushedBuilds(t)-before != c.builds {
				t.Errorf("%q, %d new pushed builds, want the last build and %d", got.out, w.pushedBuilds(t)-before, c.builds)
			}
		})
	}
}

// origin/main unreadable: the last pushed build runs with one line, or the working tree's with one line when none was built
func TestShimWithOriginUnreadableFallsBackWithOneLine(t *testing.T) {
	t.Parallel()
	for _, c := range []struct {
		name, want, line string
		hasLast          bool
	}{
		{"a last pushed build exists", "pushed-v1", "running the last pushed build", true},
		{"none was ever built", "local-v2", "running the working tree's build", false},
	} {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newPushedWorld(t)
			w.goDev(t)
			if c.hasLast {
				w.run(t, w.tree)
				waitFor(t, w.stamp(), w.pushedTree(t))
			}
			// origin/main moves to a child of the pushed commit that holds no x/go: a dev tree whose pushed x/go cannot be read
			pushed := strings.TrimSpace(gitT(t, w.tree, "rev-parse", "HEAD~1"))
			bare := strings.TrimSpace(gitT(t, w.tree, "commit-tree", "4b825dc642cb6eb9a060e54bf8d69288fbee4904", "-p", pushed, "-m", "no x/go"))
			gitT(t, w.tree, "update-ref", "refs/remotes/origin/main", bare)
			// a dev tree is read again, not served from the dev stamp, once its source moves
			now := time.Now()
			_ = os.Chtimes(filepath.Join(w.tree, "x/go/go.mod"), now.Add(time.Hour), now.Add(time.Hour))

			got := w.run(t, w.base)

			if got.out != c.want || !strings.Contains(got.errs, "origin/main is unreadable") || !strings.Contains(got.errs, c.line) {
				t.Errorf("%q, stderr %q, want %q and a line holding %q", got.out, got.errs, c.want, c.line)
			}
		})
	}
}

// a failed build of one tree is retried after 10 min, not before
func TestShimRetriesAFailedPushedBuildAfterTenMinutes(t *testing.T) {
	t.Parallel()
	w := newPushedWorld(t)
	w.goDev(t)
	w.run(t, w.base, "GO_FAIL_PUSHED=1")
	failed := filepath.Join(w.tree, "x/go/bin/x-pushed.failed")
	waitFor(t, failed, w.pushedTree(t))
	before := w.pushedBuilds(t)
	old := time.Now().Add(-11 * time.Minute)
	_ = os.Chtimes(failed, old, old)

	w.run(t, w.base)
	waitFor(t, w.stamp(), w.pushedTree(t))

	if w.pushedBuilds(t) != before+1 {
		t.Errorf("%d pushed builds after the retry, want %d", w.pushedBuilds(t), before+1)
	}
}
