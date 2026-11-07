package main

import (
	"encoding/json"
	"os"
	"os/user"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"
)

const overrideAt = "2026-11-07T15:24:00+02:00"

// a world whose store holds the given json; "" plants no store
func overrideWorld(t *testing.T, store string, paths ...string) (*mergeWorld, string) {
	t.Helper()
	w := newMergeWorld(t, paths...)
	path := filepath.Join(t.TempDir(), "operator-override.json")
	if store != "" {
		write(t, path, store)
	}
	w.env = append(w.env, "X_OVERRIDE_STORE="+path)
	return w, path
}

func prsOn() string { return `{"prs":{"by":"word","at":"` + overrideAt + `"}}` }

// every check that answers no, and every read that fails, under one on: all in one world to spare its git spawns
func TestOverrideLandsPastEveryCheck(t *testing.T) {
	t.Parallel()
	const openThread = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":false,"path":"a.ts","line":1,"comments":{"nodes":[]}}]}}}}}`
	cases := []struct {
		name  string
		setup func(w *mergeWorld)
	}{
		{"every check answers no: a self-edit, no clean, red ci, an open thread, no round", func(w *mergeWorld) {
			write(t, w.store, `{}`)
			w.hub.pages[repoPath+"/commits/"+w.head+"/check-runs"] = `{"total_count":1,"check_runs":[{"name":"test","status":"completed","conclusion":"failure","html_url":"https://ci/1"}]}`
			w.hub.pages["graphql"] = openThread
			w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = `{"workflow_runs":[]}`
			w.env = append(w.env, "X_ROUND_REPO=o/r")
		}},
		{"every read fails: clean, ci, round, threads, risky, a graphql error, a stack", func(w *mergeWorld) {
			write(t, w.store, `not json`)
			w.hub.pages[repoPath+"/branches/main/protection/required_status_checks"] = serverDown
			w.hub.pages[repoPath+"/actions/workflows/review.yml/runs"] = serverDown
			w.hub.pages[repoPath+"/pulls/7/files"] = serverDown
			w.hub.pages[repoPath+"/stacks"] = serverDown
			w.hub.pages["graphql"] = `{"errors":[{"message":"Something went wrong"}]}`
			w.env = append(w.env, "X_ROUND_REPO=o/r")
		}},
		{"a repo with no required checks", func(w *mergeWorld) {
			delete(w.hub.pages, repoPath+"/branches/main/protection/required_status_checks")
		}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w, store := overrideWorld(t, prsOn(), "x/go/merge_auto.go")
			c.setup(w)
			w.env = append(w.env, "X_DEV_BUILD=1")

			got := w.run(t, "7", "--apply")

			merges := w.hub.sent("PUT ")
			if got.code != 0 || len(merges) != 1 {
				t.Fatalf("exit %d, %d merge calls\n%s", got.code, len(merges), got.stdout)
			}
			if !strings.Contains(merges[0], "Operator-override: prs, by word at "+overrideAt) {
				t.Errorf("the squash message names no override: %s", merges[0])
			}
			used := envelopeOf(got).Data.Override
			if used == nil || used.By != "word" || used.At != overrideAt || !used.DevBuild {
				t.Errorf("the output field = %+v, want by word at %s from a dev build", used, overrideAt)
			}
			line := read(t, filepath.Join(filepath.Dir(store), "operator-override.log"))
			for _, want := range []string{`"scope":"prs"`, `"by":"word"`, `"since":"` + overrideAt + `"`, `"what":"o/r#7 at `, `"dev_build":true`} {
				if !strings.Contains(line, want) {
					t.Errorf("the log line %q holds no %s", line, want)
				}
			}
		})
	}
}

func TestOverrideLandsFromAWing(t *testing.T) {
	t.Parallel()
	w, _ := overrideWorld(t, prsOn(), "x/go/merge_auto.go")
	wing := filepath.Join(t.TempDir(), "wing")
	gitT(t, w.clone, "worktree", "add", "-q", "--detach", wing)

	got := xIn(t, wing, w.env, "lane", "merge-auto", "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 0 || len(merges) != 1 {
		t.Fatalf("exit %d, %d merge calls\n%s", got.code, len(merges), got.stdout)
	}
}

func TestOverrideOffWaitsAsToday(t *testing.T) {
	t.Parallel()
	cases := []struct{ name, store string }{
		{"no store", ""},
		{"an empty store", `{}`},
		{"a store that does not parse", `{"prs":`},
		{"another scope only", `{"guards":{"by":"word","at":"` + overrideAt + `"}}`},
		{"a grant with no by", `{"prs":{"at":"` + overrideAt + `"}}`},
		{"a grant past its until", `{"prs":{"by":"word","at":"` + overrideAt + `","until":"2020-01-01T00:00:00Z"}}`},
		{"an until that does not parse", `{"prs":{"by":"word","at":"` + overrideAt + `","until":"soon"}}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w, _ := overrideWorld(t, c.store, "x/go/merge_auto.go")

			got := w.run(t, "7", "--apply")

			want := "--apply --dima-ok 7"
			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(envelopeOf(got).Error, want) {
				t.Fatalf("exit %d, %d merge calls, error %q, want it to name %q", got.code, len(merges), envelopeOf(got).Error, want)
			}
		})
	}
}

func TestOverrideStillStopsOnHoldAndBrake(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, want string
		setup      func(w *mergeWorld)
	}{
		{"his hold", "held by dima's hold", func(w *mergeWorld) { write(t, holdRecordOf(w), `{"prs":["7"]}`) }},
		{"a hold record that does not read", "unreadable", func(w *mergeWorld) { write(t, holdRecordOf(w), `not json`) }},
		{"the brake", "brake on", func(w *mergeWorld) {
			w.hub.pages[repoPath+"/issues"] = `[{"number":8,"labels":[{"name":"` + brakeLabel + `"}]}]`
		}},
		{"a brake that does not read", "the brake did not read", func(w *mergeWorld) { w.hub.pages[repoPath+"/issues"] = serverDown }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w, _ := overrideWorld(t, prsOn(), "x/go/merge_auto.go")
			c.setup(w)

			got := w.run(t, "7", "--apply")

			if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(got.stdout, c.want) {
				t.Fatalf("exit %d, %d merge calls, want %q in\n%s", got.code, len(merges), c.want, got.stdout)
			}
		})
	}
}

func TestOverrideQuestionTakesASessionBesideItsScope(t *testing.T) {
	t.Parallel()
	store := filepath.Join(t.TempDir(), "operator-override.json")
	write(t, store, `{"prs":{"by":"word","at":"a"},"guards:s1":{"by":"word","at":"b"}}`)
	cases := []struct {
		scope, session string
		on             bool
	}{
		{"prs", "", true},
		{"guards", "s1", true},
		{"guards", "s2", false},
		{"guards", "", false},
		{"prs", "s1", false},
	}
	for _, c := range cases {
		if _, on := overrideGrantIn(store, c.scope, c.session); on != c.on {
			t.Errorf("%s for session %q: on = %v, want %v", c.scope, c.session, on, c.on)
		}
	}
}

func TestOverrideStoreIgnoresHomeAndXState(t *testing.T) {
	// serial: t.Setenv
	planted := t.TempDir()
	t.Setenv("HOME", planted)
	t.Setenv("X_STATE", planted)
	t.Setenv("X_OVERRIDE_STORE", filepath.Join(planted, "store.json"))
	t.Setenv("X_TEST", "")

	got := overrideStore()

	me, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(me.HomeDir, ".local/state/x/operator-override.json"); got != want || strings.HasPrefix(got, planted) {
		t.Errorf("the store = %s, want %s, never under the planted %s", got, want, planted)
	}
}

func TestOverrideOffClearsWhatItNames(t *testing.T) {
	t.Parallel()
	const both = `{"guards":{"by":"word","at":"a"},"prs":{"by":"shift","at":"b"}}`
	cases := []struct {
		name, store, want string
		args              []string
		cleared           string
	}{
		{"every scope", both, `{}`, []string{"--override-off"}, "guards,prs"},
		{"shift-only takes a shift's", both, `{"guards":{"by":"word","at":"a"}}`, []string{"--override-off", "--shift-only"}, "prs"},
		{"shift-only leaves his word", prsOn(), prsOn(), []string{"--override-off", "--shift-only"}, ""},
		{"a store that does not parse goes", `{"prs":`, `{}`, []string{"--override-off"}, ""},
		{"shift-only leaves one that does not parse", `{"prs":`, `{"prs":`, []string{"--override-off", "--shift-only"}, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			store := filepath.Join(t.TempDir(), "operator-override.json")
			write(t, store, c.store)
			env := []string{"X_OVERRIDE_STORE=" + store}

			dry := xIn(t, t.TempDir(), env, append([]string{"lane", "merge-auto"}, c.args...)...)
			if dry.code != 4 || read(t, store) != c.store {
				t.Fatalf("without --apply: exit %d, store %s, want 4 and it unchanged\n%s", dry.code, read(t, store), dry.stdout)
			}
			if !strings.Contains(dry.next, "--override-off") {
				t.Errorf("the confirm command %q drops --override-off", dry.next)
			}
			got := xIn(t, t.TempDir(), env, append([]string{"lane", "merge-auto", "--apply"}, c.args...)...)

			if got.code != 0 || !jsonEqual(read(t, store), c.want) {
				t.Fatalf("exit %d, store %s, want %s\n%s", got.code, read(t, store), c.want, got.stdout)
			}
			if said := strings.Join(envelopeOf(got).Data.Cleared, ","); said != c.cleared {
				t.Errorf("cleared %q, want %q", said, c.cleared)
			}
		})
	}
}

func jsonEqual(a, b string) bool {
	if !json.Valid([]byte(a)) || !json.Valid([]byte(b)) {
		return a == b
	}
	var x, y any
	_ = json.Unmarshal([]byte(a), &x)
	_ = json.Unmarshal([]byte(b), &y)
	return reflect.DeepEqual(x, y)
}

func TestOverrideOffKeepsItsArgvExact(t *testing.T) {
	t.Parallel()
	for _, args := range [][]string{
		{"--override-off", "7"},
		{"--shift-only"},
		{"7", "--shift-only"},
		{},
	} {
		t.Run(strings.Join(args, " "), func(t *testing.T) {
			t.Parallel()
			got := xIn(t, t.TempDir(), nil, append([]string{"lane", "merge-auto", "--apply"}, args...)...)
			if got.code != 2 || !strings.Contains(got.stdout, "merge-auto") {
				t.Fatalf("exit %d, want 2\n%s", got.code, got.stdout)
			}
			if slices.Contains(args, "--shift-only") && !strings.Contains(got.stdout, "narrows --override-off") {
				t.Errorf("--shift-only alone names no --override-off\n%s", got.stdout)
			}
		})
	}
}

// --override-check, its one clone named: it runs outside any repo, so a read in the wrong dir fails
func overrideCheck(t *testing.T, w *mergeWorld) (ran, overrideCheckReport) {
	t.Helper()
	w.hub.pages[repoPath+"/pulls"] = `[{"number":7,"title":"a pr"}]`
	got := xIn(t, t.TempDir(), append(w.env, "X_OVERRIDE_CLONES=o/r="+w.clone), "lane", "merge-auto", "--override-check")
	var envelope struct {
		Data overrideCheckReport `json:"data"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return got, envelope.Data
}

func TestOverrideCheckNamesWhatWouldStopEachPr(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, store, stops string
		lands              bool
		setup              func(w *mergeWorld)
	}{
		{name: "on, a self-edit lands", store: prsOn(), lands: true},
		{name: "on, a held pr names the hold", store: prsOn(), stops: "held by dima's hold", setup: func(w *mergeWorld) { write(t, holdRecordOf(w), `{"prs":["7"]}`) }},
		{name: "off, a self-edit names his word", stops: "self-edit, needs dima's word"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			w, store := overrideWorld(t, c.store, "x/go/merge_auto.go")
			if c.setup != nil {
				c.setup(w)
			}
			got, report := overrideCheck(t, w)

			if got.code != 0 || len(report.Prs) != 1 || report.Prs[0].PR != 7 {
				t.Fatalf("exit %d, prs %+v\n%s", got.code, report.Prs, got.stdout)
			}
			if stops := report.Prs[0].Stops; (c.lands && stops != "") || !strings.Contains(stops, c.stops) {
				t.Errorf("stops %q, want %q", stops, c.stops)
			}
			if isOn := report.Override != nil && report.Override.By == "word"; isOn != (c.store != "") {
				t.Errorf("the report's override = %+v, with store %q", report.Override, c.store)
			}
			if writes := append(w.hub.sent("PUT "), w.hub.sent("DELETE ")...); len(writes) != 0 {
				t.Errorf("a read-only check wrote to github: %q", writes)
			}
			if c.store != "" && read(t, store) != c.store {
				t.Errorf("the store moved: %s", read(t, store))
			}
			if _, err := os.Stat(filepath.Join(filepath.Dir(store), "operator-override.log")); err == nil {
				t.Errorf("a read-only check logged a pass")
			}
		})
	}
}

func TestOverrideCheckNamesGithubsOwnRefusals(t *testing.T) {
	t.Parallel()
	for field, want := range map[string]string{`"draft":true`: "a draft", `"mergeable":false`: "a conflict"} {
		t.Run(want, func(t *testing.T) {
			t.Parallel()
			w, _ := overrideWorld(t, prsOn(), "script/foo.ts")
			w.hub.pages[repoPath+"/pulls/7"] = strings.Replace(w.hub.pages[repoPath+"/pulls/7"], `"number":7,`, `"number":7,`+field+`,`, 1)

			_, report := overrideCheck(t, w)

			if len(report.Prs) != 1 || !strings.Contains(report.Prs[0].Stops, want) {
				t.Fatalf("prs %+v, want it to name %q", report.Prs, want)
			}
		})
	}
}

func TestOverrideCheckNamesAMissingClone(t *testing.T) {
	t.Parallel()
	got := xIn(t, t.TempDir(), []string{"X_OVERRIDE_CLONES=o/b=/no/such/clone", "X_GITHUB_URL=http://127.0.0.1:1"}, "lane", "merge-auto", "--override-check")
	if got.code != 0 || !strings.Contains(got.stdout, "no clone of o/b") {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}

func TestOverrideCheckKeepsItsArgvExact(t *testing.T) {
	t.Parallel()
	for _, args := range [][]string{{"--override-check", "7"}, {"--override-check", "--override-off"}, {"--override-check", "--shift-only"}} {
		if got := xIn(t, t.TempDir(), nil, append([]string{"lane", "merge-auto"}, args...)...); got.code != 2 {
			t.Errorf("%v: exit %d, want 2\n%s", args, got.code, got.stdout)
		}
	}
}

func TestOverrideOffAfterTheReadMergesNothing(t *testing.T) {
	t.Parallel()
	w, store := overrideWorld(t, prsOn(), "script/foo.ts")
	w.hub.onRead = func(path string) {
		if path == repoPath+"/issues" {
			_ = os.WriteFile(store, []byte(`{}`), 0o644)
		}
	}

	got := w.run(t, "7", "--apply")

	if merges := w.hub.sent("PUT "); got.code != 1 || len(merges) != 0 || !strings.Contains(got.stdout, "went off after the read") {
		t.Fatalf("exit %d, %d merge calls\n%s", got.code, len(merges), got.stdout)
	}
}

func TestOverrideNamesGithubsRefusalWithNoLanding(t *testing.T) {
	t.Parallel()
	for _, refusal := range []string{
		"405 Pull Request is still a draft",
		"405 Pull Request is not mergeable",
		"405 Repository rule violations found",
	} {
		t.Run(refusal, func(t *testing.T) {
			t.Parallel()
			w, store := overrideWorld(t, prsOn(), "x/go/merge_auto.go")
			w.hub.refuseMerge = refusal

			got := w.run(t, "7", "--apply")

			_, words, _ := strings.Cut(refusal, " ")
			if got.code == 0 || !strings.Contains(got.stdout, words) || strings.Contains(got.stdout, "merged #7") {
				t.Fatalf("exit %d, want non-zero with %q and no landing\n%s", got.code, words, got.stdout)
			}
			if _, err := os.Stat(filepath.Join(filepath.Dir(store), "operator-override.log")); err == nil {
				t.Errorf("a refused merge wrote a pass line")
			}
		})
	}
}
