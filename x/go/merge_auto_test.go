package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
)

// a github for merge-auto: GETs answer from pages (a key with "?page=2" beside it splits the list), the
// merge refuses a sha that is not the pr's head, an approve may publish review:clean, and every call
// lands in calls as "METHOD path" with its json body after a space
type hub struct {
	mu        sync.Mutex
	pages     map[string]string
	calls     []string
	auth      []string
	head      string
	onApprove func(h *hub)
}

func (h *hub) serve(t *testing.T) *httptest.Server {
	t.Helper()
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h.mu.Lock()
		defer h.mu.Unlock()
		raw, _ := io.ReadAll(r.Body)
		h.calls = append(h.calls, strings.TrimSpace(r.Method+" "+r.URL.Path+" "+string(raw)))
		h.auth = append(h.auth, r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPut && strings.HasSuffix(r.URL.Path, "/merge"):
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
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/reviews"):
			if h.onApprove != nil {
				h.onApprove(h)
			}
			_, _ = w.Write([]byte(`{"state":"APPROVED"}`))
			return
		case r.Method == http.MethodPost && r.URL.Path == "/graphql":
			_, _ = w.Write([]byte(h.pages["graphql"]))
			return
		}
		key := r.URL.Path
		if r.URL.Query().Get("page") != "" {
			key += "?page=" + r.URL.Query().Get("page")
		} else if _, paged := h.pages[key+"?page=2"]; paged {
			w.Header().Set("Link", `<`+server.URL+r.URL.Path+`?per_page=100&page=2>; rel="next"`)
		}
		body, ok := h.pages[key]
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"message":"Not Found"}`))
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

// a pr world: a bare origin standing in for github.com/o/r, a clone cclio runs merge-auto in, the pr
// branch coder/x touching the given paths, a verifier store, and the hub answering for #7 as all green
type mergeWorld struct {
	clone, origin, seed, head, store string
	hub                              *hub
	env                              []string
}

// moveHead pushes seed's coder/x and points the hub at its new head, every check green on it
func (w *mergeWorld) moveHead(t *testing.T) {
	t.Helper()
	gitT(t, w.seed, "push", "-q", "-f", "origin", "coder/x")
	old, head := w.head, gitT(t, w.seed, "rev-parse", "HEAD")
	w.hub.mu.Lock()
	defer w.hub.mu.Unlock()
	for _, suffix := range []string{"/check-runs", "/statuses"} {
		w.hub.pages[repoPath+"/commits/"+head+suffix] = w.hub.pages[repoPath+"/commits/"+old+suffix]
	}
	w.hub.pages[repoPath+"/pulls/7"] = strings.ReplaceAll(w.hub.pages[repoPath+"/pulls/7"], old, head)
	w.hub.head, w.head = head, head
}

// mainMoves lands one unrelated commit on origin's main and rebases coder/x onto it
func (w *mergeWorld) mainMoves(t *testing.T, name string) {
	t.Helper()
	gitT(t, w.seed, "switch", "-q", "main")
	write(t, filepath.Join(w.seed, name), "main moved\n")
	gitT(t, w.seed, "add", name)
	gitT(t, w.seed, "commit", "-q", "-m", "main: "+name)
	gitT(t, w.seed, "push", "-q", "origin", "main")
	gitT(t, w.seed, "switch", "-q", "coder/x")
	gitT(t, w.seed, "rebase", "-q", "main")
}

func newMergeWorld(t *testing.T, paths ...string) *mergeWorld {
	t.Helper()
	origin := filepath.Join(t.TempDir(), "origin.git")
	gitT(t, filepath.Dir(origin), "init", "-q", "--bare", "-b", "main", origin)
	seed := repo(t)
	gitT(t, seed, "remote", "add", "origin", origin)
	gitT(t, seed, "push", "-q", "origin", "main")
	gitT(t, seed, "switch", "-q", "-c", "coder/x")
	for _, p := range paths {
		write(t, filepath.Join(seed, p), "change in "+p+"\n")
	}
	gitT(t, seed, "add", ".")
	gitT(t, seed, "commit", "-q", "-m", "the pr's change")
	gitT(t, seed, "push", "-q", "origin", "coder/x")
	head := gitT(t, seed, "rev-parse", "HEAD")

	clone := filepath.Join(t.TempDir(), "clone")
	gitT(t, filepath.Dir(clone), "clone", "-q", origin, clone)
	gitT(t, clone, "remote", "set-url", "origin", "https://github.com/o/r.git")
	gitT(t, clone, "config", "url."+origin+".insteadOf", "https://github.com/o/r.git")

	var files []string
	for _, p := range paths {
		files = append(files, `{"filename":"`+p+`","status":"modified"}`)
	}
	h := &hub{head: head, pages: map[string]string{
		repoPath + "/pulls/7": `{"number":7,"title":"a pr","state":"open","merged":false,"body":"the body",
			"head":{"sha":"` + head + `","ref":"coder/x"},"base":{"ref":"main"}}`,
		repoPath + "/pulls/7/files":                                   "[" + strings.Join(files, ",") + "]",
		repoPath + "/branches/main/protection/required_status_checks": `{"contexts":["test","build"]}`,
		repoPath + "/commits/" + head + "/check-runs": `{"total_count":2,"check_runs":[
			{"name":"test","status":"completed","conclusion":"success","html_url":"https://ci/1"},
			{"name":"build","status":"completed","conclusion":"success","html_url":"https://ci/2"}]}`,
		repoPath + "/commits/" + head + "/statuses": `[]`,
		"graphql": `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[]}}}}}`,
	}}
	server := h.serve(t)

	store := filepath.Join(t.TempDir(), "pr-verified.json")
	write(t, store, `{"o/r#7":"`+head+`"}`)
	bin := filepath.Join(t.TempDir(), "bin")
	write(t, filepath.Join(bin, "gh"), "#!/bin/sh\n[ \"$1 $2\" = 'auth token' ] && echo gho_dima && exit 0\necho \"fake gh: $*\" >&2\nexit 1\n")
	env := []string{"PATH=" + bin + ":" + os.Getenv("PATH"), "X_GITHUB_URL=" + server.URL, "X_VERIFIED=" + store,
		"X_KEYS=" + keysFixture(t, map[string]string{})}
	return &mergeWorld{clone: clone, origin: origin, seed: seed, head: head, store: store, hub: h, env: env}
}

func (w *mergeWorld) run(t *testing.T, args ...string) ran {
	t.Helper()
	return xIn(t, w.clone, w.env, append([]string{"lane", "merge-auto"}, args...)...)
}

type mergeCheckRow struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail"`
}

func checkRows(t *testing.T, got ran) []mergeCheckRow {
	t.Helper()
	var envelope struct {
		Data struct {
			Checks []mergeCheckRow `json:"checks"`
		} `json:"data"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return envelope.Data.Checks
}

func TestMergeAutoMergesACleanGreenPrAndPrintsTheThreeChecks(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")

	got := w.run(t, "7", "--apply")

	merges := w.hub.sent("PUT " + repoPath + "/pulls/7/merge")
	if got.code != 0 || len(merges) != 1 || !strings.Contains(merges[0], `"sha":"`+w.head+`"`) {
		t.Fatalf("exit %d, merge calls %q, want one pinned to %s:\n%s", got.code, merges, w.head, got.stdout)
	}
	var names []string
	for _, c := range checkRows(t, got) {
		if !c.OK {
			t.Errorf("check %s reads not ok: %s", c.Name, c.Detail)
		}
		names = append(names, c.Name)
	}
	if !slices.Equal(names, []string{"verifier", "ci", "threads"}) {
		t.Errorf("checks %v, want verifier, ci, threads:\n%s", names, got.stdout)
	}
}

func TestMergeAutoCarriesACleanAcrossARebaseWithUnchangedPatchIds(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	w.mainMoves(t, "one.txt")
	w.mainMoves(t, "two.txt")
	w.moveHead(t)

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want the carried clean to merge:\n%s", got.code, len(merges), got.stdout)
	}
	if rows := checkRows(t, got); len(rows) == 0 || !strings.Contains(rows[0].Detail, "patch-id") {
		t.Errorf("the verifier row %+v does not say the clean carried by patch-id", rows)
	}
}

// lane merge-main's flow: main merged into the branch, nothing else touched — the clean carries
func TestMergeAutoCarriesACleanAcrossAPlainMergeOfMain(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	w.mainMoves(t, "one.txt")
	gitT(t, w.seed, "reset", "-q", "--hard", "origin/coder/x")
	gitT(t, w.seed, "merge", "-q", "--no-edit", "main")
	w.moveHead(t)

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want a plain merge of main to keep the clean:\n%s", got.code, len(merges), got.stdout)
	}
}

func TestMergeAutoWaitsWhenTheBranchChangeIsNotTheVerifiedOne(t *testing.T) {
	cases := map[string]func(t *testing.T, w *mergeWorld){
		"a merge of main that also edits a file": func(t *testing.T, w *mergeWorld) {
			w.mainMoves(t, "one.txt")
			gitT(t, w.seed, "reset", "-q", "--hard", "origin/coder/x")
			gitT(t, w.seed, "merge", "-q", "--no-commit", "main")
			write(t, filepath.Join(w.seed, "script/foo.ts"), "slipped into the merge\n")
			gitT(t, w.seed, "add", "script/foo.ts")
			gitT(t, w.seed, "commit", "-q", "--no-edit")
		},
		"a verified commit dropped": func(t *testing.T, w *mergeWorld) {
			write(t, filepath.Join(w.seed, "script/bar.ts"), "a second verified change\n")
			gitT(t, w.seed, "add", "script/bar.ts")
			gitT(t, w.seed, "commit", "-q", "-m", "second change")
			w.moveHead(t)
			write(t, w.store, `{"o/r#7":"`+w.head+`"}`)
			gitT(t, w.seed, "reset", "-q", "--hard", "HEAD~1")
		},
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			change(t, w)
			w.moveHead(t)

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeError(got), "wait: ") {
				t.Fatalf("exit %d, %d merge calls, error %q, want a wait", got.code, len(merges), envelopeError(got))
			}
		})
	}
}

func TestMergeAutoWaitsWhenAPushChangedThePatchAfterTheClean(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	write(t, filepath.Join(w.seed, "script/foo.ts"), "an unreviewed fix\n")
	gitT(t, w.seed, "commit", "-q", "-am", "unreviewed fix")
	w.moveHead(t)

	got := w.run(t, "7", "--apply")

	want := "wait: " + short(w.head) + " unreviewed fix is past the verifier's clean"
	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeError(got), want) {
		t.Fatalf("exit %d, %d merge calls, error %q, want %q", got.code, len(merges), envelopeError(got), want)
	}
}

// the pr page still names the read head while github's branch moved on: the merge carries the read sha
// and github refuses it, so nothing unread merges
func TestMergeAutoPinsTheMergeToTheHeadItRead(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	w.hub.head = strings.Repeat("d", 40)

	got := w.run(t, "7", "--apply")

	merges := w.hub.sent("PUT ")
	if got.code != 1 || len(merges) != 1 || !strings.Contains(merges[0], `"sha":"`+w.head+`"`) || !strings.Contains(envelopeError(got), "Head branch was modified") {
		t.Fatalf("exit %d, merges %q, error %q, want one merge pinned to %s that github refused", got.code, merges, envelopeError(got), w.head)
	}
}

func riskyOf(t *testing.T, got ran) []string {
	t.Helper()
	var envelope struct {
		Data struct {
			Risky []string `json:"risky"`
		} `json:"data"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return envelope.Data.Risky
}

func TestMergeAutoMergesARiskyPrAndNamesEachRiskyPath(t *testing.T) {
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
			for page, body := range c.files {
				w.hub.pages[repoPath+"/pulls/7/files"+page] = body
			}

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 || !slices.Equal(riskyOf(t, got), c.risky) {
				t.Fatalf("exit %d, %d merge calls, risky %v, want a merge naming %v:\n%s", got.code, len(merges), riskyOf(t, got), c.risky, got.stdout)
			}
		})
	}
}

func TestMergeAutoPrintsTheRiskyLineOnTheBoard(t *testing.T) {
	w := newMergeWorld(t, ".github/workflows/ci.yml")

	got := xIn(t, w.clone, append(w.env, "CLAUDECODE="), "lane", "merge-auto", "7", "--apply", "--board")

	if plain := sgr.ReplaceAllString(got.stdout, ""); got.code != 0 || !strings.Contains(plain, "risky: .github/workflows/ci.yml") {
		t.Fatalf("exit %d, the board names no risky line:\n%s", got.code, plain)
	}
}

func TestMergeAutoMarksACheckThatDoesNotHoldOnTheBoard(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	write(t, w.store, `{}`)

	got := xIn(t, w.clone, append(w.env, "CLAUDECODE="), "lane", "merge-auto", "7", "--board")

	if plain := sgr.ReplaceAllString(got.stdout, ""); got.code != 1 || !strings.Contains(plain, "✗ verifier") || !strings.Contains(plain, "✓ ci") {
		t.Fatalf("exit %d, want ✗ on the verifier and ✓ on ci:\n%s", got.code, plain)
	}
}

func TestMergeAutoWaitsForDimaOnASelfEdit(t *testing.T) {
	for _, path := range []string{
		"home/.claude/plugin-x/mods/x-mod-guard/guard.ts",
		"cclio/.claude/hooks/pr-watch.sh",
		"home/.claude/shelf/hooks/worktree-seed.sh",
		"lefthook.yaml",
		".github/workflows/review.yml",
		".github/workflows/review-approved.yml",
		"x/go/risky.json",
		"x/go/merge_auto.go",
		"x/go/gh.go",
		"x/go/keys.go",
	} {
		t.Run(path, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts", path)

			got := w.run(t, "7", "--apply")

			want := "wait: self-edit, needs dima's word — " + path
			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeError(got), want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want %q", got.code, len(merges), envelopeError(got), want)
			}
		})
	}
}

// commitAt lands a commit on seed's main at a fixed committer date and pushes it
func commitAt(t *testing.T, w *mergeWorld, date string, args ...string) string {
	t.Helper()
	gitT(t, w.seed, "switch", "-q", "main")
	c := exec.Command("git", append([]string{"-c", "commit.gpgsign=false"}, args...)...)
	c.Dir = w.seed
	c.Env = append(cleanEnv(), "GIT_COMMITTER_DATE="+date, "GIT_AUTHOR_DATE="+date)
	if out, err := c.CombinedOutput(); err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
	gitT(t, w.seed, "push", "-q", "origin", "main")
	sha := gitT(t, w.seed, "rev-parse", "HEAD")
	gitT(t, w.seed, "switch", "-q", "coder/x")
	return sha
}

const brakeNow = "2026-10-22T12:00:00Z"

func TestMergeAutoBrakesForSevenDaysAfterARevertOfItsMerge(t *testing.T) {
	cases := []struct {
		name     string
		revertAt string
		revert   func(t *testing.T, w *mergeWorld, merged, at string) string
		brake    bool
	}{
		{"git revert 4 days ago", "2026-10-18T12:00:00Z", gitRevert, true},
		{"github's revert pr 6 days ago", "2026-10-16T12:00:00Z", githubRevert, true},
		{"git revert 8 days ago", "2026-10-14T11:59:00Z", gitRevert, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			write(t, filepath.Join(w.seed, "merged.txt"), "an earlier pr\n")
			gitT(t, w.seed, "add", "merged.txt")
			merged := commitAt(t, w, "2026-10-12T12:00:00Z", "commit", "-q", "-m", "an earlier pr (#5)\n\nthe body\n\n"+mergeTrailer)
			revert := c.revert(t, w, merged, c.revertAt)

			got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

			merges := w.hub.sent("PUT ")
			if !c.brake {
				if got.code != 0 || len(merges) != 1 {
					t.Fatalf("exit %d, %d merge calls, want the brake off after 7 days:\n%s", got.code, len(merges), got.stdout)
				}
				return
			}
			want := "wait: brake on, needs dima's word — " + short(revert)
			if got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeError(got), want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want %q", got.code, len(merges), envelopeError(got), want)
			}
		})
	}
}

func TestMergeAutoIgnoresARevertOfAHandMerge(t *testing.T) {
	w := newMergeWorld(t, "script/foo.ts")
	write(t, filepath.Join(w.seed, "merged.txt"), "a hand merge\n")
	gitT(t, w.seed, "add", "merged.txt")
	merged := commitAt(t, w, "2026-10-20T12:00:00Z", "commit", "-q", "-m", "a hand merge (#4)")
	gitRevert(t, w, merged, "2026-10-21T12:00:00Z")

	got := xIn(t, w.clone, append(w.env, "X_NOW="+brakeNow), "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls, want no brake for a merge merge-auto never made:\n%s", got.code, len(merges), got.stdout)
	}
}

func gitRevert(t *testing.T, w *mergeWorld, merged, at string) string {
	return commitAt(t, w, at, "revert", "--no-edit", merged)
}

// github's revert button squashes into `Revert "<subject>" (#n)`, the reverted sha nowhere in it
func githubRevert(t *testing.T, w *mergeWorld, _, at string) string {
	gitT(t, w.seed, "switch", "-q", "main")
	gitT(t, w.seed, "rm", "-q", "merged.txt")
	return commitAt(t, w, at, "commit", "-q", "-m", "Revert \"an earlier pr (#5)\" (#6)\n\nReverts o/r#5")
}

// bytes: review:clean is a required check, and an approve on dima's account makes review-approved.yml
// publish it green on the approved head
func bytesWorld(t *testing.T, publishes bool) *mergeWorld {
	w := newMergeWorld(t, "apps/speak/src/a.ts")
	w.hub.pages[repoPath+"/branches/main/protection/required_status_checks"] = `{"contexts":["test","build","review:clean"]}`
	if publishes {
		w.hub.onApprove = func(h *hub) {
			h.pages[repoPath+"/commits/"+h.head+"/check-runs"] = `{"check_runs":[
				{"name":"test","status":"completed","conclusion":"success"},
				{"name":"build","status":"completed","conclusion":"success"},
				{"name":"review:clean","status":"completed","conclusion":"success"}]}`
		}
	}
	return w
}

func TestMergeAutoApprovesABytesHeadThenMergesOnReviewClean(t *testing.T) {
	w := bytesWorld(t, true)

	got := xIn(t, w.clone, append(w.env, "X_POLL=10ms"), "lane", "merge-auto", "7", "--apply")

	approves := w.hub.sent("POST " + repoPath + "/pulls/7/reviews")
	merges := w.hub.sent("PUT ")
	if got.code != 0 || len(approves) != 1 || len(merges) != 1 {
		t.Fatalf("exit %d, %d approves, %d merges, want one each:\n%s", got.code, len(approves), len(merges), got.stdout)
	}
	if !strings.Contains(approves[0], `"event":"APPROVE"`) || !strings.Contains(approves[0], `"commit_id":"`+w.head+`"`) {
		t.Errorf("the approve %q is not an APPROVE of the head %s", approves[0], w.head)
	}
	if calls := strings.Join(w.hub.calls, "\n"); strings.Index(calls, "POST "+repoPath+"/pulls/7/reviews") > strings.Index(calls, "PUT ") {
		t.Errorf("the merge went before the approve:\n%s", calls)
	}
	for _, a := range w.hub.auth {
		if a != "Bearer gho_dima" {
			t.Fatalf("a call went out as %q, want dima's gh login", a)
		}
	}
}

func TestMergeAutoApprovesNothingUnlessTheRestHolds(t *testing.T) {
	cases := map[string]func(w *mergeWorld){
		"the verifier is not clean": func(w *mergeWorld) { write(t, w.store, `{}`) },
		"a thread is open": func(w *mergeWorld) {
			w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[
				{"isResolved":false,"path":"a.ts","line":1,"comments":{"nodes":[{"url":"https://t/1"}]}}]}}}}}`
		},
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			w := bytesWorld(t, true)
			change(w)

			got := xIn(t, w.clone, append(w.env, "X_POLL=10ms"), "lane", "merge-auto", "7", "--apply")

			if approves, merges := w.hub.sent("POST "+repoPath+"/pulls/7/reviews"), w.hub.sent("PUT "); got.code != 1 || len(approves)+len(merges) != 0 {
				t.Fatalf("exit %d, %d approves, %d merges, want neither:\n%s", got.code, len(approves), len(merges), got.stdout)
			}
		})
	}
}

func TestMergeAutoStopsWhenReviewCleanNeverLands(t *testing.T) {
	w := bytesWorld(t, false)

	got := xIn(t, w.clone, append(w.env, "X_POLL=10ms", "X_REVIEW_WAIT=200ms"), "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeError(got), "review:clean") {
		t.Fatalf("exit %d, %d merges, error %q, want a stop naming review:clean", got.code, len(merges), envelopeError(got))
	}
}

// the want line: dima never presses approve — a low-risk pr and a risky one both merge in frame, with no
// approve and no github auto-merge, and the risky one names its path
func TestMergeAutoMergesBothPrsWithoutDimasHandOrGithubsAutoMerge(t *testing.T) {
	plain, risky := newMergeWorld(t, "script/foo.ts"), newMergeWorld(t, ".github/workflows/ci.yml")

	gotPlain, gotRisky := plain.run(t, "7", "--apply"), risky.run(t, "7", "--apply")

	for _, w := range []*mergeWorld{plain, risky} {
		calls := strings.Join(w.hub.calls, "\n")
		if len(w.hub.sent("PUT ")) != 1 || strings.Contains(calls, "/reviews") || strings.Contains(calls, "enablePullRequestAutoMerge") || strings.Contains(calls, "auto-merge") {
			t.Fatalf("want one merge, no approve, no auto-merge:\n%s", calls)
		}
	}
	if gotPlain.code != 0 || gotRisky.code != 0 || len(riskyOf(t, gotPlain)) != 0 || !slices.Equal(riskyOf(t, gotRisky), []string{".github/workflows/ci.yml"}) {
		t.Fatalf("exits %d %d, risky %v %v", gotPlain.code, gotRisky.code, riskyOf(t, gotPlain), riskyOf(t, gotRisky))
	}
}

func TestMergeAutoDryRunPlansAMergeAndRefusesAWait(t *testing.T) {
	clean, waiting := newMergeWorld(t, "script/foo.ts"), newMergeWorld(t, "script/foo.ts")
	write(t, waiting.store, `{}`)

	planned, refused := clean.run(t, "7"), waiting.run(t, "7")

	if planned.code != 4 || refused.code != 1 || !strings.Contains(envelopeError(refused), "wait: ") {
		t.Fatalf("exits %d and %d, want 4 for a merge to confirm and 1 for a wait:\n%s\n%s", planned.code, refused.code, planned.stdout, refused.stdout)
	}
	if len(clean.hub.sent("PUT "))+len(waiting.hub.sent("PUT ")) != 0 {
		t.Error("a dry run sent a merge")
	}
}

func envelopeError(got ran) string {
	var envelope struct {
		Error string `json:"error"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return envelope.Error
}

func TestMergeAutoWaitsAndNamesWhy(t *testing.T) {
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
		{"one open review thread", func(w *mergeWorld) {
			w.hub.pages["graphql"] = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[
				{"isResolved":true,"path":"a.go","line":1,"comments":{"nodes":[{"url":"https://t/1"}]}},
				{"isResolved":false,"path":"script/foo.ts","line":3,"comments":{"nodes":[{"url":"https://t/2"}]}}]}}}}}`
		}, "1 open review thread: script/foo.ts:3 https://t/2"},
		{"no verifier clean recorded", func(w *mergeWorld) {
			write(t, w.store, `{"o/r#8":"`+w.head+`"}`)
		}, "no verifier clean recorded for o/r#7"},
		{"a clean only as a plain pr comment", func(w *mergeWorld) {
			write(t, w.store, `{}`)
			w.hub.pages[repoPath+"/issues/7/comments"] = `[{"user":{"login":"dvakatsiienko"},"body":"verdict: clean\nverified: ` + w.head + `"}]`
		}, "no verifier clean recorded for o/r#7"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			w := newMergeWorld(t, "script/foo.ts")
			c.change(w)

			got := w.run(t, "7", "--apply")

			merges := w.hub.sent("PUT ")
			if got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeError(got), "wait: "+c.want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want exit 1, 0 merges and %q", got.code, len(merges), envelopeError(got), c.want)
			}
		})
	}
}
