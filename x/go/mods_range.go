package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type rangeRow struct {
	Sha  string      `json:"sha"`
	Mods []modReport `json:"mods"`
}

// --range <base>..<head>: the whole suite at each commit of the range that touches a mod, on that commit's own bytes, for the review of a
// move batch. it reads no scratch, writes no stamp and runs no gate; a red commit does not stop the walk, so one run names every one
func testRange(r *Run, repo, spec string) (any, error) {
	base, head, ok := strings.Cut(spec, "..")
	if !ok || base == "" || head == "" || strings.HasPrefix(head, ".") {
		return nil, usageFail("--range reads <base>..<head>, two ends and two dots; got "+spec, "x mods edit test --range <base>..<head>")
	}
	listed, _ := run(repo, nil, "", "git", "rev-list", "--reverse", spec)
	if !listed.ok {
		return nil, &Fail{Msg: "git rev-list " + spec + " failed: " + listed.log, Next: "git log --oneline " + spec}
	}
	var rows []rangeRow
	var lines, red []string
	if err := r.Step("test", "the suite at each commit of "+spec, func() (string, error) {
		for sha := range strings.FieldsSeq(listed.out) {
			reports, err := testCommit(repo, sha)
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

// every mod the commit touches, tested on the commit's tracked files; a mod the commit deleted has nothing to test
func testCommit(repo, sha string) ([]modReport, error) {
	changed, _ := run(repo, nil, "", "git", "show", "--first-parent", "--format=", "--name-only", sha)
	if !changed.ok {
		return nil, &Fail{Msg: "git show " + sha + " failed: " + changed.log, Next: "git show --stat " + sha}
	}
	var reports []modReport
	for _, mod := range touchedMods(strings.Split(changed.out, "\n")) {
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
		report, err := testModOverlay(mod, overlay)
		if err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, nil
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
