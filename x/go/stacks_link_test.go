//go:build !nostacks

package main

import (
	"strings"
	"testing"
	"time"
)

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
'stack'*) echo "fake gh-stack: unexpected $*" >&2; exit 1 ;;`

// github's side of a linked stack: the open prs, and the stacks api answering for the pr it is asked about
func stackGithub(t *testing.T, clone string, stacks string) []string {
	t.Helper()
	onGithub(t, clone)
	pages := map[string]string{repoPath + "/pulls": `[{"number":11,"head":{"ref":"codie/FRM-1-a"}},{"number":12,"head":{"ref":"codie/FRM-1-a-2"}},
		{"number":13,"head":{"ref":"codie/FRM-1-a-3"}},{"number":21,"head":{"ref":"codie/FRM-1-v-2"}},{"number":22,"head":{"ref":"codie/FRM-1-v-2-2"}}]`}
	if stacks != "" {
		pages[repoPath+"/stacks"] = stacks
	}
	server, _ := fakeGithub(t, pages)
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"})
	return []string{"X_GITHUB_URL=" + server.URL, "X_KEYS=" + keys}
}

// the clone's origin reads as github.com/o/r and still fetches from the bare fixture
func onGithub(t *testing.T, clone string) {
	t.Helper()
	origin := gitT(t, clone, "remote", "get-url", "origin")
	gitT(t, clone, "remote", "set-url", "origin", "https://github.com/o/r.git")
	gitT(t, clone, "config", "url."+origin+".insteadOf", "https://github.com/o/r.git")
}

const linkedStack = `[{"number":4,"base":{"ref":"main"},"pull_requests":[
	{"number":11,"state":"closed","merged_at":"2026-10-23T10:00:00Z","head":{"ref":"codie/FRM-1-a"}},
	{"number":12,"state":"open","head":{"ref":"codie/FRM-1-a-2"}},
	{"number":13,"state":"open","head":{"ref":"codie/FRM-1-a-3"}}]}]`

// linkEnv is a gh with the extension plus github answering the layers' prs
func linkEnv(t *testing.T, clone string) (env []string, log string) {
	t.Helper()
	env, log = ghRecorder(t, ghStack)
	return append(env, stackGithub(t, clone, "")...), log
}

// by pr number: gh stack link pushes every branch it is named, and a frame worktree's push dies
func TestStackLinkLinksTheLayersBottomUp(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	env, log := linkEnv(t, clone)

	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

	var links []string
	for line := range strings.Lines(read(t, log)) {
		if strings.Contains(line, " stack link ") {
			links = append(links, strings.TrimSpace(line))
		}
	}
	if want := "ghs_coder stack link 11 12 13"; got.code != 0 || len(links) != 1 || links[0] != want {
		t.Fatalf("exit %d, stack link calls %q, want [%q]\n%s", got.code, links, want, got.stdout)
	}
}

// gh-stack's own view reads a local file its link never writes, so view asks github's stacks api
func TestStackViewPrintsTheStackGithubHolds(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	env := stackGithub(t, clone, linkedStack)

	got := xIn(t, clone, env, "lane", "stack", "view")

	a, b, c := strings.Index(got.stdout, `"codie/FRM-1-a"`), strings.Index(got.stdout, `"codie/FRM-1-a-2"`), strings.Index(got.stdout, `"codie/FRM-1-a-3"`)
	if got.code != 0 || a < 0 || !(a < b && b < c) || !strings.Contains(got.stdout, `"pr":13`) {
		t.Fatalf("exit %d, want the 3 layers bottom-up with their prs:\n%s", got.code, got.stdout)
	}
}

func TestStackViewOfAPrInNoStackNamesLink(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	env := stackGithub(t, clone, `[]`)

	got := xIn(t, clone, env, "lane", "stack", "view")

	if got.code == 0 || !strings.Contains(got.stdout, "#13") || got.next != "x lane stack link --apply" {
		t.Fatalf("exit %d, next %q, want a failure naming #13 and the link verb\n%s", got.code, got.next, got.stdout)
	}
}

func TestStackViewOnARepoWithoutStacksSaysSo(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	env := stackGithub(t, clone, "")

	got := xIn(t, clone, env, "lane", "stack", "view")

	if got.code == 0 || !strings.Contains(got.stdout, "stacks api answered 404 for o/r") {
		t.Fatalf("exit %d, want a refusal naming the 404 and the repo\n%s", got.code, got.stdout)
	}
}

func TestStackViewShowsAMergedLayerAsMerged(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2", "codie/FRM-1-a-3")
	env := stackGithub(t, clone, linkedStack)

	got := xIn(t, clone, env, "lane", "stack", "view", "--board")

	if got.code != 0 || !strings.Contains(sgr.ReplaceAllString(got.stdout, ""), "codie/FRM-1-a #11 merged") {
		t.Fatalf("exit %d, want #11 shown merged:\n%s", got.code, got.stdout)
	}
}

func TestStackLinkWithoutTheExtensionNamesTheInstall(t *testing.T) {
	t.Parallel()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2")
	env, log := linkEnv(t, clone)
	env = append(env, "FAKE_NO_STACK=1")

	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

	if got.code == 0 || !strings.Contains(got.stdout, "gh extension install github/gh-stack") || strings.Contains(read(t, log), " stack ") {
		t.Fatalf("exit %d, want a failure naming the install and no gh stack call:\n%s", got.code, got.stdout)
	}
}

// gh stack link exits as exits lists, the last code repeating; it returns the run and the link count
func linkWith(t *testing.T, exits string) (ran, int) {
	t.Helper()
	clone := layers(t, "codie/FRM-1-a", "codie/FRM-1-a-2")
	env, log := linkEnv(t, clone)
	env = append(env, "FAKE_DIR="+t.TempDir(), "FAKE_EXITS="+exits, "X_FAKE_SLEEP=1")
	got := xIn(t, clone, env, "lane", "stack", "link", "--apply")
	return got, strings.Count(read(t, log), " stack link ")
}

func TestStackLinkRetriesAHeldLock(t *testing.T) {
	t.Parallel()
	got, calls := linkWith(t, "8 8 0")

	if got.code != 0 || calls != 3 {
		t.Fatalf("exit %d after %d links, want success on the 3rd\n%s", got.code, calls, got.stdout)
	}
}

func TestStackLinkGivesUpOnTheLockAfterTwoMinutes(t *testing.T) {
	t.Parallel()
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
	t.Parallel()
	got, calls := linkWith(t, "7")

	for _, want := range []string{"/trees/w2", "gh stack rebase --continue", "gh stack rebase --abort"} {
		if got.code == 0 || calls != 1 || !strings.Contains(got.stdout, want) {
			t.Fatalf("exit %d after %d links, want 1 call and a refusal naming %q\n%s", got.code, calls, want, got.stdout)
		}
	}
}

func TestStackLinkRefusesARepoWithoutStacksAtOnce(t *testing.T) {
	t.Parallel()
	got, calls := linkWith(t, "9")

	if got.code == 0 || calls != 1 || !strings.Contains(got.stdout, "not enabled for o/r") {
		t.Fatalf("exit %d after %d links, want 1 call and a refusal naming the repo\n%s", got.code, calls, got.stdout)
	}
}

func TestStackLinkReadsTheLayersOnOrigin(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, from string
		branches   []string
		want       string
	}{
		{"a slug ending in a number stays its own root", "codie/FRM-1-v-2", []string{"codie/FRM-1-v-2", "codie/FRM-1-v-2-2"}, "21 22"},
		{"one layer is no stack", "codie/FRM-1-a", []string{"codie/FRM-1-a"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			clone := layers(t, c.branches...)
			gitT(t, clone, "switch", "-q", c.from)
			env, log := linkEnv(t, clone)

			got := xIn(t, clone, env, "lane", "stack", "link", "--apply")

			calls := ""
			if exists(log) {
				calls = read(t, log)
			}
			if c.want == "" && (got.code == 0 || !strings.Contains(got.stdout, "2 layers") || strings.Contains(calls, "stack link")) {
				t.Fatalf("exit %d, want a refusal naming 2 layers and no link\n%s", got.code, got.stdout)
			}
			if c.want != "" && (got.code != 0 || !strings.Contains(calls, "stack link "+c.want+"\n")) {
				t.Fatalf("exit %d, want one link of %q\n%s\n%s", got.code, c.want, got.stdout, calls)
			}
		})
	}
}
