package main

import (
	"bytes"
	"encoding/json"
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
	Env    map[string]string `json:"env"`
	Exit   int               `json:"exit"`
	Status string            `json:"status"`
	Next   string            `json:"next"`
	Data   map[string]any    `json:"data"`
	After  string            `json:"after"`
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

// the binary under test, built once with its source dir pinned so store.ts is found
func binary(t *testing.T) string {
	t.Helper()
	src, _ := filepath.Abs(".")
	bin := filepath.Join(t.TempDir(), "x")
	build := exec.Command("go", "build", "-ldflags", "-X main.srcDir="+src, "-o", bin, ".")
	if out, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build: %v\n%s", err, out)
	}
	return bin
}

func world(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "world")
	if out, err := exec.Command("../fixtures/setup.sh", dir).CombinedOutput(); err != nil {
		t.Fatalf("setup.sh: %v\n%s", err, out)
	}
	return dir
}

func runCall(t *testing.T, bin, dir string, c call) (map[string]any, string, int) {
	t.Helper()
	argv := make([]string, len(c.Argv))
	for i, arg := range c.Argv {
		argv[i] = strings.ReplaceAll(arg, "{world}", dir)
	}
	cmd := exec.Command(bin, argv...)
	cmd.Dir = filepath.Join(dir, "repo")
	cmd.Env = append(filterEnv(os.Environ()), "HANDOFF_STORE_ROOT="+filepath.Join(dir, "store"), "VITEST=1")
	for key, value := range c.Env {
		cmd.Env = append(cmd.Env, key+"="+value)
	}
	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	err := cmd.Run()
	code := 0
	if exit, ok := err.(*exec.ExitError); ok {
		code = exit.ExitCode()
	}
	var envelope map[string]any
	_ = json.Unmarshal(stdout.Bytes(), &envelope)
	return envelope, stdout.String(), code
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

func TestFixtureCallsSpeakTheEnvelope(t *testing.T) {
	bin := binary(t)
	byID := map[string]call{}
	for _, c := range fixtures(t) {
		byID[c.ID] = c
	}
	for _, c := range fixtures(t) {
		isAgentTTY := c.Mode == "tty" && c.Env["CLAUDECODE"] != ""
		if c.Mode != "pipe" && !isAgentTTY {
			continue
		}
		t.Run(c.ID, func(t *testing.T) {
			dir := world(t)
			if prior, ok := byID[c.After]; ok {
				runCall(t, bin, dir, prior)
			}
			envelope, stdout, code := runCall(t, bin, dir, c)
			if code != c.Exit {
				t.Errorf("exit %d, want %d\n%s", code, c.Exit, stdout)
			}
			if c.ID == "completion-zsh-pipe" {
				if !strings.HasPrefix(stdout, "#compdef x") {
					t.Errorf("want the raw zsh script on a pipe, got %.80q", stdout)
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

func TestEmbeddedRegistryIsTheSharedOne(t *testing.T) {
	shared, err := os.ReadFile("../fixtures/registry.json")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(shared, registryJSON) {
		t.Fatal("x/go/registry.json drifted from x/fixtures/registry.json — copy it over")
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

func TestPurposesPassTheLint(t *testing.T) {
	for _, verb := range verbs {
		if problems := lintPurpose(verb); len(problems) > 0 {
			t.Errorf("%s: %s", verb.Name, strings.Join(problems, "; "))
		}
	}
}
