package main

import (
	"go/scanner"
	"go/token"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
)

// the lane verbs a pr travels through, each proven in both pr modes (FRM-423, dima o129: «a good mvp»)
var prVerbs = []string{"pr-open", "merge-auto", "push", "restack"}

// a test file is stacked mode when it builds only with the add-on, plain mode otherwise; a verb has a case in a
// mode when one of that mode's files runs it as `"lane", "<verb>"`
// a comment names a verb and runs nothing, so the scanner's tokens are read, never the raw text
func lanePrCases(src []byte) []string {
	fset := token.NewFileSet()
	var sc scanner.Scanner
	sc.Init(fset.AddFile("", fset.Base(), len(src)), src, nil, 0)
	var cases []string
	var before []string
	for {
		_, tok, lit := sc.Scan()
		if tok == token.EOF {
			return cases
		}
		before = append(before, tok.String()+lit)
		if n := len(before); n >= 3 && tok == token.STRING && before[n-2] == token.COMMA.String() && before[n-3] == token.STRING.String()+`"lane"` {
			if verb, err := strconv.Unquote(lit); err == nil && slices.Contains(prVerbs, verb) {
				cases = append(cases, verb)
			}
		}
	}
}

func TestLanePrCasesCountsOnlyARunningCase(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name, src string
		want      []string
	}{
		{"a call", `package a; func f() { x("lane", "push") }`, []string{"push"}},
		{"a line comment", "package a\n// x(\"lane\", \"push\")\nfunc f() {}\n", nil},
		{"a block comment", `package a; /* "lane", "push" */ func f() {}`, nil},
		{"inside a raw string", "package a; const s = `\"lane\", \"push\"`", nil},
		{"inside a message", `package a; func f() { t("no \"lane\", \"push\" here") }`, nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			t.Parallel()
			if got := lanePrCases([]byte(c.src)); !slices.Equal(got, c.want) {
				t.Errorf("got %v, want %v", got, c.want)
			}
		})
	}
}

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
		for _, verb := range lanePrCases(raw) {
			covered[mode][verb] = true
		}
	}
	modes := []string{"plain", "stacked"}
	// built out, or with the add-on's files deleted, the stacked half drops away and the plain half still holds
	if laneAddOn.stackShown == nil {
		modes = modes[:1]
	}
	for _, mode := range modes {
		for _, verb := range prVerbs {
			if !covered[mode][verb] {
				t.Errorf("x lane %s has no test case in %s pr mode", verb, mode)
			}
		}
	}
}
