//go:build !nostacks

package main

import (
	"strings"
	"testing"
	"time"
)

func TestPrOpenWithBaseOpensOntoTheLayerBelow(t *testing.T) {
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "coder/FRM-1-a", "part 2", bodyFile(t))

	calls := strings.TrimSpace(read(t, log))
	if got.code != 0 || !strings.HasPrefix(calls, "ghs_coder pr create --base coder/FRM-1-a --head coder/FRM-1-a-2 ") || strings.Contains(calls, "\n") {
		t.Fatalf("exit %d, gh calls %q, want one pr create onto coder/FRM-1-a\n%s", got.code, calls, got.stdout)
	}
}

// a gh with the gh-stack extension: FAKE_NO_STACK leaves it uninstalled, view answers for three layers
const ghStack = `'extension list'*) if [ -z "$FAKE_NO_STACK" ]; then printf 'gh stack\tgithub/gh-stack\tv0.0.6\n'; fi ;;
'stack link'*) n=$(cat "$FAKE_DIR/n" 2>/dev/null || echo 0); n=$((n + 1)); echo $n > "$FAKE_DIR/n"
	code=$(echo "$FAKE_EXITS" | cut -d' ' -f$n); code=${code:-$(echo "$FAKE_EXITS" | awk '{print $NF}')}
	case "$code" in
	7) echo "a rebase operation is already in progress (/repo/.git/worktrees/w2/gh-stack-rebase-state)" >&2
		echo "Operation started in worktree /trees/w2"
		echo 'Run ` + "`gh stack rebase --continue` or `gh stack rebase --abort`" + ` before another mutation' ;;
	8) echo "could not acquire stack lock" >&2 ;;
	9) echo "Stacked PRs are not enabled for this repository" >&2 ;;
	esac
	exit "${code:-0}" ;;
'stack view --json'*) echo '{"trunk":"main","currentBranch":"coder/FRM-1-a-3","branches":[
	{"name":"coder/FRM-1-a","pr":{"number":11,"state":"OPEN"}},
	{"name":"coder/FRM-1-a-2","pr":{"number":12,"state":"OPEN"}},
	{"name":"coder/FRM-1-a-3","pr":{"number":13,"state":"OPEN"}}]}' ;;
'stack'*) echo "fake gh-stack: unexpected $*" >&2; exit 1 ;;`

func TestStackLinkLinksTheLayersBottomUp(t *testing.T) {
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env, log := ghRecorder(t, ghStack)

	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

	var links []string
	for line := range strings.Lines(read(t, log)) {
		if strings.Contains(line, " stack link ") {
			links = append(links, strings.TrimSpace(line))
		}
	}
	if want := "ghs_coder stack link coder/FRM-1-a coder/FRM-1-a-2 coder/FRM-1-a-3"; got.code != 0 || len(links) != 1 || links[0] != want {
		t.Fatalf("exit %d, stack link calls %q, want [%q]\n%s", got.code, links, want, got.stdout)
	}
}

func TestStackViewPrintsTheLayersInOrder(t *testing.T) {
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2", "coder/FRM-1-a-3")
	env, _ := ghRecorder(t, ghStack)

	got := xIn(t, clone, env, "lane", "stack", "view")

	a, b, c := strings.Index(got.stdout, `"coder/FRM-1-a"`), strings.Index(got.stdout, "coder/FRM-1-a-2"), strings.Index(got.stdout, "coder/FRM-1-a-3")
	if got.code != 0 || a < 0 || !(a < b && b < c) {
		t.Fatalf("exit %d, want the 3 layers bottom-up:\n%s", got.code, got.stdout)
	}
}

func TestStackVerbsWithoutTheExtensionNameTheInstall(t *testing.T) {
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	env, log := ghRecorder(t, ghStack)
	env = append(env, "FAKE_NO_STACK=1")

	for _, argv := range [][]string{{"lane", "stack", "link", "--apply"}, {"lane", "stack", "view"}} {
		t.Run(argv[2], func(t *testing.T) {
			got := xIn(t, clone, env, argv...)

			if got.code == 0 || !strings.Contains(got.stdout, "gh extension install github/gh-stack") {
				t.Fatalf("exit %d, want a failure naming the install:\n%s", got.code, got.stdout)
			}
		})
	}
	if strings.Contains(read(t, log), " stack ") {
		t.Errorf("gh stack ran without the extension:\n%s", read(t, log))
	}
}

// linkWith runs stack link --apply on a 2-layer stack whose gh stack link exits as exits lists, the
// last code repeating; sleeps run on the test clock. it returns the run and how many links ran
func linkWith(t *testing.T, exits string) (ran, int) {
	t.Helper()
	clone := layers(t, "coder/FRM-1-a", "coder/FRM-1-a-2")
	env, log := ghRecorder(t, ghStack)
	env = append(env, "FAKE_DIR="+t.TempDir(), "FAKE_EXITS="+exits, "X_FAKE_SLEEP=1")
	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")
	return got, strings.Count(read(t, log), " stack link ")
}

func TestStackLinkRetriesAHeldLock(t *testing.T) {
	got, calls := linkWith(t, "8 8 0")

	if got.code != 0 || calls != 3 {
		t.Fatalf("exit %d after %d links, want success on the 3rd\n%s", got.code, calls, got.stdout)
	}
}

func TestStackLinkGivesUpOnTheLockAfterTwoMinutes(t *testing.T) {
	start := time.Now()
	got, calls := linkWith(t, "8")

	if got.code == 0 || !strings.Contains(got.stdout, "lock") || !strings.Contains(got.stdout, "2m0s") || calls < 4 {
		t.Fatalf("exit %d after %d links, want a failure naming the lock and its 2m0s budget\n%s", got.code, calls, got.stdout)
	}
	if took := time.Since(start); took > 30*time.Second {
		t.Errorf("took %s: the budget ran on the wall clock, not the test clock", took)
	}
}

func TestStackLinkRefusesAPausedRebaseAtOnce(t *testing.T) {
	got, calls := linkWith(t, "7")

	for _, want := range []string{"/trees/w2", "gh stack rebase --continue", "gh stack rebase --abort"} {
		if got.code == 0 || calls != 1 || !strings.Contains(got.stdout, want) {
			t.Fatalf("exit %d after %d links, want 1 call and a refusal naming %q\n%s", got.code, calls, want, got.stdout)
		}
	}
}

func TestStackLinkRefusesARepoWithoutStacksAtOnce(t *testing.T) {
	got, calls := linkWith(t, "9")

	if got.code == 0 || calls != 1 || !strings.Contains(got.stdout, "origin.git") {
		t.Fatalf("exit %d after %d links, want 1 call and a refusal naming the repo\n%s", got.code, calls, got.stdout)
	}
}

func TestMergeAutoMergesAStackBottomUp(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/pulls/8"] = `{"number":8,"title":"part 2","state":"open","merged":false,"body":"b",
		"head":{"sha":"` + w.head + `","ref":"coder/x-2"},"base":{"ref":"coder/x"}}`
	w.hub.pages[repoPath+"/pulls"] = `[{"number":9,"head":{"ref":"coder/y"}},{"number":7,"head":{"ref":"coder/x"}}]`
	w.hub.mu.Unlock()

	upper := w.run(t, "8", "--apply")

	if upper.code == 0 || !strings.Contains(upper.stdout, "#7") || len(w.hub.sent("PUT")) != 0 {
		t.Fatalf("upper layer: exit %d, merges %q, want a wait naming #7 and no merge\n%s", upper.code, w.hub.sent("PUT"), upper.stdout)
	}

	lower := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge"); lower.code != 0 || len(merges) != 1 {
		t.Fatalf("lower layer: exit %d, merges %q, want #7 merged\n%s", lower.code, merges, lower.stdout)
	}
}

func TestPrOpenRefusesABaseMissingFromOrigin(t *testing.T) {
	clone := layers(t, "coder/FRM-1-a")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "--base", "coder/FRM-1-gone", "part 2", bodyFile(t))

	if got.code == 0 || !strings.Contains(got.stdout, "coder/FRM-1-gone") || exists(log) {
		t.Fatalf("exit %d, want a refusal naming the missing base and no gh call\n%s", got.code, got.stdout)
	}
}
