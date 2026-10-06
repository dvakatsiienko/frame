package main

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/creack/pty"
)

// a real zsh on a pty: compinit, the generated script sourced, a line typed, then <Tab>
func TestZshTabCompletesFromTheRegistry(t *testing.T) {
	if _, err := exec.LookPath("zsh"); err != nil {
		t.Skip("no zsh here")
	}
	dir := world(t)
	bin := t.TempDir()
	if err := os.Symlink(xbin, filepath.Join(bin, "x")); err != nil {
		t.Fatal(err)
	}
	knowledge, _ := filepath.Abs("../fixtures/knowledge")
	shell := exec.Command("zsh", "-f", "-i")
	shell.Dir = filepath.Join(dir, "repo")
	shell.Env = append(cleanEnv(), "PATH="+bin+":"+os.Getenv("PATH"), "HANDOFF_STORE_ROOT="+filepath.Join(dir, "store"),
		"X_KNOWLEDGE_ROOT="+knowledge, "X_STATE="+filepath.Join(dir, "state"), "TERM=xterm-256color", "PS1=$ ")
	ptmx, err := pty.StartWithSize(shell, &pty.Winsize{Rows: 40, Cols: 200})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = shell.Process.Kill(); ptmx.Close() }()

	var mu sync.Mutex
	var screen bytes.Buffer
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := ptmx.Read(buf)
			mu.Lock()
			screen.Write(buf[:n])
			mu.Unlock()
			if err != nil {
				return
			}
		}
	}()
	waitFor := func(want string) bool {
		for deadline := time.Now().Add(8 * time.Second); time.Now().Before(deadline); time.Sleep(30 * time.Millisecond) {
			mu.Lock()
			found := strings.Contains(screen.String(), want)
			mu.Unlock()
			if found {
				return true
			}
		}
		return false
	}
	_, _ = ptmx.Write([]byte("autoload -Uz compinit && compinit -u -D && source <(x completion zsh) && echo READY\r"))
	if !waitFor("READY\r\n") {
		t.Fatalf("zsh never loaded the script:\n%s", screen.String())
	}

	cases := []struct{ typed, want string }{
		{"x la", "lane"},
		{"x lane comm", "commit"},
		{"x knowledge read spa", "spawn-mechanics"},
		{"x handoffs peek cli-a", "cli-arms"},
		{"x probe bare --mo", "--model"},
		{"x probe bare --model hai", "haiku"},
		{"x schema lane pu", "push"},
	}
	for _, c := range cases {
		mu.Lock()
		screen.Reset()
		mu.Unlock()
		_, _ = ptmx.Write([]byte(c.typed + "\t"))
		if !waitFor(c.want) {
			mu.Lock()
			t.Errorf("%q<Tab> never showed %q; the screen: %q", c.typed, c.want, screen.String())
			mu.Unlock()
		}
		// ctrl-u clears the line for the next case
		_, _ = ptmx.Write([]byte("\x15"))
		time.Sleep(100 * time.Millisecond)
	}
}
