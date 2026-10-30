package main

import (
	"cmp"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// preflight reads a ticket the way a lane plan should before it spawns anyone: exit lines sixth sense can
// grade, nothing the plan would build twice, and no redesign slipping into an unattended lane (FRM-355)

var (
	numbered   = regexp.MustCompile(`^\s*\d+[.)]\s`)
	postMerge  = regexp.MustCompile(`(?i)\bpost-merge\b`)
	grillWord  = regexp.MustCompile(`(?i)\b(simplif(?:y|ies|ied|ying|ication)|re-?design(?:s|ed|ing)?|re-?work(?:s|ed|ing)?)\b`)
	clioWord   = regexp.MustCompile(`(?i)\bclio\b`)
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
	// the exit lines bind where the seal wrote them: the lane spec's section for this ticket, else the ticket's own
	exitText, from, fix := body, id, "x linear body "+id
	paths, section := laneSpecSection(repo, id)
	if len(paths) > 1 {
		shown := make([]string, len(paths))
		for i, p := range paths {
			shown[i] = home(p)
		}
		return nil, &Fail{Refused: true, Msg: id + " has a section in " + plural(len(paths), "lane spec") + ": " + strings.Join(shown, ", ") + " — one spec binds a ticket",
			Next: "remove the stale section, then x brief preflight " + id}
	}
	if section != "" {
		exitText, from, fix = section, home(paths[0])+" § "+id, "edit "+home(paths[0])
	}
	lines := briefLines(exitText)

	var found []finding
	exits := 0
	if err := r.Step("lint", "the exit lines and the grill words", func() (string, error) {
		// the raw lines, headings included: a heading is the likeliest place for «redesign»; the spec's section too
		sources := []struct{ text, where string }{{body, ""}}
		if exitText != body {
			sources = append(sources, struct{ text, where string }{exitText, " (spec)"})
			sources[0].where = " (ticket)"
		}
		for _, source := range sources {
			for i, text := range strings.Split(source.text, "\n") {
				if grill := grillWord.FindString(quotedText.ReplaceAllString(text, "")); grill != "" {
					found = append(found, finding{i + 1, "grill", grill + source.where, "a simplify / redesign / rework wants a grill before a lane"})
				}
			}
		}
		for _, line := range lines {
			if !line.exit {
				continue
			}
			exits++
			if !numbered.MatchString(line.text) {
				found = append(found, finding{line.n, "lint", "exit line", "has no number for sixth sense to grade it by"})
			}
			if !surface.MatchString(line.group) && !postMerge.MatchString(line.group) {
				found = append(found, finding{line.n, "lint", "exit line", "names no surface (a path, a port or a command in backticks) and no «post-merge»"})
			}
			if twoOwners(line.group) {
				found = append(found, finding{line.n, "lint", "exit line", "has two owners, clio and codie: sixth sense cannot read clio's half, so split it"})
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
		found = append(found, xCommandFindings(exitText, verbs)...)
		return plural(len(found)-before, "finding"), nil
	}); err != nil {
		return nil, err
	}

	if err := r.Step("resolve", "each exit-line command resolves here, none is run", func() (string, error) {
		before := len(found)
		found = append(found, resolveFindings(exitText, repo)...)
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
		msg := []string{plural(len(found), "problem") + " in " + from}
		for _, f := range found {
			if f.Line == 0 {
				msg = append(msg, fmt.Sprintf("%s commit %s — %s", f.Kind, f.What, f.Why))
				continue
			}
			msg = append(msg, fmt.Sprintf("line %d: %s %s — %s", f.Line, f.Kind, f.What, f.Why))
		}
		return nil, &Fail{Refused: true, Msg: strings.Join(msg, "\n"), Next: fix}
	}
	r.Done(fmt.Sprintf("ok: %s from %s, numbered, each with a surface", plural(exits, "exit line"), from), "")
	return ordered{{"ticket", id}, {"exits", exits}, {"from", from}, {"repo", repo}}, nil
}

// the section of a lane spec, `.scratch/<feature>/spec.md`, headed by the ticket's id, blank lines standing in
// for the file above it so a finding's line is the spec's own; paths names every spec holding one
func laneSpecSection(repo, id string) (paths []string, section string) {
	specs, _ := filepath.Glob(filepath.Join(repo, ".scratch", "*", "spec.md"))
	// .scratch/ is gitignored, so a linked worktree's own holds no seal: the main checkout's specs are read beside
	// it, and a stale copy of the same section in both refuses as two specs
	if common, linked, err := worktreeOf(repo); err == nil && linked {
		main, _ := filepath.Glob(filepath.Join(filepath.Dir(common), ".scratch", "*", "spec.md"))
		specs = append(specs, main...)
	}
	head := regexp.MustCompile(`(?m)^## ` + regexp.QuoteMeta(id) + `\b.*$`)
	for _, spec := range specs {
		raw, err := os.ReadFile(spec)
		if err != nil {
			continue
		}
		text := string(raw)
		at := head.FindStringIndex(text)
		if at == nil {
			continue
		}
		paths = append(paths, spec)
		if section != "" {
			continue
		}
		rest := text[at[1]:]
		if next := nextHeading.FindStringIndex(rest); next != nil {
			rest = rest[:next[0]]
		}
		section = strings.Repeat("\n", strings.Count(text[:at[0]], "\n")) + text[at[0]:at[1]] + rest
	}
	return paths, section
}

// xCommandFindings checks every `x …` command the exit lines name against the registry, statically:
// nothing in the ticket runs. a span the ticket marks (new) is exempt, and so is a flag marked (new)
func xCommandFindings(body string, registry []Verb) []finding {
	var found []finding
	seen := map[string]bool{}
	refs, newSpans, newFlags := exitCommands(body)
	for _, ref := range refs {
		if declaredNew(ref.text, newSpans) {
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

// `x brief summon brief.md` is the lane's own once `x brief summon` (new) sits anywhere in the spec
func declaredNew(span string, newSpans map[string]bool) bool {
	for declared := range newSpans {
		if span == declared || strings.HasPrefix(span, declared+" ") {
			return true
		}
	}
	return false
}

// the first words that make a span a command; any other span (`match`, `## signed`, `spec:`) is a value
const argMark = "\x00arg\x00"

var (
	commandHeads = []string{"node", "go", "git", "gh", "rg", "jq"}
	// a lone `docs/nope.md` or `/clear` names a thing; only a script runs
	scriptPath = regexp.MustCompile(`^[\w.~$/{}-]*/[\w.-]+\.(?:sh|zsh|ts|mjs|js|py)$`)
)

// resolveFindings reds an exit-line command that cannot run here: a pnpm script its package lacks, a head off
// the PATH, a file argument or script that does not exist. it resolves and never executes: an unattended
// preflight must not write. `x` spans are the verbs step's
func resolveFindings(body, repo string) []finding {
	var found []finding
	files := repoFiles(repo)
	refs, newSpans, _ := exitCommands(body)
	for _, ref := range refs {
		if declaredNew(ref.text, newSpans) {
			continue
		}
		// a placeholder or a quoted argument becomes one marked word no file check reads; «_» stays a name's own
		for _, segment := range shellSep.Split(argument.ReplaceAllString(ref.text, argMark), -1) {
			words := strings.Fields(segment)
			if len(words) == 0 {
				continue
			}
			head := words[0]
			switch {
			case head == "x":
				continue
			case head == "pnpm":
				if kind, why := pnpmMissing(strings.Join(words, " "), repo); kind != "" {
					found = append(found, finding{ref.line, kind, strings.Join(words[:min(2, len(words))], " "), why})
				}
				continue
			case slices.Contains(commandHeads, head):
				if _, err := exec.LookPath(head); err != nil {
					found = append(found, finding{ref.line, "command", head, "not on the PATH"})
					continue
				}
			case scriptPath.MatchString(head):
				if kind, why := pathMissing(head, repo, files); kind != "" {
					found = append(found, finding{ref.line, kind, head, why})
				}
			default:
				continue
			}
			for _, word := range words[1:] {
				if strings.HasPrefix(word, "-") || strings.Contains(word, argMark) || strings.ContainsAny(word, "*") || strings.Contains(word, "...") ||
					!strings.Contains(word, "/") || !isPathLike(word) {
					continue
				}
				if kind, why := pathMissing(word, repo, files); kind != "" {
					found = append(found, finding{ref.line, kind, word, why})
				}
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

// clio's half beside a surface outside _clio/ (FRM-355's exit 6 always graded «pending»)
func twoOwners(group string) bool {
	// a quoted «clio» is a word, never an owner; a backticked _clio/ path or clio:* skill is clio's half
	clios, others := clioWord.MatchString(quotedText.ReplaceAllString(group, "")), false
	for _, match := range codeSpan.FindAllStringSubmatch(group, -1) {
		if span := strings.TrimSpace(match[1]); span == "clio" || strings.HasPrefix(span, "_clio/") || strings.HasPrefix(span, "clio:") {
			clios = true
		} else {
			others = true
		}
	}
	return clios && others
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
