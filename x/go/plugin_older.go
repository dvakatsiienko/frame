package main

import (
	"bufio"
	"bytes"
	"cmp"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
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
		reload, read := lastReload(session.ID)
		if reload.After(loaded) {
			loaded = reload
		}
		held := "unknown"
		for _, v := range versions {
			if read && (session.StartedAt > 0 || !reload.IsZero()) && !v.at.After(loaded) {
				held = v.name
			}
		}
		if held != to {
			older = append(older, ordered{{"session", cmp.Or(session.Name, session.ID)}, {"version", held}})
		}
	}
	return older
}

const reloadCommand = "<command-name>/reload-plugins</command-name>"

// the time of the session's last /reload-plugins, read from its transcript: zero when it never ran one, and false
// when the transcript could not be read to its end, so the caller says «unknown» rather than guess
func lastReload(id string) (time.Time, bool) {
	path := newestTranscript(id)
	if path == "" {
		return time.Time{}, true
	}
	file, err := os.Open(path)
	if err != nil {
		return time.Time{}, false
	}
	defer file.Close()
	var last time.Time
	scan := bufio.NewScanner(file)
	scan.Buffer(make([]byte, 0, 1<<20), 64<<20)
	for scan.Scan() {
		if !bytes.Contains(scan.Bytes(), []byte(reloadCommand)) {
			continue
		}
		// only the command row itself: a tool result quoting the tag (a Read of this file) is no reload
		var row struct {
			Type      string    `json:"type"`
			Timestamp time.Time `json:"timestamp"`
			Message   struct {
				Content json.RawMessage `json:"content"`
			} `json:"message"`
		}
		var content string
		if json.Unmarshal(scan.Bytes(), &row) != nil {
			continue
		}
		command := row.Type == "user" && json.Unmarshal(row.Message.Content, &content) == nil && strings.HasPrefix(content, reloadCommand)
		if command && row.Timestamp.After(last) {
			last = row.Timestamp
		}
	}
	return last, scan.Err() == nil
}
