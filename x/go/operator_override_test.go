package main

import (
	"os"
	"path/filepath"
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

func TestOverrideNamesGithubsRefusalAndNoLanding(t *testing.T) {
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
