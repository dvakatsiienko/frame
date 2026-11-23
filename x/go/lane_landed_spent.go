package main

import (
	"regexp"
	"strings"
)

var verifyShaName = regexp.MustCompile(`^verify-[0-9a-f]{7,40}$`)

// a verify-<sha> tree, of any lane, at a sha origin/main holds is spent: landed decamps it clean, and names it when it stays
func spentVerifyTree(main, name, sha string, detached bool) bool {
	return detached && verifyShaName.MatchString(name) && strings.HasPrefix(sha, strings.TrimPrefix(name, "verify-")) &&
		ok(gitIn(main, "merge-base", "--is-ancestor", sha, "origin/main"))
}
