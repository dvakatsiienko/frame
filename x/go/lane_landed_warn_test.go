package main

import (
	"path/filepath"
	"strings"
	"testing"
)

func warnSet(rules ...string) string {
	lines := "const WARN_ONLY: ReadonlySet<string> = new Set([\n"
	for _, rule := range rules {
		lines += "    '" + rule + "',\n"
	}
	return lines + "]);\nconst other = new Set(['not-a-rule']);\n"
}

// a pr off a repo whose warn-only set holds older-rule: base, head and origin/main as the case says
func warnWorld(t *testing.T, head, main []string) (landedWorld, []string) {
	t.Helper()
	w := newLandedWorld(t)
	w.done(t)
	commit := func(rules []string, say string) string {
		write(t, filepath.Join(w.repo, warnOnlyFile), warnSet(rules...))
		gitT(t, w.repo, "add", warnOnlyFile)
		gitT(t, w.repo, "commit", "-q", "--allow-empty", "-m", say)
		return gitT(t, w.repo, "rev-parse", "HEAD")
	}
	base := commit([]string{"older-rule"}, "base")
	headSha := commit(head, "the pr")
	mainSha := commit(main, "main at the land")
	gitT(t, w.repo, "update-ref", "refs/remotes/origin/main", mainSha)
	gitT(t, w.repo, "remote", "add", "origin", "https://github.com/o/r.git")
	// a fetch stays on this machine: the fixture's origin answers from the repo itself
	gitT(t, w.repo, "config", "url."+w.repo+".insteadOf", "https://github.com/o/r.git")
	return w, warnEnv(t, w, base, headSha)
}

func warnEnv(t *testing.T, w landedWorld, base, head string) []string {
	t.Helper()
	server, _ := fakeGithub(t, map[string]string{repoPath + "/pulls/7": `{"merged":true,"body":"- ticket: FRM-1","head":{"ref":"codie/FRM-1-a","sha":"` + head + `"},"base":{"sha":"` + base + `"}}`})
	keys := keysFixture(t, map[string]string{
		"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder",
		"keychain:x-token-linear-codie:x":  farFuture + ":tok-codie",
		"keychain:x-token-linear-clio:x":   farFuture + ":tok-clio",
	})
	return []string{"X_KEYS=" + keys, "X_GITHUB_URL=" + server.URL, "X_LINEAR_URL=" + w.server.URL, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.repo, stubPnpm(t)}
}

func TestLandedRedsARuleThePrLeftWarnOnly(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name       string
		head, main []string
		wants      []string
		absent     []string
	}{
		{name: "the pr's rule still listed reds", head: []string{"older-rule", "new-rule"}, main: []string{"older-rule", "new-rule"},
			wants: []string{"🔴 warn-only", "new-rule"}, absent: []string{"older-rule"}},
		{name: "the pr's rule removed since is green", head: []string{"older-rule", "new-rule"}, main: []string{"older-rule"},
			wants: []string{"✅ warn-only", "new-rule"}, absent: []string{"🔴 warn-only"}},
		{name: "a pr that added none prints nothing", head: []string{"older-rule"}, main: []string{"older-rule", "someone-elses"},
			absent: []string{"warn-only"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w, env := warnWorld(t, c.head, c.main)

			out := runAs(t, env, "lane", "landed", "FRM-1", "--repo", w.repo, "--pr", "7").stdout
			for _, want := range c.wants {
				if !strings.Contains(out, want) {
					t.Errorf("want %q in:\n%s", want, out)
				}
			}
			for _, not := range c.absent {
				if strings.Contains(out, not) {
					t.Errorf("want no %q in:\n%s", not, out)
				}
			}
		})
	}
}

func TestLandedRedsWhenTheWarnOnlySetCannotBeRead(t *testing.T) {
	t.Parallel()
	w, _ := warnWorld(t, []string{"older-rule"}, []string{"older-rule"})
	gone := "0000000000000000000000000000000000000000"

	got := runAs(t, warnEnv(t, w, gone, gone), "lane", "landed", "FRM-1", "--repo", w.repo, "--pr", "7")

	if out := got.stdout; !strings.Contains(out, "🔴 warn-only") {
		t.Fatalf("want a red line when the set does not read:\n%s", out)
	}
}
