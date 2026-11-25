package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

//go:embed risky.json
var riskyJSON []byte

// light is an allow-list: research and test-drive markdown, and media under assets and brand, so a code file of any
// extension there reads normal
var riskyList = func() (list struct{ Risky, Self, Light, Memory []*regexp.Regexp }) {
	var raw struct{ Risky, Self, Light, Memory []string }
	if err := json.Unmarshal(riskyJSON, &raw); err != nil {
		panic("risky.json: " + err.Error())
	}
	compile := func(globs []string, fold bool) (out []*regexp.Regexp) {
		for _, g := range globs {
			re := globRegexp(g)
			if fold {
				re = regexp.MustCompile("(?i)" + re.String())
			}
			out = append(out, re)
		}
		return out
	}
	// the mac's filesystem folds case, so a `claude.md` loads as memory: the gated lists fold, the light allow-list stays exact
	list.Risky, list.Self, list.Light, list.Memory = compile(raw.Risky, true), compile(raw.Self, true), compile(raw.Light, false), compile(raw.Memory, true)
	return list
}()

// `**/` is any number of dirs, `**` anything, `*` and `?` stay inside one segment
func globRegexp(glob string) *regexp.Regexp {
	var b strings.Builder
	b.WriteString("^")
	for i := 0; i < len(glob); i++ {
		switch {
		case strings.HasPrefix(glob[i:], "**/"):
			b.WriteString("(?:.*/)?")
			i += 2
		case strings.HasPrefix(glob[i:], "**"):
			b.WriteString(".*")
			i++
		case glob[i] == '*':
			b.WriteString("[^/]*")
		case glob[i] == '?':
			b.WriteString("[^/]")
		default:
			b.WriteString(regexp.QuoteMeta(glob[i : i+1]))
		}
	}
	return regexp.MustCompile(b.String() + "$")
}

func matchesAny(path string, globs []*regexp.Regexp) bool {
	return slices.ContainsFunc(globs, func(g *regexp.Regexp) bool { return g.MatchString(path) })
}

// the pr's head and the paths it changes, read again after the paths: a push between the two reads would tier one head
// and merge another, so a moved head refuses
func headAndPaths(api, n string, pr *pullHead) ([]string, error) {
	if _, err := ghFetch(asDima, api+"/pulls/"+n, pr); err != nil {
		return nil, err
	}
	paths, err := prPaths(api, n)
	if err != nil {
		return nil, err
	}
	var again pullHead
	if _, err := ghFetch(asDima, api+"/pulls/"+n, &again); err != nil {
		return nil, err
	}
	if again.Head.Sha != pr.Head.Sha {
		return nil, &Fail{Refused: true, Msg: fmt.Sprintf("#%s's head moved while its paths were read, %s → %s: the tier would name one head and the merge another", n, short(pr.Head.Sha), short(again.Head.Sha)), Next: "x lane merge-auto " + n}
	}
	return paths, nil
}

// every path a pr changes, a rename's old name included: a file moved out of a risky dir is still a change to it
func prPaths(api, n string) ([]string, error) {
	type file struct {
		Filename         string `json:"filename"`
		PreviousFilename string `json:"previous_filename"`
	}
	files, err := ghPages[file](asDima, api+"/pulls/"+n+"/files", "")
	if err != nil {
		return nil, err
	}
	// github lists at most 3000 files and never says it cut: a full list may hide a risky path
	if len(files) >= 3000 {
		return nil, fmt.Errorf("pr %s changes %d files, github's whole 3000-file list, so its tier is unreadable: split the pr", n, len(files))
	}
	var paths []string
	for _, f := range files {
		for _, path := range []string{f.PreviousFilename, f.Filename} {
			if path != "" && !slices.Contains(paths, path) {
				paths = append(paths, path)
			}
		}
	}
	return paths, nil
}

func riskyOf(paths []string) (risky, self []string) {
	risky = []string{}
	for _, path := range paths {
		isSelf := matchesAny(path, riskyList.Self)
		if isSelf {
			self = append(self, path)
		}
		if isSelf || matchesAny(path, riskyList.Risky) {
			risky = append(risky, path)
		}
	}
	return risky, self
}

// the checks a pr's paths ask, the union over every path, never one tier's: a risky path asks the security pass, a
// memory path clio's wishkeeper read, and only an all-light pr drops its sixth sense; the tier is the highest, for the
// card. read off the final diff, so a pr grown past light asks the clean it needs today (FRM-548)
type prTier struct {
	Tier string   `json:"tier"`
	Asks []string `json:"asks"`
}

func tierOf(paths []string) prTier {
	risky, memory, light := false, false, len(paths) > 0
	for _, path := range paths {
		isRisky := matchesAny(path, riskyList.Risky) || matchesAny(path, riskyList.Self)
		isMemory := matchesAny(path, riskyList.Memory)
		risky, memory = risky || isRisky, memory || isMemory
		light = light && !isRisky && !isMemory && matchesAny(path, riskyList.Light)
	}
	t := prTier{Tier: "normal", Asks: []string{}}
	if !light {
		t.Asks = append(t.Asks, "sixth-sense")
	}
	if risky {
		t.Asks = append(t.Asks, "security")
	}
	if memory {
		t.Asks = append(t.Asks, "wishkeeper")
	}
	switch {
	case risky:
		t.Tier = "risky"
	case memory:
		t.Tier = "memory"
	case light:
		t.Tier = "light"
	}
	return t
}

func (t prTier) shown() string {
	if len(t.Asks) == 0 {
		return t.Tier + ": no sixth sense, the round only"
	}
	return t.Tier + ": asks " + strings.Join(t.Asks, ", ")
}
