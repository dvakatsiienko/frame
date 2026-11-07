package main

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// a live mod loads from the main checkout and reloads in every session at its next turn end, so it is edited in a
// scratch copy and lands only when its overlay validates and tests green, all files or none (FRM-388)
const modsDir = "home/.claude/plugin-x/mods/"

// the scratch root holds each copy at its repo path, `.base/` the bytes it was pulled at, `.pulled` the pulled paths,
// `.tested` the stamp of the overlay `x mods edit test` last passed
const (
	scratchBase   = ".base"
	scratchPulled = ".pulled"
	scratchTested = ".tested"
)

func scratchRoot(repo string) string {
	// the os tmp dies with the mac, and an unpushed edit with it
	dir := stateDir()
	if job := os.Getenv("CLAUDE_JOB_DIR"); job != "" {
		dir = filepath.Join(job, "tmp")
	}
	return filepath.Join(dir, "x-mods-edit", filepath.Base(repo))
}

// a path is a mod's when it sits under the mods dir, one mod deep; the mod's name is that first part
func modOf(path string) (string, bool) {
	rest, ok := strings.CutPrefix(filepath.ToSlash(path), modsDir)
	mod, _, deep := strings.Cut(rest, "/")
	return mod, ok && deep && mod != ""
}

func modsRepo() (string, string, error) {
	repo, err := top()
	if err != nil {
		return "", "", err
	}
	return repo, scratchRoot(repo), nil
}

func modsEditPull(r *Run, args []string, _ Flags) (any, error) {
	repo, scratch, err := modsRepo()
	if err != nil {
		return nil, err
	}
	r.Open(scratch)
	var copies []string
	if err := r.Step("pull", "copying into scratch", func() (string, error) {
		pulled := readPulled(scratch)
		for _, arg := range args {
			path, err := modsRepoPath(repo, arg)
			if err != nil {
				return "", err
			}
			from, to := filepath.Join(repo, path), filepath.Join(scratch, path)
			if exists(from) {
				if err := copyFile(from, to); err != nil {
					return "", err
				}
				if err := copyFile(from, filepath.Join(scratch, scratchBase, path)); err != nil {
					return "", err
				}
			} else if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
				return "", err
			}
			if !slices.Contains(pulled, path) {
				pulled = append(pulled, path)
			}
			copies = append(copies, to)
		}
		return fmt.Sprintf("%d pulled", len(copies)), writePulled(scratch, pulled)
	}); err != nil {
		return nil, err
	}
	r.Done(strings.Join(copies, "\n"), "edit the copies, then x mods edit push")
	return ordered{{"copies", copies}}, nil
}

func modsEditStatus(r *Run, _ []string, _ Flags) (any, error) {
	_, scratch, err := modsRepo()
	if err != nil {
		return nil, err
	}
	changed := changedScratch(scratch)
	printOverlayHeader(r, scratch, changed)
	r.Done(fmt.Sprintf("%d edited", len(changed)), "x mods edit test")
	return ordered{{"edited", changed}, {"scratch", scratch}}, nil
}

// test lays the edited copies over a copy of each touched mod and runs the validator and the mod's tests on it;
// --against HEAD runs only the edited tests on HEAD's mod instead; --only runs one test file
func modsEditTest(r *Run, _ []string, flags Flags) (any, error) {
	repo, scratch, err := modsRepo()
	if err != nil {
		return nil, err
	}
	changed := changedScratch(scratch)
	r.Open(fmt.Sprintf("%d edited", len(changed)))
	against, _ := flags["against"].(string)
	only, _ := flags["only"].(string)
	if against != "" && only != "" {
		return nil, usageFail("--only and --against each pick what runs; name one", "x mods edit test --only <test file>")
	}
	printOverlayHeader(r, scratch, changed)
	if only != "" {
		r.skip("gates")
		return testOneFile(r, repo, scratch, changed, only)
	}
	if against != "" {
		r.skip("gates")
		return againstRef(r, repo, scratch, changed, against)
	}
	// read before the run: a save while the tests run must not stamp bytes they never read
	stamp := overlayStamp(repo, scratch, changed)
	copies, err := newFormattedCopies(repo, scratch)
	if err != nil {
		return nil, err
	}
	defer copies.done()
	var reports []modReport
	if err := r.Step("test", "validate and test on an overlay copy", func() (string, error) {
		reports, err = overlayTest(repo, copies, changed, "")
		return reportLine(reports), err
	}); err != nil {
		return nil, err
	}
	red := redReports(reports)
	var verdicts []gateVerdict
	// a red test does not stop the gates: one run names every red a commit would meet
	gatesErr := r.Step("gates", "the commit hook's gates on the overlay", func() (string, error) {
		verdicts, err = overlayGates(repo, scratch, copies, changed, stamp, len(red) == 0)
		if err != nil {
			return "", err
		}
		return verdictLine(verdicts), gatesFail(verdicts, "red on the overlay", "x mods edit test")
	})
	stopped, isRed := errors.AsType[*Fail](gatesErr)
	if gatesErr != nil && !isRed {
		return nil, gatesErr
	}
	if len(red) > 0 {
		msg, log := "red on the overlay: "+reportLine(red), nonBlank(redLog(red))
		if isRed {
			msg, log = msg+"; "+stopped.Msg, append(log, stopped.Log...)
		} else {
			log = append(log, verdictLine(verdicts))
		}
		return nil, &Fail{Msg: msg, Next: "x mods edit test", Log: log}
	}
	if isRed {
		return nil, stopped
	}
	// a lost stamp costs one test run at the push, nothing more
	_ = os.WriteFile(filepath.Join(scratch, scratchTested), []byte(stamp), 0o644)
	r.Done(reportLine(reports), "x mods edit push")
	return ordered{{"mods", reports}, {"gates", verdicts}}, nil
}

// one file's green proves one file: it writes no stamp and no gate green, so a push still runs the whole test
func testOneFile(r *Run, repo, scratch string, changed []string, arg string) (any, error) {
	var only string
	var reports []modReport
	if err := r.Step("test", "validate and test one file on an overlay copy", func() (string, error) {
		var err error
		if only, err = onlyTestFile(repo, scratch, arg); err != nil {
			return "", err
		}
		copies, err := newFormattedCopies(repo, scratch)
		if err != nil {
			return "", err
		}
		defer copies.done()
		if reports, err = overlayTest(repo, copies, changed, only); err != nil {
			return "", err
		}
		if red := redReports(reports); len(red) > 0 {
			return "", &Fail{Msg: "red on the overlay: " + reportLine(red), Next: "x mods edit test --only " + only, Log: nonBlank(redLog(red))}
		}
		if reports[0].Passed == 0 {
			return "", &Fail{Refused: true, Msg: only + " ran no test, so nothing is green", Next: "x mods edit test"}
		}
		return reportLine(reports), nil
	}); err != nil {
		return nil, err
	}
	r.Done(reportLine(reports), "x mods edit test")
	return ordered{{"only", only}, {"mods", reports}}, nil
}

// an --only path reads from the repo root, and names a test file of a mod, in scratch or in the repo
func onlyTestFile(repo, scratch, arg string) (string, error) {
	path, err := modPathFrom(repo, repo, arg)
	if err != nil {
		return "", err
	}
	refuse := func(why string) (string, error) {
		return "", usageFail(arg+" "+why+"; nothing ran", "x mods edit status")
	}
	if !isTestFile(path) {
		return refuse("is not a .test.ts or .test.tsx file")
	}
	if exists(filepath.Join(scratch, scratchBase, path)) && !exists(filepath.Join(scratch, path)) {
		return refuse("is deleted in scratch")
	}
	for _, root := range []string{scratch, repo} {
		if info, err := os.Stat(filepath.Join(root, path)); err == nil && info.Mode().IsRegular() {
			return path, nil
		}
	}
	return refuse("is no file in scratch or the repo")
}

func isTestFile(path string) bool {
	return strings.HasSuffix(path, ".test.ts") || strings.HasSuffix(path, ".test.tsx")
}

// what a scratch holds apart from its pull: every changed copy, and a copy since removed, whose base alone stands
func overlayDiffers(scratch string, changed []string) []string {
	paths := slices.Clone(changed)
	base := filepath.Join(scratch, scratchBase)
	_ = filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		rel, _ := filepath.Rel(base, path)
		if !exists(filepath.Join(scratch, rel)) {
			paths = append(paths, filepath.ToSlash(rel))
		}
		return nil
	})
	slices.Sort(paths)
	return paths
}

// the line a red is read against: a half-done edit here reads apart from a red on main. it says what differs, never whose
func printOverlayHeader(r *Run, scratch string, changed []string) {
	paths := overlayDiffers(scratch, changed)
	if len(paths) == 0 {
		return
	}
	verb := "differ"
	if len(paths) == 1 {
		verb = "differs"
	}
	count := fmt.Sprintf("overlay %s %s", plural(len(paths), "path"), verb)
	if r.human {
		r.Open("")
		// a board row never clips itself
		rows := []string{count}
		for _, path := range paths {
			rows = append(rows, clip(path, r.board.inner()-inset))
		}
		r.Show(rows, inset)
		return
	}
	fmt.Fprintln(os.Stderr, count+": "+strings.Join(paths, ", "))
}

func modsEditPush(r *Run, args []string, flags Flags) (any, error) {
	repo, scratch, err := modsRepo()
	if err != nil {
		return nil, err
	}
	added := splitList(flags["add"])
	changed := changedScratch(scratch)
	r.Open(fmt.Sprintf("%d edited", len(changed)))
	if err := r.Step("plan", "every file pulled or added, the repo unchanged since", func() (string, error) {
		if len(changed) == 0 {
			return "", &Fail{Refused: true, Msg: "nothing edited in " + scratch, Next: "x mods edit status"}
		}
		if len(args) > 0 {
			var named []string
			for _, arg := range args {
				path, err := modsRepoPath(repo, arg)
				if err != nil {
					return "", err
				}
				if !slices.Contains(changed, path) {
					return "", &Fail{Refused: true, Msg: path + " holds no edit in scratch; nothing written", Next: "x mods edit status"}
				}
				named = append(named, path)
			}
			changed = named
		}
		return fmt.Sprintf("%d to write", len(changed)), modsPushPlan(repo, scratch, changed, added)
	}); err != nil {
		return nil, err
	}
	copies, err := newFormattedCopies(repo, scratch)
	if err != nil {
		return nil, err
	}
	defer copies.done()
	var reports []modReport
	if err := r.Step("test", "validate and test on an overlay copy", func() (string, error) {
		stamp := overlayStamp(repo, scratch, changed)
		if tested, _ := os.ReadFile(filepath.Join(scratch, scratchTested)); string(tested) == stamp {
			return "x mods edit test passed these bytes", nil
		}
		reports, err = overlayTest(repo, copies, changed, "")
		if red := redReports(reports); err == nil && len(red) > 0 {
			err = &Fail{Refused: true, Msg: "red on the overlay, nothing written: " + reportLine(red), Next: "x mods edit test", Log: nonBlank(redLog(red))}
		}
		if err == nil && overlayStamp(repo, scratch, changed) == stamp {
			recordTestedMods(repo, copies, changed)
		}
		return reportLine(reports), err
	}); err != nil {
		return nil, err
	}
	if err := r.Step("write", "all or nothing, restored from a backup on a failed write", func() (string, error) {
		return fmt.Sprintf("%d written", len(changed)), writeAll(repo, scratch, copies, changed)
	}); err != nil {
		return nil, err
	}
	said := fmt.Sprintf("%d written", len(changed))
	if len(reports) > 0 {
		said += ", " + reportLine(reports)
	}
	r.Done(said, "x lane commit <msg> -- <paths>")
	return ordered{{"written", changed}, {"mods", reports}}, nil
}

/* the plan */

// a file reaches the mod only when it was pulled or named with --add, and only when its target is as it was pulled
func modsPushPlan(repo, scratch string, changed, added []string) error {
	pulled := readPulled(scratch)
	for _, path := range changed {
		if _, ok := modOf(path); !ok {
			return &Fail{Refused: true, Msg: path + " is not under " + modsDir + "<mod>/; nothing written", Next: "x mods edit status"}
		}
		if !slices.Contains(pulled, path) && !slices.Contains(added, path) {
			return &Fail{Refused: true, Msg: path + " was never pulled; nothing written", Next: "x mods edit push --add " + path}
		}
		target := filepath.Join(repo, path)
		base, err := os.ReadFile(filepath.Join(scratch, scratchBase, path))
		now, nowErr := os.ReadFile(target)
		switch {
		case err != nil && nowErr == nil:
			return &Fail{Refused: true, Msg: path + " exists in the repo but was never pulled; nothing written", Next: "x mods edit pull " + path}
		case err == nil && nowErr != nil:
			return &Fail{Refused: true, Msg: path + " is gone from the repo since the pull; nothing written", Next: "x mods edit pull " + path}
		case err == nil && !bytes.Equal(base, now):
			return &Fail{Refused: true, Msg: path + " changed in the repo since the pull; nothing written", Next: "x mods edit pull " + path}
		}
	}
	return nil
}

// every target is backed up before the first write; a failed write puts back each one already written. it lands as the
// commit's format step leaves it, so a later overlay of this mod reads what the commit holds
func writeAll(repo, scratch string, copies *formattedCopies, changed []string) error {
	type was struct {
		path  string
		body  []byte
		isNew bool
	}
	var written []was
	for _, path := range changed {
		target := filepath.Join(repo, path)
		body, err := os.ReadFile(target)
		prior := was{path: target, body: body, isNew: errors.Is(err, fs.ErrNotExist)}
		if err := copyFile(copies.path(path), target); err != nil {
			restoreErr := error(nil)
			for _, w := range written {
				if w.isNew {
					restoreErr = errors.Join(restoreErr, os.Remove(w.path))
				} else {
					restoreErr = errors.Join(restoreErr, os.WriteFile(w.path, w.body, 0o644))
				}
			}
			return &Fail{Msg: fmt.Sprintf("writing %s failed, %d written before it restored: %v", path, len(written), errors.Join(err, restoreErr)),
				Next: "x mods edit status"}
		}
		written = append(written, prior)
	}
	for _, path := range changed {
		target, copied := filepath.Join(repo, path), filepath.Join(scratch, path)
		if err := copyFile(target, filepath.Join(scratch, scratchBase, path)); err != nil {
			return err
		}
		// a save since the format stays in scratch, an edit still to land
		if now, err := os.ReadFile(copied); err == nil && bytes.Equal(now, copies.raw[path]) {
			if err := copyFile(target, copied); err != nil {
				return err
			}
		}
	}
	return nil
}

/* the overlay */

// every pre-commit gate the overlay's paths match, on a temp index of HEAD and the overlay; a green records only bytes the
// tests read, so a save after the stamp and a red test record nothing
func overlayGates(repo, scratch string, copies *formattedCopies, changed []string, stamp string, testsGreen bool) ([]gateVerdict, error) {
	gates, err := readHookGates(repo, "pre-commit")
	if err != nil || len(gates) == 0 || len(changed) == 0 {
		return nil, err
	}
	env, treeOf, done, err := headIndex(repo)
	if err != nil {
		return nil, err
	}
	defer done()
	if err := layCopies(repo, changed, env, copies.path); err != nil {
		return nil, err
	}
	staged, err := indexPaths(repo, env)
	if err != nil {
		return nil, err
	}
	verdicts := runPreCommit(repo, gates, staged, env, func(g hookGate) string {
		if g.commitOnly {
			return gateCommits
		}
		return ""
	})
	redClockReads(repo, gates, verdicts, changed, env)
	if gatesFail(verdicts, "", "") == nil && testsGreen && overlayStamp(repo, scratch, changed) == stamp {
		recordTree(repo, treeOf, gates, verdicts)
		recordTestedMods(repo, copies, changed)
	}
	return verdicts, nil
}

// every byte an overlay test would read: the touched mods' files with the edited copies laid over
func overlayStamp(repo, scratch string, changed []string) string {
	sources := map[string]string{}
	for _, mod := range touchedMods(changed) {
		root := filepath.Join(repo, modsDir, mod)
		_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err == nil && !d.IsDir() {
				rel, _ := filepath.Rel(repo, path)
				sources[filepath.ToSlash(rel)] = path
			}
			return nil
		})
	}
	for _, path := range changed {
		sources[path] = filepath.Join(scratch, path)
	}
	hash := sha256.New()
	for _, path := range slices.Sorted(maps.Keys(sources)) {
		body, _ := os.ReadFile(sources[path])
		fmt.Fprintf(hash, "%s %d\n", path, len(body))
		hash.Write(body)
	}
	return fmt.Sprintf("%x", hash.Sum(nil))
}

type modReport struct {
	Mod      string   `json:"mod"`
	Validate string   `json:"validate"`
	Failed   []string `json:"failed,omitempty"`
	Errored  []string `json:"errored,omitempty"`
	Passed   int      `json:"passed"`
	log      string
}

func (m modReport) isRed() bool { return m.Validate != "ok" || len(m.Failed)+len(m.Errored) > 0 }

// each touched mod is copied to the job tmp with the edited copies laid over it as the commit's format step leaves them, then
// validated, then tested, so its green proves the bytes a commit holds; a named test file narrows the run to its mod and that one file
func overlayTest(repo string, copies *formattedCopies, changed []string, only string) ([]modReport, error) {
	var reports []modReport
	mods := touchedMods(changed)
	if only != "" {
		mods = touchedMods([]string{only})
	}
	for _, mod := range mods {
		dir, err := os.MkdirTemp("", "x-mods-overlay-")
		if err != nil {
			return nil, err
		}
		defer os.RemoveAll(dir)
		overlay := filepath.Join(dir, mod)
		if err := os.CopyFS(overlay, os.DirFS(filepath.Join(repo, modsDir, mod))); err != nil {
			return nil, err
		}
		for _, path := range changed {
			if m, _ := modOf(path); m == mod {
				rel := strings.TrimPrefix(filepath.ToSlash(path), modsDir+mod+"/")
				if err := copyFile(copies.path(path), filepath.Join(overlay, rel)); err != nil {
					return nil, err
				}
			}
		}
		if only != "" {
			keep := strings.TrimPrefix(only, modsDir+mod+"/")
			if err := setAsideTestsBut(overlay, func(rel string) bool { return rel == keep }); err != nil {
				return nil, err
			}
		}
		report := modReport{Mod: mod, Validate: "ok"}
		// the validator reads the hooks module as the engine will: a parse error is red before any test runs (PK-64)
		if got, _ := run("", nil, "", "claude", "plugin", "validate", overlay); !got.ok {
			report.Validate = firstErrorLine(got.log)
			report.log = got.log
			reports = append(reports, report)
			continue
		}
		got, _ := run("", nil, "", "claude", "plugin", "test", overlay)
		log := got.log
		report.Passed, report.Failed, report.Errored = testOutcome(log)
		if !got.ok && timeoutOnly(log) && testTally.MatchString(log) {
			again, kept, err := runTimedOutFiles(overlay, log)
			if err != nil {
				return nil, err
			}
			got = again
			log += "\n" + again.log
			passed, failed, errored := testOutcome(again.log)
			report.Passed, report.Failed, report.Errored = kept+passed, failed, errored
		}
		// the engine runs on past a throwing hook, so a test beside it still passes (`engine.md`)
		if skipped := hookSkipped.FindString(log); skipped != "" {
			report.Errored = append(report.Errored, skipped)
		}
		if !got.ok && len(report.Failed)+len(report.Errored) == 0 {
			report.Errored = []string{"claude plugin test exited red with no failing test named"}
		}
		report.log = log
		reports = append(reports, report)
	}
	return reports, nil
}

// only the files that timed out run again, as `mods/test.ts` does: a second whole run on a loaded machine times out other
// rows. the rest step aside in this throwaway overlay, so the kit does not find them; answers the second run and the
// passes of the files it left out
func runTimedOutFiles(overlay, log string) (result, int, error) {
	timedOut := map[string]bool{}
	passes := map[string]int{}
	file := ""
	for line := range strings.SplitSeq(log, "\n") {
		line = strings.TrimSpace(line)
		if m := testFileLine.FindStringSubmatch(line); m != nil {
			file = m[1]
		} else if testFailLine.MatchString(line) {
			timedOut[file] = true
		} else if testPassLine.MatchString(line) {
			passes[file]++
		}
	}
	kept := 0
	for name, n := range passes {
		if !timedOut[name] {
			kept += n
		}
	}
	if err := setAsideTestsBut(overlay, func(rel string) bool { return timedOut[rel] }); err != nil {
		return result{}, 0, err
	}
	got, _ := run("", nil, "", "claude", "plugin", "test", overlay)
	return got, kept, nil
}

// claude plugin test takes only a folder, so a test file steps aside in the throwaway overlay for the kit not to find it
func setAsideTestsBut(overlay string, keep func(rel string) bool) error {
	return filepath.WalkDir(overlay, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !isTestFile(path) {
			return err
		}
		rel, err := filepath.Rel(overlay, path)
		if err != nil || keep(filepath.ToSlash(rel)) {
			return err
		}
		return os.Rename(path, path+".passed")
	})
}

// --against <ref>: the edited test files on the ref's mod, so a test that fails there proves it reads the change
func againstRef(r *Run, repo, scratch string, changed []string, ref string) (any, error) {
	var tests []string
	for _, path := range changed {
		if _, ok := modOf(path); ok && strings.Contains(filepath.ToSlash(path), "/tests/") {
			tests = append(tests, path)
		}
	}
	if len(tests) == 0 {
		return nil, &Fail{IsUsage: true, Msg: "no edited test file to run against " + ref, Next: "x mods edit status"}
	}
	var reports []modReport
	if err := r.Step("test", "the edited tests on "+ref+"'s mod", func() (string, error) {
		for _, mod := range touchedMods(tests) {
			dir, err := os.MkdirTemp("", "x-mods-against-")
			if err != nil {
				return "", err
			}
			defer os.RemoveAll(dir)
			archive, err := run(repo, nil, "", "git", "archive", "--format=tar", "-o", filepath.Join(dir, "ref.tar"), ref, modsDir+mod)
			if !archive.ok {
				return "", &Fail{Msg: "git archive " + ref + " failed: " + archive.log, Next: "git log -1 " + ref, Log: nonBlank(archive.log)}
			}
			if got, _ := run(dir, nil, "", "tar", "-xf", "ref.tar"); !got.ok || err != nil {
				return "", &Fail{Msg: "unpacking " + ref + " failed: " + got.log, Next: "x mods edit test"}
			}
			overlay := filepath.Join(dir, modsDir, mod)
			for _, path := range tests {
				if m, _ := modOf(path); m == mod {
					rel := strings.TrimPrefix(filepath.ToSlash(path), modsDir+mod+"/")
					if err := copyFile(filepath.Join(scratch, path), filepath.Join(overlay, rel)); err != nil {
						return "", err
					}
				}
			}
			got, _ := run("", nil, "", "claude", "plugin", "test", overlay)
			report := modReport{Mod: mod, Validate: "skipped"}
			report.Passed, report.Failed, report.Errored = testOutcome(got.log)
			reports = append(reports, report)
		}
		return reportLine(reports), nil
	}); err != nil {
		return nil, err
	}
	r.Done(reportLine(reports), "")
	return ordered{{"against", ref}, {"mods", reports}}, nil
}

/* claude plugin test's words */

var (
	hookSkipped  = regexp.MustCompile(`hook was skipped: .*`)
	testFileLine = regexp.MustCompile(`^(tests/\S+\.test\.tsx?):$`)
	testFailLine = regexp.MustCompile(`^\(fail\) (.+?)(?: \[[\d.]+ms\])?$`)
	testPassLine = regexp.MustCompile(`^\(pass\) `)
	// no tally: the run died partway, so files it never reached would read green on a rerun of the rest
	testTally = regexp.MustCompile(`(?m)^Ran \d+ tests? across`)
)

// a test file that cannot load is «errored», a test that runs and fails is «failed» (`(fail) the file did not load`)
func testOutcome(log string) (passed int, failed, errored []string) {
	file := ""
	for line := range strings.SplitSeq(log, "\n") {
		line = strings.TrimSpace(line)
		if m := testFileLine.FindStringSubmatch(line); m != nil {
			file = m[1]
			continue
		}
		if testPassLine.MatchString(line) {
			passed++
			continue
		}
		if m := testFailLine.FindStringSubmatch(line); m != nil {
			if m[1] == "the file did not load" {
				errored = append(errored, file)
			} else {
				failed = append(failed, m[1])
			}
		}
	}
	return passed, failed, errored
}

func firstErrorLine(log string) string {
	for line := range strings.SplitSeq(log, "\n") {
		if strings.Contains(line, "❯") && !strings.Contains(line, "calls:") && !strings.Contains(line, "author") {
			return strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "❯"))
		}
	}
	return "claude plugin validate failed"
}

func reportLine(reports []modReport) string {
	var parts []string
	for _, m := range reports {
		switch {
		case m.Validate != "ok" && m.Validate != "skipped":
			parts = append(parts, m.Mod+": "+m.Validate)
		case len(m.Failed)+len(m.Errored) > 0:
			parts = append(parts, fmt.Sprintf("%s: %d failed (%s), %d errored (%s)", m.Mod, len(m.Failed), strings.Join(m.Failed, "; "),
				len(m.Errored), strings.Join(m.Errored, "; ")))
		default:
			parts = append(parts, fmt.Sprintf("%s: %d pass", m.Mod, m.Passed))
		}
	}
	return strings.Join(parts, " · ")
}

func redReports(reports []modReport) []modReport {
	var red []modReport
	for _, m := range reports {
		if m.isRed() {
			red = append(red, m)
		}
	}
	return red
}

func redLog(reports []modReport) string {
	var logs []string
	for _, m := range reports {
		logs = append(logs, m.log)
	}
	return strings.Join(logs, "\n")
}

/* scratch */

func touchedMods(paths []string) []string {
	var mods []string
	for _, path := range paths {
		if mod, ok := modOf(path); ok && !slices.Contains(mods, mod) {
			mods = append(mods, mod)
		}
	}
	return mods
}

// every scratch file whose bytes differ from its pulled base, or that has none
func changedScratch(scratch string) []string {
	var changed []string
	_ = filepath.WalkDir(scratch, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(scratch, path)
		if d.IsDir() {
			if rel == scratchBase {
				return filepath.SkipDir
			}
			return nil
		}
		if rel == scratchPulled || rel == scratchTested {
			return nil
		}
		base, err := os.ReadFile(filepath.Join(scratch, scratchBase, rel))
		body, _ := os.ReadFile(path)
		if err != nil || !bytes.Equal(base, body) {
			changed = append(changed, filepath.ToSlash(rel))
		}
		return nil
	})
	return changed
}

func modsRepoPath(repo, arg string) (string, error) {
	cwd, _ := os.Getwd()
	return modPathFrom(cwd, repo, arg)
}

// a relative arg reads from base; the answer is the mod's path from the repo root
func modPathFrom(base, repo, arg string) (string, error) {
	abs := arg
	if !filepath.IsAbs(arg) {
		abs = filepath.Join(base, arg)
	}
	rel, err := filepath.Rel(repo, abs)
	if err != nil || strings.HasPrefix(rel, "..") {
		return "", &Fail{IsUsage: true, Msg: arg + " is outside " + repo, Next: "x mods edit pull " + modsDir + "<mod>/<file>"}
	}
	if _, ok := modOf(rel); !ok {
		return "", &Fail{IsUsage: true, Msg: arg + " is not under " + modsDir + "<mod>/", Next: "x mods edit pull " + modsDir + "<mod>/<file>"}
	}
	return filepath.ToSlash(rel), nil
}

func readPulled(scratch string) []string {
	body, _ := os.ReadFile(filepath.Join(scratch, scratchPulled))
	return slices.DeleteFunc(strings.Split(string(body), "\n"), func(s string) bool { return s == "" })
}

func writePulled(scratch string, paths []string) error {
	if err := os.MkdirAll(scratch, 0o755); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(scratch, scratchPulled), []byte(strings.Join(paths, "\n")+"\n"), 0o644)
}

func copyFile(from, to string) error {
	body, err := os.ReadFile(from)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
		return err
	}
	return os.WriteFile(to, body, 0o644)
}

func splitList(v any) []string {
	s, _ := v.(string)
	return slices.DeleteFunc(strings.Split(s, ","), func(p string) bool { return strings.TrimSpace(p) == "" })
}
