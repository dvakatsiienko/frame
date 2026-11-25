package main

import (
	"regexp"
	"slices"
	"strings"
)

// clio's app posts the read; a person could name an account like it, but never make it a Bot
const clioApp = "x-clio-cc[bot]"

var wishkeeperRead = regexp.MustCompile(`^wishkeeper read ([0-9a-f]{7,40})\b`)

// a memory path's wishkeeper read, clio's before the merge: one pr comment from her app naming the sha it read, which
// reaches the head as a round does, by its history or a rebase that kept the code; no other author counts (FRM-548)
func wishkeeperCheck(api, n, head, base, ref string, paths []string) (mergeCheck, error) {
	c := mergeCheck{Name: "wishkeeper"}
	type note struct {
		User struct {
			Login string `json:"login"`
			Type  string `json:"type"`
		} `json:"user"`
		Body string `json:"body"`
	}
	notes, err := ghPages[note](asDima, api+"/issues/"+n+"/comments", "")
	if err != nil {
		return c, err
	}
	if got, _ := gitIn("", "fetch", "-q", "origin", "refs/heads/"+ref); !got.ok {
		c.Detail = "git could not fetch " + ref + " to read the wishkeeper read's history: " + logLine(got.log)
		return c, nil
	}
	for _, nt := range notes {
		read := wishkeeperRead.FindStringSubmatch(nt.Body)
		if nt.User.Login != clioApp || nt.User.Type != "Bot" || read == nil {
			continue
		}
		if !roundReaches(read[1], head, base, ref) {
			continue
		}
		// a read vouches only for the memory it saw: a memory path of the pr changed after it is unread (steer 20:32); a read
		// a rebase carried saw the same change, and a memory file only main changed is not the pr's
		// no rename folding: a memory file moved off its path still names its old one; a diff git could not read vouches nothing
		if ok(gitIn("", "merge-base", "--is-ancestor", read[1], head)) {
			// -z: a path with a space or a non-ascii byte comes whole and unquoted, as github names it
			changed, _ := gitIn("", "diff", "-z", "--name-only", "--no-renames", read[1], head)
			if !changed.ok {
				c.Detail = "git could not diff clio's wishkeeper read on " + short(read[1]) + " against " + short(head) + ": " + logLine(changed.log)
				continue
			}
			names := strings.Split(strings.Trim(changed.out, "\x00"), "\x00")
			if edited := slices.IndexFunc(names, func(p string) bool {
				return slices.Contains(paths, p) && matchesAny(p, riskyList.Memory)
			}); edited >= 0 {
				c.Detail = "clio's wishkeeper read on " + short(read[1]) + " is older than a memory edit, " + names[edited] + ": a new read reaches " + short(head)
				continue
			}
		}
		c.OK, c.Detail = true, "clio's wishkeeper read on "+short(read[1])
		return c, nil
	}
	if c.Detail != "" {
		return c, nil
	}
	c.Detail = "no wishkeeper read reaches " + short(head) + ": a memory path asks clio's, posted as " + clioApp + ": «wishkeeper read <sha>: <n> findings»"
	return c, nil
}
