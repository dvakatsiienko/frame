package main

import (
	"fmt"
	"path/filepath"
	"slices"
	"strings"
)

// a path resolves from the cwd, as git resolves a pathspec; every later step reads the root form, and a retry hint keeps
// the form the caller typed, since it reruns from the same cwd
func commitPaths(tree string, call commitCall) ([]string, error) {
	prefix := ""
	if call.repo != "" {
		prefix = prefixInside(tree, call.startCwd)
	} else if shown, _ := git("rev-parse", "--show-prefix"); shown.ok {
		prefix = shown.out
	}
	if prefix == "" {
		return slices.Clone(call.paths), nil
	}
	return rootPaths(tree, prefix, call.paths)
}

// prefixInside is where cwd sits under tree, ending in a slash, "" at the root or outside it: with --repo the run enters that
// repo's root, so the caller's own cwd says whether a typed path reads from a subfolder of it
func prefixInside(tree, cwd string) string {
	realTree, errTree := filepath.EvalSymlinks(tree)
	realCwd, errCwd := filepath.EvalSymlinks(cwd)
	if errTree != nil || errCwd != nil {
		return ""
	}
	rel, err := filepath.Rel(realTree, realCwd)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, "../") {
		return ""
	}
	return filepath.ToSlash(rel) + "/"
}

// rootPaths turns each path the caller typed from a subfolder (prefix, ending in a slash) into its repo-root form, as git
// resolves a pathspec from the cwd. when the cwd reading carries no change and the root reading does, the call is refused
// naming both: the caller wrote a root path from a subfolder, and neither reading is picked silently
func rootPaths(tree, prefix string, paths []string) ([]string, error) {
	changed := func(path string) bool {
		status, _ := gitIn(tree, "status", "--porcelain", "--untracked-files=all", "--", path)
		return status.out != ""
	}
	out := make([]string, len(paths))
	for i, typed := range paths {
		if filepath.IsAbs(typed) || strings.HasPrefix(typed, ":") {
			out[i] = typed
			continue
		}
		fromCwd, fromRoot := filepath.ToSlash(filepath.Join(prefix, typed)), filepath.ToSlash(filepath.Clean(typed))
		if !changed(fromCwd) && fromRoot != fromCwd && changed(fromRoot) {
			return nil, &Fail{Refused: true,
				Msg:  typed + " run from " + strings.TrimSuffix(prefix, "/") + "/ reads " + fromCwd + ", which has no change; " + fromRoot + " from the repo root does. a path resolves from the cwd, like git",
				Next: "x lane commit <msg-file> -- " + fromRoot + " from the repo root, or the path as the cwd sees it"}
		}
		out[i] = fromCwd
	}
	return out, nil
}

// a path gone from both the tree and the index (the old side of a mv) kills `add`,
// so stage only what exists and let the index carry the removal
func sortCommitPaths(call commitCall, paths []string) (present, named []string, err error) {
	for _, path := range paths {
		named = append(named, path)
		if exists(path) || ok(git("ls-files", "--error-unmatch", "--", path)) {
			present = append(present, path)
		} else if logged, _ := git("log", "-1", "--format=%h", "--", path); !ok(git("cat-file", "-e", "HEAD:"+path)) && logged.out != "" {
			// a racing commit (the pocket hook's) already landed this delete: nothing is left to commit for it
			named = named[:len(named)-1]
		} else if words := strings.Fields(path); len(words) > 1 && !ok(git("cat-file", "-e", "HEAD:"+path)) {
			// zsh hands a quoted "$paths" over as one argument; «nothing staged» hid that (2026-10-18)
			return nil, nil, usageFail(fmt.Sprintf("%q names no file: the path list arrived as one word", path),
				"x lane commit "+call.msgFile+" -- "+strings.Join(words, " "))
		} else if call.dry {
			// a dry run's index holds HEAD, so a path it cannot find matches nothing a real commit could take
			return nil, nil, &Fail{Refused: true, Msg: "pathspec " + path + " matches no file: a real commit refuses it", Next: "x lane commit --dry " + call.msgFile + " -- <paths that exist>"}
		}
	}
	return present, named, nil
}

func onDisk(paths []string) []string {
	var found []string
	for _, path := range paths {
		if exists(path) {
			found = append(found, path)
		}
	}
	return found
}
