package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// the overlay is HEAD plus this session's own edits: whatever else git sees dirty in the mod is a parallel member's half-done
// work, put back to HEAD's bytes (or removed when HEAD has no such file) and named on stderr and in the report. a path stays when
// this session pulled or landed it (a base copy in scratch), holds it (it wrote it in the tree), or `keep` names it; an ignored
// file (the engine's types) is never dirt. left in, one peer's red test file or half edit reds every run until its owner commits
// (FRM-572 line 17: a staged file counted too, which `git ls-files --others` never lists)
func leavePeersOut(repo, scratch, overlay, mod, keep string) ([]string, error) {
	// exec itself: run trims its output, and a status line opens with a space
	out, err := exec.Command("git", "-C", repo, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", modsDir+mod).Output()
	if err != nil {
		return nil, &Fail{Msg: "git status failed: " + err.Error(), Next: "git status"}
	}
	var skipped []string
	entries := strings.Split(string(out), "\x00")
	for i := 0; i < len(entries); i++ {
		entry := entries[i]
		if len(entry) < 4 {
			continue
		}
		state, path := entry[:2], entry[3:]
		paths := []string{path}
		// a rename or copy lists its new path, then the path it came from, which HEAD still holds
		if state[0] == 'R' || state[0] == 'C' {
			if i+1 < len(entries) {
				paths = append(paths, entries[i+1])
			}
			i++
		}
		for n, one := range paths {
			if one == keep || exists(filepath.Join(scratch, scratchBase, one)) || len(heldBy(repo, []string{one}, true)) > 0 {
				continue
			}
			inOverlay := filepath.Join(overlay, strings.TrimPrefix(one, modsDir+mod+"/"))
			// a path HEAD does not have: untracked, added to the index, or the new name of a rename
			isNew := state == "??" || state[0] == 'A' || (n == 0 && (state[0] == 'R' || state[0] == 'C'))
			if isNew {
				if err := removeIfThere(inOverlay); err != nil {
					return nil, err
				}
			} else if err := writeHeadCopy(repo, one, inOverlay); err != nil {
				return nil, err
			}
			skipped = append(skipped, one+", not yours")
			fmt.Fprintln(os.Stderr, "skipped: "+one+", not yours")
		}
	}
	return skipped, nil
}

// writeHeadCopy writes HEAD's bytes of one path over the overlay's copy
func writeHeadCopy(repo, path, to string) error {
	c := exec.Command("git", "-C", repo, "show", "HEAD:"+path)
	body, err := c.Output()
	if err != nil {
		return &Fail{Msg: "git show HEAD:" + path + " failed: " + err.Error(), Next: "git status"}
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	return os.WriteFile(to, body, 0o644)
}
