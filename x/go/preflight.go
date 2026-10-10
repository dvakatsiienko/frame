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
	// a <placeholder> or quoted string is one ignored argument, spaces and separators inside included
	argument = regexp.MustCompile(`<[^<>\n]*>|"[^"\n]*"|'[^'\n]*'`)
	shellSep = regexp.MustCompile(`\|\||&&|[|;&]`)
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

	if err := r.Step("verbs", "each x verb and flag the exit lines name", func() (string, error) {
		before := len(found)
		found = append(found, xCommandFindings(body, verbs)...)
		return plural(len(found)-before, "finding"), nil
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
			for _, at := range codeSpan.FindAllStringSubmatchIndex(line.group, -1) {
				token := strings.TrimSpace(line.group[at[2]:at[3]])
				if verb := verbOf(token, verbsOnMain); verb != "" {
					if !claimsToAdd(line.group, at[0], at[1]) {
						continue
					}
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

// xCommandFindings checks every `x …` command the exit lines name against the registry, statically:
// nothing in the ticket runs. a span the ticket marks (new) is exempt, and so is a flag marked (new)
func xCommandFindings(body string, registry []Verb) []finding {
	var found []finding
	seen := map[string]bool{}
	refs, newSpans, newFlags := exitCommands(body)
	for _, ref := range refs {
		if newSpans[ref.text] {
			continue
		}
		for _, f := range xSegmentFindings(ref, registry, newFlags) {
			if key := fmt.Sprint(f.Line, f.Kind, f.What); !seen[key] {
				seen[key] = true
				found = append(found, f)
			}
		}
	}
	return found
}

type commandRef struct {
	line int
	text string
}

// the commands of the exit sections: backticked spans and fenced lines. a span followed by (new) is
// declared by the ticket anywhere in its body, not only under exit
func exitCommands(body string) (refs []commandRef, newSpans, newFlags map[string]bool) {
	newSpans, newFlags = map[string]bool{}, map[string]bool{}
	fenced, inExit := false, false
	for i, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			fenced = !fenced
			continue
		}
		if fenced {
			if inExit {
				refs = append(refs, commandRef{i + 1, strings.TrimPrefix(strings.TrimSpace(line), "$ ")})
			}
			continue
		}
		if heading.MatchString(line) {
			inExit = strings.Contains(strings.ToLower(line), "exit")
			continue
		}
		for _, at := range codeSpan.FindAllStringSubmatchIndex(line, -1) {
			span := strings.TrimSpace(line[at[2]:at[3]])
			switch {
			case newMark.MatchString(line[at[1]:]) && strings.HasPrefix(span, "x "):
				newSpans[span] = true
			case newMark.MatchString(line[at[1]:]):
				for word := range strings.FieldsSeq(span) {
					if name := flagName(word); name != "" {
						newFlags[name] = true
					}
				}
			case inExit:
				refs = append(refs, commandRef{i + 1, span})
			}
		}
	}
	return refs, newSpans, newFlags
}

// `--dry=yes` → dry; "" for a word that is no flag, a bare - or the -- that ends the flags
func flagName(word string) string {
	if !strings.HasPrefix(word, "-") {
		return ""
	}
	name, _, _ := strings.Cut(strings.TrimLeft(word, "-"), "=")
	return name
}

func xSegmentFindings(ref commandRef, registry []Verb, newFlags map[string]bool) []finding {
	var found []finding
	for _, segment := range shellSep.Split(argument.ReplaceAllString(ref.text, "_"), -1) {
		words := strings.Fields(segment)
		if len(words) == 0 || words[0] != "x" {
			continue
		}
		found = append(found, xWalk(ref.line, words[1:], registry, newFlags)...)
	}
	return found
}

// the walk consumes registry tokens: after a family the next word must be one of its verbs
func xWalk(line int, words []string, registry []Verb, newFlags map[string]bool) []finding {
	hasPrefix := func(name string) bool {
		return slices.ContainsFunc(registry, func(v Verb) bool { return v.Name == name || strings.HasPrefix(v.Name, name+" ") })
	}
	isVerb := func(name string) bool {
		return slices.ContainsFunc(registry, func(v Verb) bool { return v.Name == name })
	}
	current := ""
	for _, word := range words {
		if strings.HasPrefix(word, "-") {
			continue
		}
		next := strings.TrimSpace(current + " " + word)
		if hasPrefix(next) {
			current = next
			continue
		}
		if isVerb(current) || word == "_" {
			break
		}
		if first, _, _ := strings.Cut(current, " "); familyOf(first).RawDoor != "" {
			return nil
		}
		return []finding{{line, "verb", strings.TrimSpace("x " + next), "no such x verb (x --help lists them)"}}
	}
	verb, _, ok := findVerb(strings.Fields(current))
	if !ok || verb.Name != current {
		return nil
	}
	var found []finding
	for _, word := range words {
		if word == "--" {
			break
		}
		name := flagName(word)
		if name == "" || name == "h" || slices.Contains(globalFlagNames, name) || newFlags[name] {
			continue
		}
		if _, own := verb.Flags[name]; !own {
			found = append(found, finding{line, "flag", strings.SplitN(word, "=", 2)[0], "x " + verb.Name + " has no such flag (x schema " + verb.Name + " lists them)"})
		}
	}
	return found
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

// a verb already on main is a finding only where the line claims to add it; a verb named as a tool is not
var addClaim = regexp.MustCompile(`(?i)\b(?:adds?|new verb|introduc(?:e|es|ed))\b`)

// the claim word sits within 40 bytes of the span, on either side
func claimsToAdd(group string, from, to int) bool {
	before := group[max(0, from-40):from]
	after := group[to:min(len(group), to+40)]
	return addClaim.MatchString(before) || addClaim.MatchString(after)
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
	// a quoted «cclio» is a word, never an owner; a backticked cclio/ path is cclio's half
	cclios, others := cclioWord.MatchString(quotedText.ReplaceAllString(group, "")), false
	for _, match := range codeSpan.FindAllStringSubmatch(group, -1) {
		if strings.HasPrefix(strings.TrimSpace(match[1]), "cclio") {
			cclios = true
		} else {
			others = true
		}
	}
	return cclios && others
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
