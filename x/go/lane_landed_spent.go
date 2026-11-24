package main

import (
	"cmp"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var verifyShaName = regexp.MustCompile(`^verify-[0-9a-f]{7,40}$`)

// a tree untouched this long may go; a session reading a tree by path moves nothing in it, so this is the one age a tree has
const touchFence = 2 * time.Hour

// a verify-<sha> tree, of any lane, at a sha origin/main holds is spent: landed decamps it clean, and names it when it stays
func spentVerifyTree(main, name, sha string, detached bool) bool {
	return detached && verifyShaName.MatchString(name) && strings.HasPrefix(sha, strings.TrimPrefix(name, "verify-")) &&
		ok(gitIn(main, "merge-base", "--is-ancestor", sha, "origin/main"))
}

// treeStay, and for another lane's tree its age too. the age is read first: treeStay's git status can rewrite a racy index,
// which would date the tree now
func treeStayAged(e worktreeEntry, other bool, main string, selves []string, mergedHead string) string {
	touched := ""
	if other {
		touched = recentlyTouched(e.path)
	}
	return cmp.Or(treeStay(e, main, selves, mergedHead), touched)
}

// why a spent tree stays on its age: its git admin dir, which creation, a checkout and any git run in the tree write to, has a
// file changed inside the fence. a dir that does not read holds the tree, since what cannot be read says nothing
func recentlyTouched(tree string) string {
	pointer, err := os.ReadFile(filepath.Join(tree, ".git"))
	admin, found := strings.CutPrefix(strings.TrimSpace(string(pointer)), "gitdir: ")
	if err != nil || !found {
		return "recently touched: its git dir did not read"
	}
	var newest time.Time
	err = filepath.WalkDir(admin, func(_ string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		info, err := entry.Info()
		if err == nil && info.ModTime().After(newest) {
			newest = info.ModTime()
		}
		return err
	})
	if err != nil {
		return "recently touched: its git dir did not read"
	}
	if age := clock().Sub(newest); age < touchFence {
		return "recently touched: its git dir changed " + age.Round(time.Minute).String() + " ago, inside " + touchFence.String()
	}
	return ""
}
