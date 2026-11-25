package main

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// summonWorld is a frame root holding the trial script and one live codie trial, a home whose ~/.claude.json
// trusts the summon home, and a state dir for brief stamps
type summonWorld struct {
	frame, home, state, repo string
	// the body linear answers for the summon's ticket
	ticket string
}

func newSummonWorld(t *testing.T) summonWorld {
	t.Helper()
	w := summonWorld{frame: t.TempDir(), home: t.TempDir(), state: t.TempDir(), repo: t.TempDir()}
	script, err := os.ReadFile("../../script/test-drive-list.ts")
	if err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(w.frame, "script/test-drive-list.ts"), string(script))
	write(t, filepath.Join(w.frame, "docs/test-drive/tdd.md"), "---\nstatus: live\nuntil: 2099-01-01\nfits: codie\n---\n\n# tdd\n")
	write(t, filepath.Join(w.frame, "docs/test-drive/gone.md"), "---\nstatus: dropped\nfits: codie\n---\n\n# gone\n")
	claudeJSON, _ := json.Marshal(map[string]any{"projects": map[string]any{w.repo: map[string]any{"hasTrustDialogAccepted": true}}})
	write(t, filepath.Join(w.home, ".claude.json"), string(claudeJSON))
	return w
}

const goodBrief = "/x:crew-codie FRM-1 a job coordinator: 🦉 clio\nwish: none\n\nlane: side\n\n## trials\n\n- `tdd`: each exit line red first\n"

// brief writes a brief, stamps it as a passing x brief check would unless told not to, and returns its path
func (w summonWorld) brief(t *testing.T, text string, stamped bool) string {
	t.Helper()
	path := filepath.Join(w.repo, "brief.md")
	write(t, path, text)
	if stamped {
		sum := fmt.Sprintf("%x", sha256.Sum256([]byte(text)))
		write(t, filepath.Join(w.state, "briefs", sum+".json"), `{"sha256":"`+sum+`"}`)
	}
	return path
}

// the summon reads its ticket's body from linear for the lane: line: a fake answers w.ticket
func (w summonWorld) summon(t *testing.T, command string, env ...string) ran {
	t.Helper()
	return w.summonWith(t, command, []string{"--apply", "--area", "cli"}, env...)
}

// summonWith runs the summon with the given flags after the command; none is a check, which writes no record
func (w summonWorld) summonWith(t *testing.T, command string, flags []string, env ...string) ran {
	t.Helper()
	description, _ := json.Marshal(w.ticket)
	server := newFakeLinear(t, func(gqlCall) string {
		return `{"data":{"issue":{"id":"uuid-1","description":` + string(description) + `}}}`
	})
	base := []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID=", "X_KEYS=" + linearKeys(t), "X_LINEAR_URL=" + server.URL}
	return xIn(t, w.repo, asCaller(t, append(base, env...), "coordinator"), append([]string{"brief", "summon", command}, flags...)...)
}

// a bytes checkout is known by its essentials script; this one fails every app
func (w summonWorld) bytesHome(t *testing.T) string {
	t.Helper()
	bytes := filepath.Join(w.repo, "bytes")
	write(t, filepath.Join(bytes, "script/apps-essentials.ts"), "process.exit(1)\n")
	claudeJSON, _ := json.Marshal(map[string]any{"projects": map[string]any{bytes: map[string]any{"hasTrustDialogAccepted": true}}})
	write(t, filepath.Join(w.home, ".claude.json"), string(claudeJSON))
	return bytes
}

func codieArgv(repo, brief string) string {
	return "cd " + repo + " && claude --bg -n '🌗 🔧 cli | FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"
}

func sixthArgv(w summonWorld, tail string) string {
	return "cd " + w.repo + " && claude --bg -n '🌗 🔎 cli | FRM-1' --model opus --effort medium '/x:crew-sixth-sense FRM-1 https://github.com/o/r/pull/7 codie clio" + tail + " trials: tdd' --remote-control"
}

// herdrArgv is the herdr-native summon line x:crew-lead § preflight names
func herdrArgv(repo, brief string) string {
	return "hc run --bg --no-parent --no-notify --name codie --cwd " + repo + " -- claude -n '🌗 🔧 cli | FRM-1' --model opus --effort medium \"$(cat " + brief + ")\" --remote-control"
}

// the argv a passing summon prints: the command with its session id and the prompt-suggestion setting right after claude
// the summon x prints: the session id after the claude it runs, and -n the display it drew from the record
func withSessionID(command string, got ran) string {
	sid, _ := got.data["sessionId"].(string)
	display, _ := got.data["display"].(string)
	named := regexp.MustCompile(`-n '[^']*'`).ReplaceAllLiteralString(command, "-n '"+display+"'")
	return strings.Replace(named, "claude ", "claude --session-id "+sid+" --settings '{\"promptSuggestionEnabled\":false}' ", 1)
}

// FRM-579 exit 1: a standing role starts through summon, its record drawing the pretty name from roles.json
func (w summonWorld) summonStanding(t *testing.T, caller string, env []string, args ...string) ran {
	t.Helper()
	base := []string{"HOME=" + w.home, "X_STATE=" + w.state, "X_FRAME_ROOT=" + w.frame, "HC_TERMINAL_ID="}
	return xIn(t, w.repo, asCaller(t, append(base, env...), caller), append([]string{"brief", "summon", "--apply"}, args...)...)
}

func paneArgv(w summonWorld, name string) string {
	return "hc run --bg --no-parent --no-notify --name boot --cwd " + w.repo + " -- claude -n '" + name + "' --model opus 'boot'"
}
