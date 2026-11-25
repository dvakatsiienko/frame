package main

import (
	"regexp"
)

// a risky path's one /security-review, run by codie before sixth sense's first round and recorded by sixth sense's stamp
// beside the clean; it carries to a new head by the clean's own rule (FRM-548)
func securityCheck(repo, n, head, base, ref string) mergeCheck {
	c := mergeCheck{Name: "security"}
	stamp := "~/frame/_clio/.claude/hooks/watch-pr.sh --verified " + repo + " " + n + " " + head + " --security <sha>"
	store, path, _ := verifiedStore()
	passed := store[repo+"#"+n+":security"]
	switch {
	case store == nil:
		c.Detail = "no sixth sense store at " + path
	case passed == "":
		c.Detail = "no security pass recorded for " + repo + "#" + n + ": a risky path asks codie's /security-review before sixth sense's first round, then its stamp: " + stamp
	case passed == head:
		c.OK, c.Detail = true, "security pass on "+short(head)
	// the store value reaches git as a revision, so a ref name like origin/main is refused before it can pass a pr
	case !shaValue.MatchString(passed):
		c.Detail = "the security pass recorded for " + repo + "#" + n + " is not a commit sha: " + passed + "; a new pass and its stamp: " + stamp
	// one pass a risky pr, never rerun (dima, grill 2 Q6): a pass on the head's history holds after a later push, but only
	// on the pr's own commits: a base commit sits in every pr's history and holds none of its code
	case ok(gitIn("", "fetch", "-q", "origin", "refs/heads/"+ref)) && ok(gitIn("", "merge-base", "--is-ancestor", passed, head)) &&
		!ok(gitIn("", "merge-base", "--is-ancestor", passed, "origin/"+base)):
		c.OK, c.Detail = true, "security pass on "+short(passed)+", on the history of "+short(head)
	default:
		if c.OK, c.Detail = carried(passed, "the security pass", head, base, ref); !c.OK {
			c.Detail += "; a new pass and its stamp: " + stamp
		}
	}
	return c
}

var shaValue = regexp.MustCompile(`^[0-9a-f]{8,40}$`)
