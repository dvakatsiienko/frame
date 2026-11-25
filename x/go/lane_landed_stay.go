package main

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// why a tree must stay, or "" when it may go: its own dirt, a git lock, a live session in it
func treeStay(e worktreeEntry, main string, selves []string, mergedHead string) string {
	reason := treeDirt(e.path, main, selves, mergedHead)
	if e.locked {
		// git worktree lock: a session working in it, git refuses to remove it either way
		reason = strings.TrimPrefix(reason+", "+lockSays(e), ", ")
	}
	if session := liveSessionIn(e.path); session != "" {
		reason = strings.TrimPrefix(reason+", a live session sits in it: "+session, ", ")
	}
	return reason
}

// the ignored paths an install, a build or a seed makes again, from frame's and bytes' .gitignore build lines;
// any other ignored path keeps the tree, since worktree remove deletes it (nothing of dima's is destroyed)
var disposable = regexp.MustCompile(`(^|/)(node_modules|\.next|\.vite|\.turbo|\.vercel|\.generated|dist|build|out|coverage|\.vitest|__pycache__|\.pnpm-store)/` +
	`|(^|/)\.claude-plugin/types/` +
	`|(^|/)(\.DS_Store|\.worktree-offset|[^/]*\.tsbuildinfo|(npm|yarn|\.pnpm)-[^/]*\.log[^/]*)$` +
	`|^(x/go/bin/|x/go/x$|home/\.claude/sline/(bin/|sline$)|schedule/jobs/[^/]+/bin/|home/\.claude/plugin-x/mods/[^/]+/tsconfig\.json$)`)

// a seed's copy (bytes copies its .env files in) is the main checkout's file byte for byte, so the main keeps it
func seedCopy(tree, main, file string) bool {
	if strings.HasSuffix(file, "/") {
		return false
	}
	ours, err := os.ReadFile(filepath.Join(tree, file))
	if err != nil {
		return false
	}
	theirs, err := os.ReadFile(filepath.Join(main, file))
	return err == nil && string(ours) == string(theirs)
}

func treeDirt(tree, main string, selves []string, mergedHead string) string {
	var reasons []string
	if slices.Contains(selves, resolved(tree)) {
		reasons = append(reasons, "x runs from it")
	}
	// worktree remove deletes ignored files too: only build, install and seed output goes with the tree
	status, _ := gitIn(tree, "status", "--porcelain", "--ignored=matching")
	var changed, ignored []string
	for line := range strings.SplitSeq(status.out, "\n") {
		// run trims stdout, so the first line may have lost its leading status blank
		if len(line) <= 2 {
			continue
		}
		file := strings.TrimSpace(line[2:])
		switch {
		case !strings.HasPrefix(line, "!!"):
			changed = append(changed, file)
		case file != ".scratch/" && file != seedLink && !disposable.MatchString(file) && !seedCopy(tree, main, file):
			ignored = append(ignored, file)
		}
	}
	switch {
	case !status.ok:
		reasons = append(reasons, "git status failed")
	case len(changed) > 0:
		reasons = append(reasons, "changes in "+strings.Join(changed, ", "))
	}
	if len(ignored) > 0 {
		reasons = append(reasons, "ignored files no build or seed makes: "+strings.Join(ignored, ", "))
	}
	if holdsAFile(filepath.Join(tree, ".scratch")) {
		reasons = append(reasons, "holds a file in .scratch/")
	}
	if stoppedOn(tree) != "" {
		reasons = append(reasons, "a rebase or bisect is stopped in it")
	}
	// a squash merge leaves the branch's commits off main, and a deleted branch leaves them on no remote:
	// a tree at the merged pr's head, or at an earlier one, holds nothing the pr did not carry
	carried := false
	if mergedHead != "" {
		within, _ := gitIn(tree, "merge-base", "--is-ancestor", "HEAD", mergedHead)
		carried = within.ok
	}
	if !carried {
		ahead, _ := gitIn(tree, "rev-list", "HEAD", "--not", "--remotes=origin")
		switch {
		case !ahead.ok:
			reasons = append(reasons, "git rev-list failed")
		// commits on no remote that origin/main holds by a squash are landed: nothing would be lost (PK-404)
		case ahead.out != "" && !onMain(main, strings.SplitN(ahead.out, "\n", 2)[0]):
			reasons = append(reasons, plural(len(strings.Split(ahead.out, "\n")), "commit")+" on no remote")
		}
	}
	return strings.Join(reasons, ", ")
}

// worktree-seed.sh's link for a fork's tree: nothing of a session's, and excluded so git calls it ignored
const seedLink = ".claude/agents/wishkeeper.md"

// a walk that fails holds something it could not read, so it reads as holding a file
func holdsAFile(dir string) bool {
	found := false
	err := filepath.WalkDir(dir, func(_ string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() {
			found = true
			return fs.SkipAll
		}
		return nil
	})
	return found || err != nil && !errors.Is(err, fs.ErrNotExist)
}
