package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// what the caller asked, and where from
type commitCall struct {
	msgFile, message, startCwd, repo, bumpName string
	// the message taken on stdin, the caller's to remove, a refusal's too
	piped     string
	paths     []string
	dry, hold bool
}

// with --repo it enters that repo, so top() after it reads that tree
func readCommitCall(args []string, flags Flags) (call commitCall, err error) {
	call = commitCall{msgFile: args[0], paths: args[1:], dry: flags["dry"] == true, hold: flags["hold-unstaged"] == true}
	// `-` takes the message on stdin, so no message file is kept or reused (a reused one glued two messages, 2026-10-14)
	if call.msgFile == "-" {
		piped, err := stdinMessage()
		if err != nil {
			return call, err
		}
		call.piped, call.msgFile = piped, piped
	}
	if _, err := os.Stat(call.msgFile); err != nil {
		return call, usageFail("no message file at "+call.msgFile, "x lane commit <msg-file> -- <paths…>")
	}
	call.bumpName, _ = flags["bump"].(string)
	if len(call.paths) == 0 && call.bumpName == "" {
		return call, usageFail("no paths — name what goes into the commit", "x lane commit "+call.msgFile+" -- <paths…>")
	}
	call.message, _ = filepath.Abs(call.msgFile)
	call.startCwd, _ = os.Getwd()
	call.repo, _ = flags["repo"].(string)
	if call.repo != "" {
		if call.dry {
			return call, usageFail("--dry reads this tree's hook, never another repo's", "x lane commit --dry "+call.msgFile+" -- <paths…>")
		}
		if err := enterMain(call.repo); err != nil {
			return call, err
		}
	}
	return call, nil
}

// the gate turn's label, and what a retry this run names carries: the flag and the caller's own paths, never the manifest the
// bump adds
type commitRetry struct {
	verb, head, paths string
}

func commitRetryLines(call commitCall) commitRetry {
	bumpFlag := ""
	if call.bumpName != "" {
		bumpFlag = "--bump " + call.bumpName + " "
	}
	verb := "x lane commit "
	switch {
	case call.dry:
		verb += "--dry "
	case call.hold:
		verb += "--hold-unstaged "
	}
	return commitRetry{verb: verb, head: bumpFlag + call.msgFile, paths: strings.Join(call.paths, " ")}
}

// all after the verb
func (retry commitRetry) rest() string {
	return strings.TrimSuffix(retry.head+" -- "+retry.paths, " -- ")
}

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

func midOperation() bool {
	return slices.ContainsFunc(gitPaths("", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"), exists)
}

// what stops a dry run before it waits for its turn
func dryRefusal(tree string, call commitCall) error {
	if call.dry && !exists(filepath.Join(tree, gateCopyRun)) {
		return usageFail("--dry reads a frame-shaped hook: this tree has no "+gateCopyRun, "x lane commit "+call.msgFile+" -- <paths…>")
	}
	if call.dry && midOperation() {
		return usageFail("--dry cannot mirror a commit mid-merge, mid-cherry-pick, mid-revert or mid-rebase", "x lane commit "+call.msgFile+" -- <paths…>")
	}
	return nil
}
