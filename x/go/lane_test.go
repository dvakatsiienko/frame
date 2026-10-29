package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/cgi"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// a repo outside any frame tree: the lane verbs must work in any git repo
func repo(t *testing.T) string {
	t.Helper()
	dir, _ := filepath.EvalSymlinks(t.TempDir())
	gitT(t, dir, "init", "-q", "-b", "main")
	write(t, filepath.Join(dir, "readme.txt"), "one\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "seed")
	return dir
}

func gitT(t *testing.T, dir string, args ...string) string {
	t.Helper()
	c := exec.Command("git", append([]string{"-c", "user.name=fixture", "-c", "user.email=fixture@example.com", "-c", "commit.gpgsign=false"}, args...)...)
	c.Dir = dir
	c.Env = cleanEnv()
	out, err := c.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	return strings.TrimSpace(string(out))
}

// a commit hook exports GIT_DIR and friends; a fixture repo must not inherit them
func cleanEnv() []string {
	var kept []string
	for _, pair := range filterEnv(os.Environ()) {
		if !strings.HasPrefix(pair, "GIT_") {
			kept = append(kept, pair)
		}
	}
	return append(kept, "GIT_AUTHOR_NAME=fixture", "GIT_AUTHOR_EMAIL=fixture@example.com",
		"GIT_COMMITTER_NAME=fixture", "GIT_COMMITTER_EMAIL=fixture@example.com", "GIT_CONFIG_COUNT=1",
		"GIT_CONFIG_KEY_0=commit.gpgsign", "GIT_CONFIG_VALUE_0=false", "X_TRACE=0")
}

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
}

func message(t *testing.T) string {
	path := filepath.Join(t.TempDir(), "msg.txt")
	write(t, path, "fixture commit\n")
	return path
}

type ran struct {
	code   int
	stdout string
	data   map[string]any
	next   string
}

func xIn(t *testing.T, dir string, env []string, args ...string) ran {
	t.Helper()
	c := exec.Command(xbin, args...)
	c.Dir = dir
	c.Env = append(append(cleanEnv(), "X_TEST=1"), env...)
	var stdout bytes.Buffer
	c.Stdout = &stdout
	code := exitOf(c.Run())
	var envelope struct {
		Data map[string]any `json:"data"`
		Next string         `json:"next"`
	}
	_ = json.Unmarshal(stdout.Bytes(), &envelope)
	return ran{code, stdout.String(), envelope.Data, envelope.Next}
}

func TestCommitReadsPathsFromTheRootInASubdir(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "sub/keep.txt"), "")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "sub")
	write(t, filepath.Join(dir, "readme.txt"), "from a subdir\n")

	got := xIn(t, filepath.Join(dir, "sub"), nil, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 || gitT(t, dir, "status", "--porcelain") != "" {
		t.Fatalf("exit %d, status %q", got.code, gitT(t, dir, "status", "--porcelain"))
	}
}

func TestCommitOnRepoMainTakesOnlyTheNamedPaths(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "readme.txt"), "two\n")
	write(t, filepath.Join(target, "other.txt"), "untouched\n")

	got := xIn(t, repo(t), nil, "lane", "commit", "--repo", target, message(t), "--", "readme.txt")

	if got.code != 0 || got.data["sha"] != gitT(t, target, "rev-parse", "HEAD") {
		t.Fatalf("exit %d, data %v", got.code, got.data)
	}
	if status := gitT(t, target, "status", "--porcelain"); status != "?? other.txt" {
		t.Errorf("status %q, want only other.txt left", status)
	}
}

func TestCommitRefusesARepoItMustNotTouch(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		setup func(t *testing.T, dir string)
		exit  int
	}{
		{"not a git repo", nil, 2},
		{"a branch other than main", func(t *testing.T, dir string) { gitT(t, dir, "switch", "-q", "-c", "side") }, 1},
		{"mid-merge", func(t *testing.T, dir string) {
			write(t, filepath.Join(dir, ".git/MERGE_HEAD"), gitT(t, dir, "rev-parse", "HEAD")+"\n")
		}, 1},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			target, _ := filepath.EvalSymlinks(t.TempDir())
			before := ""
			if tc.setup != nil {
				target = repo(t)
				tc.setup(t, target)
				before = gitT(t, target, "rev-parse", "HEAD")
			}
			write(t, filepath.Join(target, "readme.txt"), "two\n")

			got := xIn(t, repo(t), nil, "lane", "commit", "--repo", target, message(t), "--", "readme.txt")

			if got.code != tc.exit {
				t.Errorf("exit %d, want %d", got.code, tc.exit)
			}
			if before != "" && gitT(t, target, "rev-parse", "HEAD") != before {
				t.Error("HEAD moved")
			}
		})
	}
}

func TestCommitFormatsTheNamedPathsWithTheRepoBiome(t *testing.T) {
	t.Parallel()
	biome, _ := filepath.Abs("../../node_modules/.bin/biome")
	if _, err := os.Stat(biome); err != nil {
		t.Skip("no biome in this tree: pnpm install")
	}
	dir := repo(t)
	write(t, filepath.Join(dir, "biome.json"), "{}\n")
	if err := os.MkdirAll(filepath.Join(dir, "node_modules/.bin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(biome, filepath.Join(dir, "node_modules/.bin/biome")); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(dir, "a.ts"), "const  a = {b:1}\n")

	got := xIn(t, dir, nil, "lane", "commit", message(t), "--", "a.ts")

	if body := gitT(t, dir, "show", "HEAD:a.ts"); got.code != 0 || body != "const a = { b: 1 };" {
		t.Fatalf("exit %d, committed %q", got.code, body)
	}
}

// a `claude` on PATH that logs its arguments and passes or fails its validate as told
func fakeClaude(t *testing.T, valid bool) (env []string, log string) {
	bin := t.TempDir()
	log = filepath.Join(bin, "calls.log")
	verdict := "exit 0"
	if !valid {
		verdict = "echo 'Validation failed'; exit 1"
	}
	write(t, filepath.Join(bin, "claude"), "#!/bin/sh\necho \"$@\" >> \""+log+"\"\n"+verdict+"\n")
	return []string{"PATH=" + bin + ":" + os.Getenv("PATH")}, log
}

func TestCommitValidatesTheModANamedPathSitsIn(t *testing.T) {
	t.Parallel()
	const path = "home/.claude/plugin-x/mods/m/hooks.ts"
	for _, valid := range []bool{true, false} {
		dir := repo(t)
		write(t, filepath.Join(dir, "home/.claude/plugin-x/mods/m/.claude-plugin/plugin.json"), `{ "name": "m" }`+"\n")
		write(t, filepath.Join(dir, path), "export {};\n")
		before := gitT(t, dir, "rev-parse", "HEAD")
		env, log := fakeClaude(t, valid)

		got := xIn(t, dir, env, "lane", "commit", message(t), "--", path)

		calls, _ := os.ReadFile(log)
		if strings.TrimSpace(string(calls)) != "plugin validate home/.claude/plugin-x/mods/m" {
			t.Errorf("valid=%v: claude called with %q", valid, calls)
		}
		if valid && got.code != 0 {
			t.Errorf("a valid mod was refused: exit %d", got.code)
		}
		if !valid && (got.code != 1 || gitT(t, dir, "rev-parse", "HEAD") != before || gitT(t, dir, "diff", "--cached", "--name-only") != "") {
			t.Errorf("an invalid mod got through: exit %d", got.code)
		}
	}
}

// a hand-made worktree of a git-crypt repo with the smudge filter off, so the secret stays ciphertext
func lockedWorktree(t *testing.T) string {
	if _, err := exec.LookPath("git-crypt"); err != nil {
		t.Skip("git-crypt is not installed")
	}
	dir := repo(t)
	c := exec.Command("git-crypt", "init")
	c.Dir, c.Env = dir, cleanEnv()
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("git-crypt init: %v\n%s", err, out)
	}
	write(t, filepath.Join(dir, ".gitattributes"), "secret.txt filter=git-crypt diff=git-crypt\n")
	write(t, filepath.Join(dir, "secret.txt"), "plaintext\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "secret")
	tree := filepath.Join(t.TempDir(), "tree")
	gitT(t, dir, "-c", "filter.git-crypt.smudge=cat", "-c", "filter.git-crypt.required=false", "worktree", "add", "-q", tree, "-b", "side")
	tree, _ = filepath.EvalSymlinks(tree)
	return tree
}

func TestCommitRefusesCiphertextAndNamesUnlock(t *testing.T) {
	t.Parallel()
	tree := lockedWorktree(t)
	write(t, filepath.Join(tree, "readme.txt"), "two\n")

	got := xIn(t, tree, nil, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 1 || got.next != "x lane unlock" {
		t.Fatalf("exit %d, next %q", got.code, got.next)
	}
}

func TestCommitGatesOnTheCiJobsOnlyOnMain(t *testing.T) {
	t.Parallel()
	goTest := func(pass bool) string {
		if pass {
			return "package m\n\nimport \"testing\"\n\nfunc TestM(t *testing.T) {}\n"
		}
		return "package m\n\nimport \"testing\"\n\nfunc TestM(t *testing.T) { t.Fatal(\"red\") }\n"
	}
	cases := []struct {
		name, branch, path string
		plant              map[string]string
		commits            bool
	}{
		{"a red go test refuses", "main", "mod/m.go", map[string]string{"mod/m_test.go": goTest(false)}, false},
		{"a green go test commits", "main", "mod/m.go", map[string]string{"mod/m_test.go": goTest(true)}, true},
		{"a red typecheck refuses", "main", "src/a.ts", map[string]string{"package.json": `{"scripts":{"typecheck":"exit 1","test":"exit 0"}}`}, false},
		{"a red vitest refuses", "main", "src/a.ts", map[string]string{"package.json": `{"scripts":{"typecheck":"exit 0","test":"exit 1"}}`}, false},
		{"a pr branch skips the jobs", "coder/x", "mod/m.go", map[string]string{"mod/m_test.go": goTest(false)}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := repo(t)
			write(t, filepath.Join(dir, "mod/go.mod"), "module m\n\ngo 1.21\n")
			for path, body := range c.plant {
				write(t, filepath.Join(dir, path), body)
			}
			gitT(t, dir, "add", ".")
			gitT(t, dir, "commit", "-q", "-m", "plant")
			if c.branch != "main" {
				gitT(t, dir, "switch", "-q", "-c", c.branch)
			}
			before := gitT(t, dir, "rev-parse", "HEAD")
			body := "export const a = 1\n"
			if strings.HasSuffix(c.path, ".go") {
				body = "package m\n"
			}
			write(t, filepath.Join(dir, c.path), body)

			got := xIn(t, dir, nil, "lane", "commit", message(t), "--", c.path)

			if moved := gitT(t, dir, "rev-parse", "HEAD") != before; moved != c.commits || (got.code == 0) != c.commits {
				t.Fatalf("committed %v, exit %d, want committed %v\n%s", moved, got.code, c.commits, got.stdout)
			}
		})
	}
}

func TestCommitOnMainLeavesToThePreCommitTheJobsItRuns(t *testing.T) {
	t.Parallel()
	const (
		both    = "pre-commit:\n  commands:\n    typecheck:\n      run: script/index-run.sh pnpm typecheck\n    test:\n      run: script/index-run.sh pnpm test\npre-push:\n  commands:\n    t:\n      run: pnpm test\n"
		turbo   = "pre-commit:\n  jobs:\n    - name: typecheck-changed\n      run: pnpm turbo typecheck --filter='...[origin/main]'\n"
		neither = "pre-commit:\n  commands:\n    # pnpm typecheck and pnpm test moved to pre-push\n    format:\n      run: pnpm exec biome check {staged_files}\n    mods:\n      run: pnpm mods:test\npre-push:\n  commands:\n    t:\n      run: pnpm typecheck && pnpm test\n"
		wired   = "#!/bin/sh\ncall_lefthook() { :; }\ncall_lefthook run \"pre-commit\" \"$@\"\n"
		other   = "#!/bin/sh\nexit 0\n"
		mention = "#!/bin/sh\n# a lefthook shim, once\nexit 0\n"
		notExec = "chmod-x:"
	)
	cases := []struct {
		name, config, hook, path, env string
		want                          []string
	}{
		{"frame's pre-commit runs both", both, wired, "src/a.ts", "", nil},
		{"a pre-commit running neither", neither, wired, "src/a.ts", "", []string{"typecheck", "test"}},
		{"a turbo typecheck keeps test", turbo, wired, "src/a.ts", "", []string{"test"}},
		{"no hook installed", both, "", "src/a.ts", "", []string{"typecheck", "test"}},
		{"a hook not wired to lefthook", both, other, "src/a.ts", "", []string{"typecheck", "test"}},
		{"a hook that only mentions lefthook", both, mention, "src/a.ts", "", []string{"typecheck", "test"}},
		{"a hook git skips, no exec bit", both, notExec + wired, "src/a.ts", "", []string{"typecheck", "test"}},
		{"lefthook switched off in the env", both, wired, "src/a.ts", "LEFTHOOK=0", []string{"typecheck", "test"}},
		{"a go path runs go test either way", both, wired, "mod/m.go", "", []string{"go"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := repo(t)
			write(t, filepath.Join(dir, "mod/go.mod"), "module m\n\ngo 1.21\n")
			write(t, filepath.Join(dir, "mod/m_test.go"), "package m\n\nimport (\n\t\"os\"\n\t\"testing\"\n)\n\nfunc TestM(t *testing.T) { _ = os.WriteFile(\"../go.ran\", nil, 0o644) }\n")
			write(t, filepath.Join(dir, "package.json"), `{"scripts":{"typecheck":"touch typecheck.ran","test":"touch test.ran"}}`)
			write(t, filepath.Join(dir, "lefthook.yaml"), c.config)
			write(t, filepath.Join(dir, ".gitignore"), "*.ran\n")
			gitT(t, dir, "add", ".")
			gitT(t, dir, "commit", "-q", "-m", "plant")
			if hook, plain := strings.CutPrefix(c.hook, notExec); c.hook != "" {
				path := filepath.Join(dir, ".git/hooks/pre-commit")
				write(t, path, hook)
				if plain {
					_ = os.Chmod(path, 0o644)
				}
			}
			body := "export const a = 1\n"
			if strings.HasSuffix(c.path, ".go") {
				body = "package m\n"
			}
			write(t, filepath.Join(dir, c.path), body)

			got := xIn(t, dir, []string{"GIT_CONFIG_GLOBAL=/dev/null", c.env}, "lane", "commit", message(t), "--", c.path)

			var ran []string
			for _, job := range []string{"typecheck", "test", "go"} {
				if exists(filepath.Join(dir, job+".ran")) {
					ran = append(ran, job)
				}
			}
			if got.code != 0 || !slices.Equal(ran, c.want) {
				t.Fatalf("exit %d, jobs run %q, want %q\n%s", got.code, ran, c.want, got.stdout)
			}
		})
	}
}

// a repo whose rules file holds one of dima's quotes, then the commit's message and the quote edited
func quotedRules(t *testing.T, msg string) (dir string, got ran) {
	t.Helper()
	dir = repo(t)
	write(t, filepath.Join(dir, "rules/a.md"), "# r\n\n- keep it, dima: «checks belong at commit»\n- a plain line\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "seed")
	write(t, filepath.Join(dir, "rules/a.md"), "# r\n\n- keep it, dima: «checks belong anywhere»\n- a plain line\n")
	file := filepath.Join(t.TempDir(), "msg.txt")
	write(t, file, msg)
	return dir, xIn(t, dir, nil, "lane", "commit", file, "--", "rules/a.md")
}

func TestCommitStopsAChangedQuoteOfDimas(t *testing.T) {
	t.Parallel()
	dir, got := quotedRules(t, "📜 rules: reword\n")

	if got.code == 0 || !strings.Contains(got.stdout, "«checks belong at commit»") || gitT(t, dir, "log", "-1", "--format=%s") != "seed" {
		t.Fatalf("exit %d, want a refusal naming the gone quote and no commit\n%s", got.code, got.stdout)
	}
}

func TestCommitTakesAChangedQuoteOnceShown(t *testing.T) {
	t.Parallel()
	dir, got := quotedRules(t, "📜 rules: reword\n\nquotes: shown\n")

	if got.code != 0 || !strings.Contains(gitT(t, dir, "log", "-1", "--format=%s"), "reword") {
		t.Fatalf("exit %d, want the commit with quotes: shown\n%s", got.code, got.stdout)
	}
}

func TestCommitTakesANewMemoryFile(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "rules/new.md"), "- dima: «a fresh quote»\n")

	got := xIn(t, dir, nil, "lane", "commit", message(t), "--", "rules/new.md")

	if got.code != 0 {
		t.Fatalf("exit %d, want a new rules file committed: HEAD holds no quote it could lose\n%s", got.code, got.stdout)
	}
}

func TestCommitStopsAQuoteChangedInARenamedFile(t *testing.T) {
	t.Parallel()
	dir := repo(t)
	write(t, filepath.Join(dir, "rules/a.md"), "- his word: «keep this line exactly as he said»\n")
	gitT(t, dir, "add", ".")
	gitT(t, dir, "commit", "-q", "-m", "seed")
	gitT(t, dir, "mv", "rules/a.md", "rules/b.md")
	write(t, filepath.Join(dir, "rules/b.md"), "- his word: «keep this line roughly as he said»\n")

	// a user's diff.renames reads the move as one new file; the gate must not care
	renames := []string{"GIT_CONFIG_COUNT=2", "GIT_CONFIG_KEY_1=diff.renames", "GIT_CONFIG_VALUE_1=true"}
	got := xIn(t, dir, renames, "lane", "commit", message(t), "--", "rules/a.md", "rules/b.md")

	if got.code == 0 || !strings.Contains(got.stdout, "«keep this line exactly as he said»") {
		t.Fatalf("exit %d, want the renamed file's changed quote named\n%s", got.code, got.stdout)
	}
}

func TestCommitStopsAQuoteGoneByDelete(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, path string }{{"the file named", "rules/a.md"}, {"its dir named", "rules"}}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			dir := repo(t)
			write(t, filepath.Join(dir, "rules/a.md"), "- dima: «checks belong at commit»\n")
			gitT(t, dir, "add", ".")
			gitT(t, dir, "commit", "-q", "-m", "seed")
			_ = os.Remove(filepath.Join(dir, "rules/a.md"))

			got := xIn(t, dir, nil, "lane", "commit", message(t), "--", c.path)

			if got.code == 0 || !strings.Contains(got.stdout, "«checks belong at commit»") {
				t.Fatalf("exit %d, want the deleted quote named\n%s", got.code, got.stdout)
			}
		})
	}
}

func TestUnlockTurnsCiphertextBackIntoPlaintext(t *testing.T) {
	t.Parallel()
	tree := lockedWorktree(t)

	got := xIn(t, tree, nil, "lane", "unlock")

	if body, _ := os.ReadFile(filepath.Join(tree, "secret.txt")); got.code != 0 || string(body) != "plaintext\n" {
		t.Fatalf("exit %d, secret.txt %q", got.code, body)
	}
}

// flakyRemote serves a bare repo over smart http through git's own http-backend, answering
// the first `fails` push requests (receive-pack) with `status` instead; the plan's ls-remote
// and the verify read pass untouched
func flakyRemote(t *testing.T, status, fails int) (string, *atomic.Int32) {
	t.Helper()
	root := t.TempDir()
	gitT(t, root, "init", "-q", "--bare", "remote.git")
	gitT(t, filepath.Join(root, "remote.git"), "config", "http.receivepack", "true")
	gitBin, err := exec.LookPath("git")
	if err != nil {
		t.Fatal(err)
	}
	backend := &cgi.Handler{Path: gitBin, Args: []string{"http-backend"}, InheritEnv: []string{"PATH"},
		Env: []string{"GIT_PROJECT_ROOT=" + root, "GIT_HTTP_EXPORT_ALL=1"}}
	var pushes atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if strings.Contains(req.URL.String(), "receive-pack") && pushes.Add(1) <= int32(fails) {
			w.WriteHeader(status)
			return
		}
		backend.ServeHTTP(w, req)
	}))
	t.Cleanup(server.Close)
	return server.URL + "/remote.git", &pushes
}

func TestPushRetriesOnlyAServerError(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name          string
		status, fails int
		pushes        bool
		requests      int32
	}{
		{"a 500 then 200 lands on the retry", http.StatusInternalServerError, 1, true, 3},
		{"a 403 is never retried", http.StatusForbidden, 99, false, 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			url, seen := flakyRemote(t, c.status, c.fails)
			dir := repo(t)
			gitT(t, dir, "remote", "add", "origin", url)

			got := xIn(t, dir, nil, "lane", "push", "--apply")

			if (got.code == 0) != c.pushes || (c.pushes && got.data["remote"] != gitT(t, dir, "rev-parse", "HEAD")) {
				t.Fatalf("exit %d, want pushed %v\n%s", got.code, c.pushes, got.stdout)
			}
			if c.requests > 0 && seen.Load() != c.requests {
				t.Errorf("%d requests reached the remote, want %d", seen.Load(), c.requests)
			}
		})
	}
}

func TestServerErrorKnowsGithubsWordsOverSsh(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, log string
		retry     bool
	}{
		{"the FRM-343 push, verbatim", "remote: Internal Server Error        \nremote: Request ID 3E7D:237F88\n ! [remote rejected] 86dd55be05 -> worktree-FRM-343-x-handoff (Internal Server Error)\nerror: failed to push some refs", true},
		{"a rejected ref alone", " ! [remote rejected] main -> main (Bad Gateway)\nerror: failed to push some refs", true},
		{"curl's 502", "error: RPC failed; HTTP 502 curl 22 The requested URL returned error: 502", true},
		{"curl's 403", "fatal: unable to access 'https://example.com/r.git/': The requested URL returned error: 403", false},
		{"a declined hook on the remote", " ! [remote rejected] main -> main (protected branch hook declined)\nerror: failed to push some refs", false},
		{"a denied key", "ERROR: Permission to o/r.git denied to someone.\nfatal: Could not read from remote repository.", false},
		{"a pre-push hook naming a 500", "│  test: api answered HTTP 500 — internal server error\nerror: failed to push some refs", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := serverError.MatchString(c.log); got != c.retry {
				t.Errorf("retry %v, want %v for %q", got, c.retry, c.log)
			}
		})
	}
}

func TestAGlobalFlagBeforeTheVerbStillFindsIt(t *testing.T) {
	t.Parallel()
	if got := xIn(t, repo(t), nil, "--json", "lane", "push"); got.code != 4 || got.next != "x lane push --apply" {
		t.Fatalf("exit %d, next %q", got.code, got.next)
	}
}

// a fake frame tree whose binary only prints a marker: the shim must pick it from a subdir
func fakeTree(t *testing.T, marker string) string {
	tree, _ := filepath.EvalSymlinks(t.TempDir())
	shim, _ := os.ReadFile("../bin/x")
	write(t, filepath.Join(tree, "x/bin/x"), string(shim))
	write(t, filepath.Join(tree, "x/go/go.mod"), "module x\n")
	write(t, filepath.Join(tree, "x/go/bin/x"), "#!/bin/sh\necho "+marker+"\n")
	// the source older than the binary, both in the past: a later write is newer to the second
	now := time.Now()
	_ = os.Chtimes(filepath.Join(tree, "x/go/go.mod"), now.Add(-2*time.Minute), now.Add(-2*time.Minute))
	_ = os.Chtimes(filepath.Join(tree, "x/go/bin/x"), now.Add(-time.Minute), now.Add(-time.Minute))
	if err := os.MkdirAll(filepath.Join(tree, "deep/er"), 0o755); err != nil {
		t.Fatal(err)
	}
	return tree
}

func TestShimRunsTheNearestTreesBinary(t *testing.T) {
	t.Parallel()
	tree := fakeTree(t, "tree-local")
	shim, _ := filepath.Abs("../bin/x")

	c := exec.Command(shim)
	c.Dir = filepath.Join(tree, "deep/er")
	out, _ := c.Output()

	if strings.TrimSpace(string(out)) != "tree-local" {
		t.Fatalf("got %.80q", out)
	}
}

func TestShimPinsADevBuildWhenXGoDiffersFromOriginMain(t *testing.T) {
	t.Parallel()
	program := "package main\n\nimport \"fmt\"\n\nvar devBuild string\n\nfunc main() { fmt.Println(\"dev=\" + devBuild) }\n"
	cases := []struct {
		name, want string
		change     func(t *testing.T, tree string)
	}{
		{"the same code as origin/main", "dev=", func(*testing.T, string) {}},
		{"an uncommitted edit", "dev=1", func(t *testing.T, tree string) {
			write(t, filepath.Join(tree, "x/go/main.go"), program+"\n// edited\n")
		}},
		{"an untracked file", "dev=1", func(t *testing.T, tree string) {
			write(t, filepath.Join(tree, "x/go/extra.go"), "package main\n")
		}},
		{"a commit origin/main lacks", "dev=1", func(t *testing.T, tree string) {
			write(t, filepath.Join(tree, "x/go/main.go"), program+"\n// committed\n")
			gitT(t, tree, "commit", "-qam", "ahead")
		}},
		{"a checkout behind origin/main", "dev=", func(t *testing.T, tree string) {
			write(t, filepath.Join(tree, "x/go/main.go"), program+"\n// newer on main\n")
			gitT(t, tree, "commit", "-qam", "main moved")
			gitT(t, tree, "update-ref", "refs/remotes/origin/main", "HEAD")
			gitT(t, tree, "checkout", "-q", "HEAD~1")
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			tree := fakeTree(t, "stale")
			write(t, filepath.Join(tree, ".gitignore"), "bin/\n")
			write(t, filepath.Join(tree, "x/go/main.go"), program)
			gitT(t, tree, "init", "-q")
			gitT(t, tree, "add", ".")
			gitT(t, tree, "commit", "-qm", "init")
			gitT(t, tree, "update-ref", "refs/remotes/origin/main", "HEAD")
			c.change(t, tree)

			run := exec.Command(filepath.Join(tree, "x/bin/x"))
			run.Dir = tree
			out, _ := run.Output()

			if strings.TrimSpace(string(out)) != c.want {
				t.Errorf("got %q, want %q", out, c.want)
			}
		})
	}
}

func TestShimRebuildsABinaryOlderThanItsSource(t *testing.T) {
	t.Parallel()
	tree := fakeTree(t, "stale")
	write(t, filepath.Join(tree, "x/go/main.go"), "package main\n\nimport \"fmt\"\n\nfunc main() { fmt.Println(\"rebuilt\") }\n")

	c := exec.Command(filepath.Join(tree, "x/bin/x"))
	c.Dir = tree
	out, _ := c.Output()

	if strings.TrimSpace(string(out)) != "rebuilt" {
		t.Fatalf("got %q — the stale binary ran", out)
	}
}

// a peer's git holds the index lock for 2 s, then lets go: the commit waits it out and lands
func TestCommitWaitsOutABriefIndexLock(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "readme.txt"), "two\n")
	lock := filepath.Join(target, ".git", "index.lock")
	write(t, lock, "")
	go func() {
		time.Sleep(2 * time.Second)
		_ = os.Remove(lock)
	}()

	got := xIn(t, target, nil, "lane", "commit", message(t), "--", "readme.txt")

	if got.code != 0 || got.data["sha"] != gitT(t, target, "rev-parse", "HEAD") {
		t.Fatalf("exit %d, data %v\n%s", got.code, got.data, got.stdout)
	}
	if waited, _ := got.data["waited"].(string); !strings.HasPrefix(waited, "index lock held, waited ") {
		t.Errorf("waited %q, want one «index lock held, waited» line", waited)
	}
}

// a lock nobody lets go of outlives the wait: the verb names it and its age, and leaves it where it is
func TestCommitFailsOnAStaleIndexLockAndKeepsIt(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "readme.txt"), "two\n")
	lock := filepath.Join(target, ".git", "index.lock")
	write(t, lock, "")

	got := xIn(t, target, []string{"X_LOCK_WAIT=300ms"}, "lane", "commit", message(t), "--", "readme.txt")

	if got.code == 0 {
		t.Fatalf("exit 0, want a failure on the held lock\n%s", got.stdout)
	}
	if !strings.Contains(got.stdout, lock) || !strings.Contains(got.stdout, " old") {
		t.Errorf("the failure names no lock path and age:\n%s", got.stdout)
	}
	if !exists(lock) {
		t.Error("the lock was removed; the verb must leave it for the caller")
	}
}

func TestCommitNamesAPathListThatArrivedAsOneWord(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "a.ts"), "a\n")
	write(t, filepath.Join(target, "b.ts"), "b\n")

	got := xIn(t, target, nil, "lane", "commit", message(t), "--", "a.ts b.ts")

	if got.code != 2 || !strings.Contains(got.stdout, "arrived as one word") || !strings.Contains(got.next, "-- a.ts b.ts") {
		t.Fatalf("exit %d, next %q, want a usage error naming the one-word list\n%s", got.code, got.next, got.stdout)
	}
}

func TestCommitTakesAFileWhoseNameHoldsASpace(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "my notes.md"), "notes\n")

	got := xIn(t, target, nil, "lane", "commit", message(t), "--", "my notes.md")

	if got.code != 0 || gitT(t, target, "ls-files", "my notes.md") != "my notes.md" {
		t.Fatalf("exit %d, want the spaced file committed\n%s", got.code, got.stdout)
	}
}

func TestCommitTakesAStagedDeleteOfASpacedFile(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "my notes.md"), "notes\n")
	gitT(t, target, "add", ".")
	gitT(t, target, "commit", "-q", "-m", "notes")
	gitT(t, target, "rm", "-q", "my notes.md")

	got := xIn(t, target, nil, "lane", "commit", message(t), "--", "my notes.md")

	if got.code != 0 || gitT(t, target, "ls-files", "my notes.md") != "" {
		t.Fatalf("exit %d, want the delete committed\n%s", got.code, got.stdout)
	}
}

// no lock, no line: a commit that never waited says nothing about waiting
func TestCommitWithNoIndexLockSaysNothingOfWaiting(t *testing.T) {
	t.Parallel()
	target := repo(t)
	write(t, filepath.Join(target, "readme.txt"), "two\n")

	got := xIn(t, target, nil, "lane", "commit", message(t), "--", "readme.txt")

	if _, has := got.data["waited"]; got.code != 0 || has {
		t.Errorf("exit %d, data %v: want a commit with no waited field", got.code, got.data)
	}
}

// layers pushes each branch on top of the one before it, from main up, and leaves a clone on the last
func layers(t *testing.T, names ...string) string {
	t.Helper()
	origin := filepath.Join(t.TempDir(), "origin.git")
	gitT(t, filepath.Dir(origin), "init", "-q", "--bare", "-b", "main", origin)
	seed := repo(t)
	gitT(t, seed, "remote", "add", "origin", origin)
	gitT(t, seed, "push", "-q", "origin", "main")
	for _, name := range names {
		gitT(t, seed, "switch", "-q", "-c", name)
		write(t, filepath.Join(seed, strings.ReplaceAll(name, "/", "-")+".txt"), name+"\n")
		gitT(t, seed, "add", ".")
		gitT(t, seed, "commit", "-q", "-m", name)
		gitT(t, seed, "push", "-q", "origin", name)
	}
	clone := filepath.Join(t.TempDir(), "clone")
	gitT(t, filepath.Dir(clone), "clone", "-q", "-b", names[len(names)-1], origin, clone)
	return clone
}

// ghRecorder is a fake gh on PATH: every call lands in calls.log behind its token, then the case body answers it
func ghRecorder(t *testing.T, cases string) (env []string, log string) {
	t.Helper()
	dir := t.TempDir()
	log = filepath.Join(dir, "calls.log")
	write(t, filepath.Join(dir, "bin/gh"), "#!/bin/sh\nprintf '%s %s\\n' \"$GH_TOKEN\" \"$*\" >> '"+log+"'\ncase \"$*\" in\n"+cases+"\nesac\n")
	keys := keysFixture(t, map[string]string{"keychain:x-token-gh-x-codie-cc:x": farFuture + ":ghs_coder"})
	return []string{"PATH=" + filepath.Join(dir, "bin") + ":" + os.Getenv("PATH"), "X_KEYS=" + keys}, log
}

const prCreated = `'pr create'*) echo https://github.com/o/r/pull/8 ;;`

func bodyFile(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "body.md")
	write(t, path, "the body\n")
	return path
}

func TestPrOpenOpensOntoMain(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a")
	env, log := ghRecorder(t, prCreated)

	got := xIn(t, clone, env, "lane", "pr-open", "--apply", "a title", bodyFile(t))

	calls := strings.TrimSpace(read(t, log))
	if got.code != 0 || !strings.HasPrefix(calls, "ghs_coder pr create --base main --head coder/FRM-1-a ") || strings.Contains(calls, "\n") {
		t.Fatalf("exit %d, gh calls %q, want one pr create onto main as the codie app\n%s", got.code, calls, got.stdout)
	}
}
