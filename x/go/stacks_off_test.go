//go:build nostacks

package main

import (
	"strings"
	"testing"
)

// with the add-on built out, pr-open knows no --base, verify-tree no --stack, and no stack verb dispatches
func TestWithoutTheStacksAddOnNoStackDoorExists(t *testing.T) {
	t.Parallel()
	clone := layers(t, "coder/FRM-1-a")
	for _, argv := range [][]string{
		{"lane", "pr-open", "--base", "main", "a title", bodyFile(t)},
		{"lane", "stack", "view"},
		{"lane", "restack", "--apply"},
		{"lane", "verify-tree", "--stack", "https://github.com/o/r/pull/7"},
	} {
		got := xIn(t, clone, nil, argv...)

		if got.code != 2 || !strings.Contains(got.stdout, `"status":"usage"`) {
			t.Errorf("%v: exit %d, want a usage error\n%s", argv, got.code, got.stdout)
		}
	}
}
