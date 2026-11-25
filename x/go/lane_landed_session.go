package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// the session registry names each session's pid; a file left by a dead pid says nothing, and the registry's cwd may be
// where the session started, so the process's own cwd says where it sits. the session sitting in tree, named, or ""
func liveSessionIn(tree string) string {
	files, _ := filepath.Glob(filepath.Join(sessionsDir(), "*.json"))
	root := resolved(tree)
	for _, file := range files {
		var session struct {
			Cwd  string `json:"cwd"`
			Pid  int    `json:"pid"`
			Name string `json:"name"`
			ID   string `json:"sessionId"`
		}
		raw, err := os.ReadFile(file)
		if err != nil || json.Unmarshal(raw, &session) != nil || session.Pid <= 0 {
			continue
		}
		if err := syscall.Kill(session.Pid, 0); err != nil && !errors.Is(err, syscall.EPERM) {
			continue
		}
		for _, at := range []string{cmp.Or(processCwd(session.Pid), session.Cwd), transcriptCwd(session.ID)} {
			if cwd := resolved(at); at != "" && (cwd == root || strings.HasPrefix(cwd, root+string(filepath.Separator))) {
				return fmt.Sprintf("%s (pid %d)", cmp.Or(session.Name, session.ID, "unnamed"), session.Pid)
			}
		}
	}
	return ""
}

// a Bash cd moves no process (probed on a bare cc, 2026-11-05); cc stamps the cwd it carried on every transcript row, so the last row says where the session went
func transcriptCwd(id string) string {
	newest := newestTranscript(id)
	if newest == "" {
		return ""
	}
	return lastCwdIn(newest)
}

// a session moved between trees can leave a transcript under two project dirs: the newest is where it sits
func newestTranscript(id string) string {
	if id == "" {
		return ""
	}
	files, _ := filepath.Glob(filepath.Join(projectsDir(), "*", id+".jsonl"))
	newest, at := "", time.Time{}
	for _, file := range files {
		if info, err := os.Stat(file); err == nil && info.ModTime().After(at) {
			newest, at = file, info.ModTime()
		}
	}
	return newest
}

const transcriptTail = 256 * 1024

// the end of the file first: transcripts run to tens of MB, and this runs per session per tree. a cut first line fails
// its parse and is skipped; a tail with no cwd widens, since a last row past its size would read as no session in the tree
func lastCwdIn(path string) string {
	file, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return ""
	}
	for size := min(info.Size(), transcriptTail); ; size = min(info.Size(), size*4) {
		tail := make([]byte, size)
		if _, err := file.ReadAt(tail, info.Size()-size); err != nil {
			return ""
		}
		for _, raw := range slices.Backward(bytes.Split(tail, []byte("\n"))) {
			var row struct {
				Cwd string `json:"cwd"`
			}
			if json.Unmarshal(raw, &row) == nil && row.Cwd != "" {
				return row.Cwd
			}
		}
		if size == info.Size() {
			return ""
		}
	}
}

// "" when the process can't be read, and the caller falls back on the registry: a wrong spare costs a later landed, a wrong decamp a live tree
func processCwd(pid int) string {
	if link, err := os.Readlink(fmt.Sprintf("/proc/%d/cwd", pid)); err == nil {
		return link
	}
	got, err := run("", nil, "", "lsof", "-a", "-p", strconv.Itoa(pid), "-d", "cwd", "-Fn")
	if err != nil || !got.ok {
		return ""
	}
	for line := range strings.SplitSeq(got.out, "\n") {
		if name, ok := strings.CutPrefix(line, "n"); ok {
			return name
		}
	}
	return ""
}
