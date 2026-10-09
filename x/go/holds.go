package main

import (
	"encoding/json"
	"fmt"
	"maps"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// x-mod-holds (the cc mod) holds a file from a session's first edit until it is committed; lane commit
// reads its store and refuses a named path another live session holds, so a coordinator's commit never
// sweeps a coder's hunk (cclio took a live coder's package.json, 2026-10-06). the release checks are the
// mod's own: an idle holder, a dead pid, a landed hold that is clean in git. a broken store never blocks

var holdsFile = regexp.MustCompile(`^x-mod-holds_.*\.json$`)

const holdsIdle = 30 * time.Minute

type modHold struct {
	At     int64  `json:"at"`
	File   string `json:"file"`
	Landed bool   `json:"landed"`
}

type modHolder struct {
	Pid       int    `json:"pid"`
	Start     string `json:"start"`
	IdleSince *int64 `json:"idleSince"`
}

// named is the path the caller passed, file the held file under it (the same path unless named is a dir)
type heldPath struct {
	named, file, session string
	since                time.Duration
}

// the store dir: X_HOLDS in a test, none under X_TEST without it, cc's plugin store otherwise
func holdsDir() string {
	if dir := os.Getenv("X_HOLDS"); dir != "" {
		return dir
	}
	if os.Getenv("X_TEST") != "" {
		return ""
	}
	userHome, _ := os.UserHomeDir()
	return filepath.Join(userHome, ".claude", "plugins", "store")
}

func heldByOthers(tree string, paths []string) []heldPath {
	dir := holdsDir()
	if dir == "" {
		return nil
	}
	entries, _ := os.ReadDir(dir)
	store := map[string]json.RawMessage{}
	for _, entry := range entries {
		if !holdsFile.MatchString(entry.Name()) {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var one map[string]json.RawMessage
		if json.Unmarshal(raw, &one) == nil {
			maps.Copy(store, one)
		}
	}
	self, now := os.Getenv("CLAUDE_CODE_SESSION_ID"), time.Now()
	var held []heldPath
	for _, path := range paths {
		key := heldKey(filepath.Join(tree, path))
		for name, value := range store {
			rest, ok := strings.CutPrefix(name, "hold:")
			session, file, cut := strings.Cut(rest, ":")
			// a named dir takes every held file under it
			if !ok || !cut || (file != key && !strings.HasPrefix(file, key+"/")) || session == self {
				continue
			}
			var hold modHold
			if json.Unmarshal(value, &hold) != nil {
				continue
			}
			var holder *modHolder
			if raw, ok := store["holder:"+session]; ok {
				_ = json.Unmarshal(raw, &holder)
			}
			if holdReleased(holder, hold, now) {
				continue
			}
			file, err := filepath.Rel(tree, hold.File)
			if err != nil {
				file = hold.File
			}
			held = append(held, heldPath{path, file, session, now.Sub(time.UnixMilli(hold.At))})
		}
	}
	return held
}

// the mod keys a hold by the real path, lowercased (apfs is case-insensitive); a new file by its nearest real dir
func heldKey(path string) string {
	if real, err := filepath.EvalSymlinks(path); err == nil {
		return strings.ToLower(real)
	}
	dir := filepath.Dir(path)
	for ; dir != "/" && dir != "."; dir = filepath.Dir(dir) {
		if real, err := filepath.EvalSymlinks(dir); err == nil {
			return strings.ToLower(real + path[len(dir):])
		}
	}
	return strings.ToLower(path)
}

func holdReleased(holder *modHolder, hold modHold, now time.Time) bool {
	if holder == nil {
		return true
	}
	if holder.IdleSince != nil && now.Sub(time.UnixMilli(*holder.IdleSince)) >= holdsIdle {
		return true
	}
	if holder.Pid != 0 && holder.Start != "" {
		// a reused pid starts at another time
		got, _ := run("", nil, "", "ps", "-o", "lstart=", "-p", strconv.Itoa(holder.Pid))
		if strings.TrimSpace(got.out) != holder.Start {
			return true
		}
	}
	if hold.Landed {
		// a folder gone or outside git can commit nothing, so it holds nothing — the mod's isClean
		clean, _ := gitIn(filepath.Dir(hold.File), "status", "--porcelain", "--", hold.File)
		return !clean.ok || clean.out == ""
	}
	return false
}

func heldFail(held []heldPath, msgFile string, paths []string) *Fail {
	var msg []string
	taken := map[string]bool{}
	for _, h := range held {
		taken[h.named] = true
		msg = append(msg, fmt.Sprintf("%s is held by session %s, which took it %d min ago", h.file, h.session[:min(8, len(h.session))], int(math.Round(h.since.Minutes()))))
	}
	var free []string
	for _, path := range paths {
		if !taken[path] {
			free = append(free, path)
		}
	}
	next := "ask the holder to commit it, then x lane commit " + msgFile + " -- " + strings.Join(paths, " ")
	if len(free) > 0 {
		next = "x lane commit " + msgFile + " -- " + strings.Join(free, " ")
	}
	return &Fail{Refused: true, Msg: strings.Join(msg, "\n") + "\nnothing staged — commit only what this session holds", Next: next}
}
