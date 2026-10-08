package main

import (
	"encoding/json"
	"path/filepath"
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
