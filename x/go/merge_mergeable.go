package main

import (
	"time"
)

// github's own read of the merge, an allow-list: clean passes, and unstable, a red or pending check no branch rule
// requires, which ciCheck ignores too; github computes it after a push, so a null or unknown is read again
func mergeableCheck(api, n string, pr pullHead, trunk string, clock *waitClock) (mergeCheck, error) {
	c := mergeCheck{Name: "mergeable"}
	for read := 1; pr.Mergeable == nil || pr.MergeableState == "unknown"; read++ {
		if read == 3 {
			c.Detail = "github is still computing whether #" + n + " merges; run it again in a minute"
			return c, nil
		}
		clock.sleep(2 * time.Second)
		if _, err := ghFetch(asDima, api+"/pulls/"+n, &pr); err != nil {
			return c, err
		}
	}
	switch state := pr.MergeableState; state {
	case "clean", "unstable":
		c.OK, c.Detail = true, "github would merge it ("+state+")"
	case "dirty", "behind":
		// merge-main merges origin/main, so it fixes a plain pr onto main; a stack's layer restacks onto main whole
		door := "x lane restack --apply"
		if trunk != "" && pr.Base.Ref == "main" {
			door = "x lane merge-main"
		}
		said := "conflicts with"
		if state == "behind" {
			said = "is behind"
		}
		c.Detail = "#" + n + " " + said + " " + pr.Base.Ref + " → " + door
	case "blocked":
		c.Detail = "github's branch protection holds it: a required check or review is still missing"
	case "":
		c.Detail = "github gave #" + n + " no mergeable state"
	default:
		c.Detail = "github will not merge #" + n + ": its mergeable state is " + state
	}
	return c, nil
}
