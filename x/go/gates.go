package main

import (
	"cmp"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"

	yaml "go.yaml.in/yaml/v3"
)

// a commit's gates, read from lefthook.yaml so `x mods edit test` and the hook cannot drift. each gate runs against a
// temp index through script/index-run.sh, so it reads the bytes a commit would hold, the tree and the real index untouched

const (
	gateGreen   = "green"
	gateRed     = "red"
	gateNoPath  = "no path"
	gateCommits = "the commit's"
	cannotRun   = "cannot run: "

	gateCopyRun = "script/index-run.sh"
	// the suite a green overlay leaves to the commit, tagged in lefthook.yaml
	commitOnlyTag = "commit-only"
)

type hookGate struct {
	name       string
	run        string
	glob       []*regexp.Regexp
	exclude    []*regexp.Regexp
	commitOnly bool
	cannot     string
}

type gateVerdict struct {
	Gate    string `json:"gate"`
	Verdict string `json:"verdict"`
	log     string
}

var (
	hookPlaceholder = regexp.MustCompile(`(?:^|[^$])(\{[a-z0-9_]+\})`)
	hookFills       = map[string]string{"pre-commit": "{staged_files}", "commit-msg": "{1}"}
)

// the hook's gates in file order; no lefthook.yaml reads as none
func readHookGates(tree, hook string) ([]hookGate, error) {
	raw, err := os.ReadFile(filepath.Join(tree, "lefthook.yaml"))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(raw, &doc); err != nil {
		return nil, fmt.Errorf("lefthook.yaml: %w", err)
	}
	if len(doc.Content) == 0 {
		return nil, nil
	}
	var gates []hookGate
	for key, block := range yamlPairs(yamlValue(doc.Content[0], hook)) {
		switch key.Value {
		case "parallel":
		case "commands":
			for name, body := range yamlPairs(block) {
				gates = append(gates, readGate(hook, name.Value, body))
			}
		default:
			gates = append(gates, hookGate{name: key.Value, cannot: "the hook's " + key.Value + " key"})
		}
	}
	return gates, nil
}

func readGate(hook, name string, body *yaml.Node) hookGate {
	g := hookGate{name: name}
	for key, value := range yamlPairs(body) {
		switch key.Value {
		case "run":
			g.run = value.Value
		case "glob", "exclude":
			for _, pattern := range yamlStrings(value) {
				matcher, err := gateGlob(pattern)
				if err != nil {
					g.cannot = cmp.Or(g.cannot, err.Error())
				} else if key.Value == "glob" {
					g.glob = append(g.glob, matcher)
				} else {
					g.exclude = append(g.exclude, matcher)
				}
			}
		case "tags":
			g.commitOnly = slices.Contains(yamlStrings(value), commitOnlyTag)
		default:
			g.cannot = cmp.Or(g.cannot, "its "+key.Value+" key")
		}
	}
	if g.run == "" {
		g.cannot = cmp.Or(g.cannot, "it has no run line")
	}
	for _, found := range hookPlaceholder.FindAllStringSubmatch(g.run, -1) {
		if found[1] != hookFills[hook] {
			g.cannot = cmp.Or(g.cannot, "its "+found[1]+" placeholder")
		}
	}
	return g
}

func yamlValue(mapping *yaml.Node, key string) *yaml.Node {
	for k, v := range yamlPairs(mapping) {
		if k.Value == key {
			return v
		}
	}
	return nil
}

func yamlPairs(mapping *yaml.Node) func(func(*yaml.Node, *yaml.Node) bool) {
	return func(yield func(*yaml.Node, *yaml.Node) bool) {
		if mapping == nil || mapping.Kind != yaml.MappingNode {
			return
		}
		for i := 0; i+1 < len(mapping.Content); i += 2 {
			if !yield(mapping.Content[i], mapping.Content[i+1]) {
				return
			}
		}
	}
}

func yamlStrings(node *yaml.Node) []string {
	if node.Kind == yaml.ScalarNode {
		return []string{node.Value}
	}
	var values []string
	for _, item := range node.Content {
		values = append(values, item.Value)
	}
	return values
}

// lefthook's globs, case folded and with a `*` that crosses a slash; a form this does not read is named, never guessed
func gateGlob(pattern string) (*regexp.Regexp, error) {
	if strings.Contains(pattern, "[") {
		return nil, fmt.Errorf("its glob %s", pattern)
	}
	var re strings.Builder
	re.WriteString(`(?i)^`)
	inBrace := false
	for i := 0; i < len(pattern); i++ {
		switch c := pattern[i]; {
		case c == '*':
			for i+1 < len(pattern) && pattern[i+1] == '*' {
				i++
			}
			re.WriteString(`.*`)
		case c == '?':
			re.WriteString(`.`)
		case c == '{':
			inBrace = true
			re.WriteString(`(?:`)
		case c == '}' && inBrace:
			inBrace = false
			re.WriteString(`)`)
		case c == ',' && inBrace:
			re.WriteString(`|`)
		default:
			re.WriteString(regexp.QuoteMeta(string(c)))
		}
	}
	re.WriteString(`$`)
	return regexp.Compile(re.String())
}

func (g hookGate) paths(staged []string) []string {
	var kept []string
	for _, path := range staged {
		matches := func(m *regexp.Regexp) bool { return m.MatchString(path) }
		if (len(g.glob) == 0 || slices.ContainsFunc(g.glob, matches)) && !slices.ContainsFunc(g.exclude, matches) {
			kept = append(kept, path)
		}
	}
	return kept
}

// a temp index holding HEAD; the caller lays a commit's paths over it, and removes it with the returned func
func headIndex(repo string) (env []string, tree func() (string, error), done func(), err error) {
	dir, err := os.MkdirTemp("", "x-gates-")
	if err != nil {
		return nil, nil, nil, err
	}
	done = func() { _ = os.RemoveAll(dir) }
	env = []string{"GIT_INDEX_FILE=" + filepath.Join(dir, "index")}
	if got, _ := run(repo, env, "", "git", "read-tree", "HEAD"); !got.ok {
		done()
		return nil, nil, nil, &Fail{Msg: "git read-tree HEAD failed: " + got.log, Next: "git status"}
	}
	tree = func() (string, error) {
		got, _ := run(repo, env, "", "git", "write-tree")
		if !got.ok {
			return "", &Fail{Msg: "git write-tree failed: " + got.log, Next: "git status"}
		}
		return got.out, nil
	}
	return env, tree, done, nil
}

// what a commit from this index would stage, as lefthook's {staged_files} reads it: a deleted path is no file to check
func indexPaths(repo string, env []string) ([]string, error) {
	got, _ := run(repo, env, "", "git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
	if !got.ok {
		return nil, &Fail{Msg: "git diff --cached failed: " + got.log, Next: "git status"}
	}
	return slices.DeleteFunc(strings.Split(got.out, "\x00"), func(path string) bool { return path == "" }), nil
}

// HEAD, then the touched mods as the tree holds them, then the scratch copies: what the overlay's test reads
func overlayIndex(repo, scratch string, changed []string, env []string) error {
	var mods []string
	for _, mod := range touchedMods(changed) {
		mods = append(mods, modsDir+mod)
	}
	if got, _ := run(repo, env, "", "git", append([]string{"add", "-A", "--"}, mods...)...); !got.ok {
		return &Fail{Msg: "git add of the touched mods failed: " + got.log, Next: "x mods edit status"}
	}
	for _, path := range changed {
		copied := filepath.Join(scratch, path)
		blob, _ := run(repo, nil, "", "git", "hash-object", "-w", "--path="+path, copied)
		if !blob.ok {
			return &Fail{Msg: "git hash-object " + path + " failed: " + blob.log, Next: "x mods edit status"}
		}
		mode := "100644"
		if info, err := os.Stat(copied); err == nil && info.Mode()&0o111 != 0 {
			mode = "100755"
		}
		if got, _ := run(repo, env, "", "git", "update-index", "--add", "--cacheinfo", mode+","+blob.out+","+path); !got.ok {
			return &Fail{Msg: "git update-index " + path + " failed: " + got.log, Next: "x mods edit status"}
		}
	}
	return nil
}

// each gate over the index env names, the hook's order kept in the result; a gate that reds on timeouts alone runs once more
func runPreCommit(repo string, gates []hookGate, staged, env []string, skip func(hookGate) string) []gateVerdict {
	verdicts := make([]gateVerdict, len(gates))
	var wait sync.WaitGroup
	for i, g := range gates {
		verdicts[i].Gate = g.name
		paths := g.paths(staged)
		said := ""
		switch {
		case g.cannot != "":
			said = cannotRun + g.cannot
		case len(paths) == 0:
			said = gateNoPath
		case skip != nil:
			said = skip(g)
		}
		if said != "" {
			verdicts[i].Verdict = said
			continue
		}
		wait.Go(func() {
			command := strings.ReplaceAll(g.run, "{staged_files}", shellJoin(paths))
			if !strings.HasPrefix(command, gateCopyRun+" ") {
				command = gateCopyRun + " sh -c " + shellQuote(command)
			}
			got, _ := run(repo, env, "", "sh", "-c", command)
			if !got.ok && timeoutOnly(got.log) {
				got, _ = run(repo, env, "", "sh", "-c", command)
			}
			verdicts[i].log = got.log
			verdicts[i].Verdict = gateRed
			if got.ok {
				verdicts[i].Verdict = gateGreen
			}
		})
	}
	wait.Wait()
	return verdicts
}

func shellJoin(paths []string) string {
	quoted := make([]string, len(paths))
	for i, path := range paths {
		quoted[i] = shellQuote(path)
	}
	return strings.Join(quoted, " ")
}

func shellQuote(text string) string {
	if regexp.MustCompile(`^[\w@%+=:,./-]+$`).MatchString(text) {
		return text
	}
	return "'" + strings.ReplaceAll(text, "'", `'\''`) + "'"
}

func verdictLine(verdicts []gateVerdict) string {
	var parts []string
	for _, v := range verdicts {
		parts = append(parts, v.Gate+": "+v.Verdict)
	}
	return strings.Join(parts, ", ")
}

// the gates that stop a commit, named; their output's tail goes to the log beside every verdict
func gatesFail(verdicts []gateVerdict, where, next string) error {
	var stopped []string
	log := []string{}
	for _, v := range verdicts {
		log = append(log, v.Gate+": "+v.Verdict)
	}
	for _, v := range verdicts {
		if v.Verdict == gateRed || strings.HasPrefix(v.Verdict, cannotRun) {
			stopped = append(stopped, v.Gate+" ("+v.Verdict+")")
			lines := nonBlank(v.log)
			log = append(log, lines[max(0, len(lines)-40):]...)
		}
	}
	if len(stopped) == 0 {
		return nil
	}
	return &Fail{Msg: where + ": " + strings.Join(stopped, ", "), Next: next, Log: log}
}
