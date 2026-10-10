package main

import (
	"strings"
	"testing"
)

func exitSection(lines ...string) string {
	return "## exit\n\n" + strings.Join(lines, "\n") + "\n"
}

func TestXCommandFindingsChecksEachNamedVerbAndFlag(t *testing.T) {
	cases := []struct {
		name string
		body string
		want []string
	}{
		{"a verb the registry lacks", exitSection("1. `x lane nope` prints ok"), []string{"verb x lane nope"}},
		{"a mistyped sub-verb", exitSection("1. `x lane gaet` prints ok"), []string{"verb x lane gaet"}},
		{"a mistyped family", exitSection("1. `x lanee gate` prints ok"), []string{"verb x lanee"}},
		{"a flag the verb lacks", exitSection("1. `x lane gate --dry` prints ok"), []string{"flag --dry"}},
		{"a flag on a verb with own flags", exitSection("1. `x lane commit --repo . --nope` prints ok"), []string{"flag --nope"}},
		{"verb and flags that exist", exitSection("1. `x lane commit --repo . --hold-unstaged` prints ok"), nil},
		{"help, global and value forms", exitSection("1. `x lane gate -h`", "2. `x lane gate --help`", "3. `x lane gate --json`", "4. `x lane commit --repo=.`"), nil},
		{"a verb the ticket declares new", exitSection("1. `x lane brand-new --x` (new) prints ok"), nil},
		{"a flag declared new on an existing verb", "## want\n\n`--dry` (new) on the gate\n\n" + exitSection("1. `x lane gate --dry` prints ok"), nil},
		{"a mistyped flag beside a new one", "`--dry` (new)\n\n" + exitSection("1. `x lane gate --dry`", "2. `x lane commit --repoo .`"), []string{"flag --repoo"}},
		{"only the x segment of a pipe", exitSection("1. `x lane gate | rg ok`"), nil},
		{"a non-x segment's flags are untouched", exitSection("1. `x lane gate | rg -v ok`"), nil},
		{"only the x segment after &&", exitSection("1. `cd y && x lane gate`"), nil},
		{"the bad x segment after &&", exitSection("1. `cd y && x lane gaet`"), []string{"verb x lane gaet"}},
		{"the bad x segment of a pipe", exitSection("1. `x lane gaet | rg ok`"), []string{"verb x lane gaet"}},
		{"a non-x command", exitSection("1. `pnpm test` is green", "2. `git push --force`"), nil},
		{"a placeholder with spaces and a pipe", exitSection("1. `x lane commit <msg file | none> --repo .`"), nil},
		{"a quoted argument holding a separator", exitSection("1. `x lane commit \"a; x nope\" --repo .`"), nil},
		{"a positional argument after a verb", exitSection("1. `x lane review 12` prints ok"), nil},
		{"a raw door passthrough", exitSection("1. `x linear issue list --team FRM` prints ok"), nil},
		{"a fenced block under exit", "## exit\n\n```sh\nx lane gaet && x lane gate\n```\n", []string{"verb x lane gaet"}},
		{"a span outside the exit section", "## want\n\n`x lane nope` is a thought\n\n" + exitSection("1. `x lane gate`"), nil},
		{"the same defect twice on one line", exitSection("1. `x lane nope` then `x lane nope`"), []string{"verb x lane nope"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var got []string
			for _, f := range xCommandFindings(c.body, verbs) {
				got = append(got, f.Kind+" "+f.What)
			}
			if strings.Join(got, "|") != strings.Join(c.want, "|") {
				t.Errorf("findings = %q, want %q", got, c.want)
			}
		})
	}
}

// the want line: a sealed exit line naming a flag the registry lacks refuses the seal, through the built x
func TestPreflightRefusesAnExitLineNamingAMissingFlag(t *testing.T) {
	_, got := runPreflight(t, exitSection("1. `x lane gate --dry` prints ok"), "FRM-1")

	if got.code == 0 || !strings.Contains(got.stdout, "line 3: flag --dry") {
		t.Fatalf("exit %d\n%s", got.code, got.stdout)
	}
}
