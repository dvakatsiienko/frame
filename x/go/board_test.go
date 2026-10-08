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

	board := xIn(t, t.TempDir(), env, "knowledge", "list", "--board")
	plain := xIn(t, t.TempDir(), env, "knowledge", "list")

	if board.code != 0 || json.Valid([]byte(strings.TrimSpace(board.stdout))) || !strings.Contains(board.stdout, "probe") {
		t.Fatalf("--board in an agent env: exit %d, want the human board naming probe.md:\n%s", board.code, board.stdout)
	}
	if !json.Valid([]byte(strings.TrimSpace(plain.stdout))) {
		t.Errorf("without --board an agent env still gets json:\n%s", plain.stdout)
	}
}
