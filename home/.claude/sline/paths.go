package main

import (
	"os"
	"path/filepath"
)

// Every location sline reads under ~/.claude, named once. Five files used to
// each resolve the home directory and re-spell a path segment, which meant the
// layout of a directory none of them owns was duplicated across the package.
//
// This is also where a move lands: the consolidated artifact shelf at
// ~/.claude/shelf/ now exists, with handoffs as one family under it. That move
// changed exactly one line below, which is what this file was for.

func claudeHome(parts ...string) string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(append([]string{homeDir, ".claude"}, parts...)...)
}

// slineStatePath is the cross-render cache — disposable, never git-tracked.
func slineStatePath() string { return claudeHome("sline", "sline-state.json") }

// settingsPath holds the launch-time model and effort defaults.
func settingsPath() string { return claudeHome("settings.json") }

// sessionsDir maps session ids to the names peers address.
func sessionsDir() string { return claudeHome("sessions") }

// focusPath is per session id, so parallel sessions never fight over one file.
func focusPath(sessionID string) string { return claudeHome("focus", sessionID+".json") }

// handoffsDir is the CST store every handoff frontend shares.
func handoffsDir() string { return claudeHome("shelf", "handoffs") }

// outputStylesDir holds every style file — the peers of whichever one is active.
func outputStylesDir() string { return claudeHome("output-styles") }

// statusCachePath is written by shelf/hooks/sline-status-fetch.sh and only ever read here.
func statusCachePath() string { return claudeHome("focus", "status-cache.json") }

// outputStylePath resolves a style to its markdown source. Callers pass the bare
// style name as rendered ("ELI5"); "output-" is this repo's filing prefix on
// disk and is added here, so exactly one place knows the naming convention.
func outputStylePath(styleName string) string {
	if styleName == "" {
		return ""
	}
	return claudeHome("output-styles", "output-"+styleName+".md")
}
