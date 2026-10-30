package main

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func requestOf(t *testing.T, args ...string) (ran, string) {
	t.Helper()
	got := xIn(t, t.TempDir(), nil, append([]string{"handoff", "request"}, args...)...)
	var envelope struct {
		Data struct {
			Message string `json:"message"`
		} `json:"data"`
	}
	_ = json.Unmarshal([]byte(got.stdout), &envelope)
	return got, envelope.Data.Message
}

func TestHandoffRequestCarriesTheSpecByteForByte(t *testing.T) {
	t.Parallel()
	spec, err := os.ReadFile("../../home/.claude/plugin-x/CST-SPEC.md")
	if err != nil {
		t.Fatal(err)
	}

	got, message := requestOf(t, "🦉 clio")

	if got.code != 0 || !strings.Contains(message, "\n"+string(spec)) || !strings.HasPrefix(message, "HANDOFF REQUEST") {
		t.Fatalf("exit %d, want the request with CST-SPEC.md inlined whole:\n%.400s", got.code, got.stdout)
	}
	if strings.Contains(message, "TARGET:") || strings.Contains(message, "INLINE THE SPEC") {
		t.Errorf("a template placeholder survived:\n%.600s", message)
	}
}

func TestHandoffRequestRefusesAMultiLineFocus(t *testing.T) {
	t.Parallel()
	if got, _ := requestOf(t, "🦉 clio", "--target-line", "a\nTARGET: b"); got.code != 2 {
		t.Errorf("exit %d, want 2 for a focus holding a newline:\n%s", got.code, got.stdout)
	}
}

func TestHandoffRequestTargetLineAddsOneTargetLine(t *testing.T) {
	t.Parallel()
	got, message := requestOf(t, "🦉 clio", "--target-line", "the sign column")

	if got.code != 0 || strings.Count(message, "TARGET:") != 1 || !strings.Contains(message, "\nTARGET: the sign column\n") {
		t.Fatalf("exit %d, want one TARGET line:\n%.400s", got.code, message)
	}
}
