package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/user"
	"path/filepath"
	"time"
)

// the scope merge-auto and x-mod-guard's merge rule ask for; `guards` and `all` are later chunks
const overrideScopePrs = "prs"

// one scope's grant in the store, shaped as x-mod-guard's reader reads it
type overrideGrant struct {
	By    string `json:"by"`
	At    string `json:"at"`
	Until string `json:"until,omitempty"`
}

// what the merge's record carries
type overrideUsed struct {
	Scope    string `json:"scope"`
	By       string `json:"by"`
	At       string `json:"at"`
	DevBuild bool   `json:"devBuild,omitempty"`
}

func (u *overrideUsed) named() string {
	said := "operator-override " + u.Scope + ", by " + u.By + " at " + u.At
	if u.DevBuild {
		said += ", from a dev build"
	}
	return said
}

// the store's path: a session's Bash can set HOME and X_STATE, so neither reaches a real run; a test binary
// reads only the store its test names, so a real override on this mac can't land inside a suite
func overrideStore() string {
	if mergeTestEnvOn() {
		return os.Getenv("X_OVERRIDE_STORE")
	}
	return filepath.Join(systemHome(), ".local/state/x/operator-override.json")
}

func overrideLog(store string) string {
	return filepath.Join(filepath.Dir(store), "operator-override.log")
}

// the system's user record, which HOME can't move; no record means no path, and no path reads off
func systemHome() string {
	me, err := user.Current()
	if err != nil {
		return ""
	}
	return me.HomeDir
}

// the one question every lock asks; a store that does not read answers off, so a broken one locks as today
func overrideOn(scope string) (overrideGrant, bool) {
	store := overrideStore()
	if store == "" || !filepath.IsAbs(store) {
		return overrideGrant{}, false
	}
	raw, err := os.ReadFile(store)
	if err != nil {
		return overrideGrant{}, false
	}
	var grants map[string]overrideGrant
	if json.Unmarshal(raw, &grants) != nil {
		return overrideGrant{}, false
	}
	grant, on := grants[scope]
	if !on || grant.By == "" {
		return overrideGrant{}, false
	}
	if grant.Until != "" {
		until, err := time.Parse(time.RFC3339, grant.Until)
		if err != nil || !clock().Before(until) {
			return overrideGrant{}, false
		}
	}
	return grant, true
}

// one line per pass; it is what catches a store written around the guard. a line that can't land is named to the
// caller, never a stop: the merge is done by now
func overrideLogPass(used *overrideUsed, what string) error {
	line, err := json.Marshal(map[string]any{"at": clock().Format(time.RFC3339), "by": used.By, "dev_build": used.DevBuild, "scope": used.Scope, "since": used.At, "what": what})
	if err != nil {
		return err
	}
	file, err := os.OpenFile(overrideLog(overrideStore()), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(file, "%s\n", line)
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	return err
}
