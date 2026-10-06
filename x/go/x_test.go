package main

import (
	"bytes"
	"cmp"
	"sync"
	"syscall"
	"time"

	"encoding/json"
	"fmt"
	"github.com/creack/pty"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

type call struct {
	ID     string            `json:"id"`
	Argv   []string          `json:"argv"`
	Mode   string            `json:"mode"`
	Cols   int               `json:"cols"`
	Env    map[string]string `json:"env"`
	Exit   int               `json:"exit"`
	Status string            `json:"status"`
	Next   string            `json:"next"`
	Data   map[string]any    `json:"data"`
	After  string            `json:"after"`
	Keys   []string          `json:"keys"`
	Stdin  string            `json:"stdin"`
}

func fixtures(t *testing.T) []call {
	t.Helper()
	raw, err := os.ReadFile("../fixtures/calls.json")
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Calls []call `json:"calls"`
	}
	if err := json.Unmarshal(raw, &file); err != nil {
		t.Fatal(err)
	}
	return file.Calls
}

// the binary under test, built once per run with its source dir pinned
var xbin string

func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "x-test-")
	if err != nil {
		panic(err)
	}
	src, _ := filepath.Abs(".")
	xbin = filepath.Join(dir, "x")
	if out, err := exec.Command("go", "build", "-ldflags", "-X main.srcDir="+src, "-o", xbin, ".").CombinedOutput(); err != nil {
		panic(fmt.Sprintf("build: %v\n%s", err, out))
	}
	code := m.Run()
	_ = os.RemoveAll(dir)
	os.Exit(code)
}

func world(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "world")
	if out, err := exec.Command("../fixtures/setup.sh", dir).CombinedOutput(); err != nil {
		t.Fatalf("setup.sh: %v\n%s", err, out)
	}
	return dir
}

func command(bin, dir string, c call) *exec.Cmd {
	argv := make([]string, len(c.Argv))
	for i, arg := range c.Argv {
		argv[i] = strings.ReplaceAll(arg, "{world}", dir)
	}
	cmd := exec.Command(bin, argv...)
	cmd.Dir = filepath.Join(dir, "repo")
	cmd.Env = append(cleanEnv(), "HANDOFF_STORE_ROOT="+filepath.Join(dir, "store"), "X_TEST=1",
		"X_KNOWLEDGE_ROOT="+filepath.Join(dir, "knowledge"), "X_STATE="+filepath.Join(dir, "state"))
	for key, value := range c.Env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	return cmd
}

func runCall(t *testing.T, bin, dir string, c call) (map[string]any, string, int) {
	t.Helper()
	if c.Mode == "tty" {
		out, code := runTTY(t, bin, dir, c)
		var envelope map[string]any
		_ = json.Unmarshal([]byte(strings.TrimSpace(out)), &envelope)
		return envelope, out, code
	}
	cmd := command(bin, dir, c)
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	code := exitOf(cmd.Run())
	var envelope map[string]any
	_ = json.Unmarshal(stdout.Bytes(), &envelope)
	return envelope, stdout.String(), code
}

func exitOf(err error) int {
	if exit, ok := err.(*exec.ExitError); ok {
		return exit.ExitCode()
	}
	if err != nil {
		return -1
	}
	return 0
}

var keyBytes = map[string]string{"Enter": "\r", "Down": "\x1b[B", "Up": "\x1b[A", "Tab": "\t", "Escape": "\x1b"}

// a tty call runs on a pty sized to its cols; stdin is the pty too unless the call says `stdin: none`.
// each key waits for the screen to settle first, so a form has drawn before it is answered
func runTTY(t *testing.T, bin, dir string, c call) (string, int) {
	t.Helper()
	ptmx, tty, err := pty.Open()
	if err != nil {
		t.Fatal(err)
	}
	defer ptmx.Close()
	_ = pty.Setsize(ptmx, &pty.Winsize{Rows: 50, Cols: uint16(cmp.Or(c.Cols, 120))})
	cmd := command(bin, dir, c)
	cmd.Env = append(cmd.Env, "X_THEME=dark", "TERM=xterm-256color")
	cmd.Stdout, cmd.Stderr = tty, tty
	if c.Stdin != "none" {
		cmd.Stdin = tty
		cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true, Setctty: true}
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	tty.Close()

	var mu sync.Mutex
	var screen bytes.Buffer
	last := time.Now()
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			mu.Lock()
			screen.Write(buf[:n])
			last = time.Now()
			mu.Unlock()
			if err != nil {
				return
			}
		}
	}()
	settled := func() {
		deadline := time.Now().Add(10 * time.Second)
		for time.Now().Before(deadline) {
			mu.Lock()
			quiet := screen.Len() > 0 && time.Since(last) > 300*time.Millisecond
			mu.Unlock()
			if quiet {
				return
			}
			time.Sleep(20 * time.Millisecond)
		}
	}
	for _, key := range c.Keys {
		settled()
		mu.Lock()
		last = time.Now()
		mu.Unlock()
		_, _ = ptmx.Write([]byte(cmp.Or(keyBytes[key], key)))
	}

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err = <-done:
	case <-time.After(30 * time.Second):
		_ = cmd.Process.Kill()
		t.Fatalf("%s hung on the pty", c.ID)
	}
	time.Sleep(50 * time.Millisecond)
	mu.Lock()
	defer mu.Unlock()
	return screen.String(), exitOf(err)
}

// the test runs as an agent would, so the agent markers it inherits are dropped
func filterEnv(env []string) []string {
	var kept []string
	for _, pair := range env {
		if !strings.HasPrefix(pair, "CLAUDECODE=") && !strings.HasPrefix(pair, "AI_AGENT=") {
			kept = append(kept, pair)
		}
	}
	return kept
}

// every call in calls.json is the contract: a pipe or an agent gets one envelope line, a terminal gets
// the human view; both end on the call's exit code
func TestFixtureCallsHoldTheContract(t *testing.T) {
	bin := xbin
	byID := map[string]call{}
	for _, c := range fixtures(t) {
		byID[c.ID] = c
	}
	for _, c := range fixtures(t) {
		isAgent := c.Mode != "tty" || c.Env["CLAUDECODE"] != ""
		t.Run(c.ID, func(t *testing.T) {
			t.Parallel()
			dir := world(t)
			if prior, ok := byID[c.After]; ok {
				runCall(t, bin, dir, prior)
			}
			envelope, stdout, code := runCall(t, bin, dir, c)
			if code != c.Exit {
				t.Errorf("exit %d, want %d\n%s", code, c.Exit, stdout)
			}
			if strings.HasPrefix(c.ID, "completion-zsh") {
				if !strings.HasPrefix(strings.TrimSpace(stdout), "#compdef x") {
					t.Errorf("want the raw zsh script, got %.80q", stdout)
				}
				return
			}
			if !isAgent {
				if envelope != nil || !strings.Contains(stdout, "╭") {
					t.Errorf("want a framed human view on a terminal, got %.200q", stdout)
				}
				return
			}
			if strings.Count(strings.TrimSpace(stdout), "\n") != 0 || envelope == nil {
				t.Fatalf("stdout is not one json line: %.200q", stdout)
			}
			if ok, _ := envelope["ok"].(bool); ok != (c.Exit == 0) {
				t.Errorf("ok=%v with exit %d", envelope["ok"], c.Exit)
			}
			if c.Status != "" && envelope["status"] != c.Status {
				t.Errorf("status %v, want %s", envelope["status"], c.Status)
			}
			if c.Next != "" && envelope["next"] != c.Next {
				t.Errorf("next %v, want %s", envelope["next"], c.Next)
			}
			data, _ := envelope["data"].(map[string]any)
			for key, want := range c.Data {
				if got, _ := json.Marshal(data[key]); string(got) != marshal(want) {
					t.Errorf("data.%s = %s, want %s", key, got, marshal(want))
				}
			}
		})
	}
}

func TestRefusedCommitHandsTheHookOutputToAnAgent(t *testing.T) {
	bin, dir := xbin, world(t)
	hook := filepath.Join(dir, "repo/.git/hooks/pre-commit")
	if err := os.WriteFile(hook, []byte("#!/bin/sh\necho 'hook says: line 131 is too wide'\nexit 1\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(bin, "lane", "commit", filepath.Join(dir, "msg.txt"), "--", "notes.txt")
	cmd.Dir = filepath.Join(dir, "repo")
	cmd.Env = filterEnv(os.Environ())
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	_ = cmd.Run()
	if !strings.Contains(stdout.String(), `"status":"failed"`) {
		t.Fatalf("want a failed envelope, got %s", stdout.String())
	}
	if !strings.Contains(stderr.String(), "hook says: line 131 is too wide") {
		t.Errorf("the envelope says the hook output is above, but stderr holds %q", stderr.String())
	}
}

func TestEveryVerbBelongsToAListedFamily(t *testing.T) {
	for _, verb := range verbs {
		if family := familyOf(verb.Family()); family.Gist == "" || family.Example == "" {
			t.Errorf("%s: family %s has no gist or example in registry.json", verb.Name, verb.Family())
		}
	}
}

func TestRegistryAndImplementationsMatch(t *testing.T) {
	named := map[string]bool{}
	for _, verb := range verbs {
		named[verb.Name] = true
		impl, ok := impls[verb.Name]
		if !ok {
			t.Errorf("%s is in the registry with no go implementation", verb.Name)
		}
		if verb.NeedsApply && (impl.Plan == nil || impl.Apply == nil) {
			t.Errorf("%s publishes, so it needs Plan and Apply", verb.Name)
		}
	}
	for name := range impls {
		if !named[name] {
			t.Errorf("%s is implemented but not in the registry", name)
		}
	}
}

func TestLintRefusesAVagueWordBesidePunctuation(t *testing.T) {
	problems := lintPurpose(Verb{Name: "lane tidy", Purpose: "handles, then tidies the worktree before a push"})
	if len(problems) == 0 {
		t.Fatal("«handles,» passed the lint; the TS lint refuses it")
	}
}

func TestPurposesPassTheLint(t *testing.T) {
	for _, verb := range verbs {
		if problems := lintPurpose(verb); len(problems) > 0 {
			t.Errorf("%s: %s", verb.Name, strings.Join(problems, "; "))
		}
	}
}
