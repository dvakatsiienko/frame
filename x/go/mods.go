package main

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

// a live mod loads from the main checkout and reloads in every session at its next turn end, so it is edited in a
// scratch copy and lands only when its overlay validates and tests green, all files or none (FRM-388)
const modsDir = "home/.claude/plugin-x/mods/"

// the scratch root holds each copy at its repo path, `.base/` the bytes it was pulled at, `.pulled` the pulled paths
const (
	scratchBase   = ".base"
	scratchPulled = ".pulled"
)

func scratchRoot(repo string) string {
	dir := os.TempDir()
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
	r.Done(fmt.Sprintf("%d edited", len(changed)), "x mods edit test")
	return ordered{{"edited", changed}, {"scratch", scratch}}, nil
}

// test lays the edited copies over a copy of each touched mod and runs the validator and the mod's tests on it;
// --against HEAD runs only the edited tests on HEAD's mod instead
func modsEditTest(r *Run, _ []string, flags Flags) (any, error) {
	repo, scratch, err := modsRepo()
	if err != nil {
		return nil, err
	}
	changed := changedScratch(scratch)
	r.Open(fmt.Sprintf("%d edited", len(changed)))
	if against, _ := flags["against"].(string); against != "" {
		return againstRef(r, repo, scratch, changed, against)
	}
	var reports []modReport
	if err := r.Step("test", "validate and test on an overlay copy", func() (string, error) {
		reports, err = overlayTest(repo, scratch, changed)
		return reportLine(reports), err
	}); err != nil {
		return nil, err
	}
	if red := redReports(reports); len(red) > 0 {
		return nil, &Fail{Msg: "red on the overlay: " + reportLine(red), Next: "x mods edit test", Log: nonBlank(redLog(red))}
	}
	r.Done(reportLine(reports), "x mods edit push")
	return ordered{{"mods", reports}}, nil
}

func modsEditPush(r *Run, _ []string, flags Flags) (any, error) {
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
		return fmt.Sprintf("%d to write", len(changed)), modsPushPlan(repo, scratch, changed, added)
	}); err != nil {
		return nil, err
	}
	var reports []modReport
	if err := r.Step("test", "validate and test on an overlay copy", func() (string, error) {
		reports, err = overlayTest(repo, scratch, changed)
		if red := redReports(reports); err == nil && len(red) > 0 {
			err = &Fail{Refused: true, Msg: "red on the overlay, nothing written: " + reportLine(red), Next: "x mods edit test", Log: nonBlank(redLog(red))}
		}
		return reportLine(reports), err
	}); err != nil {
		return nil, err
	}
	if err := r.Step("write", "all or nothing, restored from a backup on a failed write", func() (string, error) {
		return fmt.Sprintf("%d written", len(changed)), writeAll(repo, scratch, changed)
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%d written, %s", len(changed), reportLine(reports)), "x lane commit <msg> -- <paths>")
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

// every target is backed up before the first write; a failed write puts back each one already written
func writeAll(repo, scratch string, changed []string) error {
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
		if err := copyFile(filepath.Join(scratch, path), target); err != nil {
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
		if err := copyFile(filepath.Join(scratch, path), filepath.Join(scratch, scratchBase, path)); err != nil {
			return err
		}
	}
	return nil
}

/* the overlay */

type modReport struct {
	Mod      string   `json:"mod"`
	Validate string   `json:"validate"`
	Failed   []string `json:"failed,omitempty"`
	Errored  []string `json:"errored,omitempty"`
	Passed   int      `json:"passed"`
	log      string
}

func (m modReport) isRed() bool { return m.Validate != "ok" || len(m.Failed)+len(m.Errored) > 0 }

// each touched mod is copied to the job tmp with the edited copies laid over it, then validated, then tested
func overlayTest(repo, scratch string, changed []string) ([]modReport, error) {
	var reports []modReport
	for _, mod := range touchedMods(changed) {
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
				if err := copyFile(filepath.Join(scratch, path), filepath.Join(overlay, rel)); err != nil {
					return nil, err
				}
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
		report.Passed, report.Failed, report.Errored = testOutcome(got.log)
		if !got.ok && len(report.Failed)+len(report.Errored) == 0 {
			report.Errored = []string{"claude plugin test exited red with no failing test named"}
		}
		report.log = got.log
		reports = append(reports, report)
	}
	return reports, nil
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
	testFileLine = regexp.MustCompile(`^(tests/\S+\.test\.tsx?):$`)
	testFailLine = regexp.MustCompile(`^\(fail\) (.+?)(?: \[[\d.]+ms\])?$`)
	testPassLine = regexp.MustCompile(`^\(pass\) `)
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
		if rel == scratchPulled {
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
	abs := arg
	if !filepath.IsAbs(arg) {
		cwd, _ := os.Getwd()
		abs = filepath.Join(cwd, arg)
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
