package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

type rangeRow struct {
	Sha  string      `json:"sha"`
	Mods []modReport `json:"mods"`
}

// --range <base>..<head>: for the review of a move batch, on each commit's own bytes. the whole suite runs at the head, for every mod
// the range touched; each earlier commit runs only the test files its own diff touches (a test file it changed, or the test a changed
// hooks file names), and one touching none is skipped and said: a whole suite a commit is 25 min of the machine's cores (FRM-662).
// it reads no scratch, writes no stamp and runs no gate; a red commit does not stop the walk, so one run names every one
func testRange(r *Run, repo, spec string) (any, error) {
	base, head, ok := strings.Cut(spec, "..")
	if !ok || base == "" || head == "" || strings.HasPrefix(base, "-") || strings.HasPrefix(head, "-") || strings.HasPrefix(head, ".") {
		return nil, usageFail("--range reads <base>..<head>, two ends and two dots, never an option; got "+spec, "x mods edit test --range <base>..<head>")
	}
	listed, _ := run(repo, nil, "", "git", "rev-list", "--reverse", spec)
	if !listed.ok {
		return nil, &Fail{Msg: "git rev-list " + spec + " failed: " + listed.log, Next: "git log --oneline " + spec}
	}
	commits := strings.Fields(listed.out)
	spanned, _ := run(repo, nil, "", "git", "diff", "--name-only", base, head)
	if !spanned.ok {
		return nil, &Fail{Msg: "git diff " + spec + " failed: " + spanned.log, Next: "git log --oneline " + spec}
	}
	rangeMods := touchedMods(strings.Split(spanned.out, "\n"))
	var rows []rangeRow
	var lines, red []string
	if err := r.Step("test", "the head's suite and each commit's own tests in "+spec, func() (string, error) {
		for i, sha := range commits {
			var whole []string
			if i == len(commits)-1 {
				whole = rangeMods
			}
			reports, err := testCommit(repo, sha, whole)
			if err != nil {
				return "", err
			}
			if len(reports) == 0 {
				continue
			}
			rows = append(rows, rangeRow{sha[:7], reports})
			line := sha[:7] + ": " + reportLine(reports)
			lines = append(lines, line)
			if len(redReports(reports)) > 0 {
				red = append(red, line)
			}
			if !r.human {
				fmt.Fprintln(os.Stderr, line)
			}
		}
		if len(rows) == 0 {
			return "", &Fail{Refused: true, Msg: "no commit in " + spec + " touches a mod, so nothing ran", Next: "x mods edit test"}
		}
		if len(red) > 0 {
			return "", &Fail{Msg: fmt.Sprintf("red at %d of %d commits: %s", len(red), len(rows), strings.Join(red, "; ")), Next: "x mods edit test --range " + spec, Log: lines}
		}
		return fmt.Sprintf("%d commits green", len(rows)), nil
	}); err != nil {
		return nil, err
	}
	if r.human {
		r.Show(lines, inset)
	}
	r.Done(fmt.Sprintf("%d commits green", len(rows)), "")
	return ordered{{"range", spec}, {"commits", rows}}, nil
}

// the mods `whole` names get their whole suite on the commit's tracked files (the head); otherwise every mod the commit touches runs
// the test files its diff points at. a mod the commit deleted has nothing to test
func testCommit(repo, sha string, whole []string) ([]modReport, error) {
	changed, _ := run(repo, nil, "", "git", "show", "--first-parent", "--format=", "--name-only", sha)
	if !changed.ok {
		return nil, &Fail{Msg: "git show " + sha + " failed: " + changed.log, Next: "git show --stat " + sha}
	}
	paths := strings.Split(changed.out, "\n")
	mods := touchedMods(paths)
	if whole != nil {
		mods = whole
	}
	var reports []modReport
	for _, mod := range mods {
		if there, _ := run(repo, nil, "", "git", "ls-tree", "--name-only", sha, "--", modsDir+mod); there.out == "" {
			continue
		}
		dir, err := os.MkdirTemp("", "x-mods-range-")
		if err != nil {
			return nil, err
		}
		defer os.RemoveAll(dir)
		overlay, err := modAtRef(repo, dir, sha, mod)
		if err != nil {
			return nil, err
		}
		// git holds none of the engine's types, a mod's node_modules or its tsconfig.json (the repo ignores them), so the checkout's own ride along
		for _, ignored := range []string{".claude-plugin/types", "node_modules", "tsconfig.json"} {
			src := filepath.Join(repo, modsDir, mod, ignored)
			switch info, err := os.Stat(src); {
			case err != nil:
			case info.IsDir():
				if err := os.CopyFS(filepath.Join(overlay, ignored), os.DirFS(src)); err != nil {
					return nil, err
				}
			default:
				if err := copyFile(src, filepath.Join(overlay, ignored)); err != nil {
					return nil, err
				}
			}
		}
		if whole != nil {
			report, err := testModOverlay(mod, overlay, true)
			if err != nil {
				return nil, err
			}
			reports = append(reports, report)
			continue
		}
		picked := testsOfDiff(paths, mod, overlay)
		if len(picked) == 0 {
			reports = append(reports, modReport{Mod: mod, Validate: "ok", NoTests: true})
			continue
		}
		if err := setAsideTestsBut(overlay, func(rel string) bool { return slices.Contains(picked, rel) }); err != nil {
			return nil, err
		}
		report, err := testModOverlay(mod, overlay, false)
		if err != nil {
			return nil, err
		}
		report.Only = picked
		reports = append(reports, report)
	}
	return reports, nil
}

// the test files (relative to the mod) a commit's diff points at: each test file it changed, and for each hooks file it changed the
// test file that carries its name (hooks/<name>.ts → <name>.test.ts anywhere under the mod); only files the overlay holds
func testsOfDiff(paths []string, mod, overlay string) []string {
	prefix := modsDir + mod + "/"
	var stems, picked []string
	for _, path := range paths {
		rel, ok := strings.CutPrefix(filepath.ToSlash(path), prefix)
		switch {
		case !ok:
		case isTestFile(rel):
			if exists(filepath.Join(overlay, rel)) {
				picked = append(picked, rel)
			}
		case strings.HasPrefix(rel, "hooks/") && (strings.HasSuffix(rel, ".ts") || strings.HasSuffix(rel, ".tsx")):
			stems = append(stems, strings.TrimSuffix(strings.TrimSuffix(filepath.Base(rel), ".tsx"), ".ts"))
		}
	}
	_ = filepath.WalkDir(overlay, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() || !isTestFile(path) {
			return err
		}
		rel, _ := filepath.Rel(overlay, path)
		name := strings.TrimSuffix(strings.TrimSuffix(filepath.Base(path), ".tsx"), ".ts")
		if slices.Contains(stems, strings.TrimSuffix(name, ".test")) {
			picked = append(picked, filepath.ToSlash(rel))
		}
		return nil
	})
	slices.Sort(picked)
	return slices.Compact(picked)
}

// a mod's tracked files at a ref, unpacked under dir; its path comes back
func modAtRef(repo, dir, ref, mod string) (string, error) {
	archive, _ := run(repo, nil, "", "git", "archive", "--format=tar", "-o", filepath.Join(dir, "ref.tar"), ref, modsDir+mod)
	if !archive.ok {
		return "", &Fail{Msg: "git archive " + ref + " failed: " + archive.log, Next: "git log -1 " + ref, Log: nonBlank(archive.log)}
	}
	if got, _ := run(dir, nil, "", "tar", "-xf", "ref.tar"); !got.ok {
		return "", &Fail{Msg: "unpacking " + ref + " failed: " + got.log, Next: "x mods edit test"}
	}
	return filepath.Join(dir, modsDir, mod), nil
}
