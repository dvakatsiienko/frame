package main

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
)

const warnOnlyFile = "home/.claude/plugin-x/mods/x-mod-guard/hooks/register.ts"

var (
	warnOnlySet  = regexp.MustCompile(`(?s)const WARN_ONLY\b[^=]*= new Set\(\[(.*?)\]\)`)
	warnOnlyRule = regexp.MustCompile(`'([^']+)'`)
)

// the guard's warn-only rules at a ref, nil with no such file; a rule leaves the set at its sixth sense's clean
func warnOnlyAt(repo, ref string) ([]string, error) {
	listed, _ := gitIn(repo, "ls-tree", ref, "--", warnOnlyFile)
	if !listed.ok {
		return nil, fmt.Errorf("%s does not read here", short(ref))
	}
	if listed.out == "" {
		return nil, nil
	}
	shown, err := mustGitIn(repo, "show", "show", ref+":"+warnOnlyFile)
	if err != nil {
		return nil, err
	}
	var rules []string
	if set := warnOnlySet.FindStringSubmatch(shown); set != nil {
		for _, m := range warnOnlyRule.FindAllStringSubmatch(set[1], -1) {
			rules = append(rules, m[1])
		}
	}
	return rules, nil
}

// a rule the pr added to the set and the land still lists; nil when the pr added none, so the older rules print nothing
func warnOnlyLine(repo, head string, merged bool) *landedLine {
	if got, _ := gitIn(repo, "ls-tree", "origin/main", "--", warnOnlyFile); got.ok && got.out == "" {
		return nil
	}
	line := &landedLine{name: "warn-only", fix: "take the rule out of WARN_ONLY in " + warnOnlyFile + ", its clean said"}
	land := head
	if merged {
		land = "origin/main"
	}
	// a squash leaves the pr's shas on no branch; a failed fetch shows at the read below
	_, _ = gitIn(repo, "fetch", "-q", "origin", head)
	_, _ = gitIn(repo, "fetch", "-q", "origin", "main")
	// the fork point, never github's base sha, which can sit behind a branch that took main in: another lane's rule would read as this pr's
	var before, after, now []string
	base, err := mustGitIn(repo, "merge-base", "merge-base", head, "origin/main")
	if err == nil {
		before, err = warnOnlyAt(repo, base)
	}
	if err == nil {
		after, err = warnOnlyAt(repo, head)
	}
	if err == nil {
		now, err = warnOnlyAt(repo, land)
	}
	if err != nil {
		line.detail = "the warn-only set did not read: " + err.Error()
		return line
	}
	return warnOnlyVerdict(line, warnOnlyAdded(nil, before, after), now)
}

func warnOnlyAdded(added, before, after []string) []string {
	for _, rule := range after {
		if !slices.Contains(before, rule) && !slices.Contains(added, rule) {
			added = append(added, rule)
		}
	}
	return added
}

func warnOnlyVerdict(line *landedLine, added, now []string) *landedLine {
	var left []string
	for _, rule := range added {
		if slices.Contains(now, rule) {
			left = append(left, rule)
		}
	}
	switch {
	case len(added) == 0:
		return nil
	case len(left) > 0:
		line.detail = strings.Join(left, ", ") + " still warn-only at the land"
	default:
		line.ok, line.detail = true, strings.Join(added, ", ")+" enforcing"
	}
	return line
}

// a lane with no pr: the rules its own commits added, each read against its parent, since main interleaves other lanes
func quickWarnOnlyLine(repo string, commits []string) *landedLine {
	if got, _ := gitIn(repo, "ls-tree", "origin/main", "--", warnOnlyFile); got.ok && got.out == "" {
		return nil
	}
	line := &landedLine{name: "warn-only", fix: "take the rule out of WARN_ONLY in " + warnOnlyFile + ", its clean said"}
	var added []string
	for _, commit := range commits {
		sha, _, _ := strings.Cut(commit, " ")
		after, err := warnOnlyAt(repo, sha)
		if err == nil && len(after) > 0 {
			var before []string
			if before, err = warnOnlyAt(repo, sha+"^"); err == nil {
				added = warnOnlyAdded(added, before, after)
			}
		}
		if err != nil {
			line.detail = "the warn-only set did not read: " + err.Error()
			return line
		}
	}
	now, err := warnOnlyAt(repo, "origin/main")
	if err != nil {
		line.detail = "the warn-only set did not read: " + err.Error()
		return line
	}
	return warnOnlyVerdict(line, added, now)
}
