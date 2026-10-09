package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var testHome, realHome string

// every path sline writes hangs off $HOME, so no test can reach dima's real ~/.claude
func TestMain(m *testing.M) {
	realHome, _ = os.UserHomeDir()
	dir, err := os.MkdirTemp("", "sline-home-")
	if err != nil {
		panic(err)
	}
	testHome, _ = filepath.EvalSymlinks(dir)
	_ = os.Setenv("HOME", testHome)
	code := m.Run()
	_ = os.RemoveAll(dir)
	os.Exit(code)
}

func TestStatePathsLiveUnderTheTestHome(t *testing.T) {
	for _, p := range []string{slineStatePath(), focusPath("s"), handoffsDir()} {
		if !strings.HasPrefix(p, testHome+"/") {
			t.Errorf("%s is outside the test home %s", p, testHome)
		}
	}
}
