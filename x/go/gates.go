package main

import (
	"cmp"
	"crypto/sha256"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

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
	// what a green overlay already proved: a lost line costs one rerun, so it needs no lock
	gatesGreenFile = "gates-green.tsv"
	gatesGreenKept = 200
	gatesGreenFor  = time.Hour
	treeSubject    = "tree"
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
		return nil, &Fail{Msg: "lefthook.yaml does not parse: " + err.Error(), Next: "lefthook validate"}
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

// why a gate does not run on these paths, or "": lefthook skips a gate with no file only when a glob or {staged_files} asks for one
func (g hookGate) notRunning(staged []string) string {
	switch {
	case g.cannot != "":
		return cannotRun + g.cannot
	case len(g.paths(staged)) == 0 && (len(g.glob) > 0 || strings.Contains(g.run, "{staged_files}")):
		return gateNoPath
	}
	return ""
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

// a dry run's gates on the temp index the run's git already reads; a green records its tree for the real commit
func dryCommit(r *Run, tree, message string, env []string, treeOf func() (string, error), again, next string) (any, error) {
	r.skip("hold", "ci", "commit", "restore")
	var verdicts []gateVerdict
	var pre []hookGate
	if err := r.Step("gates", "the commit hook's gates on a temp index", func() (string, error) {
		staged, err := indexPaths(tree, env)
		if err != nil {
			return "", err
		}
		if pre, err = readHookGates(tree, "pre-commit"); err != nil {
			return "", err
		}
		msg, err := readHookGates(tree, "commit-msg")
		if err != nil {
			return "", err
		}
		verdicts = runPreCommit(tree, pre, staged, env, nil)
		onMessage, err := runCommitMsg(tree, msg, staged, env, message)
		if err != nil {
			return "", err
		}
		verdicts = append(verdicts, onMessage...)
		return verdictLine(verdicts), gatesFail(verdicts, "red on the dry run", again)
	}); err != nil {
		return nil, err
	}
	recordTree(tree, treeOf, pre, verdicts)
	r.Done(verdictLine(verdicts), next)
	return ordered{{"gates", verdicts}}, nil
}

// commit-msg gates run in sequence on one copy of the message, since two of them edit it; a hook reads the tree's scripts
func runCommitMsg(tree string, gates []hookGate, staged, env []string, message string) ([]gateVerdict, error) {
	dir, err := os.MkdirTemp("", "x-gates-msg-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)
	copied := filepath.Join(dir, "COMMIT_EDITMSG")
	if err := copyFile(message, copied); err != nil {
		return nil, err
	}
	verdicts := make([]gateVerdict, len(gates))
	for i, g := range gates {
		verdicts[i].Gate = g.name
		if verdicts[i].Verdict = g.notRunning(staged); verdicts[i].Verdict != "" {
			continue
		}
		got, _ := run(tree, env, "", "sh", "-c", strings.ReplaceAll(g.run, "{1}", quote(copied)))
		verdicts[i].log = got.log
		verdicts[i].Verdict = gateRed
		if got.ok {
			verdicts[i].Verdict = gateGreen
		}
	}
	return verdicts, nil
}

// a gate that reads only the index copy and went green on a tree over a HEAD: a gate may diff against HEAD, so both key it
func recordTree(repo string, treeOf func() (string, error), gates []hookGate, verdicts []gateVerdict) {
	var proven []string
	for i, g := range gates {
		if verdicts[i].Verdict == gateGreen && strings.HasPrefix(g.run, gateCopyRun+" ") {
			proven = append(proven, g.name+"="+runHash(g))
		}
	}
	at, _ := run(repo, nil, "", "git", "rev-parse", "HEAD")
	if sha, err := treeOf(); err == nil && at.ok && len(proven) > 0 {
		recordGreen(treeSubject+" "+at.out, sha, proven)
	}
}

// a gate's run line in a record, so a gate edited since its green proves nothing
func runHash(g hookGate) string {
	sum := sha256.Sum256([]byte(g.run))
	return fmt.Sprintf("%x", sum[:4])
}

// what the tree a pathspec commit of these paths would hold already proved; any failed read proves nothing
func provenOnThisTree(tree string, paths []string) []string {
	env, treeOf, done, err := headIndex(tree)
	if err != nil {
		return nil
	}
	defer done()
	for _, path := range paths {
		// a path gone from the tree and from HEAD fails the add and changes nothing, as the commit's own stage skips it
		if got, _ := run(tree, env, "", "git", "add", "-A", "--", path); !got.ok && exists(filepath.Join(tree, path)) {
			return nil
		}
	}
	sha, err := treeOf()
	at, _ := run(tree, nil, "", "git", "rev-parse", "HEAD")
	if err != nil || !at.ok {
		return nil
	}
	record, _ := os.ReadFile(filepath.Join(stateDir(), gatesGreenFile))
	lines := nonBlank(string(record))
	slices.Reverse(lines)
	for _, line := range lines {
		fields := strings.Split(line, "\t")
		if len(fields) != 4 || fields[1] != treeSubject+" "+at.out || fields[2] != sha {
			continue
		}
		if until, err := strconv.ParseInt(fields[0], 10, 64); err != nil || time.Now().Unix() >= until {
			return nil
		}
		gates, err := readHookGates(tree, "pre-commit")
		if err != nil {
			return nil
		}
		var proven []string
		for _, g := range gates {
			if slices.Contains(strings.Split(fields[3], ","), g.name+"="+runHash(g)) {
				proven = append(proven, g.name)
			}
		}
		return proven
	}
	return nil
}

// one line per thing a green proved, `<valid until>\t<subject>\t<sha>\t<gates>`, read back by `mods:test --skip-tested` and a
// real commit; a failed write costs one rerun
func recordGreen(subject, sha string, gates []string) {
	path := filepath.Join(stateDir(), gatesGreenFile)
	old, _ := os.ReadFile(path)
	lines := append(nonBlank(string(old)), fmt.Sprintf("%d\t%s\t%s\t%s", time.Now().Add(gatesGreenFor).Unix(), subject, sha, strings.Join(gates, ",")))
	lines = lines[max(0, len(lines)-gatesGreenKept):]
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	temp := fmt.Sprintf("%s.%d", path, os.Getpid())
	if os.WriteFile(temp, []byte(strings.Join(lines, "\n")+"\n"), 0o644) == nil {
		_ = os.Rename(temp, path)
	}
}

// each touched mod's subtree as the overlay's tests read it: the tree's mod, then the scratch copies
func recordTestedMods(repo, scratch string, changed []string) {
	env, _, done, err := headIndex(repo)
	if err != nil {
		return
	}
	defer done()
	mods := touchedMods(changed)
	for _, mod := range mods {
		if got, _ := run(repo, env, "", "git", "add", "-A", "--", modsDir+mod); !got.ok {
			return
		}
	}
	if layScratch(repo, scratch, changed, env) != nil {
		return
	}
	for _, mod := range mods {
		if got, _ := run(repo, env, "", "git", "write-tree", "--prefix="+modsDir+mod+"/"); got.ok {
			recordGreen("mod "+mod, got.out, nil)
		}
	}
}

// the scratch copies over the index env names: HEAD plus these paths is what a commit of them would hold
func layScratch(repo, scratch string, changed []string, env []string) error {
	for _, path := range changed {
		copied := filepath.Join(scratch, path)
		blob, _ := run(repo, nil, "", "git", "hash-object", "-w", "--path="+path, copied)
		if !blob.ok {
			return &Fail{Msg: "git hash-object " + path + " failed: " + blob.log, Next: "x mods edit status"}
		}
		// a push keeps the target's mode and a scratch copy never holds one, so the index's mode is the commit's
		mode := "100644"
		if listed, _ := run(repo, env, "", "git", "ls-files", "-s", "--", path); listed.ok && listed.out != "" {
			mode, _, _ = strings.Cut(listed.out, " ")
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
		said := g.notRunning(staged)
		if said == "" && skip != nil {
			said = skip(g)
		}
		if said != "" {
			verdicts[i].Verdict = said
			continue
		}
		wait.Go(func() {
			command := strings.ReplaceAll(g.run, "{staged_files}", shellJoin(paths))
			if !strings.HasPrefix(command, gateCopyRun+" ") {
				command = gateCopyRun + " sh -c " + quote(command)
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
		quoted[i] = quote(path)
	}
	return strings.Join(quoted, " ")
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
	return &Fail{Refused: true, Msg: where + ": " + strings.Join(stopped, ", "), Next: next, Log: log}
}
