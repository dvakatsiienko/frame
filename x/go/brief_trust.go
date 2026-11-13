package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

const trustKey = "hasTrustDialogAccepted"

// trustOf reads ~/.claude.json for a summon home (already cleaned, so a trailing slash reads the key cc writes): trusted, or a fleet member's own home whose entry holds the key false,
// which the summon sets at --apply (mend is that entry's key); anything else is neither
func trustOf(home string) (isTrusted bool, mend string) {
	userHome, _ := os.UserHomeDir()
	raw, err := os.ReadFile(filepath.Join(userHome, ".claude.json"))
	if err != nil {
		return false, ""
	}
	var config struct {
		Projects map[string]struct {
			Trusted *bool `json:"hasTrustDialogAccepted"`
		} `json:"projects"`
	}
	if json.Unmarshal(raw, &config) != nil {
		return false, ""
	}
	key := home
	entry := config.Projects[key]
	switch {
	case entry.Trusted == nil:
		return false, ""
	case *entry.Trusted:
		return true, ""
	case isMemberHome(key, userHome):
		return false, key
	}
	return false, ""
}

// isMemberHome is an exact match against a fleet member's home, never a prefix: the home as typed (cleaned) names a member
// and so does its symlink-resolved form, so a symlink to a member, or out of the worktrees, is no member; a worktree counts only
// as a direct child of the main checkout's .claude/worktrees/
func isMemberHome(home, userHome string) bool {
	resolve := func(path string) string {
		if real, err := filepath.EvalSymlinks(path); err == nil {
			return real
		}
		return path
	}
	frame := mainCheckout(frameRoot())
	resolved := resolve(home)
	for _, member := range []string{frame, filepath.Join(frame, "_clio"), filepath.Join(frame, "_crow"), filepath.Join(userHome, "projects/bytes"), filepath.Join(userHome, "projects/studio")} {
		if home == filepath.Clean(member) && resolved == resolve(member) {
			return true
		}
	}
	trees := filepath.Join(frame, ".claude/worktrees")
	return filepath.Dir(home) == trees && filepath.Dir(resolved) == resolve(trees) && filepath.Base(home) != ".."
}

// setTrust flips one value, projects[key].hasTrustDialogAccepted, false to true: a targeted edit of the bytes cc wrote, never a
// re-serialize, in a unique temp file beside it that a rename puts in place, then read back as the summon reads it. cc may later
// save its in-memory copy over it and flip the key back (an inference, never seen): harmless, the member has started past the
// dialog and the next summon writes it again
func setTrust(key string) error {
	userHome, _ := os.UserHomeDir()
	path := filepath.Join(userHome, ".claude.json")
	hand := &Fail{Msg: key + "'s trust key was not set in " + path, Next: "jq '.projects[\"" + key + "\"]." + trustKey + " = true' ~/.claude.json > /tmp/claude.json && mv /tmp/claude.json ~/.claude.json"}
	raw, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	start, end, found := falseTrustAt(raw, key)
	if !found {
		if isTrusted, _ := trustOf(key); isTrusted {
			return nil
		}
		return hand
	}
	edited := bytes.Clone(raw[:start])
	edited = append(append(edited, "true"...), raw[end:]...)
	if !json.Valid(edited) {
		return hand
	}
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	temp, err := os.CreateTemp(filepath.Dir(path), ".claude.json.x-trust-*")
	if err != nil {
		return err
	}
	_, werr := temp.Write(edited)
	if cerr := temp.Close(); werr == nil {
		werr = cerr
	}
	if werr == nil {
		werr = os.Chmod(temp.Name(), info.Mode().Perm())
	}
	if werr == nil {
		werr = os.Rename(temp.Name(), path)
	}
	if werr != nil {
		_ = os.Remove(temp.Name())
		return werr
	}
	if isTrusted, _ := trustOf(key); !isTrusted {
		return hand
	}
	return nil
}

// falseTrustAt finds the `false` of projects[key].hasTrustDialogAccepted by walking the json tokens: its byte range, or none
func falseTrustAt(raw []byte, key string) (start, end int, found bool) {
	type open struct {
		isObject, wantsKey bool
		key                string
	}
	var stack []open
	done := func() {
		if len(stack) > 0 && stack[len(stack)-1].isObject {
			stack[len(stack)-1].wantsKey = true
		}
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	for {
		token, err := dec.Token()
		if err != nil {
			return 0, 0, false
		}
		switch v := token.(type) {
		case json.Delim:
			if v == '{' || v == '[' {
				stack = append(stack, open{isObject: v == '{', wantsKey: v == '{'})
				continue
			}
			stack = stack[:len(stack)-1]
			done()
		case string:
			if top := len(stack) - 1; top >= 0 && stack[top].isObject && stack[top].wantsKey {
				stack[top].key, stack[top].wantsKey = v, false
				continue
			}
			done()
		case bool:
			if len(stack) == 3 && stack[0].key == "projects" && stack[1].key == key && stack[2].key == trustKey && !v {
				end = int(dec.InputOffset())
				if start = end - len("false"); start >= 0 && strings.HasPrefix(string(raw[start:end]), "false") {
					return start, end, true
				}
				return 0, 0, false
			}
			done()
		default:
			done()
		}
	}
}
