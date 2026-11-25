package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// a worktree codie's other-repo half lands on that repo's main and nowhere else
func enterMain(repo string) error {
	root, _ := gitIn(repo, "rev-parse", "--show-toplevel")
	if !root.ok {
		return usageFail(repo+" is not a git repo", "x lane commit --repo <git repo on main> <msg-file> -- <paths…>")
	}
	name, _ := gitIn(root.out, "symbolic-ref", "--quiet", "--short", "HEAD")
	if name.out != "main" {
		return &Fail{Refused: true, Msg: fmt.Sprintf("%s is on %s, not main", root.out, or(name.out, "a detached HEAD")),
			Next: "switch " + root.out + " to main, then rerun"}
	}
	// the bare mid-merge commit would conclude someone else's merge under this message
	// absolute: in a linked worktree --git-path already answers absolute, and joining it to root breaks
	mergeHead, _ := gitIn(root.out, "rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD")
	if mergeHead.ok && exists(mergeHead.out) {
		return &Fail{Refused: true, Msg: root.out + " is mid-merge — not committing into someone else's merge",
			Next: "finish the merge in " + root.out + ", then rerun"}
	}
	return os.Chdir(root.out)
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

// stdinMessage saves the message piped on stdin to a temp file the commit reads, refusing an empty one
func stdinMessage() (string, error) {
	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		return "", err
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return "", usageFail("an empty message on stdin", "x lane commit - -- <paths…> <<'MSG' … MSG")
	}
	file, err := os.CreateTemp("", "x-msg-*.txt")
	if err != nil {
		return "", err
	}
	defer file.Close()
	if _, err := file.Write(raw); err != nil {
		return "", errors.Join(err, os.Remove(file.Name()))
	}
	return file.Name(), nil
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
