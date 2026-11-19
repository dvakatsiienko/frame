package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

// a github for merge-auto: GETs answer from pages (a key with "?page=2" beside it splits the list), the
// merge refuses a sha that is not the pr's head, a read may run a hook, and every call
// lands in calls as "METHOD path" with its json body after a space
type hub struct {
	mu     sync.Mutex
	pages  map[string]string
	calls  []string
	auth   []string
	head   string
	onRead func(path string)
	// a path's answer from its second GET on: a push landing between two reads
	later map[string]string
	reads map[string]int
	// github's own refusal of the merge, as «<status> <message>»
	refuseMerge string
	// each call's path and query, which calls leaves out
	queries []string
}

func (h *hub) lastQuery(path string) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, v := range slices.Backward(h.queries) {
		if p, query, _ := strings.Cut(v, "?"); p == path {
			return query
		}
	}
	return ""
}

func (h *hub) serve(t *testing.T) *httptest.Server {
	t.Helper()
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.mu.Lock()
		defer h.mu.Unlock()
		raw, _ := io.ReadAll(r.Body)
		h.calls = append(h.calls, strings.TrimSpace(r.Method+" "+r.URL.Path+" "+string(raw)))
		h.queries = append(h.queries, r.URL.Path+"?"+r.URL.RawQuery)
		h.auth = append(h.auth, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPut && strings.HasSuffix(r.URL.Path, "/merge"):
			if status, message, refused := strings.Cut(h.refuseMerge, " "); refused {
				n, _ := strconv.Atoi(status)
				w.WriteHeader(n)
				_, _ = w.Write([]byte(`{"message":"` + message + `"}`))
				return
			}
			var body struct {
				Sha string `json:"sha"`
			}
			_ = json.Unmarshal(raw, &body)
			if body.Sha != h.head {
				w.WriteHeader(http.StatusConflict)
				_, _ = w.Write([]byte(`{"message":"Head branch was modified. Review and try the merge again."}`))
				return
			}
			_, _ = w.Write([]byte(`{"sha":"` + mergedSha + `","merged":true,"message":"Pull Request successfully merged"}`))
			return
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/labels"):
			if h.pages["labels"] == serverDown || (h.pages["labels:"+brakeLabel] == serverDown && strings.Contains(string(raw), brakeLabel)) {
				w.WriteHeader(http.StatusInternalServerError)
				_, _ = w.Write([]byte(`{"message":"Server Error"}`))
				return
			}
			_, _ = w.Write([]byte(`[]`))
			return
		case r.Method == http.MethodPost && r.URL.Path == "/graphql":
			_, _ = w.Write([]byte(h.pages["graphql"]))
			return
		}
		key := r.URL.Path
		if h.onRead != nil {
			h.onRead(key)
		}
		if r.URL.Query().Get("page") != "" {
			key += "?page=" + r.URL.Query().Get("page")
		} else if _, paged := h.pages[key+"?page=2"]; paged {
			w.Header().Set("Link", `<`+server.URL+r.URL.Path+`?per_page=100&page=2>; rel="next"`)
		}
		body, ok := h.pages[key]
		if h.reads == nil {
			h.reads = map[string]int{}
		}
		if h.reads[key]++; h.reads[key] > 1 && h.later[key] != "" {
			body = h.later[key]
		}
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Not Found"}`))
			return
		}
		if body == serverDown {
			w.WriteHeader(http.StatusInternalServerError)
			_, _ = w.Write([]byte(`{"message":"Server Error"}`))
			return
		}
		if code, ok := strings.CutPrefix(body, "<status "); ok {
			n, _ := strconv.Atoi(strings.TrimSuffix(code, ">"))
			w.WriteHeader(n)
			_, _ = w.Write([]byte(`{"message":"answered ` + code + `"}`))
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	return server
}

// the calls whose "METHOD path" starts with prefix
func (h *hub) sent(prefix string) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	var out []string
	for _, c := range h.calls {
		if strings.HasPrefix(c, prefix) {
			out = append(out, c)
		}
	}
	return out
}

const mergedSha = "cccccccccccccccccccccccccccccccccccccccc"

// a pr world: a bare origin standing in for github.com/o/r, a clone clio runs merge-auto in, the pr
// branch codie/x touching the given paths, a sixth sense store, and the hub answering for #7 as all green
type mergeWorld struct {
	clone, origin, seed, head, store, state string
	hub                                     *hub
	env                                     []string
}

// moveHead pushes seed's codie/x and points the hub at its new head, every check green on it
func (w *mergeWorld) moveHead(t *testing.T) {
	t.Helper()
	gitT(t, w.seed, "push", "-q", "-f", "origin", "codie/x")
	old, head := w.head, gitT(t, w.seed, "rev-parse", "HEAD")
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	for _, suffix := range []string{"/check-runs", "/statuses"} {
		w.hub.pages[repoPath+"/commits/"+head+suffix] = w.hub.pages[repoPath+"/commits/"+old+suffix]
	}
	w.hub.pages[repoPath+"/pulls/7"] = strings.ReplaceAll(w.hub.pages[repoPath+"/pulls/7"], old, head)
	w.hub.head, w.head = head, head
}

// mainMoves lands one unrelated commit on origin's main and rebases codie/x onto it
func (w *mergeWorld) mainMoves(t *testing.T, name string) {
	t.Helper()
	gitT(t, w.seed, "switch", "-q", "main")
	write(t, filepath.Join(w.seed, name), "main moved\n")
	gitT(t, w.seed, "add", name)
	gitT(t, w.seed, "commit", "-q", "-m", "main: "+name)
	gitT(t, w.seed, "push", "-q", "origin", "main")
	gitT(t, w.seed, "switch", "-q", "codie/x")
	gitT(t, w.seed, "rebase", "-q", "main")
}

func newMergeWorld(t *testing.T, paths ...string) *mergeWorld {
	t.Helper()
	root := seeded(t, "merge "+strings.Join(paths, "\n"), func(root string) {
		origin := filepath.Join(root, "origin.git")
		gitT(t, root, "init", "-q", "--bare", "-b", "main", origin)
		seed := filepath.Join(root, "seed")
		copyFixture(t, seedRepo(t), seed)
		gitT(t, seed, "remote", "add", "origin", origin)
		gitT(t, seed, "push", "-q", "origin", "main")
		gitT(t, seed, "switch", "-q", "-c", "codie/x")
		for _, p := range paths {
			write(t, filepath.Join(seed, p), "change in "+p+"\n")
		}
		gitT(t, seed, "add", ".")
		gitT(t, seed, "commit", "-q", "-m", "the pr's change")
		gitT(t, seed, "push", "-q", "origin", "codie/x")
		write(t, filepath.Join(root, "head"), gitT(t, seed, "rev-parse", "HEAD"))

		clone := filepath.Join(root, "clone")
		gitT(t, root, "clone", "-q", origin, clone)
		gitT(t, clone, "remote", "set-url", "origin", "https://github.com/o/r.git")
		gitT(t, clone, "config", "url."+origin+".insteadOf", "https://github.com/o/r.git")
		gitT(t, clone, "config", "url."+origin+".pushInsteadOf", "https://github.com/o/r.git")
	})
	origin, seed, clone := filepath.Join(root, "origin.git"), filepath.Join(root, "seed"), filepath.Join(root, "clone")
	head := readOr(filepath.Join(root, "head"), "")

	var files []string
	for _, p := range paths {
		files = append(files, `{"filename":"`+p+`","status":"modified"}`)
	}
	h := &hub{head: head, pages: map[string]string{
		// mergeable leads, so a test that plants its own value after "number" wins: go's json keeps a key's last value
		repoPath + "/pulls/7": `{"mergeable":true,"mergeable_state":"clean","number":7,"title":"a pr","state":"open","merged":false,"body":"the body",
			"head":{"sha":"` + head + `","ref":"codie/x"},"base":{"ref":"main"}}`,
		repoPath + "/pulls/7/files": "[" + strings.Join(files, ",") + "]",
		// the pr's own labels, the brake's first read; #8 is a stack's upper layer
		repoPath + "/issues/7/labels": `[]`, repoPath + "/issues/8/labels": `[]`,
		repoPath + "/branches/main/protection/required_status_checks": `{"contexts":["test","build"]}`,
		repoPath + "/commits/" + head + "/check-runs": `{"total_count":2,"check_runs":[
			{"name":"test","status":"completed","conclusion":"success","html_url":"https://ci/1"},
			{"name":"build","status":"completed","conclusion":"success","html_url":"https://ci/2"}]}`,
		repoPath + "/commits/" + head + "/statuses": `[]`,
		"graphql":            `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[]}}}}}`,
		repoPath + "/issues": `[]`,
		repoPath + "/pulls":  `[]`,
		repoPath + "/actions/workflows/ci.yml/runs":     `{"workflow_runs":[]}`,
		repoPath + "/actions/workflows/deploy.yml/runs": `{"workflow_runs":[]}`,
		// a memory path asks clio's wishkeeper read, posted by her app on the head
		repoPath + "/issues/7/comments": `[{"user":{"login":"x-clio-cc[bot]","type":"Bot"},"body":"wishkeeper read ` + head + `: 0 findings"}]`,
	}}
	server := h.serve(t)

	store := filepath.Join(t.TempDir(), "pr-verified.json")
	// a risky path asks the security pass beside the clean, stamped on the same head
	write(t, store, `{"o/r#7":"`+head+`","o/r#7:security":"`+head+`"}`)
	bin := filepath.Join(t.TempDir(), "bin")
	write(t, filepath.Join(bin, "gh"), "#!/bin/sh\n[ \"$1 $2\" = 'auth token' ] && echo gho_dima && exit 0\necho \"fake gh: $*\" >&2\nexit 1\n")
	state := t.TempDir()
	env := []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_GITHUB_URL=" + server.URL, "X_VERIFIED=" + store,
		"X_KEYS=" + keysFixture(t, map[string]string{}), "X_STATE=" + state}
	return &mergeWorld{clone: clone, origin: origin, seed: seed, head: head, store: store, state: state, hub: h, env: env}
}

func (w *mergeWorld) run(t *testing.T, args ...string) ran {
	t.Helper()
	return xIn(t, w.clone, w.env, append([]string{"lane", "merge-auto"}, args...)...)
}

type mergeEnvelope struct {
	Data  mergeDecision `json:"data"`
	Error string        `json:"error"`
}

func envelopeOf(got ran) mergeEnvelope {
	var envelope mergeEnvelope
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return envelope
}

func TestMergeAutoMergesACleanGreenPrNamingTheThreeChecks(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")

	got := w.run(t, "7", "--apply")

	merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge")
	if got.code != 0 || len(merges) != 1 || !strings.Contains(merges[0], `"sha":"`+w.head+`"`) {
		t.Fatalf("exit %d, merge calls %q, want one pinned to %s:\n%s", got.code, merges, w.head, got.stdout)
	}
	var names []string
	for _, c := range envelopeOf(got).Data.Checks {
		if !c.OK {
			t.Errorf("check %s reads not ok: %s", c.Name, c.Detail)
		}
		names = append(names, c.Name)
	}
	if !slices.Equal(names, []string{"sixth-sense", "ci", "mergeable", "deploy", "main-ci", "threads"}) {
		t.Errorf("checks %v, want sixth-sense, ci, mergeable, deploy, main-ci, threads:\n%s", names, got.stdout)
	}
}

func TestMergeAutoCarriesACleanAcrossARebaseWithUnchangedPatchIds(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainMoves(t, "one.txt")
	w.mainMoves(t, "two.txt")
	w.moveHead(t)

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want the carried clean to merge:\n%s", got.code, len(merges), got.stdout)
	}
	if rows := envelopeOf(got).Data.Checks; len(rows) == 0 || !strings.Contains(rows[0].Detail, "patch-id") {
		t.Errorf("sixth sense row %+v does not say the clean carried by patch-id", rows)
	}
}

// laneTree puts a worktree on the pr's branch at its head; sessions and hook shims read a fixture home
func (w *mergeWorld) laneTree(t *testing.T) string {
	t.Helper()
	tree := filepath.Join(w.clone, ".claude/worktrees/lane")
	gitT(t, w.clone, "fetch", "-q", "origin", "codie/x:codie/x")
	gitT(t, w.clone, "worktree", "add", "-q", tree, "codie/x")
	return tree
}

func (w *mergeWorld) withPnpm(t *testing.T, body string) (sessions string) {
	t.Helper()
	bin, _, _ := strings.Cut(strings.TrimPrefix(w.env[0], "PATH="), ":")
	write(t, filepath.Join(bin, "pnpm"), "#!/bin/sh\n"+body+"\n")
	if err := os.Chmod(filepath.Join(bin, "pnpm"), 0o755); err != nil {
		t.Fatal(err)
	}
	sessions = t.TempDir()
	w.env = append(w.env, "X_SESSIONS="+sessions)
	return sessions
}

// the session registry's shape, ~/.claude/sessions/<pid>.json: the tree a live session sits in stays
func plantSession(t *testing.T, sessions, cwd string, pid int) {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"cwd": cwd, "pid": pid})
	write(t, filepath.Join(sessions, strconv.Itoa(pid)+".json"), string(body))
}

// a live process whose own cwd is dir, reaped with the test: what a session sitting in a tree is
func processIn(t *testing.T, dir string) int {
	t.Helper()
	cmd := exec.Command("sh", "-c", "exec sleep 120")
	cmd.Dir = dir
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = cmd.Process.Kill()
		_ = cmd.Wait()
	})
	return cmd.Process.Pid
}

func TestMergeAutoReadsASessionsProcessCwdNeverItsRegistryDir(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		stays bool
		pid   func(t *testing.T, tree string) (registry string, pid int)
	}{
		{"the registry says elsewhere, the process sits inside", true, func(t *testing.T, tree string) (string, int) {
			return t.TempDir(), processIn(t, filepath.Join(tree, "script"))
		}},
		{"it left: the registry says the tree, the process sits elsewhere", false, func(t *testing.T, tree string) (string, int) {
			return tree, processIn(t, t.TempDir())
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			sessions := w.withPnpm(t, "exit 0")
			tree := w.laneTree(t)
			registry, pid := c.pid(t, tree)
			plantSession(t, sessions, registry, pid)

			got := w.run(t, "7", "--apply")

			if got.code != 0 || exists(tree) != c.stays {
				t.Fatalf("exit %d, tree there %v, want %v:\n%s", got.code, exists(tree), c.stays, got.stdout)
			}
			if c.stays && !strings.Contains(got.stdout, strconv.Itoa(pid)) {
				t.Errorf("the verb must name the session, pid %d:\n%s", pid, got.stdout)
			}
		})
	}
}

// a Bash cd moves no process: only the transcript's last row knows
func TestMergeAutoSparesATreeASessionEnteredByCd(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		last  func(tree string) string
		stays bool
	}{
		{"its last row sits in the tree", func(tree string) string { return filepath.Join(tree, "script") }, true},
		{"it cd'd out again", func(string) string { return "/elsewhere" }, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			sessions := w.withPnpm(t, "exit 0")
			tree := w.laneTree(t)
			home := t.TempDir()
			w.env = append(w.env, "HOME="+home)
			const id = "s-cd"
			write(t, filepath.Join(home, ".claude/projects/p", id+".jsonl"), jsonLines(t,
				map[string]any{"type": "user", "cwd": tree}, map[string]any{"type": "user", "cwd": c.last(tree)}, map[string]any{"type": "system"}))
			pid := processIn(t, t.TempDir())
			body, _ := json.Marshal(map[string]any{"cwd": t.TempDir(), "pid": pid, "sessionId": id, "name": "the codie"})
			write(t, filepath.Join(sessions, "1.json"), string(body))

			got := w.run(t, "7", "--apply")

			if got.code != 0 || exists(tree) != c.stays || c.stays && !strings.Contains(got.stdout, "the codie") {
				t.Fatalf("exit %d, tree there %v, want %v, the session named:\n%s", got.code, exists(tree), c.stays, got.stdout)
			}
		})
	}
}

// a session moved between trees can leave a transcript under two project dirs: the one written last says where it sits
func TestMergeAutoReadsASessionsNewestTranscript(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	sessions := w.withPnpm(t, "exit 0")
	tree := w.laneTree(t)
	home := t.TempDir()
	w.env = append(w.env, "HOME="+home)
	const id = "s-twin"
	stale := filepath.Join(home, ".claude/projects/a", id+".jsonl")
	write(t, stale, jsonLines(t, map[string]any{"type": "user", "cwd": "/elsewhere"}))
	long := time.Now().Add(-time.Hour)
	if err := os.Chtimes(stale, long, long); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(home, ".claude/projects/b", id+".jsonl"), jsonLines(t, map[string]any{"type": "user", "cwd": tree}))
	body, _ := json.Marshal(map[string]any{"cwd": t.TempDir(), "pid": processIn(t, t.TempDir()), "sessionId": id, "name": "the codie"})
	write(t, filepath.Join(sessions, "1.json"), string(body))

	got := w.run(t, "7", "--apply")

	if got.code != 0 || !exists(tree) {
		t.Fatalf("exit %d, tree there %v, want it spared:\n%s", got.code, exists(tree), got.stdout)
	}
}

// a last row past the tail's size holds no cwd the tail can parse, and a wrong decamp takes a live tree
func TestLastCwdReadsPastARowLongerThanTheTail(t *testing.T) {
	t.Parallel()
	path := filepath.Join(t.TempDir(), "s.jsonl")
	write(t, path, jsonLines(t, map[string]any{"type": "user", "cwd": "/the/tree"}, map[string]any{"type": "user", "text": strings.Repeat("x", transcriptTail+1)}))

	if got := lastCwdIn(path); got != "/the/tree" {
		t.Errorf("got %q", got)
	}
}

func TestMergeAutoDecampsACleanTreeAtTheLandedHead(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	tree := w.laneTree(t)

	got := w.run(t, "7", "--apply")

	if got.code != 0 || exists(tree) {
		t.Fatalf("exit %d, tree still there: %v\n%s", got.code, exists(tree), got.stdout)
	}
	if !strings.Contains(got.stdout, "decamped") {
		t.Errorf("the verb does not say the tree went:\n%s", got.stdout)
	}
}

func TestMergeAutoNamesWhyATreeStays(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name  string
		plant func(t *testing.T, w *mergeWorld, tree, home string)
		why   string
	}{
		{"an untracked file", func(t *testing.T, _ *mergeWorld, tree, _ string) {
			write(t, filepath.Join(tree, "loose.txt"), "not committed\n")
		}, "loose.txt"},
		{"a gitignored file", func(t *testing.T, w *mergeWorld, tree, _ string) {
			write(t, filepath.Join(w.clone, ".git/info/exclude"), "notes.local\n")
			write(t, filepath.Join(tree, "notes.local"), "mine\n")
		}, "notes.local"},
		{"an unpushed commit", func(t *testing.T, _ *mergeWorld, tree, _ string) {
			write(t, filepath.Join(tree, "y.txt"), "local only\n")
			gitT(t, tree, "add", "y.txt")
			gitT(t, tree, "commit", "-q", "-m", "local only")
		}, "on no remote"},
		{"a tree behind the landed head", func(t *testing.T, _ *mergeWorld, tree, _ string) {
			gitT(t, tree, "reset", "-q", "--hard", "HEAD~1")
		}, "not at the landed head"},
		{"a live session", func(t *testing.T, _ *mergeWorld, tree, home string) {
			plantSession(t, home, filepath.Join(tree, "script"), processIn(t, filepath.Join(tree, "script")))
		}, "a live session sits in it"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			home := w.withPnpm(t, "exit 0")
			tree := w.laneTree(t)
			c.plant(t, w, tree, home)

			got := w.run(t, "7", "--apply")

			if got.code != 0 || !exists(tree) || !strings.Contains(got.stdout, c.why) {
				t.Fatalf("exit %d, tree there: %v, want %q in:\n%s", got.code, exists(tree), c.why, got.stdout)
			}
		})
	}
}

func TestMergeAutoKeepsTheTreeItRunsFrom(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	tree := w.laneTree(t)

	got := xIn(t, tree, w.env, "lane", "merge-auto", "7", "--apply")

	if got.code != 0 || !exists(tree) || !strings.Contains(got.stdout, "x runs from it") {
		t.Fatalf("exit %d, tree there: %v:\n%s", got.code, exists(tree), got.stdout)
	}
}

func TestMergeAutoDecampsATreeWhoseSessionDied(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	home := w.withPnpm(t, "exit 0")
	tree := w.laneTree(t)
	plantSession(t, home, tree, 99999999)

	got := w.run(t, "7", "--apply")

	if got.code != 0 || exists(tree) {
		t.Fatalf("exit %d, a dead session kept the tree:\n%s", got.code, got.stdout)
	}
}

func TestMergeAutoLeavesAnUpperLayerTree(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	gitT(t, w.clone, "fetch", "-q", "origin", "codie/x:codie/x")
	upper := filepath.Join(w.clone, ".claude/worktrees/upper")
	gitT(t, w.clone, "worktree", "add", "-q", "-b", "codie/x-2", upper, "codie/x")
	write(t, filepath.Join(upper, "z.txt"), "the layer above\n")
	gitT(t, upper, "add", "z.txt")
	gitT(t, upper, "commit", "-q", "-m", "layer 2")

	got := w.run(t, "7", "--apply")

	if got.code != 0 || !exists(upper) || !strings.Contains(got.stdout, "an upper layer") {
		t.Fatalf("exit %d, upper there: %v:\n%s", got.code, exists(upper), got.stdout)
	}
}

// a layer just cut sits at the head that lands, with no commit yet: it is the layer above, never the merged one
func TestMergeAutoLeavesAFreshUpperLayerTree(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	gitT(t, w.clone, "fetch", "-q", "origin", "codie/x:codie/x")
	upper := filepath.Join(w.clone, ".claude/worktrees/upper")
	gitT(t, w.clone, "worktree", "add", "-q", "-b", "codie/x-2", upper, "codie/x")

	got := w.run(t, "7", "--apply")

	if got.code != 0 || !exists(upper) || !strings.Contains(got.stdout, "an upper layer") {
		t.Fatalf("exit %d, upper there: %v:\n%s", got.code, exists(upper), got.stdout)
	}
}

func TestMergeAutoNamesTheDoorForATreeThatStayed(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 0")
	write(t, filepath.Join(w.laneTree(t), "loose.txt"), "not committed\n")

	got := w.run(t, "7", "--apply")

	if !strings.Contains(got.stdout, "--pr 7 --apply") {
		t.Fatalf("a later landed needs the pr, or a squash reads its commits on no remote:\n%s", got.stdout)
	}
}

func TestMergeAutoWarnsWhenItsDecampFails(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.withPnpm(t, "exit 1")
	w.laneTree(t)

	got := w.run(t, "7", "--apply")

	if got.code != 0 || !strings.Contains(got.stdout, "lefthook install failed") {
		t.Fatalf("exit %d, want a done merge and the failure named:\n%s", got.code, got.stdout)
	}
}

// a solo stamp merges like sixth sense's clean, and every detail says whose it is
func TestMergeAutoNamesWhoseCleanItReads(t *testing.T) {
	t.Parallel()
	const byClio, bySixthSense = "by clio's read", "by sixth sense"
	cases := []struct {
		name string
		by   string
		move func(t *testing.T, w *mergeWorld)
		ok   bool
		want string
	}{
		{"clio's read on the head", "clio", nil, true, "clean on %s " + byClio},
		{"no by key on the head", "", nil, true, "clean on %s " + bySixthSense},
		{"clio's read carried", "clio", func(t *testing.T, w *mergeWorld) { w.mainMoves(t, "one.txt"); w.moveHead(t) }, true, byClio + ", carried"},
		{"sixth sense carried", "", func(t *testing.T, w *mergeWorld) { w.mainMoves(t, "one.txt"); w.moveHead(t) }, true, bySixthSense + ", carried"},
		{"clio's read past a moved head", "clio", func(t *testing.T, w *mergeWorld) {
			write(t, filepath.Join(w.seed, "script/foo.ts"), "export const moved = 2;\n")
			gitT(t, w.seed, "add", ".")
			gitT(t, w.seed, "commit", "-q", "-m", "unreviewed fix")
			w.moveHead(t)
		}, false, "past the clean " + byClio},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w := newMergeWorld(t, "script/foo.ts")
			if c.by != "" {
				write(t, w.store, `{"o/r#7":"`+w.head+`","o/r#7:by":"`+c.by+`"}`)
			}
			if c.move != nil {
				c.move(t, w)
			}
			want := c.want
			if strings.Contains(want, "%s") {
				want = fmt.Sprintf(want, short(w.head))
			}

			got := w.run(t, "7", "--apply")

			envelope := envelopeOf(got)
			if envelope.Error != "" && !c.ok {
				if !strings.Contains(envelope.Error, want) {
					t.Fatalf("error %q, want %q", envelope.Error, want)
				}
				return
			}
			rows := envelope.Data.Checks
			if len(rows) == 0 || rows[0].OK != c.ok || !strings.Contains(rows[0].Detail, want) {
				t.Fatalf("sixth sense row %+v, want ok %v and %q\n%s", rows, c.ok, want, got.stdout)
			}
		})
	}
}

// a no-clean detail names no verifier: nobody read it
func TestMergeAutoNamesNoVerifierWithNoClean(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, w.store, `{"o/r#7:by":"clio"}`)

	got := w.run(t, "7", "--apply")

	if e := envelopeOf(got).Error; got.code != 1 || !strings.Contains(e, "no clean recorded for o/r#7") || strings.Contains(e, "clio") || strings.Contains(e, "sixth sense") {
		t.Fatalf("exit %d, error %q", got.code, e)
	}
}

// lane merge-main's flow: main merged into the branch, nothing else touched — the clean carries
func TestMergeAutoCarriesACleanAcrossAPlainMergeOfMain(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.mainMoves(t, "one.txt")
	gitT(t, w.seed, "reset", "-q", "--hard", "origin/codie/x")
	gitT(t, w.seed, "merge", "-q", "--no-edit", "main")
	w.moveHead(t)

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want a plain merge of main to keep the clean:\n%s", got.code, len(merges), got.stdout)
	}
}

func TestMergeAutoWaitsWhenTheBranchChangeIsNotTheVerifiedOne(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		change func(t *testing.T, w *mergeWorld)
	}{
		{"a merge of main that also edits a file", func(t *testing.T, w *mergeWorld) {
			w.mainMoves(t, "one.txt")
			gitT(t, w.seed, "reset", "-q", "--hard", "origin/codie/x")
			gitT(t, w.seed, "merge", "-q", "--no-commit", "main")
			write(t, filepath.Join(w.seed, "script/foo.ts"), "slipped into the merge\n")
			gitT(t, w.seed, "add", "script/foo.ts")
			gitT(t, w.seed, "commit", "-q", "--no-edit")
		}},
		{"a whitespace-only edit", func(t *testing.T, w *mergeWorld) {
			write(t, filepath.Join(w.seed, "script/foo.ts"), "change  in script/foo.ts\n")
			gitT(t, w.seed, "commit", "-q", "--amend", "-a", "--no-edit")
		}},
		{"a verified commit dropped", func(t *testing.T, w *mergeWorld) {
			write(t, filepath.Join(w.seed, "script/bar.ts"), "a second verified change\n")
			gitT(t, w.seed, "add", "script/bar.ts")
			gitT(t, w.seed, "commit", "-q", "-m", "second change")
			w.moveHead(t)
			write(t, w.store, `{"o/r#7":"`+w.head+`"}`)
			gitT(t, w.seed, "reset", "-q", "--hard", "HEAD~1")
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			c.change(t, w)
			w.moveHead(t)

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, "wait: ") {
				t.Fatalf("exit %d, %d merge calls, error %q, want a wait", got.code, len(merges), envelopeOf(got).Error)
			}
		})
	}
}

func TestMergeAutoWaitsWhenAPushChangedThePatchAfterTheClean(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, filepath.Join(w.seed, "script/foo.ts"), "an unreviewed fix\n")
	gitT(t, w.seed, "commit", "-q", "-am", "unreviewed fix")
	w.moveHead(t)

	got := w.run(t, "7", "--apply")

	want := "wait: " + short(w.head) + " unreviewed fix is past the clean by sixth sense"
	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
		t.Fatalf("exit %d, %d merge calls, error %q, want %q", got.code, len(merges), envelopeOf(got).Error, want)
	}
}

// the pr page still names the read head while github's branch moved on: the merge carries the read sha
// and github refuses it, so nothing unread merges
func TestMergeAutoPinsTheMergeToTheHeadItRead(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.head = strings.Repeat("d", 40)
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	merges := w.hub.sent("PUT ")
	if got.code != 1 || len(merges) != 1 || !strings.Contains(merges[0], `"sha":"`+w.head+`"`) || !strings.Contains(envelopeOf(got).Error, "Head branch was modified") {
		t.Fatalf("exit %d, merges %q, error %q, want one merge pinned to %s that github refused", got.code, merges, envelopeOf(got).Error, w.head)
	}
}

func TestMergeAutoMergesARiskyPrNamingEachRiskyPath(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		paths  []string
		files  map[string]string
		risky  []string
		reason string
	}{
		{name: "a dir glob", paths: []string{"script/foo.ts", ".github/workflows/ci.yml"}, risky: []string{".github/workflows/ci.yml"}},
		{name: "a file name", paths: []string{".gitattributes"}, risky: []string{".gitattributes"}},
		{name: "a repo-wide name", paths: []string{"apps/speak/AGENTS.md"}, risky: []string{"apps/speak/AGENTS.md"}},
		{name: "a rename out of a risky path", paths: []string{"docs/old.md"}, files: map[string]string{
			"": `[{"filename":"docs/old.md","previous_filename":"home/.claude/rules/old.md","status":"renamed"}]`,
		}, risky: []string{"home/.claude/rules/old.md"}},
		{name: "a risky file on page 2", paths: []string{"script/foo.ts"}, files: map[string]string{
			"":        `[{"filename":"script/foo.ts","status":"modified"}]`,
			"?page=2": `[{"filename":"CLAUDE.md","status":"added"}]`,
		}, risky: []string{"CLAUDE.md"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, c.paths...)
			w.hub.mu.Lock()
			for page, body := range c.files {
				w.hub.pages[repoPath+"/pulls/7/files"+page] = body
			}
			w.hub.mu.Unlock()

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 || !slices.Equal(envelopeOf(got).Data.Risky, c.risky) {
				t.Fatalf("exit %d, %d merge calls, risky %v, want a merge naming %v:\n%s", got.code, len(merges), envelopeOf(got).Data.Risky, c.risky, got.stdout)
			}
		})
	}
}

func TestMergeAutoPrintsTheRiskyLineOnTheBoard(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, ".github/workflows/ci.yml")

	got := xIn(t, w.clone, append(w.env, "CLAUDECODE="), "lane", "merge-auto", "7", "--apply", "--board")

	if plain := sgr.ReplaceAllString(got.stdout, ""); got.code != 0 || !strings.Contains(plain, "risky: .github/workflows/ci.yml") {
		t.Fatalf("exit %d, the board names no risky line:\n%s", got.code, plain)
	}
}

func TestMergeAutoMarksACheckThatDoesNotHoldOnTheBoard(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	write(t, w.store, `{}`)

	got := xIn(t, w.clone, append(w.env, "CLAUDECODE="), "lane", "merge-auto", "7", "--board")

	if plain := sgr.ReplaceAllString(got.stdout, ""); got.code != 1 || !strings.Contains(plain, "✗ sixth-sense") || !strings.Contains(plain, "✓ ci") {
		t.Fatalf("exit %d, want ✗ on sixth sense and ✓ on ci:\n%s", got.code, plain)
	}
}

func TestMergeAutoMergesNothingUnlessTheRestHolds(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name   string
		change func(t *testing.T, w *mergeWorld)
	}{
		{"sixth sense is not clean", func(t *testing.T, w *mergeWorld) { write(t, w.store, `{}`) }},
		{"a thread is open", func(_ *testing.T, w *mergeWorld) {
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[
				{"isResolved":false,"path":"a.ts","line":1,"comments":{"nodes":[{"url":"https://t/1"}]}}]}}}}}`
		}},
		{"no ci review round ran yet", func(_ *testing.T, w *mergeWorld) {
			w.hub.mu.Lock()
			defer w.hub.mu.Unlock()
			w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[
				{"head_branch":"other","status":"completed","conclusion":"success"},
				{"head_branch":"codie/x","status":"in_progress","conclusion":null}]}`
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := roundWorld(t)
			c.change(t, w)

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 {
				t.Fatalf("exit %d, %d merges, want none:\n%s", got.code, len(merges), got.stdout)
			}
		})
	}
}

// a repo that still requires it waits as on any check: nothing here approves its way past
func TestMergeAutoWaitsOnARequiredReviewClean(t *testing.T) {
	t.Parallel()
	w := roundWorld(t)
	w.hub.mu.Lock()
	w.hub.pages[repoPath+"/branches/main/protection/required_status_checks"] = `{"contexts":["test","build","review:clean"]}`
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, "no run of review:clean") {
		t.Fatalf("exit %d, %d merges, error %q, want the wait named", got.code, len(merges), envelopeOf(got).Error)
	}
	if approves := w.hub.sent("POST " + repoPath + "/pulls/7/reviews"); len(approves) != 0 {
		t.Errorf("an approve went out: %v", approves)
	}
}

// the want line: dima never presses approve — a low-risk pr and a risky one both merge in frame, with no
// approve and no github auto-merge, and the risky one names its path
func TestMergeAutoMergesWithoutDimasHand(t *testing.T) {
	t.Parallel()
	plain, risky := newMergeWorld(t, "script/foo.ts"), newMergeWorld(t, ".github/workflows/ci.yml")

	gotPlain, gotRisky := plain.run(t, "7", "--apply"), risky.run(t, "7", "--apply")

	for _, w := range []*mergeWorld{plain, risky} {
		calls := strings.Join(w.hub.calls, "\n")
		if len(w.hub.sent("PUT ")) != 1 || strings.Contains(calls, "/reviews") || strings.Contains(calls, "enablePullRequestAutoMerge") || strings.Contains(calls, "auto-merge") {
			t.Fatalf("want one merge, no approve, no auto-merge:\n%s", calls)
		}
	}
	if gotPlain.code != 0 || gotRisky.code != 0 || len(envelopeOf(gotPlain).Data.Risky) != 0 || !slices.Equal(envelopeOf(gotRisky).Data.Risky, []string{".github/workflows/ci.yml"}) {
		t.Fatalf("exits %d %d, risky %v %v", gotPlain.code, gotRisky.code, envelopeOf(gotPlain).Data.Risky, envelopeOf(gotRisky).Data.Risky)
	}
}

func TestMergeAutoDryRunRefusesAWait(t *testing.T) {
	t.Parallel()
	clean, waiting := newMergeWorld(t, "script/foo.ts"), newMergeWorld(t, "script/foo.ts")
	write(t, waiting.store, `{}`)

	planned, refused := clean.run(t, "7"), waiting.run(t, "7")

	if planned.code != 4 || refused.code != 1 || !strings.Contains(envelopeOf(refused).Error, "wait: ") {
		t.Fatalf("exits %d and %d, want 4 for a merge to confirm and 1 for a wait:\n%s\n%s", planned.code, refused.code, planned.stdout, refused.stdout)
	}
	if len(clean.hub.sent("PUT "))+len(waiting.hub.sent("PUT ")) != 0 {
		t.Error("a dry run sent a merge")
	}
}

func TestMergeAutoStopsWhenGithubCannotListTheThreads(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.mu.Lock()
	w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":null}},"errors":[{"message":"Resource not accessible by integration"}]}`
	w.hub.mu.Unlock()

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, "Resource not accessible") {
		t.Fatalf("exit %d, %d merge calls, error %q, want a stop naming github's error", got.code, len(merges), envelopeOf(got).Error)
	}
}

func TestMergeAutoWaitCarriesTheChecksItRead(t *testing.T) {
	t.Parallel()
	w := newMergeWorld(t, ".github/workflows/ci.yml")
	write(t, w.store, `{}`)

	got := w.run(t, "7", "--apply")

	data := envelopeOf(got).Data
	if got.code != 1 || data.Decision != "wait" || len(data.Checks) != 7 || !slices.Equal(data.Risky, []string{".github/workflows/ci.yml"}) {
		t.Fatalf("exit %d, data %+v, want the wait's checks and risky line in the envelope", got.code, data)
	}
}

func TestMergeAutoWaitNamesWhy(t *testing.T) {
	t.Parallel()
	runs := func(w *mergeWorld, body string) { w.hub.pages[repoPath+"/commits/"+w.head+"/check-runs"] = body }
	cases := []struct {
		name   string
		change func(w *mergeWorld)
		want   string
	}{
		{"no run for the head", func(w *mergeWorld) {
			runs(w, `{"check_runs":[{"name":"test","status":"completed","conclusion":"success"}]}`)
		}, "no run of build for"},
		{"a required job skipped", func(w *mergeWorld) {
			runs(w, `{"check_runs":[{"name":"test","status":"completed","conclusion":"success"},
				{"name":"build","status":"completed","conclusion":"skipped"}]}`)
		}, "build is skipped"},
		{"a required job still running", func(w *mergeWorld) {
			runs(w, `{"check_runs":[{"name":"test","status":"in_progress","conclusion":null},
				{"name":"build","status":"completed","conclusion":"success"}]}`)
		}, "test is in_progress"},
		{"a repo with 0 required checks", func(w *mergeWorld) {
			delete(w.hub.pages, repoPath+"/branches/main/protection/required_status_checks")
		}, "0 required checks on main"},
		{"over 100 review threads", func(w *mergeWorld) {
			w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"pageInfo":{"hasNextPage":true},"nodes":[]}}}}}`
		}, "over 100 review threads"},
		{"one open review thread", func(w *mergeWorld) {
			w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[
				{"isResolved":true,"path":"a.go","line":1,"comments":{"nodes":[{"url":"https://t/1"}]}},
				{"isResolved":false,"path":"script/foo.ts","line":3,"comments":{"nodes":[{"url":"https://t/2"}]}}]}}}}}`
		}, "1 open review thread: script/foo.ts:3 https://t/2"},
		{"no clean recorded", func(w *mergeWorld) {
			write(t, w.store, `{"o/r#8":"`+w.head+`"}`)
		}, "no clean recorded for o/r#7"},
		{"a clean only as a plain pr comment", func(w *mergeWorld) {
			write(t, w.store, `{}`)
			w.hub.pages[repoPath+"/issues/7/comments"] = `[{"user":{"login":"dvakatsiienko"},"body":"verdict: clean\nverified: ` + w.head + `"}]`
		}, "no clean recorded for o/r#7"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			w.hub.mu.Lock()
			c.change(w)
			w.hub.mu.Unlock()

			got := w.run(t, "7", "--apply")

			merges := w.hub.sent("PUT ")
			if got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, "wait: "+c.want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want exit 1, 0 merges and %q", got.code, len(merges), envelopeOf(got).Error, c.want)
			}
		})
	}
}
