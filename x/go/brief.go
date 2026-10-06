package main

import (
	"cmp"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// brief check reads a spawn brief the way a coder will: every backticked thing it names must exist in
// the repo, and its exit lines must be checkable. prose is never checked. a pass writes a stamp keyed
// by the brief's hash, which a spawn guard can ask for (FRM-311)

type finding struct {
	Line int    `json:"line"`
	Kind string `json:"kind"`
	What string `json:"what"`
	Why  string `json:"why"`
}

type briefLine struct {
	n    int
	text string
	exit bool
	// an exit line with its indented given/when/then children, checked as one
	group string
}

var (
	codeSpan   = regexp.MustCompile("`([^`\n]+)`")
	ticketID   = regexp.MustCompile(`\b(?:FRM|BYT|DOT)-\d+\b`)
	heading    = regexp.MustCompile(`^\s*(#{1,6}\s|\*\*[^*]+\*\*\s*:?\s*$)`)
	listItem   = regexp.MustCompile(`^\s*(?:[-*+]|\d+[.)])\s+`)
	rate       = regexp.MustCompile(`\d+(?:\.\d+)?\s?%`)
	sampleSize = regexp.MustCompile(`(?i)\bn\s*(?:=|≥|>=|>)\s*\d|\bminimum n\b|\bn of\b|\bof\s+\d+\b|\bout of\b|\d+\s*/\s*\d+|\b\d+\s+(?:runs?|calls?|samples?|sessions?|prs?|tickets?|briefs?)\b`)
	surface    = regexp.MustCompile("`[^`]+`|https?://|localhost:\\d+|:\\d{2,5}\\b")
	relayed    = regexp.MustCompile(`(?i)\bdima\b[^.\n]{0,24}\b(?:approved|approves|said yes|agreed|signed off|ok'?d)\b`)
	stampTime  = regexp.MustCompile(`\b\d{1,2}:\d{2}\b|\d{4}-\d{2}-\d{2}`)
	newMark    = regexp.MustCompile(`^\s*\((?:new|to build)\)`)
	fileLike   = regexp.MustCompile(`^[\w.@~-]+\.(?:md|mdx|ts|tsx|js|mjs|go|json|jsonc|sh|zsh|yml|yaml|toml|swift|css|html|txt|plist|py|svg|png)$`)
	lineRef    = regexp.MustCompile(`(:\d+(?:-\d+)?|#[\w-]+)$`)
	jevWord    = regexp.MustCompile(`(?i)\bjev\b`)
	pnpmScript = regexp.MustCompile(`^pnpm\s+(?:(?:-C|--dir|--filter)\s+(\S+)\s+)?(?:(?:-s|--silent)\s+)?(?:run\s+)?([\w:.-]+)`)
)

// pnpm's own commands are not scripts
var pnpmBuiltins = []string{"install", "i", "add", "remove", "update", "exec", "dlx", "create", "link", "outdated", "why", "list", "ls", "store", "env", "view", "info"}

func briefCheck(r *Run, args []string, flags Flags) (any, error) {
	path := args[0]
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, usageFail("no brief at "+path, "x brief check <brief.md> --repo <path>")
	}
	repo, err := repoRoot(flags)
	if err != nil {
		return nil, err
	}
	abs, _ := filepath.Abs(path)
	sum := fmt.Sprintf("%x", sha256.Sum256(raw))
	r.Open(home(repo))

	var lines []briefLine
	tokens := map[string]int{}
	var order []string
	ids := map[string]int{}
	if err := r.Step("read", "the backticked names and ticket ids", func() (string, error) {
		lines = briefLines(string(raw))
		for _, line := range lines {
			for _, at := range codeSpan.FindAllStringSubmatchIndex(line.text, -1) {
				token := strings.TrimSpace(line.text[at[2]:at[3]])
				if token == "" || newMark.MatchString(line.text[at[1]:]) {
					continue
				}
				if _, seen := tokens[token]; !seen {
					tokens[token] = line.n
					order = append(order, token)
				}
			}
			for _, id := range ticketID.FindAllString(line.text, -1) {
				if _, seen := ids[id]; !seen {
					ids[id] = line.n
				}
			}
		}
		return fmt.Sprintf("%s, %s", plural(len(order), "name"), plural(len(ids), "ticket id")), nil
	}); err != nil {
		return nil, err
	}

	var found []finding
	unchecked := []string{}
	if err := r.Step("exist", "each name in "+home(repo), func() (string, error) {
		files := repoFiles(repo)
		for _, token := range order {
			if kind, why := missing(token, repo, files); kind != "" {
				found = append(found, finding{tokens[token], kind, token, why})
			}
		}
		absent, err := missingTickets(ids)
		if err != nil {
			unchecked = append(unchecked, "ticket ids: "+err.Error())
		}
		for _, id := range absent {
			found = append(found, finding{ids[id], "ticket", id, "no such ticket in linear"})
		}
		detail := fmt.Sprintf("%d of %d found", len(order)+len(ids)-len(found), len(order)+len(ids))
		if len(unchecked) > 0 {
			detail += ", ids unchecked"
		}
		return detail, nil
	}); err != nil {
		return nil, err
	}

	lintFound := lint(lines)
	if err := r.Step("lint", "the exit lines and the rates", func() (string, error) {
		return plural(len(lintFound), "finding"), nil
	}); err != nil {
		return nil, err
	}
	found = append(found, lintFound...)
	slices.SortStableFunc(found, func(a, b finding) int { return a.Line - b.Line })

	if len(found) > 0 {
		r.skip("stamp")
		r.Show(findingRows(found, r.board.inner()-nameCell-2), nameCell+2)
		msg := []string{plural(len(found), "problem") + " in the brief"}
		for _, f := range found {
			msg = append(msg, fmt.Sprintf("line %d: %s %s — %s", f.Line, f.Kind, f.What, f.Why))
		}
		msg = append(msg, "a thing the brief asks to build passes with (new) right after it")
		return nil, &Fail{Msg: strings.Join(msg, "\n"), Next: strings.TrimSpace("x brief check " + quote(path) + " " + repoFlag(flags))}
	}

	stamp := filepath.Join(stateDir(), "briefs", sum+".json")
	if err := r.Step("stamp", "the pass, keyed by the brief's hash", func() (string, error) {
		if err := os.MkdirAll(filepath.Dir(stamp), 0o700); err != nil {
			return "", err
		}
		body, _ := json.Marshal(ordered{{"at", time.Now().UTC().Format(time.RFC3339)}, {"brief", abs}, {"repo", repo}, {"sha256", sum}})
		return home(stamp), os.WriteFile(stamp, body, 0o600)
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("clean: %s checked", plural(len(order)+len(ids), "name")), "")
	return ordered{{"brief", abs}, {"checked", len(order) + len(ids)}, {"repo", repo}, {"sha256", sum}, {"stamp", stamp}, {"unchecked", unchecked}}, nil
}

// the --repo the caller typed, so the next command reads like theirs
func repoFlag(flags Flags) string {
	if repo, _ := flags["repo"].(string); repo != "" {
		return "--repo " + quote(repo)
	}
	return ""
}

func repoRoot(flags Flags) (string, error) {
	repo, _ := flags["repo"].(string)
	if repo == "" {
		top, err := mustGit("rev-parse", "rev-parse", "--show-toplevel")
		if err != nil {
			return "", usageFail("not in a repo — name one with --repo <path>", "x brief check <brief.md> --repo <path>")
		}
		return top, nil
	}
	abs, err := filepath.Abs(expandHome(repo))
	if err != nil || !exists(abs) {
		return "", usageFail("no repo at "+repo, "x brief check <brief.md> --repo <path>")
	}
	return abs, nil
}

// fenced blocks are code, not names; a list item under a heading that says exit is an exit line
func briefLines(text string) []briefLine {
	var lines []briefLine
	fenced, inExit, exitAt := false, false, -1
	for i, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			fenced = !fenced
			continue
		}
		if fenced {
			continue
		}
		if heading.MatchString(line) {
			inExit = strings.Contains(strings.ToLower(line), "exit")
			continue
		}
		indented := strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")
		if inExit && indented && exitAt >= 0 {
			lines[exitAt].group += "\n" + line
			lines = append(lines, briefLine{n: i + 1, text: line})
			continue
		}
		isExit := inExit && !indented && listItem.MatchString(line)
		if isExit {
			exitAt = len(lines)
		}
		lines = append(lines, briefLine{i + 1, line, isExit, line})
	}
	return lines
}

func expandHome(path string) string {
	if rest, ok := strings.CutPrefix(path, "~/"); ok {
		userHome, _ := os.UserHomeDir()
		return filepath.Join(userHome, rest)
	}
	return path
}

// every tracked and untracked file of the repo once, so a bare file name can match at any depth
func repoFiles(repo string) []string {
	out, err := runCmd(cmdIn(repo, "rg", "--files", "--hidden", "-g", "!.git", "-g", "!node_modules"))
	if err != nil && out.out == "" {
		return nil
	}
	return strings.Split(out.out, "\n")
}

func cmdIn(dir, name string, args ...string) *exec.Cmd {
	c := exec.Command(name, args...)
	c.Dir = dir
	return c
}

// missing names the kind of thing a token is and why it was not found; "" when it exists
func missing(token, repo string, files []string) (kind, why string) {
	switch {
	case strings.Contains(token, "<") || strings.HasPrefix(token, "http://") || strings.HasPrefix(token, "https://"):
		return "", ""
	case strings.HasPrefix(token, "x "):
		words := wordsOf(strings.Fields(token)[1:])
		if _, _, ok := findVerb(words); ok || len(words) == 0 || (len(words) == 1 && slices.Contains(families(), words[0])) {
			return "", ""
		}
		return "verb", "no such x verb (x --help lists them)"
	case strings.HasPrefix(token, "pnpm "):
		return pnpmMissing(token, repo)
	case isPathLike(token):
		return pathMissing(token, repo, files)
	}
	first := strings.Fields(token)[0]
	if strings.Contains(token, " ") && !strings.HasPrefix(first, "-") {
		if _, err := exec.LookPath(first); err == nil {
			return "", ""
		}
	}
	if found, _ := runCmd(cmdIn(repo, "rg", "-F", "-q", "--hidden", "-g", "!.git", "-g", "!node_modules", "--", token)); found.ok {
		return "", ""
	}
	return "term", "appears nowhere in the repo"
}

func isPathLike(token string) bool {
	return !strings.Contains(token, " ") && (strings.Contains(token, "/") || fileLike.MatchString(token))
}

func pathMissing(token, repo string, files []string) (string, string) {
	path := strings.TrimSuffix(lineRef.ReplaceAllString(token, ""), "/")
	path = expandHome(path)
	if filepath.IsAbs(path) {
		if matches, _ := filepath.Glob(path); len(matches) > 0 || exists(path) {
			return "", ""
		}
		return "path", "no such path"
	}
	if matches, _ := filepath.Glob(filepath.Join(repo, path)); len(matches) > 0 || exists(filepath.Join(repo, path)) {
		return "", ""
	}
	// a path from a sub-app's root, or a bare file name, matches a file ending in it anywhere
	for _, file := range files {
		if file == path || strings.HasSuffix(file, "/"+path) || strings.HasPrefix(file, path+"/") || strings.Contains(file, "/"+path+"/") {
			return "", ""
		}
	}
	return "path", "no such path in the repo"
}

func pnpmMissing(token, repo string) (string, string) {
	match := pnpmScript.FindStringSubmatch(token)
	if match == nil || slices.Contains(pnpmBuiltins, match[2]) {
		return "", ""
	}
	// pnpm runs a package's bin by name as well as a script
	if exists(filepath.Join(repo, match[1], "node_modules/.bin", match[2])) {
		return "", ""
	}
	manifest := filepath.Join(repo, match[1], "package.json")
	raw, err := os.ReadFile(manifest)
	if err != nil {
		return "script", "no package.json at " + home(filepath.Dir(manifest))
	}
	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	_ = json.Unmarshal(raw, &pkg)
	if _, ok := pkg.Scripts[match[2]]; ok {
		return "", ""
	}
	return "script", "no script " + match[2] + " in " + home(manifest)
}

// one linear query for every id: the ones it cannot find come back as errors naming their alias
func missingTickets(ids map[string]int) ([]string, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	names := make([]string, 0, len(ids))
	for id := range ids {
		names = append(names, id)
	}
	slices.Sort(names)
	var query strings.Builder
	query.WriteString("query {")
	for i, id := range names {
		fmt.Fprintf(&query, " t%d: issue(id: %q) { identifier }", i, id)
	}
	query.WriteString(" }")
	out, err := runCmd(exec.Command("linear", "api", query.String()))
	var answer struct {
		Errors []struct {
			Message string `json:"message"`
			Path    []any  `json:"path"`
		} `json:"errors"`
	}
	if jsonErr := json.Unmarshal([]byte(out.out), &answer); jsonErr != nil {
		return nil, fmt.Errorf("linear api did not answer (%v)", cmp.Or(err, jsonErr))
	}
	var absent []string
	for _, e := range answer.Errors {
		if !strings.Contains(e.Message, "not found") || len(e.Path) == 0 {
			return nil, fmt.Errorf("linear api: %s", e.Message)
		}
		var i int
		if _, err := fmt.Sscanf(fmt.Sprint(e.Path[0]), "t%d", &i); err == nil && i < len(names) {
			absent = append(absent, names[i])
		}
	}
	return absent, nil
}

// each rule came from a brief that misled a coder (FRM-311); a new miss adds a rule here
func lint(lines []briefLine) []finding {
	var found []finding
	jevAt, hasBudget := 0, false
	for _, line := range lines {
		text := line.text
		if rate.MatchString(text) && !sampleSize.MatchString(text) {
			found = append(found, finding{line.n, "lint", strings.TrimSpace(rate.FindString(text)), "a rate names its minimum n"})
		}
		if line.exit && !surface.MatchString(line.group) {
			found = append(found, finding{line.n, "lint", "exit line", "names no surface: a file, a port or a command in backticks"})
		}
		if line.exit && strings.Contains(line.group, "cclio/") {
			found = append(found, finding{line.n, "lint", "cclio/", "a coder's exit line never points into cclio/"})
		}
		if relayed.MatchString(text) && !stampTime.MatchString(text) {
			found = append(found, finding{line.n, "lint", "dima's approval", "a relayed approval is quoted with its time"})
		}
		if jevAt == 0 && jevWord.MatchString(text) {
			jevAt = line.n
		}
		hasBudget = hasBudget || strings.Contains(strings.ToLower(text), "budget")
	}
	if jevAt > 0 && !hasBudget {
		found = append(found, finding{jevAt, "lint", "jev", "a brief that touches jev names its budget"})
	}
	return found
}

func findingRows(found []finding, width int) []string {
	var rows []string
	for _, f := range found {
		head := ui.er.Render("✗") + " " + ui.dim.Render(fmt.Sprintf("%-5d", f.Line)) + ui.bold.Render(clip(f.What, 36))
		rows = append(rows, clip(head+"  "+ui.fg.Render(f.Why), width))
	}
	return rows
}
