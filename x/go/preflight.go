package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"math"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// preflight reads a ticket the way a lane plan should before it spawns anyone: exit lines a verifier can
// grade, nothing the plan would build twice, and no redesign slipping into an unattended lane (FRM-355)

var (
	numbered   = regexp.MustCompile(`^\s*\d+[.)]\s`)
	postMerge  = regexp.MustCompile(`(?i)\bpost-merge\b`)
	grillWord  = regexp.MustCompile(`(?i)\b(simplif(?:y|ies|ied|ying|ication)|re-?design(?:s|ed|ing)?|re-?work(?:s|ed|ing)?)\b`)
	cclioWord  = regexp.MustCompile(`(?i)\bcclio\b`)
	quotedText = regexp.MustCompile("`[^`\n]*`|«[^»\n]*»|\"[^\"\n]*\"")
)

func briefPreflight(r *Run, args []string, flags Flags) (any, error) {
	id := args[0]
	if !ticketShape.MatchString(id) {
		return nil, usageFail(id+" is not a ticket id", "x brief preflight <FRM-N|BYT-N>")
	}
	repo, err := repoRoot(flags, "x brief preflight "+id+" --repo <path>")
	if err != nil {
		return nil, err
	}
	r.Open(id)

	var body string
	if err := r.Step("read", "the ticket body", func() (string, error) {
		actor, err := actorOf(Flags{})
		if err != nil {
			return "", err
		}
		issue, err := fetchBody(actor, id)
		if issue.Description != nil {
			body = *issue.Description
		}
		return plural(strings.Count(body, "\n")+1, "line"), err
	}); err != nil {
		return nil, err
	}
	lines := briefLines(body)

	var found []finding
	exits := 0
	if err := r.Step("lint", "the exit lines and the grill words", func() (string, error) {
		// the raw lines, headings included: a heading is the likeliest place for «redesign»
		for i, text := range strings.Split(body, "\n") {
			if grill := grillWord.FindString(quotedText.ReplaceAllString(text, "")); grill != "" {
				found = append(found, finding{i + 1, "grill", grill, "a simplify / redesign / rework wants a grill before a lane"})
			}
		}
		for _, line := range lines {
			if !line.exit {
				continue
			}
			exits++
			if !numbered.MatchString(line.text) {
				found = append(found, finding{line.n, "lint", "exit line", "has no number for a verifier to grade it by"})
			}
			if !surface.MatchString(line.group) && !postMerge.MatchString(line.group) {
				found = append(found, finding{line.n, "lint", "exit line", "names no surface (a path, a port or a command in backticks) and no «post-merge»"})
			}
			if twoOwners(line.group) {
				found = append(found, finding{line.n, "lint", "exit line", "has two owners, cclio and a coder: the verifier cannot read cclio's half, so split it"})
			}
		}
		if exits == 0 {
			found = append(found, finding{1, "lint", "## exit", "the ticket has no exit lines"})
		}
		return plural(exits, "exit line"), nil
	}); err != nil {
		return nil, err
	}

	var shipped []string
	if err := r.Step("main", "what origin/main already holds", func() (string, error) {
		_, _ = gitIn(repo, "fetch", "-q", "origin", "main")
		before := len(found)
		verbsOnMain := mainVerbs(repo)
		shipped = ticketCommits(repo, id)
		for _, line := range lines {
			if !line.exit {
				continue
			}
			for _, match := range codeSpan.FindAllStringSubmatch(line.group, -1) {
				token := strings.TrimSpace(match[1])
				if verb := verbOf(token, verbsOnMain); verb != "" {
					found = append(found, finding{line.n, "main", "x " + verb, "is already a verb on main — does this line already hold?"})
				} else if isPathLike(token) && len(shipped) > 0 {
					if commit := touchedBy(repo, id, token); commit != "" {
						found = append(found, finding{line.n, "main", token, "already changed on main for " + id + " in " + commit})
					}
				}
			}
		}
		for _, commit := range shipped {
			found = append(found, finding{0, "main", commit, "main already carries a commit for " + id})
		}
		return fmt.Sprintf("%s, %s on main", plural(len(found)-before, "finding"), plural(len(shipped), "commit")), nil
	}); err != nil {
		return nil, err
	}

	// a ticket's commit has no line, so it sorts after every line
	slices.SortStableFunc(found, func(a, b finding) int { return cmp.Compare(lineOrLast(a), lineOrLast(b)) })
	if len(found) > 0 {
		r.Show(findingRows(found, r.board.inner()-nameCell-2), nameCell+2)
		msg := []string{plural(len(found), "problem") + " in " + id}
		for _, f := range found {
			if f.Line == 0 {
				msg = append(msg, fmt.Sprintf("%s commit %s — %s", f.Kind, f.What, f.Why))
				continue
			}
			msg = append(msg, fmt.Sprintf("line %d: %s %s — %s", f.Line, f.Kind, f.What, f.Why))
		}
		return nil, &Fail{Refused: true, Msg: strings.Join(msg, "\n"), Next: "x linear body " + id}
	}
	r.Done(fmt.Sprintf("ok: %s, numbered, each with a surface", plural(exits, "exit line")), "")
	return ordered{{"ticket", id}, {"exits", exits}, {"repo", repo}}, nil
}

// the verb names on origin/main, read from git: the running x may be a worktree's, which already
// holds the verbs a ticket asks for. the ticket's repo holds x when it is frame; any other repo reads frame's
func mainVerbs(repo string) []string {
	got, _ := gitIn(repo, "show", "origin/main:x/go/registry.json")
	if !got.ok {
		got, _ = gitIn(filepath.Dir(filepath.Dir(sourceDir())), "show", "origin/main:x/go/registry.json")
	}
	var registry struct {
		Verbs []struct {
			Name string `json:"name"`
		} `json:"verbs"`
	}
	if !got.ok || json.Unmarshal([]byte(got.out), &registry) != nil {
		return nil
	}
	names := make([]string, 0, len(registry.Verbs))
	for _, verb := range registry.Verbs {
		names = append(names, verb.Name)
	}
	return names
}

// verbOf answers the verb an `x …` token calls, two words before one: `x lane review <pr>` → lane review
func verbOf(token string, verbs []string) string {
	words := strings.Fields(token)
	if len(words) < 2 || words[0] != "x" {
		return ""
	}
	for n := min(2, len(words)-1); n >= 1; n-- {
		if name := strings.Join(words[1:1+n], " "); slices.Contains(verbs, name) {
			return name
		}
	}
	return ""
}

// cclio's half beside a surface outside cclio/ (FRM-355's exit 6 always graded «pending»)
func twoOwners(group string) bool {
	if !cclioWord.MatchString(group) {
		return false
	}
	for _, match := range codeSpan.FindAllStringSubmatch(group, -1) {
		if !strings.HasPrefix(strings.TrimSpace(match[1]), "cclio") {
			return true
		}
	}
	return false
}

func lineOrLast(f finding) int {
	if f.Line == 0 {
		return math.MaxInt
	}
	return f.Line
}

func ticketLine(id string) string { return `ticket: ` + id + `([^0-9]|$)` }

func ticketCommits(repo, id string) []string {
	got, _ := gitIn(repo, "log", "origin/main", "-E", "--grep="+ticketLine(id), "--format=%h %s")
	if !got.ok || got.out == "" {
		return nil
	}
	return strings.Split(got.out, "\n")
}

func touchedBy(repo, id, path string) string {
	path = strings.TrimSuffix(lineRef.ReplaceAllString(path, ""), "/")
	got, _ := gitIn(repo, "log", "origin/main", "-1", "-E", "--grep="+ticketLine(id), "--format=%h %s", "--", ":(glob)**/"+path)
	if !got.ok {
		return ""
	}
	return got.out
}
