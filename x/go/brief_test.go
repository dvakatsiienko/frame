package main

import "testing"

func TestIsPathLike(t *testing.T) {
	t.Parallel()
	cases := []struct {
		token string
		want  bool
	}{
		{"@excalidraw/utils", false},
		{"@excalidraw/mermaid-to-excalidraw", false},
		{"@types/react@19.1.0", false},
		{"x/go/brief.go", true},
		{"brief.go:37", true},
		{"FTR.md#brief", true},
		{"packages/kit/src", true},
		{"pnpm typecheck", false},
	}
	for _, c := range cases {
		if got := isPathLike(c.token); got != c.want {
			t.Errorf("isPathLike(%q) = %v, want %v", c.token, got, c.want)
		}
	}
}
