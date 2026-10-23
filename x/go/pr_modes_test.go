package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// the lane verbs a pr travels through, each proven in both pr modes (FRM-423, dima o129: «a good mvp»)
var prVerbs = []string{"pr-open", "merge-auto", "push", "restack"}

// a test file is stacked mode when it builds only with the add-on, plain mode otherwise; a verb has a case in a
// mode when one of that mode's files runs it as `"lane", "<verb>"`
func TestEveryLanePrVerbHasACaseInBothPrModes(t *testing.T) {
	t.Parallel()
	files, err := filepath.Glob("*_test.go")
	if err != nil || len(files) == 0 {
		t.Fatalf("no test files to read: %v", err)
	}
	covered := map[string]map[string]bool{"plain": {}, "stacked": {}}
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		mode := "plain"
		if strings.HasPrefix(string(raw), "//go:build !nostacks") {
			mode = "stacked"
		}
		for _, verb := range prVerbs {
			if strings.Contains(string(raw), `"lane", "`+verb+`"`) {
				covered[mode][verb] = true
			}
		}
	}
	for _, mode := range []string{"plain", "stacked"} {
		for _, verb := range prVerbs {
			if !covered[mode][verb] {
				t.Errorf("x lane %s has no test case in %s pr mode", verb, mode)
			}
		}
	}
}
