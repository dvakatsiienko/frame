package main

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
)

// the CI env reproduced: many forks in flight while fixture scripts are written and run, as the parallel suite does. on linux a script
// written without the fork lock fails to run «text file busy», about 3 in 100 here; macOS never does, so this reds only there
func TestWrittenFixtureScriptsAreNeverBusyToRun(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	var busy atomic.Int64
	var first atomic.Value
	var group sync.WaitGroup
	for worker := range 8 {
		group.Go(func() {
			for i := range 100 {
				path := filepath.Join(dir, fmt.Sprintf("s-%d-%d", worker, i))
				if err := writeFile(path, []byte("#!/bin/sh\necho ok\n"), 0o755); err != nil {
					t.Error(err)
					return
				}
				if out, err := exec.Command(path).Output(); err != nil || len(out) == 0 {
					busy.Add(1)
					first.CompareAndSwap(nil, fmt.Sprint(err))
				}
			}
		})
	}
	group.Wait()

	if n := busy.Load(); n > 0 {
		t.Errorf("%d of 800 written scripts would not run, the first: %v", n, first.Load())
	}
}
