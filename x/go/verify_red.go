package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"syscall"
	"time"
)

const verifyRedHelp = "x verify red --help"

type redPair struct{ anchor, replacement string }

type pairRow struct {
	Pair    string   `json:"pair"`
	Verdict string   `json:"verdict"`
	Tests   []string `json:"tests,omitempty"`
	Why     string   `json:"why,omitempty"`
	Seconds float64  `json:"seconds"`
}

// one run of the test on one content of the file; broken holds a check that failed before the test ran
type redRun struct {
	ok          bool
	log, broken string
	// what the run could not check, named on a still green row
	note string
}

// the clean run and every mutant go through one harness, the file's content their only difference; none writes the real tree
type redHarness interface {
	run(content []byte) (redRun, error)
	close()
}

func verifyRed(r *Run, args []string, flags Flags) (any, error) {
	// a paid lane or a live write checks this and stands down; both runs carry it, so the clean run proves nothing the mutant skips
	if err := os.Setenv("X_VERIFY", "1"); err != nil {
		return nil, err
	}
	file, pairs, test, command, err := redArgs(args, flags)
	if err != nil {
		return nil, err
	}
	if pairsFile, _ := flags["pairs"].(string); pairsFile != "" {
		if err := inLongTurn(); err != nil {
			return nil, err
		}
	}
	original, err := os.ReadFile(file)
	if err != nil {
		return nil, usageFail("no file "+file, verifyRedHelp)
	}
	var harness redHarness
	if err := r.Step("check", "the anchors and the runner", func() (string, error) {
		for _, pair := range pairs {
			if n := strings.Count(string(original), pair.anchor); n != 1 {
				return "", usageFail(fmt.Sprintf("anchor «%s» found %d times in %s, needs exactly 1", pair.anchor, n, file), "pick a longer anchor, unique in "+file)
			}
		}
		harness, err = pickHarness(file, test, command, flags)
		return fmt.Sprintf("%d pairs", len(pairs)), err
	}); err != nil {
		return nil, err
	}
	defer harness.close()
	// a kill skips the defer, and a copy of the repo holds every ignored file it held, so an interrupt cleans it first
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(stop)
	go func() {
		if _, got := <-stop; got {
			harness.close()
			os.Exit(130)
		}
	}()
	saved := resumeFrom(file, pairs, test, command, flags)

	if err := r.Step("clean", "the test on the file as it is", func() (string, error) {
		if saved.Clean {
			return "passed in the cut run", nil
		}
		got, err := harness.run(original)
		if err != nil {
			return "", err
		}
		return "it passed", cleanHolds(file, got, test != "")
	}); err != nil {
		return nil, err
	}

	saved.Clean = true
	rows := slices.Clone(saved.Pairs)
	// a harness error mid-round leaves pairs unrun, so the round ends on it, never on the pairs that ran
	if err := r.Step("mutate", "each pair alone", func() (string, error) {
		for _, pair := range pairs[len(rows):] {
			saved.Pairs = rows
			saved.save()
			started := time.Now()
			got, err := harness.run([]byte(strings.Replace(string(original), pair.anchor, pair.replacement, 1)))
			if err != nil {
				return "", err
			}
			row := judgeMutant(got)
			row.Pair, row.Seconds = pairLabel(pair.anchor), time.Since(started).Round(100*time.Millisecond).Seconds()
			rows = append(rows, row)
		}
		saved.drop()
		if verdict := worstPair(rows); verdict != verdictRed {
			return "", notHeld(verdict)
		}
		return verdictRed, nil
	}); err != nil {
		return nil, err
	}

	verdict := worstPair(rows)
	lines := make([]string, len(rows))
	for i, row := range rows {
		lines[i] = ui.fg.Render(fmt.Sprintf("%-11s %s  %.1fs  %s", row.Verdict, row.Pair, row.Seconds, strings.Join(append(row.Tests, row.Why), " ")))
	}
	r.Show(lines, nameCell+2)
	data := ordered{{"file", file}, {"verdict", verdict}, {"pairs", rows}}
	if verdict != verdictRed {
		return nil, &Fail{Refused: true, Msg: "no proof: " + pairsLine(rows), Next: "x verify red " + file + " <anchor> <replacement> <test>: a line the test reads", Data: data}
	}
	r.Done(pairsLine(rows)+"; "+file+" never written", "")
	return data, nil
}

// a pairs round is a long round: the verb runs again inside the gate queue's long slot, one turn for every pair, so a commit
// never waits behind it; inside the slot the queue says so, and a test stays off the real slot unless it plants a queue
func inLongTurn() error {
	if os.Getenv("GATE_QUEUE_HELD") == "long" || os.Getenv("X_TEST") != "" && os.Getenv("X_FRAME_ROOT") == "" {
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	queue := filepath.Join(frameRoot(), "script/gate-queue.sh")
	return syscall.Exec(queue, append([]string{queue, "--long", exe}, os.Args[1:]...), os.Environ())
}

// a cut run's finished pairs, keyed by every input a verdict reads, so a resume never replays a pair onto changed ones
type redProgress struct {
	path  string
	Clean bool      `json:"clean"`
	Pairs []pairRow `json:"pairs"`
}

func resumeFrom(file string, pairs []redPair, test string, command []string, flags Flags) *redProgress {
	hash := sha256.New()
	abs, _ := filepath.Abs(file)
	dir := filepath.Dir(abs)
	name, _ := flags["run"].(string)
	fmt.Fprintf(hash, "%s\n%s\n%q\n%s\n", abs, test, command, name)
	// a new x build may read a run differently, so its saved verdicts are no longer this build's
	if exe, err := os.Executable(); err == nil {
		if built, err := os.Stat(exe); err == nil {
			fmt.Fprintf(hash, "%s %d\n", exe, built.ModTime().UnixNano())
		}
	}
	for _, git := range [][]string{{"rev-parse", "HEAD"}, {"status", "--porcelain", "--untracked-files=all"}, {"diff", "HEAD", "--binary"}} {
		got, _ := run(dir, nil, "", "git", git...)
		fmt.Fprintf(hash, "%s\n", got.out)
	}
	// a relative path in the command reads from the cwd, and an untracked file shows in neither the status nor the diff by content
	cwd, _ := os.Getwd()
	fmt.Fprintf(hash, "%s\n", cwd)
	if untracked, err := run(dir, nil, "", "git", "ls-files", "--others", "--exclude-standard", "--full-name"); err == nil && untracked.out != "" {
		top, _ := run(dir, nil, "", "git", "rev-parse", "--show-toplevel")
		for name := range strings.SplitSeq(untracked.out, "\n") {
			if info, err := os.Stat(filepath.Join(top.out, name)); err == nil {
				fmt.Fprintf(hash, "%s %d %d\n", name, info.Size(), info.ModTime().UnixNano())
			}
		}
	}
	for _, pair := range pairs {
		fmt.Fprintf(hash, "%q %q\n", pair.anchor, pair.replacement)
	}
	for _, read := range []string{abs, test} {
		body, _ := os.ReadFile(read)
		fmt.Fprintf(hash, "%d\n", len(body))
		hash.Write(body)
	}
	saved := &redProgress{path: filepath.Join(stateDir(), "verify", fmt.Sprintf("%x.json", hash.Sum(nil)[:12]))}
	if body, err := os.ReadFile(saved.path); err == nil && json.Unmarshal(body, saved) == nil && len(saved.Pairs) <= len(pairs) {
		return saved
	}
	return &redProgress{path: saved.path}
}

func (p *redProgress) save() {
	body, err := json.Marshal(p)
	if err != nil || os.MkdirAll(filepath.Dir(p.path), 0o755) != nil {
		return
	}
	temp := fmt.Sprintf("%s.%d", p.path, os.Getpid())
	if os.WriteFile(temp, body, 0o644) == nil {
		_ = os.Rename(temp, p.path)
	}
}

func (p *redProgress) drop() { _ = os.Remove(p.path) }

func redArgs(args []string, flags Flags) (file string, pairs []redPair, test string, command []string, err error) {
	dash, _ := flags[argsBeforeDash].(int)
	before := args
	if dash >= 0 {
		before, command = args[:dash], args[dash:]
		if len(command) == 0 {
			return "", nil, "", nil, usageFail("a -- needs a command after it", verifyRedHelp)
		}
	}
	pairsFile, _ := flags["pairs"].(string)
	want := 3
	if pairsFile != "" {
		want = 1
	}
	if command == nil {
		want++
	}
	if len(before) != want {
		return "", nil, "", nil, usageFail("expected <file> <anchor> <replacement> <test>, <file> --pairs <pairs> <test>, or either with -- <command> for <test>", verifyRedHelp)
	}
	file = before[0]
	if command == nil {
		test = before[len(before)-1]
	}
	if pairsFile == "" {
		return file, []redPair{{before[1], before[2]}}, test, command, nil
	}
	pairs, err = readPairs(pairsFile)
	return file, pairs, test, command, err
}

// the last tab splits a pair, so an anchor keeps its leading tabs (go is tab-indented); a replacement holds none
func readPairs(path string) ([]redPair, error) {
	body, err := os.ReadFile(path)
	if err != nil {
		return nil, usageFail("no pairs file "+path, verifyRedHelp)
	}
	var pairs []redPair
	for i, line := range strings.Split(strings.TrimSuffix(string(body), "\n"), "\n") {
		line = strings.TrimSuffix(line, "\r")
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		cut := strings.LastIndex(line, "\t")
		if cut < 0 {
			return nil, usageFail(fmt.Sprintf("%s:%d has no tab between anchor and replacement", path, i+1), verifyRedHelp)
		}
		if cut == 0 {
			return nil, usageFail(fmt.Sprintf("%s:%d has an empty anchor", path, i+1), verifyRedHelp)
		}
		pairs = append(pairs, redPair{line[:cut], line[cut+1:]})
	}
	if len(pairs) == 0 {
		return nil, usageFail(path+" holds no pairs", verifyRedHelp)
	}
	return pairs, nil
}

func pairLabel(anchor string) string {
	label, _, cut := strings.Cut(strings.TrimSpace(anchor), "\n")
	if runes := []rune(label); cut || len(runes) > 48 {
		label = string(runes[:min(len(runes), 47)]) + "…"
	}
	return "«" + label + "»"
}

// a base already red reads every swap red whatever it does, so the run refuses before the first mutant
func cleanHolds(file string, got redRun, picked bool) error {
	read := readTestOutput(got.log)
	switch {
	case got.broken != "":
		return &Fail{Refused: true, Msg: "the clean run is broken, nothing mutated: " + got.broken, Next: "fix " + file + " until its own check passes", Log: nonBlank(got.log)}
	case !got.ok:
		names := failedNames(read)
		msg := "the clean run is red, nothing mutated: " + strings.Join(names, ", ")
		if len(names) == 0 {
			msg = "the clean run is red, nothing mutated: no failed test named"
		}
		return &Fail{Refused: true, Msg: msg, Next: "run the test until it passes on " + file + " as it is", Log: nonBlank(got.log)}
	// a runner x picked prints its tally, so a run with none ran nothing, a name that matched no test included
	case read.none && !read.ran, picked && !read.ran:
		return &Fail{Refused: true, Msg: "the clean run ran no test, nothing mutated", Next: "name a test that runs: its file, or --run with a name it holds", Log: nonBlank(got.log)}
	}
	return nil
}

func failedNames(read testOutput) []string {
	var names []string
	for _, failed := range read.failed {
		if failed.name != "the file did not load" && !strings.Contains(failed.name, " [ ") && !slices.Contains(names, failed.name) {
			names = append(names, failed.name)
		}
	}
	return names
}

// a mutant reads red when a test failed on an assertion or threw: the mutation is the only change, so a throw is it doing its
// job; a check before the run, or a test file that never loaded, reads broken, which proves nothing
func judgeMutant(got redRun) pairRow {
	if got.broken != "" {
		return pairRow{Verdict: verdictBroken, Why: got.broken}
	}
	if got.ok {
		return pairRow{Verdict: verdictStillGreen, Why: strings.TrimSuffix("the test passed with the line swapped: it does not read it; "+got.note, "; ")}
	}
	read := readTestOutput(got.log)
	names := failedNames(read)
	var asserted []failedTest
	for _, failed := range read.failed {
		if slices.Contains(names, failed.name) && failedOnAssertion(failed) {
			asserted = append(asserted, failed)
		}
	}
	// a load word inside an assertion's own output is what the test compared, never the runner saying a file did not load
	load := ""
	if read.load != "" {
		inLog := false
		for line := range strings.SplitSeq(ansiColor.ReplaceAllString(got.log, ""), "\n") {
			// a t.Fatalf message runs on over indented lines until the runner's next row
			inLog = goTestLog.MatchString(line) || inLog && strings.HasPrefix(line, " ") && failedName(line) == "" && !strings.HasPrefix(strings.TrimSpace(line), "=== ")
			if inLog {
				continue
			}
			isTitle := failedName(line) != "" && failedName(line) != "the file did not load" && !strings.Contains(failedName(line), " [ ")
			quoted := slices.ContainsFunc(asserted, func(failed failedTest) bool { return strings.Contains(failed.output, line+"\n") })
			if loadError.MatchString(line) && !isTitle && !quoted && firstRowName(passedRows, line) == "" && !strings.Contains(line, "JSON") {
				load = strings.TrimSpace(line)
				break
			}
		}
	}
	switch {
	case load != "":
		return pairRow{Verdict: verdictBroken, Why: load}
	case len(asserted) > 0:
		return pairRow{Verdict: verdictRed, Tests: names}
	case slices.ContainsFunc(read.failed, func(failed failedTest) bool { return hookTimedOut.MatchString(failed.output) }):
		return pairRow{Verdict: verdictBroken, Tests: names, Why: "it timed out, which a loaded machine does on any source; run it again when the load falls"}
	case len(names) > 0:
		return pairRow{Verdict: verdictRed, Tests: names, Why: "it threw"}
	}
	return pairRow{Verdict: verdictFailed, Why: "the command failed and its output names no failed test"}
}

func worstPair(rows []pairRow) string {
	verdicts := make([]string, len(rows))
	for i, row := range rows {
		verdicts[i] = row.Verdict
	}
	for _, verdict := range []string{verdictBroken, verdictFailed, verdictStillGreen} {
		if slices.Contains(verdicts, verdict) {
			return verdict
		}
	}
	if len(rows) == 0 {
		return verdictBroken
	}
	return verdictRed
}

func pairsLine(rows []pairRow) string {
	var parts []string
	for _, verdict := range []string{verdictRed, verdictStillGreen, verdictBroken, verdictFailed} {
		n := 0
		for _, row := range rows {
			if row.Verdict == verdict {
				n++
			}
		}
		if n > 0 {
			parts = append(parts, fmt.Sprintf("%d %s", n, verdict))
		}
	}
	return strings.Join(parts, ", ")
}

// the runner comes from the test: a go test file, a mod's test, any other js or ts test; -- names its own
func pickHarness(file, test string, command []string, flags Flags) (redHarness, error) {
	abs, err := filepath.Abs(file)
	if err != nil {
		return nil, err
	}
	name, _ := flags["run"].(string)
	isGo := command != nil && filepath.Base(command[0]) == "go"
	// a cached go test result hides the mutant
	if isGo && len(command) > 1 && command[1] == "test" && !slices.ContainsFunc(command, func(arg string) bool { return strings.HasPrefix(arg, "-count") }) {
		command = slices.Insert(slices.Clone(command), 2, "-count=1")
	}
	switch {
	// an overlay reaches only what go builds; a file a test opens at runtime is read from the copy
	case isGo && filepath.Ext(abs) == ".go":
		return newGoHarness(abs, "", command)
	case command != nil:
		return newCopyHarness(abs, command, "")
	case strings.HasSuffix(test, "_test.go"):
		goTest := []string{"go", "test", "-count=1", "-failfast", "-v"}
		if name != "" {
			goTest = append(goTest, "-run", name)
		}
		dir, err := filepath.Abs(filepath.Dir(test))
		if err != nil {
			return nil, err
		}
		// an overlay reaches only what go builds; a file a test opens at runtime is read from the copy
		if filepath.Ext(abs) != ".go" {
			// go reads the module from the dir it runs in, so the run starts in the test's own dir, never at a root with no go.mod
			return newCopyHarness(abs, append(goTest, "."), dir)
		}
		return newGoHarness(abs, dir, append(goTest, "."))
	case isModTest(test) && name != "":
		return nil, usageFail("--run names no test in a mod: its run is the one test file named", "x verify red <file> <anchor> <replacement> "+test)
	case isModTest(test):
		return newModHarness(abs, test)
	case testFile.MatchString(test):
		vitest := []string{"vitest", "run", "--bail=1"}
		if name != "" {
			vitest = append(vitest, "-t", name)
		}
		return newCopyHarness(abs, append(vitest, test), "")
	}
	return nil, usageFail("x picks no runner for "+test+": a _test.go, a mod's test or a .test.ts", "x verify red <file> <anchor> <replacement> -- <command>")
}

func isModTest(test string) bool {
	abs, err := filepath.Abs(test)
	if err != nil {
		return false
	}
	return strings.Contains(filepath.ToSlash(abs), "/"+modsDir) && isTestFile(abs)
}

// go reads the mutant through -overlay in GOFLAGS, which the child build a TestMain runs inherits; the real file stays
type goHarness struct {
	file, dir, scratch string
	command            []string
}

func newGoHarness(file, dir string, command []string) (redHarness, error) {
	scratch, err := os.MkdirTemp("", "x-verify-go-")
	if err != nil {
		return nil, err
	}
	return &goHarness{file: file, dir: dir, scratch: scratch, command: command}, nil
}

func (g *goHarness) close() { _ = os.RemoveAll(g.scratch) }

func (g *goHarness) run(content []byte) (redRun, error) {
	mutant := filepath.Join(g.scratch, "content"+filepath.Ext(g.file))
	overlay := filepath.Join(g.scratch, "overlay.json")
	body, err := json.Marshal(map[string]map[string]string{"Replace": {g.file: mutant}})
	if err == nil {
		err = errors.Join(os.WriteFile(mutant, content, 0o644), os.WriteFile(overlay, body, 0o644))
	}
	if err != nil {
		return redRun{}, err
	}
	c := exec.Command(g.command[0], g.command[1:]...)
	c.Dir = g.dir
	c.Env = append(os.Environ(), "GOFLAGS="+strings.TrimSpace(os.Getenv("GOFLAGS")+" -overlay="+overlay))
	got := runTestCmd(c)
	return redRun{ok: got.ok, log: got.log}, nil
}

// any other runner reads a copy of the repo: apfs clones of its files, each node_modules a real dir of links to the real
// entries, its shims and plain files the copy's own, so a cache a runner writes and a shim an install relinks land in the copy.
// the git-crypt set stays out: plain text never leaves the tree
type copyHarness struct {
	root, copy, file, cwd string
	// the dir of package manager shims put first on the command's PATH
	guard   string
	command []string
	// the clean run's type errors: a mutant is broken only by one it adds, so a repo already red on tsc still proves
	typeErrors []string
	typed      bool
	// the tsconfig whose program holds the file, found on the clean file; unchecked says why none does
	project, unchecked string
}

// pnpm's subcommands that only run a command or a script
var pnpmRuns = map[string]bool{"exec": true, "run": true, "run-script": true, "test": true, "t": true, "tst": true}

// the tools that install a package, each of which may write a store
var packageManagers = map[string]bool{"pnpm": true, "pnpx": true, "npm": true, "npx": true, "yarn": true, "corepack": true, "bun": true, "bunx": true}

// whether a command may write the store. what passes is a leading pnpm with a plain run as its first word, since a list of
// pnpm's writes leaked one per read (`pnpm m install`, `pnpm with <version> install`, a flag's value that reads as a
// subcommand); past it no word, and no word of a shell line, may name a package manager (`env X=1 pnpm i`, `npx pnpm i`)
func mayWriteStore(command []string) bool {
	words := command
	if strings.EqualFold(filepath.Base(command[0]), "pnpm") {
		if len(command) < 2 || !pnpmRuns[command[1]] {
			return true
		}
		words = command[2:]
	}
	for _, arg := range words {
		for word := range strings.FieldsSeq(arg) {
			if packageManagers[strings.ToLower(filepath.Base(word))] {
				return true
			}
		}
	}
	return false
}

// runDir is where the command starts in the copy; empty, the cwd's twin
func newCopyHarness(file string, command []string, runDir string) (redHarness, error) {
	if mayWriteStore(command) {
		return nil, usageFail("«"+strings.Join(command, " ")+"» may write the store, node_modules/.pnpm, which the copy shares with the real tree: only a leading pnpm exec, run or test may name a package manager",
			"run the test itself: x verify red <file> <anchor> <replacement> -- pnpm exec <runner> <test>")
	}
	root, err := mustGitIn(filepath.Dir(file), "rev-parse", "rev-parse", "--show-toplevel")
	if err != nil {
		return nil, err
	}
	root, _ = filepath.EvalSymlinks(root)
	file, _ = filepath.EvalSymlinks(file)
	cwd := runDir
	if cwd == "" {
		cwd, _ = os.Getwd()
	}
	cwd, _ = filepath.EvalSymlinks(cwd)
	switch {
	case !inside(root, cwd):
		return nil, usageFail("the cwd "+cwd+" is outside the repo "+root+", so the command would read the real tree", "cd "+root+" and run it again")
	case !inside(root, file):
		return nil, usageFail(file+" resolves outside the repo "+root+", so its mutant would land on the real file", "name the file the link points at, from its own repo")
	}
	scratch, err := os.MkdirTemp("", "x-verify-copy-")
	if err != nil {
		return nil, err
	}
	h := &copyHarness{root: root, copy: filepath.Join(scratch, filepath.Base(root)), file: file, cwd: cwd, command: command, guard: filepath.Join(scratch, "guard")}
	if err := errors.Join(copyRepo(root, h.copy), writeGuard(h.guard)); err != nil {
		h.close()
		return nil, err
	}
	return h, nil
}

// the line a guard shim prints when it refuses
const guardRefused = "x verify red refused: "

// a shim per package manager, first on the command's PATH, so one a script calls is refused as it runs; pnpm's own plain run
// passes on to the real pnpm. a package manager called by its absolute path is never seen
func writeGuard(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	refuse := `echo "` + guardRefused + `«$(basename "$0") $*» may write the store, node_modules/.pnpm, which the copy shares with the real tree" >&2; exit 97` + "\n"
	for name := range packageManagers {
		body := "#!/bin/sh\n" + refuse
		if real, err := exec.LookPath(name); err == nil && name == "pnpm" {
			runs := strings.Join(slices.Sorted(maps.Keys(pnpmRuns)), "|")
			body = "#!/bin/sh\ncase \"${1-}\" in " + runs + ") exec " + quote(real) + " \"$@\" ;; esac\n" + refuse
		}
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o755); err != nil {
			return err
		}
	}
	return nil
}

func (h *copyHarness) close() { _ = os.RemoveAll(filepath.Dir(h.copy)) }

func (h *copyHarness) inCopy(path string) string {
	if inside(h.root, path) {
		rel, _ := filepath.Rel(h.root, path)
		return filepath.Join(h.copy, rel)
	}
	return path
}

// a path under root, never one that only opens with `..` in its name
func inside(root, path string) bool {
	rel, err := filepath.Rel(root, path)
	return err == nil && rel != ".." && !strings.HasPrefix(rel, "../")
}

func (h *copyHarness) run(content []byte) (redRun, error) {
	// the baseline is the real file's errors, read first, so a resumed round's first mutant never stands in for the clean file
	if !h.typed && typedSource.MatchString(h.file) {
		original, err := os.ReadFile(h.file)
		if err == nil {
			err = os.WriteFile(h.inCopy(h.file), original, 0o644)
		}
		if err != nil {
			return redRun{}, err
		}
		h.typed, h.typeErrors = true, h.typeErrorsNow()
		// the clean run's own content is the baseline just read, so its check is already done
		if bytes.Equal(original, content) {
			return h.runCommand(), nil
		}
	}
	if err := os.WriteFile(h.inCopy(h.file), content, 0o644); err != nil {
		return redRun{}, err
	}
	if added := h.newTypeErrors(); added != "" {
		return redRun{broken: "a type error: " + added}, nil
	}
	return h.runCommand(), nil
}

// the command on the copy as it holds the file now
func (h *copyHarness) runCommand() redRun {
	command := make([]string, len(h.command))
	for i, arg := range h.command {
		command[i] = arg
		// a path as its own arg or as a flag's value, `--root=/repo/x`, both read the copy
		if flag, value, isFlag := strings.Cut(arg, "="); isFlag && strings.HasPrefix(flag, "-") && filepath.IsAbs(value) {
			command[i] = flag + "=" + h.inCopy(value)
		} else if filepath.IsAbs(arg) {
			command[i] = h.inCopy(arg)
		}
	}
	dir := h.inCopy(h.cwd)
	// the copy's own bin, never npx: a copy missing its node_modules would fetch a runner from the registry
	if bin := nearestBin(dir, command[0]); bin != "" && !strings.Contains(command[0], "/") {
		command[0] = bin
	}
	c := exec.Command(command[0], command[1:]...)
	c.Dir = dir
	// pnpm installs before a run or an exec on a tree it reads as out of date, as it always reads frame's, and that install
	// would relink the store's own shims, which the copy shares. pnpm takes the setting in either case and the upper one
	// wins, so the caller's own spelling goes first; never CI=1, which reaches vitest and refuses a new snapshot
	const noInstall = "pnpm_config_verify_deps_before_run"
	c.Env = append(slices.DeleteFunc(os.Environ(), func(pair string) bool {
		key, _, _ := strings.Cut(pair, "=")
		return strings.EqualFold(key, noInstall) || key == "PATH"
	}), noInstall+"=false", "PATH="+h.guard+string(os.PathListSeparator)+os.Getenv("PATH"))
	got := runTestCmd(c)
	if _, refused, found := strings.Cut(got.log, guardRefused); found {
		line, _, _ := strings.Cut(refused, "\n")
		return redRun{broken: "the command called a package manager: " + line, log: got.log}
	}
	return redRun{ok: got.ok, log: got.log, note: h.unchecked}
}

var (
	typedSource = regexp.MustCompile(`\.[cm]?tsx?$`)
	// a swap that moves lines moves every error below it, so errors compare without their position
	tscPosition = regexp.MustCompile(`\(\d+,\d+\)`)
	// a go test's own t.Log or t.Fatal line, which -v prints apart from its --- FAIL row when tests run in parallel
	goTestLog = regexp.MustCompile(`^\s+\S+_test\.go:\d+: `)
)

// a type error the clean file did not have, counted, so a second error worded like a clean one still reads; no tsconfig, no check
func (h *copyHarness) newTypeErrors() string {
	if !typedSource.MatchString(h.file) {
		return ""
	}
	clean := map[string]int{}
	for _, err := range h.typeErrors {
		clean[tscPosition.ReplaceAllString(err, "")]++
	}
	for _, err := range h.typeErrorsNow() {
		key := tscPosition.ReplaceAllString(err, "")
		if clean[key] == 0 {
			return err
		}
		clean[key]--
	}
	return ""
}

// tsc --noEmit on the nearest tsconfig whose program holds the file: a tsconfig whose include misses it checks nothing
func (h *copyHarness) typeErrorsNow() []string {
	if h.unchecked != "" {
		return nil
	}
	rel, _ := filepath.Rel(h.root, h.file)
	// tsc lists each file by its full path, resolved or as reached, so the file is its copy's path in either form
	target := h.inCopy(h.file)
	resolved, _ := filepath.EvalSymlinks(target)
	for dir := filepath.Dir(target); inside(h.copy, dir); dir = filepath.Dir(dir) {
		tsc := nearestBin(dir, "tsc")
		if (h.project != "" && dir != h.project) || !exists(filepath.Join(dir, "tsconfig.json")) || tsc == "" {
			continue
		}
		c := exec.Command(tsc, "--noEmit", "--listFiles", "-p", dir)
		c.Dir = dir
		// tsc prints its errors and its file list on stdout; stderr holds its own crash, never a type error
		out, _ := c.Output()
		holds := false
		var errs []string
		for line := range strings.SplitSeq(string(out), "\n") {
			listed := strings.TrimSpace(line)
			holds = holds || listed == target || listed == resolved
			if strings.Contains(line, "error TS") {
				errs = append(errs, strings.TrimSpace(line))
			}
		}
		if holds || h.project != "" {
			h.project = dir
			return errs
		}
	}
	h.unchecked = "no tsconfig above " + rel + " includes it, so its types go unchecked"
	return nil
}

func nearestBin(dir, name string) string {
	for ; ; dir = filepath.Dir(dir) {
		if bin := filepath.Join(dir, "node_modules/.bin", name); exists(bin) {
			return bin
		}
		if dir == filepath.Dir(dir) {
			return ""
		}
	}
}

func copyRepo(root, to string) error {
	locked, err := gitCryptSet(root)
	if err != nil {
		return err
	}
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		dest := filepath.Join(to, rel)
		switch name := entry.Name(); {
		case entry.IsDir() && (name == ".git" || rel == ".claude"):
			return filepath.SkipDir
		case name == "node_modules" && path != root:
			// WalkDir knows SkipDir only bare, never joined to a nil
			if err := linkEntries(root, to, path, dest); err != nil {
				return err
			}
			return skipIfDir(entry)
		case entry.IsDir():
			return os.MkdirAll(dest, 0o755)
		case name == ".git" || locked[filepath.ToSlash(rel)]:
			return nil
		case entry.Type()&fs.ModeSymlink != 0:
			target, err := os.Readlink(path)
			if err != nil {
				return err
			}
			return os.Symlink(intoCopy(root, to, target), dest)
		}
		return cloneFile(path, dest)
	})
}

func skipIfDir(entry fs.DirEntry) error {
	if entry.IsDir() {
		return filepath.SkipDir
	}
	return nil
}

// an absolute link into the repo would read the real tree from the copy, so it points at the copy's twin
func intoCopy(root, to, target string) string {
	if filepath.IsAbs(target) && inside(root, target) {
		rel, _ := filepath.Rel(root, target)
		return filepath.Join(to, rel)
	}
	return target
}

// a node_modules link straight to the real one lets a runner write its caches there; a real dir of links per entry keeps them
// here, and an entry that resolves to a workspace package of the repo points at the copy's package. what an install rewrites
// in place is the copy's own: .bin a real dir of its shims, and each plain file, pnpm's state files among them, a clone
func linkEntries(root, to, modules, dest string) error {
	real, err := filepath.EvalSymlinks(modules)
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(real)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	for _, entry := range entries {
		// a runner's caches and pnpm's dir of run records are a run's own: the copy starts without them
		if strings.HasPrefix(entry.Name(), ".vite") || entry.Name() == ".vitest-cache" || entry.Name() == ".cache" || entry.Name() == ".pnpm-task-run-state-v1" {
			continue
		}
		link, own := filepath.Join(real, entry.Name()), filepath.Join(dest, entry.Name())
		resolved, resolveErr := filepath.EvalSymlinks(link)
		switch {
		case entry.Name() == ".bin" && entry.IsDir():
			err = copyShims(root, to, link, own)
		case entry.Type().IsRegular():
			err = cloneFile(link, own)
		case entry.Name() == ".bin" && resolveErr == nil:
			// a .bin that links to another level's points at the copy's own there: its shims find their packages from that level
			err = os.Symlink(intoCopy(root, to, resolved), own)
		default:
			if resolveErr == nil && !strings.Contains(resolved, "/node_modules/") {
				link = intoCopy(root, to, resolved)
			}
			err = os.Symlink(link, own)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// pnpm's shim is a script, npm's a link beside the package it runs: a script is cloned, a link made again, so either runs the
// copy's entry of that package
func copyShims(root, to, bin, dest string) error {
	shims, err := os.ReadDir(bin)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	for _, shim := range shims {
		from, own := filepath.Join(bin, shim.Name()), filepath.Join(dest, shim.Name())
		if shim.Type()&fs.ModeSymlink == 0 {
			err = cloneFile(from, own)
		} else if target, linkErr := os.Readlink(from); linkErr != nil {
			err = linkErr
		} else {
			err = os.Symlink(intoCopy(root, to, target), own)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func gitCryptSet(root string) (map[string]bool, error) {
	// nul-separated both ways: a quoted non-ascii path would never match the walk's raw one; an untracked file counts too
	list := exec.Command("git", "ls-files", "-z", "--cached", "--others", "--exclude-standard")
	list.Dir = root
	files, err := list.Output()
	if err != nil {
		return nil, gitFailure("ls-files", err)
	}
	check := exec.Command("git", "check-attr", "-z", "filter", "--stdin")
	check.Dir, check.Stdin = root, strings.NewReader(string(files))
	out, err := check.Output()
	if err != nil {
		return nil, gitFailure("check-attr", err)
	}
	locked := map[string]bool{}
	// each answer is three fields: the path, the attribute, its value
	fields := strings.Split(string(out), "\x00")
	for i := 0; i+2 < len(fields); i += 3 {
		if fields[i+2] == "git-crypt" {
			locked[fields[i]] = true
		}
	}
	return locked, nil
}

func gitFailure(verb string, err error) error {
	if exit, ok := errors.AsType[*exec.ExitError](err); ok {
		return fmt.Errorf("git %s: %w: %s", verb, err, exit.Stderr)
	}
	return err
}

// a mod runs as `x mods edit test` runs it: the mod copied off the tree, validated, then claude plugin test on the copy
type modHarness struct {
	repo, file, test, scratch string
}

func newModHarness(file, test string) (redHarness, error) {
	repo, err := mustGitIn(filepath.Dir(file), "rev-parse", "rev-parse", "--show-toplevel")
	if err != nil {
		return nil, err
	}
	repo, _ = filepath.EvalSymlinks(repo)
	file, _ = filepath.EvalSymlinks(file)
	testAbs, _ := filepath.Abs(test)
	testAbs, _ = filepath.EvalSymlinks(testAbs)
	relFile, _ := filepath.Rel(repo, file)
	relTest, _ := filepath.Rel(repo, testAbs)
	fileMod, inMod := modOf(filepath.ToSlash(relFile))
	if testMod, _ := modOf(filepath.ToSlash(relTest)); !inMod || fileMod != testMod {
		return nil, usageFail(file+" is no file of "+test+"'s mod; a mod's test reads only its own mod", "x verify red <file> <anchor> <replacement> -- <command>")
	}
	scratch, err := os.MkdirTemp("", "x-verify-mod-")
	if err != nil {
		return nil, err
	}
	return &modHarness{repo: repo, file: filepath.ToSlash(relFile), test: filepath.ToSlash(relTest), scratch: scratch}, nil
}

func (m *modHarness) close() { _ = os.RemoveAll(m.scratch) }

func (m *modHarness) run(content []byte) (redRun, error) {
	mutant := filepath.Join(m.scratch, filepath.Base(m.file))
	if err := os.WriteFile(mutant, content, 0o644); err != nil {
		return redRun{}, err
	}
	// the copies are laid as given: a mutant passed through the format step could lose the swap
	copies := &formattedCopies{repo: m.repo, out: map[string]string{m.file: mutant}}
	reports, err := overlayTest(m.repo, copies, []string{m.file}, m.test)
	if err != nil {
		return redRun{}, err
	}
	got := redRun{ok: true}
	for _, report := range reports {
		got.log += report.log + "\n"
		if report.Validate != "ok" {
			got.broken = "the mod does not validate: " + report.Validate
		}
		got.ok = got.ok && !report.isRed()
	}
	return got, nil
}
