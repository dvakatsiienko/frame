package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type planted struct {
	name, caller, kind string
	ms                 int
}

// plant writes trace lines into the day file `ago` days back
func plant(t *testing.T, state string, ago int, lines ...planted) string {
	t.Helper()
	day := time.Now().AddDate(0, 0, -ago).Format(time.DateOnly)
	var body strings.Builder
	for _, l := range lines {
		fmt.Fprintf(&body, `{"name":%q,"duration_ms":%d,"x.caller":%q,"error.type":%q}`+"\n", l.name, l.ms, l.caller, l.kind)
	}
	path := filepath.Join(state, "traces", day+".jsonl")
	write(t, path, body.String())
	return path
}

func TestStatsGivesEachVerbItsP50AndP95(t *testing.T) {
	state := t.TempDir()
	var lines []planted
	for ms := 1; ms <= 20; ms++ {
		lines = append(lines, planted{"schema", "cc", "", ms})
	}
	plant(t, state, 0, append(lines, planted{"lane push", "cc", "external", 900})...)

	got := xIn(t, repo(t), tracing(state), "stats")

	want := `[{"calls":20,"failures":{},"name":"schema","p50_ms":10,"p95_ms":19},{"calls":1,"failures":{"external":1},"name":"lane push","p50_ms":900,"p95_ms":900}]`
	if marshal(got.data["verbs"]) != want {
		t.Errorf("verbs = %s\nwant    %s", marshal(got.data["verbs"]), want)
	}
}

func TestStatsNamesTheVerbsWithNoCalls(t *testing.T) {
	state := t.TempDir()
	plant(t, state, 0, planted{"schema", "cc", "", 3}, planted{"lane commit", "cc", "", 3})

	got := xIn(t, repo(t), tracing(state), "stats")

	unused := marshal(got.data["unused"])
	for _, name := range []string{"lane push", "knowledge read"} {
		if !strings.Contains(unused, `"`+name+`"`) {
			t.Errorf("unused %s lacks %s", unused, name)
		}
	}
	for _, name := range []string{"schema", "lane commit"} {
		if strings.Contains(unused, `"`+name+`"`) {
			t.Errorf("unused %s names %s, which was called", unused, name)
		}
	}
}

func TestStatsTrashesDaysOlderThan90(t *testing.T) {
	state, bin, bin2 := t.TempDir(), t.TempDir(), t.TempDir()
	write(t, filepath.Join(bin, "trash"), "#!/bin/sh\nmv \"$@\" "+bin2+"/\n")
	old := plant(t, state, 91, planted{"schema", "cc", "", 3})
	kept := plant(t, state, 89, planted{"schema", "cc", "", 3})

	got := xIn(t, repo(t), tracing(state, "PATH="+bin+":/usr/bin:/bin"), "stats")

	if marshal(got.data["trashed"]) != marshal([]string{filepath.Base(old)}) {
		t.Errorf("trashed %s, want the 91-day file", marshal(got.data["trashed"]))
	}
	if _, err := os.Stat(filepath.Join(bin2, filepath.Base(old))); err != nil {
		t.Errorf("the 91-day file never reached the trash: %v", err)
	}
	if _, err := os.Stat(kept); err != nil {
		t.Errorf("the 89-day file is gone: %v", err)
	}
}

func TestStatsRefusesAWindowPastTheKeptDays(t *testing.T) {
	got := xIn(t, repo(t), nil, "stats", "--days", "120")
	if got.code != 2 || got.next != "x stats --days 90" {
		t.Errorf("exit %d, next %q: %s", got.code, got.next, got.stdout)
	}
}

func TestStatsSkipsALineWithABlankName(t *testing.T) {
	state := t.TempDir()
	plant(t, state, 0, planted{" ", "cc", "", 3}, planted{"schema", "cc", "", 3})
	if got := xIn(t, repo(t), tracing(state), "stats"); got.code != 0 || marshal(got.data["calls"]) != "1" {
		t.Errorf("exit %d, calls %s", got.code, marshal(got.data["calls"]))
	}
}

func TestStatsCountsALineWithNoCallerAsUnknown(t *testing.T) {
	state := t.TempDir()
	plant(t, state, 0, planted{"schema", "", "", 3})
	if got := xIn(t, repo(t), tracing(state), "stats"); marshal(got.data["callers"]) != `{"unknown":1}` {
		t.Errorf("callers %s", marshal(got.data["callers"]))
	}
}

func TestStatsCountsTheCallsInTheWindow(t *testing.T) {
	state := t.TempDir()
	plant(t, state, 0,
		planted{"schema", "cc", "", 10}, planted{"schema", "cc", "", 20},
		planted{"lane commit", "dima", "refused", 100}, planted{"pnpm x-go:test", "dima", "", 3000})
	plant(t, state, 5, planted{"lane commit", "cc", "", 200})
	plant(t, state, 40, planted{"schema", "cc", "", 5})

	got := xIn(t, repo(t), tracing(state), "stats", "--days", "30")

	if got.code != 0 {
		t.Fatalf("exit %d: %s", got.code, got.stdout)
	}
	want := map[string]string{
		"calls":    `5`,
		"callers":  `{"cc":3,"dima":2}`,
		"failures": `{"refused":1}`,
		"families": `[{"calls":2,"name":"lane","raw":[]},{"calls":2,"name":"schema","raw":[]},{"calls":1,"name":"pnpm","raw":[]}]`,
	}
	for key, value := range want {
		if marshal(got.data[key]) != value {
			t.Errorf("%s = %s, want %s", key, marshal(got.data[key]), value)
		}
	}
}

func TestATraceLineSaysAWorktreeBuiltIt(t *testing.T) {
	cases := []struct {
		name, src string
		dev       bool
	}{
		{"a worktree build", "/a/frame/.claude/worktrees/b/x/go", true},
		{"a main checkout build", "/a/frame/x/go", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			bin, state := filepath.Join(t.TempDir(), "x"), t.TempDir()
			if out, err := exec.Command("go", "build", "-ldflags", "-X main.srcDir="+c.src, "-o", bin, ".").CombinedOutput(); err != nil {
				t.Fatalf("build: %v\n%s", err, out)
			}
			run := exec.Command(bin, "schema")
			run.Env = append(cleanEnv(), tracing(state)...)
			if out, err := run.CombinedOutput(); err != nil {
				t.Fatalf("x schema: %v\n%s", err, out)
			}

			lines := traces(t, state)
			if len(lines) != 1 || (lines[0]["x.dev"] == true) != c.dev {
				t.Errorf("x.dev = %v, want %v (%d lines)", lines[0]["x.dev"], c.dev, len(lines))
			}
		})
	}
}

func TestStatsDaysIsTheSpanOfTheTraces(t *testing.T) {
	state := t.TempDir()
	plant(t, state, 1, planted{"schema", "cc", "", 3})
	plant(t, state, 0, planted{"schema", "cc", "", 3})

	got := xIn(t, repo(t), tracing(state), "stats", "--days", "30")

	day := func(ago int) string { return `"` + time.Now().AddDate(0, 0, -ago).Format(time.DateOnly) + `"` }
	want := map[string]string{"days": `2`, "first": day(1), "last": day(0)}
	for key, value := range want {
		if marshal(got.data[key]) != value {
			t.Errorf("%s = %s, want %s", key, marshal(got.data[key]), value)
		}
	}
}

func TestStatsLeavesDevBuildsOutUnlessAsked(t *testing.T) {
	dev := `{"name":"schema","duration_ms":3,"x.caller":"cc","service.version":"v1-go+abc1234","x.dev":true}` + "\n"
	cases := []struct {
		name, calls, days string
		argv              []string
	}{
		{"by default", `1`, `1`, []string{"stats"}},
		{"with --dev", `3`, `4`, []string{"stats", "--dev"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			state := t.TempDir()
			plant(t, state, 0, planted{"schema", "cc", "", 3})
			write(t, filepath.Join(state, "traces", time.Now().AddDate(0, 0, -3).Format(time.DateOnly)+".jsonl"), dev+dev)

			got := xIn(t, repo(t), tracing(state), c.argv...)
			for key, value := range map[string]string{"calls": c.calls, "days": c.days, "dev": `2`} {
				if marshal(got.data[key]) != value {
					t.Errorf("%s = %s, want %s", key, marshal(got.data[key]), value)
				}
			}
		})
	}
}
