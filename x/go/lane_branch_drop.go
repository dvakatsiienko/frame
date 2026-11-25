package main

import (
	"os"
	"strings"
)

// only a lane's own branch shape goes by itself
func isLaneBranch(ref string) bool {
	return strings.HasPrefix(ref, "codie/")
}

func branchStands(main, ref string) bool {
	if ok(gitIn(main, "rev-parse", "--verify", "-q", "refs/heads/"+ref)) {
		return true
	}
	sha, err := remoteBranch(main, ref)
	return sha != "" || err != nil
}

// a rebase or a bisect detaches its tree, and only these files still name what it will come back to
func stoppedOn(tree string) string {
	for _, path := range gitPaths(tree, "rebase-merge/head-name", "rebase-apply/head-name", "BISECT_START") {
		if raw, err := os.ReadFile(path); err == nil {
			return strings.TrimPrefix(strings.TrimSpace(string(raw)), "refs/heads/")
		}
	}
	return ""
}

// why a branch must stay, "" when it may go: a tree on it, or a commit carried does not vouch for
func branchStay(main, ref, uncarried string, carried func(sha string) bool) (string, branchTips) {
	return branchStayUnless(main, ref, uncarried, carried, nil)
}

func branchDrop(main, ref string, tips branchTips) string {
	if tips.local != "" {
		if deleted, _ := gitIn(main, "update-ref", "-d", "refs/heads/"+ref, tips.local); !deleted.ok {
			return "⚠ " + ref + " stays: it moved since the read"
		}
	}
	if tips.remote != "" {
		// a ref delete carries no commit for the pre-push gates to read
		if deleted, _ := gitIn(main, "-c", "core.hooksPath=/dev/null", "push", "-q", "--force-with-lease=refs/heads/"+ref+":"+tips.remote, "origin", ":refs/heads/"+ref); !deleted.ok {
			return "⚠ " + ref + " stays on origin: the delete failed or it moved since the read"
		}
	}
	return ref + " gone"
}

// an open pr based on the branch would close with it
func laneBranchWhy(as, main, slug, ref, head string) (string, branchTips) {
	if why := openPrOnBase(as, slug, ref); why != "" {
		return why, branchTips{}
	}
	return branchStay(main, ref, "the merge did not carry", func(sha string) bool {
		return sha == head || ok(gitIn(main, "merge-base", "--is-ancestor", sha, head))
	})
}

// one line on the merged branch, "" when no lane branch stands
func laneBranchNote(as, main, slug, ref, head string) string {
	if !isLaneBranch(ref) || !branchStands(main, ref) {
		return ""
	}
	why, tips := laneBranchWhy(as, main, slug, ref, head)
	if why != "" {
		return ref + " stays: " + why
	}
	return branchDrop(main, ref, tips)
}
