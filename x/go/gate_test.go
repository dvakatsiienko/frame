package main

import (
	"bytes"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestGoGateStopsRedOnAGofmtFinding(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "go.mod"), "module fixture\n\ngo 1.24\n")
	write(t, filepath.Join(dir, "main.go"), "package main\nfunc main(){}\n")

	cmd := exec.Command(xbin, "go", "gate", dir)
	cmd.Env = append(cleanEnv(), "X_TEST=1")
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	code := exitOf(cmd.Run())

	if code == 0 {
		t.Fatalf("a gofmt finding must exit non-zero, got 0:\n%s", out.String())
	}
	if !strings.Contains(out.String(), "GATE red: gofmt") {
		t.Errorf("want the GATE red line naming gofmt, got:\n%s", out.String())
	}
}
