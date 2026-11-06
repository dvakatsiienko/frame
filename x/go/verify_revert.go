package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"syscall"
)

const revertHelp = "x lane verify-tree --help"

// written before the first swap, gone after the restore: a killed x runs nothing deferred, so this is what the next run reads
type revertMarker struct {
	Pid   int      `json:"pid"`
	Head  string   `json:"head"`
	Base  string   `json:"base"`
	Files []string `json:"files"`
}

// the words after <head>, split at the dash; only --revert takes any
func revertArgs(args []string, flags Flags) (paths, command []string, err error) {
	dash, _ := flags[argsBeforeDash].(int)
	base, _ := flags["revert"].(string)
	stacked, _ := flags["stack"].(bool)
	if base == "" {
		if len(args) > 1 || dash >= 0 {
			return nil, nil, usageFail("only --revert takes more than <head>", revertHelp)
		}
		return nil, nil, nil
	}
	switch {
	case stacked:
		return nil, nil, usageFail("--revert runs on one head, not beside --stack", revertHelp)
	case strings.HasPrefix(base, "-"):
		return nil, nil, usageFail("--revert "+base+" is no commit", revertHelp)
	case dash < 2:
		return nil, nil, usageFail("--revert names the paths to swap before the --", revertHelp)
	case dash == len(args):
		return nil, nil, usageFail("--revert needs a test command after the --", revertHelp)
	}
	for _, path := range args[1:dash] {
		clean := filepath.ToSlash(filepath.Clean(path))
		if filepath.IsAbs(path) || clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
			return nil, nil, usageFail(path+" is no path inside the tree; name it from the tree's root, and never the whole tree", revertHelp)
		}
		paths = append(paths, clean)
	}
	return paths, args[dash:], nil
}

// the commit base's content comes from: where head forked, since a pr merging main moves main past it
func revertBase(main, base, head string) (string, error) {
	if _, err := mustGitIn(main, "fetch", "fetch", "-q", "origin", "main"); err != nil {
		return "", err
	}
	for _, candidate := range []string{"origin/" + base, base} {
		if !ok(gitIn(main, "rev-parse", "--verify", "--quiet", candidate+"^{commit}")) {
			continue
		}
		fork, err := mustGitIn(main, "merge-base", "merge-base", candidate, head)
		if err != nil {
			return "", err
		}
		if fork == head {
			return "", usageFail("head "+short(head)+" sits on "+base+": nothing to revert", revertHelp)
		}
		return fork, nil
	}
	return "", usageFail(base+" is no commit in this repo", revertHelp)
}

func filesAt(tree, rev string, paths []string) (map[string]bool, error) {
	listed, err := mustGitIn(tree, "ls-tree", append([]string{"--literal-pathspecs", "ls-tree", "-r", "-z", "--name-only", "--full-tree", rev, "--"}, paths...)...)
	if err != nil {
		return nil, err
	}
	files := map[string]bool{}
	for file := range strings.SplitSeq(listed, "\x00") {
		if file != "" {
			files[file] = true
		}
	}
	return files, nil
}

// every file the named paths reach on either side; a path on neither side refuses, naming it
func swapFiles(tree, fork, head string, paths []string) ([]string, error) {
	var files, lost []string
	for _, path := range paths {
		atFork, err := filesAt(tree, fork, []string{path})
		if err != nil {
			return nil, err
		}
		atHead, err := filesAt(tree, head, []string{path})
		if err != nil {
			return nil, err
		}
		if len(atFork)+len(atHead) == 0 {
			lost = append(lost, path)
		}
		for file := range atFork {
			files = append(files, file)
		}
		for file := range atHead {
			files = append(files, file)
		}
	}
	if len(lost) > 0 {
		return nil, &Fail{Refused: true, Msg: strings.Join(lost, ", ") + " on neither " + short(fork) + " nor " + short(head), Next: "git -C " + tree + " diff --stat " + short(fork) + " " + short(head)}
	}
	slices.Sort(files)
	return slices.Compact(files), nil
}

// the files hold rev's content: removals first, since a file on one side can be a dir on the other
func swapTo(tree, rev string, files []string) error {
	present, err := filesAt(tree, rev, files)
	if err != nil {
		return err
	}
	var restore []string
	for _, file := range files {
		if present[file] {
			restore = append(restore, file)
			continue
		}
		path := filepath.Join(tree, file)
		if _, err := os.Lstat(path); err != nil {
			continue
		}
		if err := os.Remove(path); err != nil {
			return &Fail{Msg: "removing " + file + " failed: " + err.Error(), Next: "git -C " + tree + " status"}
		}
		for dir := filepath.Dir(file); dir != "."; dir = filepath.Dir(dir) {
			if os.Remove(filepath.Join(tree, dir)) != nil {
				break
			}
		}
	}
	if len(restore) == 0 {
		return nil
	}
	got, _ := run(tree, nil, strings.Join(restore, "\x00"), "git", "--literal-pathspecs", "restore", "--source="+rev, "--worktree", "--pathspec-from-file=-", "--pathspec-file-nul")
	if !got.ok {
		return &Fail{Msg: "git restore from " + short(rev) + " failed", Next: "git -C " + tree + " status", Log: nonBlank(got.log)}
	}
	return nil
}

func markerPath(tree string) (string, error) {
	dir, err := mustGitIn(tree, "rev-parse", "rev-parse", "--absolute-git-dir")
	return filepath.Join(dir, "x-verify-revert.json"), err
}

func blobAt(tree, rev, file string) string {
	got, _ := gitIn(tree, "rev-parse", "--verify", "--quiet", rev+":"+file)
	return got.out
}

// a run killed mid-swap left this tree on base's source: head comes back, or the file holding neither side is named
func recoverRevert(tree string) error {
	path, err := markerPath(tree)
	if err != nil {
		return err
	}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var marker revertMarker
	if err := json.Unmarshal(raw, &marker); err != nil {
		return &Fail{Refused: true, Msg: path + " is no marker this x wrote: " + err.Error(), Next: "git -C " + tree + " status"}
	}
	if err := syscall.Kill(marker.Pid, 0); err == nil || errors.Is(err, syscall.EPERM) {
		return &Fail{Refused: true, Msg: fmt.Sprintf("a --revert run, pid %d, holds %s on base's source", marker.Pid, tree), Next: "wait for it to end, then run this again"}
	}
	var neither []string
	for _, file := range marker.Files {
		disk := ""
		if exists(filepath.Join(tree, file)) {
			hashed, err := mustGitIn(tree, "hash-object", "hash-object", "--path="+file, "--", file)
			if err != nil {
				return err
			}
			disk = hashed
		}
		if disk != blobAt(tree, marker.Head, file) && disk != blobAt(tree, marker.Base, file) {
			neither = append(neither, file)
		}
	}
	if len(neither) > 0 {
		return &Fail{Refused: true, Msg: "a killed --revert run left " + tree + " swapped, and " + strings.Join(neither, ", ") + " holds neither head's nor base's content; it stays as it is",
			Next: "put it back to head's content, then run this again"}
	}
	if err := swapTo(tree, marker.Head, marker.Files); err != nil {
		return err
	}
	return os.Remove(path)
}

// the names head's test files add outside the swapped paths: what the run must prove
func newTestNames(tree, fork, head string, swapped []string) []string {
	got, _ := gitIn(tree, "diff", "-U0", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", fork, head)
	var names []string
	isTest := false
	for line := range strings.SplitSeq(got.out, "\n") {
		if file, isHeader := strings.CutPrefix(line, "+++ "); isHeader {
			file = strings.TrimPrefix(file, "b/")
			isTest = testFile.MatchString(file) && !slices.Contains(swapped, file)
			continue
		}
		if !isTest {
			continue
		}
		if name := addedTestNameIn(line); name != "" && !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	return names
}

func sourceHolds(tree string, files []string) func(string) bool {
	return func(symbol string) bool {
		word := regexp.MustCompile(`(^|[^\w$])` + regexp.QuoteMeta(symbol) + `($|[^\w$])`)
		for _, file := range files {
			if body, err := os.ReadFile(filepath.Join(tree, file)); err == nil && word.Match(body) {
				return true
			}
		}
		return false
	}
}

func revertRun(r *Run, main, tree, head, base string, paths, command []string) (any, error) {
	fork, err := revertBase(main, base, head)
	if err != nil {
		return nil, err
	}
	files, err := swapFiles(tree, fork, head, paths)
	if err != nil {
		return nil, err
	}
	baseline, err := mustGitIn(tree, "status", "status", "--porcelain", "--untracked-files=no")
	if err != nil {
		return nil, err
	}
	marker, err := markerPath(tree)
	if err != nil {
		return nil, err
	}
	swapped := []string{}
	for _, file := range files {
		if !testFile.MatchString(file) {
			swapped = append(swapped, file)
		}
	}
	newTests := newTestNames(tree, fork, head, files)

	if err := r.Step("swap", "base's content into the named paths", func() (string, error) {
		raw, err := json.Marshal(revertMarker{os.Getpid(), head, fork, files})
		if err == nil {
			err = os.WriteFile(marker, raw, 0o644)
		}
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%d files on %s", len(files), short(fork)), swapTo(tree, fork, files)
	}); err != nil {
		// the marker is written: the deferred restore below never armed, so this path restores by hand
		return nil, errors.Join(err, restoreHead(r, tree, head, marker, files, baseline))
	}

	var verdict string
	var rows []testRow
	var output string
	var restoreErr error
	func() {
		defer func() { restoreErr = restoreHead(r, tree, head, marker, files, baseline) }()
		_ = r.Step("test", strings.Join(command, " "), func() (string, error) {
			got, _ := run(tree, nil, "", command[0], command[1:]...)
			output = got.log
			verdict, rows = judgeRun(got.log, got.ok, newTests, sourceHolds(tree, swapped))
			if verdict != verdictRed {
				return "", notHeld(verdict)
			}
			return verdict, nil
		})
	}()
	if restoreErr != nil {
		return nil, restoreErr
	}
	lines := make([]string, len(rows))
	for i, row := range rows {
		lines[i] = ui.fg.Render(row.Verdict + "  " + row.Name)
	}
	r.Show(lines, nameCell+2)
	data := ordered{{"tree", tree}, {"sha", head}, {"base", fork}, {"verdict", verdict}, {"tests", rows}}
	if verdict != verdictRed {
		return nil, &Fail{Refused: true, Msg: "no proof: " + rowsLine(rows), Next: "read the test's output above; it must fail on an assertion on " + short(fork) + "'s source", Log: nonBlank(output), Data: data}
	}
	r.Done(rowsLine(rows)+" on "+short(fork)+"'s source; "+tree+" back on "+short(head), "cd "+tree)
	return data, nil
}

func rowsLine(rows []testRow) string {
	var parts []string
	for _, verdict := range []string{verdictRed, verdictStillGreen, verdictBroken, verdictFailed} {
		var names []string
		for _, row := range rows {
			if row.Verdict == verdict {
				names = append(names, row.Name)
			}
		}
		if len(names) > 0 {
			parts = append(parts, fmt.Sprintf("%d %s: %s", len(names), verdict, strings.Join(names, ", ")))
		}
	}
	if len(parts) == 0 {
		return "no new test named and no test failed"
	}
	return strings.Join(parts, "; ")
}

// the proof the restore held is git's own compare against the state before the swap
func restoreHead(r *Run, tree, head, marker string, files []string, baseline string) error {
	return r.Step("restore", "head's content back", func() (string, error) {
		if err := swapTo(tree, head, files); err != nil {
			return "", err
		}
		status, err := mustGitIn(tree, "status", "status", "--porcelain", "--untracked-files=no")
		if err != nil {
			return "", err
		}
		// the named paths are back, so the marker has done its job; what still differs is the command's own write
		if err := os.Remove(marker); err != nil {
			return "", err
		}
		if status != baseline {
			return "", &Fail{Msg: tree + " differs from before the run: " + status, Next: "git -C " + tree + " status", Log: nonBlank(status)}
		}
		return "the porcelain compare holds", nil
	})
}
