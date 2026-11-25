package main

import (
	"cmp"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func renovateAuthor(login string) bool {
	return login == "x-renovate[bot]" || login == "renovate[bot]"
}

// a renovate pr needs no clean while every commit is renovate's own, signed by github: a member's push onto its branch
// makes it a member's pr; an unread list, or one cut short of the head (github
// stops at 250, a push can land between reads), counts as that push; a changed workflow file asks the clean too
func (d *mergeDecision) sixthSenseOf(api, repo, n string, pr pullHead, paths []string) mergeCheck {
	c := d.wordOpens(pr, sixthSenseCheck(repo, n, pr.Head.Sha, pr.Base.Ref, pr.Head.Ref))
	if c.OK || !renovateAuthor(pr.User.Login) {
		return c
	}
	type login struct {
		Login string `json:"login"`
	}
	commits, err := ghPages[struct {
		Sha       string `json:"sha"`
		Author    login  `json:"author"`
		Committer login  `json:"committer"`
		Commit    struct {
			Verification struct {
				Verified bool `json:"verified"`
			} `json:"verification"`
		} `json:"commit"`
	}](asDima, api+"/pulls/"+n+"/commits", "")
	if err != nil {
		c.Detail += "; its commits did not read: " + err.Error()
		return c
	}
	for _, commit := range commits {
		if !renovateAuthor(commit.Author.Login) || commit.Committer.Login != "web-flow" || !commit.Commit.Verification.Verified {
			c.Detail += "; a commit on it is not renovate's own"
			return c
		}
	}
	if len(commits) == 0 || commits[len(commits)-1].Sha != pr.Head.Sha {
		c.Detail += "; its commit list does not end at the head"
		return c
	}
	for _, path := range paths {
		// a bumped action runs with the repo's secrets, and ci running it proves nothing about what it took
		if strings.HasPrefix(path, ".github/workflows/") {
			c.Detail += "; it changes a workflow file, so a clean reads it: " + path
			return c
		}
	}
	c.OK, c.Detail, c.renovateExempt = true, "renovate's own commits, ci is their review", true
	return c
}

// a «clean» in a pr comment or body is never read: only sixth sense and a stamp through watch-pr.sh write this store; a
// sibling `<repo>#<n>:by` key names a verifier other than sixth sense, and the gate treats both alike, only the detail differs
// the store sixth sense and the coordinator's stamp write, through watch-pr.sh --verified only
func verifiedStore() (store map[string]string, path string, missing bool) {
	home, _ := os.UserHomeDir()
	path = filepath.Join(home, ".claude/shelf/pr-verified.json")
	if mergeTestEnvOn() {
		path = cmp.Or(os.Getenv("X_VERIFIED"), path)
	}
	raw, err := os.ReadFile(path)
	if err != nil || json.Unmarshal(raw, &store) != nil {
		return nil, path, errors.Is(err, fs.ErrNotExist)
	}
	return store, path, false
}

func sixthSenseCheck(repo, n, head, base, ref string) mergeCheck {
	c := mergeCheck{Name: "sixth-sense"}
	store, path, missing := verifiedStore()
	if store == nil {
		c.Detail = "no sixth sense store at " + path
		c.noClean = missing
		return c
	}
	verified := store[repo+"#"+n]
	by := "sixth sense"
	if who := store[repo+"#"+n+":by"]; who != "" {
		by = who + "'s read"
	}
	switch {
	case verified == "":
		c.Detail = "no clean recorded for " + repo + "#" + n
		c.noClean = true
	case verified == head:
		c.OK, c.Detail = true, "clean on "+short(head)+" by "+by
	default:
		c.OK, c.Detail = carried(verified, by, head, base, ref)
	}
	return c
}
