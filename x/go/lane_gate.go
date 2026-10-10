package main

import (
	"fmt"
	"os"
	"path"
	"regexp"
	"slices"
	"strings"
)

// the commit-msg gate frame and bytes both run: a context's contract changes with its glossary or adr,
// a crew-/guide- skill never only grows, an app's code lands with its FTR.md. each half has a message line
// that passes it on purpose, so the gate refuses a forgotten step, never a decision

var (
	glossaryUnchanged = regexp.MustCompile(`(?m)^glossary: unchanged (—|--?) \S`)
	groomed           = regexp.MustCompile(`(?m)^groom: read whole (—|--?) \S`)
	contextRow        = regexp.MustCompile(`^- \*\*([^*]+)\*\*`)
	tickSpan          = regexp.MustCompile("`([^`]+)`")
	gatedSkill        = regexp.MustCompile(`(^|/)skills/(crew|guide)-[^/]+/`)
)

// skill growth past this many non-blank lines asks for a read of the whole skill
const skillGrowth = 3

type glossaryContext struct {
	name, glossary, adr string
	// nil: no contract line, the context stays quiet; empty: listed as none yet, a touch nudges
	contract []string
}

func (c glossaryContext) dir() string { return path.Dir(c.glossary) }

func laneGate(r *Run, args []string, _ Flags) (any, error) {
	r.passthrough = true
	msg, err := os.ReadFile(args[0])
	if err != nil {
		return nil, usageFail("cannot read the commit message "+args[0], "x lane gate .git/COMMIT_EDITMSG")
	}
	if isMerging() {
		return nil, nil
	}
	root, _ := git("rev-parse", "--show-toplevel")
	if !root.ok {
		return nil, usageFail("not inside a git repo", "git rev-parse --show-toplevel")
	}
	tree := root.out
	staged := gateStaged(tree)
	var refusals, nudges []string
	if !glossaryUnchanged.Match(msg) {
		refusals = append(refusals, contractRefusals(tree, staged)...)
	}
	refusals = append(refusals, goneContracts(tree)...)
	nudges = append(nudges, contractNudges(tree, staged)...)
	if !groomed.Match(msg) {
		refusals = append(refusals, skillRefusals(tree, staged)...)
	}
	if !ftrNone.Match(msg) {
		for _, ftr := range ftrMissing(tree, nil) {
			refusals = append(refusals, fmt.Sprintf("%s's code is staged without %s — stage its ftr line, or add a bare line «ftr: none» to the commit body when no feature changed — no bullet, no indent", path.Dir(ftr), ftr))
		}
	}
	for _, line := range append(nudges, refusals...) {
		fmt.Println("lane gate: " + line)
	}
	if len(refusals) > 0 {
		r.code = 1
	}
	return nil, nil
}

// a rename keeps its old name, so its growth is read against the file it was
type stagedFile struct{ status, name, old string }

func gateStaged(tree string) []stagedFile {
	got, _ := gitIn(tree, "diff", "--cached", "--name-status", "-M")
	var files []stagedFile
	for row := range strings.SplitSeq(got.out, "\n") {
		cols := strings.Split(row, "\t")
		switch {
		case len(cols) == 3:
			files = append(files, stagedFile{cols[0][:1], cols[2], cols[1]})
		case len(cols) == 2:
			files = append(files, stagedFile{cols[0], cols[1], ""})
		}
	}
	return files
}

// glossaryContexts reads GLOSSARY-MAP.md from the index: a context row names its glossary and adr dir,
// the row under it may list its contract
func glossaryContexts(tree string) []glossaryContext {
	got, _ := gitIn(tree, "show", ":GLOSSARY-MAP.md")
	if !got.ok {
		return nil
	}
	var contexts []glossaryContext
	for row := range strings.SplitSeq(got.out, "\n") {
		if m := contextRow.FindStringSubmatch(row); m != nil {
			c := glossaryContext{name: m[1]}
			for _, span := range tickSpan.FindAllStringSubmatch(row, -1) {
				switch {
				case path.Base(span[1]) == "GLOSSARY.md" && c.glossary == "":
					c.glossary = span[1]
				case strings.HasSuffix(span[1], "/") && c.adr == "":
					c.adr = span[1]
				}
			}
			if c.glossary != "" {
				contexts = append(contexts, c)
			}
			continue
		}
		rest, ok := strings.CutPrefix(strings.TrimSpace(row), "- contract:")
		if !ok || len(contexts) == 0 {
			continue
		}
		last := &contexts[len(contexts)-1]
		last.contract = []string{}
		for _, span := range tickSpan.FindAllStringSubmatch(rest, -1) {
			last.contract = append(last.contract, span[1])
		}
	}
	return contexts
}

func underPath(file, listed string) bool {
	return file == listed || strings.HasSuffix(listed, "/") && strings.HasPrefix(file, listed)
}

func contractRefusals(tree string, staged []stagedFile) []string {
	var refusals []string
	for _, c := range glossaryContexts(tree) {
		var touched []string
		carries := false
		for _, f := range staged {
			if f.name == c.glossary || c.adr != "" && strings.HasPrefix(f.name, c.adr) {
				carries = true
			}
			for _, listed := range c.contract {
				if underPath(f.name, listed) && !slices.Contains(touched, f.name) {
					touched = append(touched, f.name)
				}
			}
		}
		if len(touched) == 0 || carries {
			continue
		}
		missing := c.glossary
		if c.adr != "" {
			missing += " or a new adr in " + c.adr
		}
		refusals = append(refusals, fmt.Sprintf("%s's contract changed (%s) without %s — stage the glossary line the change moved, or add «glossary: unchanged — <why>» to the message",
			c.name, strings.Join(touched, ", "), missing))
	}
	return refusals
}

// goneContracts names a listed contract path the index no longer holds: a stale list guards nothing
func goneContracts(tree string) []string {
	got, _ := gitIn(tree, "ls-files")
	indexed := strings.Split(got.out, "\n")
	var refusals []string
	for _, c := range glossaryContexts(tree) {
		for _, listed := range c.contract {
			if !slices.ContainsFunc(indexed, func(file string) bool { return underPath(file, listed) }) {
				refusals = append(refusals, fmt.Sprintf("%s lists `%s` in its contract and it no longer exists — fix the list in GLOSSARY-MAP.md", c.name, listed))
			}
		}
	}
	return refusals
}

// contractNudges names each context listed as none yet that the commit touches; the deepest context owns a file
func contractNudges(tree string, staged []stagedFile) []string {
	contexts := glossaryContexts(tree)
	var nudges []string
	for _, f := range staged {
		owner := -1
		for i, c := range contexts {
			dir := c.dir()
			if (dir == "." || strings.HasPrefix(f.name, dir+"/")) && (owner < 0 || len(dir) > len(contexts[owner].dir())) {
				owner = i
			}
		}
		if owner < 0 || contexts[owner].contract == nil || len(contexts[owner].contract) > 0 {
			continue
		}
		line := fmt.Sprintf("%s has no contract list yet — name the files its glossary defines in GLOSSARY-MAP.md, so the next change to them carries its glossary", contexts[owner].name)
		if !slices.Contains(nudges, line) {
			nudges = append(nudges, line)
		}
	}
	return nudges
}

func skillRefusals(tree string, staged []stagedFile) []string {
	var refusals []string
	for _, f := range staged {
		if !gatedSkill.MatchString(f.name) {
			continue
		}
		if f.status == "A" {
			refusals = append(refusals, fmt.Sprintf("%s is a new file in a crew-/guide- skill — read the skill whole and fold it in, or add «groom: read whole — <what was cut>» to the message", f.name))
			continue
		}
		paths := []string{f.name}
		if f.old != "" {
			paths = append(paths, f.old)
		}
		got, _ := gitIn(tree, append([]string{"diff", "--cached", "-M", "-U0", "--"}, paths...)...)
		added, removed := 0, 0
		for row := range strings.SplitSeq(got.out, "\n") {
			switch {
			case strings.HasPrefix(row, "+++"), strings.HasPrefix(row, "---"):
			case strings.HasPrefix(row, "+") && strings.TrimSpace(row[1:]) != "":
				added++
			case strings.HasPrefix(row, "-") && strings.TrimSpace(row[1:]) != "":
				removed++
			}
		}
		if added-removed >= skillGrowth {
			refusals = append(refusals, fmt.Sprintf("%s grows by %d non-blank lines net — read the skill whole and groom it, then add «groom: read whole — <what was cut>» to the message", f.name, added-removed))
		}
	}
	return refusals
}
