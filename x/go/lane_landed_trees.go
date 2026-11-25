package main

import (
	"path/filepath"
	"slices"
	"strings"
)

// a tree of this lane's, or another lane's spent verify tree (`other`, FRM-660): a spent tree goes when clean, and when it stays
// it never holds this landing. a verify tree whose sha is not on main is another lane's under review, and is never read (FRM-649)
type laneTree struct {
	path, reason string
	// another lane's spent verify tree: it never holds this ticket's landing, only named when it stays
	other bool
	// why the tree's lock is stale, when that lock alone held it: unlocked on --apply
	staleLock string
}

// what names a lane's trees beyond its codie/<ticket>-* branches: the pr, its head, its head once merged
type laneRefs struct {
	pr, headRef, headSha, mergedHead string
	commits                          []string // a quick lane's commits on origin/main, «<short sha> <subject>»
	underReview                      bool     // its sixth sense has not said verified: its verify tree stays
}

// laneTrees lists the ticket's trees under .claude/worktrees/, each with why it must stay, or clean by
// the root rule: no change in git status, no file in .scratch/, every commit on an origin ref or in the merged pr.
// a lane tree is a codie/<ticket>-* branch or the pr's head ref; a detached one is sixth sense's verify tree,
// named verify-pr-<n> (frame), verify-<ticket> (any other repo) or sitting at the pr's head

func laneTrees(main, repo, id string, refs laneRefs) ([]laneTree, error) {
	mergedHead := refs.mergedHead
	listed, err := mustGitIn(main, "worktree", "worktree", "list", "--porcelain")
	if err != nil {
		return nil, err
	}
	// git lists a path as it was added, which may run through a symlink (/var → /private/var)
	under := resolved(filepath.Join(main, ".claude", "worktrees")) + string(filepath.Separator)
	selves := []string{resolved(repo), resolved(frameRoot())}
	if cwd, cerr := top(); cerr == nil {
		selves = append(selves, resolved(cwd))
	}
	var trees []laneTree
	for _, entry := range worktreesOf(listed) {
		path, branch, sha, detached := entry.path, entry.branch, entry.sha, entry.detached
		ours := branch != "" && (strings.HasPrefix(branch, "codie/"+id+"-") || branch == refs.headRef)
		name := filepath.Base(path)
		// a quick lane's verify tree is verify-<short sha> at one of the ticket's commits on main
		atCommit := strings.HasPrefix(name, "verify-") && slices.ContainsFunc(refs.commits, func(c string) bool {
			short, _, _ := strings.Cut(c, " ")
			return short != "" && strings.HasPrefix(sha, short)
		})
		verify := detached && (name == "verify-"+id || (refs.pr != "" && name == "verify-pr-"+refs.pr) || (refs.headSha != "" && sha == refs.headSha) || atCommit)
		if !strings.HasPrefix(resolved(path), under) || !(ours || verify || spentVerifyTree(main, name, sha, detached)) {
			continue
		}
		// a lock whose pid is gone keeps no tree: landed unlocks it, named, on --apply; a reused pid only names the unlock
		stale, isGone := staleLock(entry)
		if !isGone {
			stale = ""
		}
		if stale != "" {
			entry.locked = false
		}
		reason := treeStayAged(entry, !ours && !verify, main, selves, mergedHead)
		if stale != "" && reason != "" {
			reason += ", its lock is stale, " + stale + ": git worktree unlock " + path
			stale = ""
		}
		if verify && refs.underReview {
			reason = strings.TrimSuffix("its lane is still under review, "+reason, ", ")
		}
		trees = append(trees, laneTree{path: path, reason: reason, staleLock: stale, other: !ours && !verify})
	}
	return trees, nil
}

type worktreeEntry struct {
	path, branch, sha string
	detached, locked  bool
	// what `git worktree lock --reason` holds: cc writes its session's pid and start time there
	lockReason string
}

func worktreesOf(listed string) []worktreeEntry {
	var entries []worktreeEntry
	for block := range strings.SplitSeq(listed, "\n\n") {
		var e worktreeEntry
		for line := range strings.SplitSeq(block, "\n") {
			if reason, found := strings.CutPrefix(line, "locked "); found || line == "locked" {
				e.locked, e.lockReason = true, reason
			}
			if v, ok := strings.CutPrefix(line, "worktree "); ok {
				e.path = v
			}
			if v, ok := strings.CutPrefix(line, "HEAD "); ok {
				e.sha = v
			}
			if v, ok := strings.CutPrefix(line, "branch refs/heads/"); ok {
				e.branch = v
			}
			e.detached = e.detached || line == "detached"
		}
		entries = append(entries, e)
	}
	return entries
}

func resolved(path string) string {
	if real, err := filepath.EvalSymlinks(path); err == nil {
		return real
	}
	return path
}
