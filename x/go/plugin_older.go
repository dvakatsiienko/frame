package main

import (
	"bufio"
	"bytes"
	"cmp"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"time"
)

// olderCopies names every live session holding a copy of the plugin older than `to`. cc records no plugin version per
// session, so a session's copy is the newest one in the cache dir that was installed by its start or its last
// /reload-plugins; one with no such copy reads «unknown», never dropped
func olderCopies(cacheDir, to string) []ordered {
	type version struct {
		name string
		at   time.Time
	}
	var versions []version
	entries, _ := os.ReadDir(cacheDir)
	for _, entry := range entries {
		if info, err := entry.Info(); err == nil && entry.IsDir() {
			versions = append(versions, version{entry.Name(), info.ModTime()})
		}
	}
	slices.SortFunc(versions, func(a, b version) int { return a.at.Compare(b.at) })

	older := []ordered{}
	files, _ := filepath.Glob(filepath.Join(sessionsDir(), "*.json"))
	slices.Sort(files)
	for _, file := range files {
		var session struct {
			Name      string `json:"name"`
			ID        string `json:"sessionId"`
			Pid       int    `json:"pid"`
			StartedAt int64  `json:"startedAt"`
		}
		raw, err := os.ReadFile(file)
		if err != nil || json.Unmarshal(raw, &session) != nil || !pidAlive(session.Pid) {
			continue
		}
		loaded := time.UnixMilli(session.StartedAt)
		if reload := lastReload(session.ID); reload.After(loaded) {
			loaded = reload
		}
		held := "unknown"
		for _, v := range versions {
			if session.StartedAt > 0 && !v.at.After(loaded) {
				held = v.name
			}
		}
		if held != to {
			older = append(older, ordered{{"session", cmp.Or(session.Name, session.ID)}, {"version", held}})
		}
	}
	return older
}

// the time of the session's last /reload-plugins, read from its transcript; zero when it never ran one
func lastReload(id string) time.Time {
	path := newestTranscript(id)
	if path == "" {
		return time.Time{}
	}
	file, err := os.Open(path)
	if err != nil {
		return time.Time{}
	}
	defer file.Close()
	var last time.Time
	scan := bufio.NewScanner(file)
	scan.Buffer(make([]byte, 0, 1<<20), 64<<20)
	for scan.Scan() {
		if !bytes.Contains(scan.Bytes(), []byte("<command-name>/reload-plugins</command-name>")) {
			continue
		}
		var row struct {
			Timestamp time.Time `json:"timestamp"`
		}
		if json.Unmarshal(scan.Bytes(), &row) == nil && row.Timestamp.After(last) {
			last = row.Timestamp
		}
	}
	return last
}
