package main

import (
	"errors"
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
	out, err := gitBytes(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--", modsDir+mod)
	if err != nil {
		return nil, &Fail{Msg: "git status failed: " + err.Error(), Next: "git status"}
	}
	var dirty []string
	seen := map[string]bool{}
	entries := strings.Split(string(out), "\x00")
	for i := 0; i < len(entries); i++ {
		entry := entries[i]
		if len(entry) < 4 {
			continue
		}
		state, paths := entry[:2], []string{entry[3:]}
		// a rename or copy lists its new path, then the path it came from
		if strings.ContainsAny(state, "RC") && i+1 < len(entries) {
			paths = append(paths, entries[i+1])
			i++
		}
		for _, path := range paths {
			if !seen[path] {
				seen[path] = true
				dirty = append(dirty, path)
			}
		}
	}
	mine := map[string]bool{}
	for _, held := range heldBy(repo, dirty, true) {
		mine[held.named] = true
	}
	var skipped []string
	for _, path := range dirty {
		if path == keep || mine[path] || exists(filepath.Join(scratch, scratchBase, path)) {
			continue
		}
		inOverlay := filepath.Join(overlay, strings.TrimPrefix(path, modsDir+mod+"/"))
		// whether HEAD holds it, not the status letters, says what the overlay gets: a `git rm --cached` file reads «D» and «??»
		if _, err := gitBytes(repo, "cat-file", "-e", "HEAD:"+path); err != nil {
			if err := removeIfThere(inOverlay); err != nil {
				return nil, err
			}
		} else if err := writeHeadCopy(repo, path, inOverlay); err != nil {
			return nil, err
		}
		skipped = append(skipped, path+", not yours")
		fmt.Fprintln(os.Stderr, "skipped: "+path+", not yours")
	}
	return skipped, nil
}

// writeHeadCopy writes HEAD's bytes of one path over the overlay's copy
func writeHeadCopy(repo, path, to string) error {
	body, err := gitBytes(repo, "show", "HEAD:"+path)
	if err != nil {
		return &Fail{Msg: "git show HEAD:" + path + " failed: " + err.Error(), Next: "git status"}
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	return os.WriteFile(to, body, 0o644)
}

// git's stdout byte for byte, its stderr in the error
func gitBytes(repo string, args ...string) ([]byte, error) {
	out, err := exec.Command("git", append([]string{"-C", repo}, args...)...).Output()
	if exitErr, ok := errors.AsType[*exec.ExitError](err); ok && len(exitErr.Stderr) > 0 {
		return out, fmt.Errorf("%w: %s", err, strings.TrimSpace(string(exitErr.Stderr)))
	}
	return out, err
}

// a run that left a peer's work at HEAD tested bytes the working tree does not hold, so it proves nothing for a commit of that tree
func anySkipped(reports []modReport) bool {
	for _, report := range reports {
		if len(report.Skipped) > 0 {
			return true
		}
	}
	return false
}
