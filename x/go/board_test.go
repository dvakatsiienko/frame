package main

import (
	"encoding/json"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestBoardDrawsTheHumanViewInAnAgentEnv(t *testing.T) {
	shelf := t.TempDir()
	write(t, filepath.Join(shelf, "probe.md"), "# probe\n\na probe doc\n")
	env := []string{"CLAUDECODE=1", "X_KNOWLEDGE_ROOT=" + shelf}

	for _, flag := range []string{"--board", "--board=true"} {
		got := xIn(t, t.TempDir(), env, "knowledge", "list", flag)
		if got.code != 0 || json.Valid([]byte(strings.TrimSpace(got.stdout))) || !strings.Contains(got.stdout, "probe") {
			t.Errorf("%s in an agent env: exit %d, want the human board naming probe.md:\n%s", flag, got.code, got.stdout)
		}
	}
	if plain := xIn(t, t.TempDir(), env, "knowledge", "list"); !json.Valid([]byte(strings.TrimSpace(plain.stdout))) {
		t.Errorf("without --board an agent env still gets json:\n%s", plain.stdout)
	}
}

func TestJSONBesideBoardStillWins(t *testing.T) {
	shelf := t.TempDir()
	write(t, filepath.Join(shelf, "probe.md"), "# probe\n\na probe doc\n")

	got := xIn(t, t.TempDir(), []string{"CLAUDECODE=1", "X_KNOWLEDGE_ROOT=" + shelf}, "knowledge", "list", "--board", "--json")

	if !json.Valid([]byte(strings.TrimSpace(got.stdout))) {
		t.Fatalf("--board --json must print json:\n%s", got.stdout)
	}
}

func TestBareXListsFamiliesWithVerbNamesOnly(t *testing.T) {
	got := xIn(t, t.TempDir(), nil)

	listed, _ := got.data["families"].([]any)
	if got.code != 0 || len(listed) != len(families()) || got.next != "x schema <family>" {
		t.Fatalf("exit %d, %d families, next %q:\n%s", got.code, len(listed), got.next, got.stdout)
	}
	if lane := listed[0].(map[string]any); lane["name"] != "lane" || !slices.Contains(lane["verbs"].([]any), any("lane commit")) {
		t.Errorf("first family %v, want lane with lane commit among its verbs", lane)
	}
	if strings.Contains(got.stdout, `"purpose"`) {
		t.Errorf("bare x carries purposes, which live one call deeper:\n%s", got.stdout)
	}
}

func TestAllListsEveryVerbWithItsPurpose(t *testing.T) {
	got := xIn(t, t.TempDir(), nil, "--all")

	groups, _ := got.data["groups"].(map[string]any)
	count := 0
	for _, members := range groups {
		for _, verb := range members.([]any) {
			if verb.(map[string]any)["purpose"] != "" {
				count++
			}
		}
	}
	if got.code != 0 || count != len(verbsUnder("")) {
		t.Fatalf("exit %d, %d verbs with a purpose, want %d:\n%s", got.code, count, len(verbsUnder("")), got.stdout)
	}
}

func TestBareXFitsOneScreen(t *testing.T) {
	for _, cols := range []int{80, 120} {
		dir := t.TempDir()
		write(t, filepath.Join(dir, "repo", ".keep"), "")
		screen, code := runTTY(t, xbin, dir, call{Cols: cols, Rows: 30})

		if lines := strings.Count(strings.TrimRight(screen, "\r\n"), "\n") + 1; code != 0 || lines > 30 {
			t.Errorf("%d cols: exit %d, %d lines on a 30-row terminal:\n%s", cols, code, lines, screen)
		}
	}
}
