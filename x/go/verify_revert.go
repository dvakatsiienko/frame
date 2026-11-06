package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"syscall"
)

const revertHelp = "x lane verify-tree --help"

// the tree's claim, in its git dir: every run holds one. a run that swaps names its files here before the first swap, so a
// killed x, which runs nothing deferred, leaves the next run all it needs. pid and start time tell a live holder from a reused pid
type treeClaim struct {
	Pid     int      `json:"pid"`
	Started string   `json:"started"`
	Head    string   `json:"head,omitempty"`
	Base    string   `json:"base,omitempty"`
	Files   []string `json:"files,omitempty"`
}

func processStarted(pid int) string {
	got, _ := run("", nil, "", "ps", "-o", "lstart=", "-p", fmt.Sprint(pid))
	return strings.Join(strings.Fields(got.out), " ")
}

func claimPath(tree string) (string, error) {
	dir, err := mustGitIn(tree, "rev-parse", "rev-parse", "--absolute-git-dir")
	return filepath.Join(dir, "x-verify-tree-claim.json"), err
}

func writeTemp(path string, claim treeClaim) (string, error) {
	raw, err := json.Marshal(claim)
	if err != nil {
		return "", err
	}
	temp := fmt.Sprintf("%s.%d", path, os.Getpid())
	return temp, os.WriteFile(temp, raw, 0o644)
}

// a file lock serialises every run's look at the claim, so two runs never both read a dead holder and restore over each other
func claimTree(tree string) (release func(), err error) {
	path, err := claimPath(tree)
	if err != nil {
		return nil, err
	}
	lock, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0o644)
	if err != nil {
		return nil, err
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return nil, err
	}
	if err := recoverKilledRun(tree, path); err != nil {
		return nil, err
	}
	temp, err := writeTemp(path, treeClaim{Pid: os.Getpid(), Started: processStarted(os.Getpid())})
	if err == nil {
		err = os.Rename(temp, path)
	}
	if err != nil {
		return nil, err
	}
	return func() { releaseClaim(path) }, nil
}

// a claim still naming files means the restore failed: it stays, so the next run restores from it
func releaseClaim(path string) {
	var claim treeClaim
	if raw, err := os.ReadFile(path); err == nil && json.Unmarshal(raw, &claim) == nil && len(claim.Files) == 0 {
		_ = os.Remove(path)
	}
}

// a holder that may be alive: only a process that is gone, or one started later under the same pid, reads as dead, so a
// failing ps never hands over a live swap
func holderAlive(claim treeClaim) bool {
	if err := syscall.Kill(claim.Pid, 0); err != nil && !errors.Is(err, syscall.EPERM) {
		return false
	}
	started := processStarted(claim.Pid)
	return started == "" || started == claim.Started
}

// the holder is alive: refuse. it is dead: its swap, if any, goes back to head, and its claim goes
func recoverKilledRun(tree, path string) error {
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var claim treeClaim
	if err := json.Unmarshal(raw, &claim); err != nil {
		return &Fail{Refused: true, Msg: path + " is no claim this x wrote: " + err.Error(), Next: "trash " + path}
	}
	if holderAlive(claim) {
		return &Fail{Refused: true, Msg: fmt.Sprintf("a run, pid %d, holds %s", claim.Pid, tree), Next: "wait for it to end, then run this again"}
	}
	if len(claim.Files) > 0 {
		if err := restoreKilledSwap(tree, claim); err != nil {
			return err
		}
	}
	return os.Remove(path)
}

func restoreKilledSwap(tree string, claim treeClaim) error {
	var neither []string
	for _, file := range claim.Files {
		disk, err := blobOnDisk(tree, file)
		if err != nil || (disk != blobAt(tree, claim.Head, file) && disk != blobAt(tree, claim.Base, file)) {
			neither = append(neither, file)
		}
	}
	if len(neither) > 0 {
		return &Fail{Refused: true, Msg: "a killed --revert run left " + tree + " swapped, and " + strings.Join(neither, ", ") + " holds neither head's nor base's content; it stays as it is",
			Next: "put it back to head's content, then run this again; or trash the tree and run git worktree prune"}
	}
	return swapTo(tree, claim.Head, claim.Files)
}

// a link hashes as its target's text, as git stores it; a dir stands in the place of a file only when that side has none
func blobOnDisk(tree, file string) (string, error) {
	path := filepath.Join(tree, file)
	info, err := os.Lstat(path)
	switch {
	case err != nil || info.IsDir():
		return "", nil
	case info.Mode()&fs.ModeSymlink != 0:
		target, err := os.Readlink(path)
		if err != nil {
			return "", err
		}
		got, err := run(tree, nil, target, "git", "hash-object", "--no-filters", "--stdin")
		return got.out, err
	}
	return mustGitIn(tree, "hash-object", "--literal-pathspecs", "hash-object", "--path="+file, "--", file)
}

// the blob a side holds at this path; a side with a dir there holds none
func blobAt(tree, rev, file string) string {
	got, _ := gitIn(tree, "--literal-pathspecs", "ls-tree", "--full-tree", rev, "--", file)
	fields := strings.Fields(got.out)
	if len(fields) < 3 || fields[1] != "blob" {
		return ""
	}
	return fields[2]
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

// every file the named paths reach on either side; a path on neither side refuses, naming it, and so does a file only this
// tree holds where the swap would write base's file, since the swap or its restore would delete it unseen
func swapFiles(tree, fork, head string, paths []string) ([]string, error) {
	var files, onFork, lost []string
	onHead := map[string]bool{}
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
			onFork = append(onFork, file)
		}
		for file := range atHead {
			files = append(files, file)
			onHead[file] = true
		}
	}
	if len(lost) > 0 {
		return nil, &Fail{Refused: true, Msg: strings.Join(lost, ", ") + " on neither " + short(fork) + " nor " + short(head), Next: "git -C " + tree + " diff --stat " + short(fork) + " " + short(head)}
	}
	slices.Sort(files)
	files = slices.Compact(files)
	var untracked []string
	for _, file := range onFork {
		_ = filepath.WalkDir(filepath.Join(tree, file), func(path string, entry fs.DirEntry, err error) error {
			if err == nil && !entry.IsDir() {
				rel, _ := filepath.Rel(tree, path)
				if rel = filepath.ToSlash(rel); !onHead[rel] {
					untracked = append(untracked, rel)
				}
			}
			return nil
		})
	}
	if len(untracked) > 0 {
		return nil, &Fail{Refused: true, Msg: "the swap would delete a file only this tree holds: " + strings.Join(untracked, ", "), Next: "move it out of the tree, then run this again"}
	}
	return files, nil
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
		info, err := os.Lstat(path)
		if err != nil || info.IsDir() {
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

// the names head's test files add outside the swapped paths: what the run must prove
func newTestNames(tree, fork, head string, swapped []string) []newTest {
	got, _ := gitIn(tree, "-c", "core.quotePath=false", "diff", "-U0", "--no-color", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/", fork, head)
	var tests []newTest
	file, added, removed := "", "", ""
	flush := func() {
		if testFile.MatchString(file) && !slices.Contains(swapped, file) {
			// a test whose call line changed, an async added or a describe around it, is no new test
			old := addedTestNames(removed, file)
			for _, test := range addedTestNames(added, file) {
				if !slices.Contains(old, test) && !slices.Contains(tests, test) {
					tests = append(tests, namedOnce(tree, head, test))
				}
			}
		}
		added, removed = "", ""
	}
	previous := ""
	for line := range strings.SplitSeq(got.out, "\n") {
		// only the line after a `--- ` header is a file: an added `++ x` prints the same way
		if name, isHeader := strings.CutPrefix(line, "+++ "); isHeader && strings.HasPrefix(previous, "--- ") {
			flush()
			file = strings.TrimPrefix(strings.Trim(strings.TrimRight(name, "\t"), `"`), "b/")
		} else if body, isAdded := strings.CutPrefix(line, "+"); isAdded {
			added += body + "\n"
		} else if body, isRemoved := strings.CutPrefix(line, "-"); isRemoved && !strings.HasPrefix(line, "--- ") {
			removed += body + "\n"
		}
		previous = line
	}
	flush()
	return tests
}

// go's output names no package beside a failure, and its import path need not be a dir: a test name another package also
// holds could be claimed by that package's red, so it never proves
func namedOnce(tree, head string, test newTest) newTest {
	if !strings.HasSuffix(test.File, ".go") {
		return test
	}
	got, _ := gitIn(tree, "grep", "-l", "-E", `^func (\([^)]*\) )?`+regexp.QuoteMeta(test.Name)+`\(`, head, "--", "*_test.go")
	dirs := map[string]bool{}
	for line := range strings.SplitSeq(got.out, "\n") {
		if _, path, found := strings.Cut(line, ":"); found {
			dirs[filepath.Dir(path)] = true
		}
	}
	if len(dirs) > 1 {
		test.IsUnread = true
		test.Why = "another package holds a test of this name, and go's output names no package beside a failure, so x cannot tell whose red this is"
	}
	return test
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
	path, err := claimPath(tree)
	if err != nil {
		return nil, err
	}
	newTests := newTestNames(tree, fork, head, files)
	report := func(verdict, output string, rows []testRow) (any, error) {
		lines := make([]string, len(rows))
		for i, row := range rows {
			lines[i] = ui.fg.Render(row.Verdict + "  " + row.Name)
		}
		r.Show(lines, nameCell+2)
		data := ordered{{"tree", tree}, {"sha", head}, {"base", fork}, {"verdict", verdict}, {"tests", rows}}
		if verdict != verdictRed {
			return nil, &Fail{Refused: true, Msg: "no proof: " + rowsLine(rows), Next: "read the test's output above; each new test must fail on an assertion on " + short(fork) + "'s source and pass on head", Log: nonBlank(output), Data: data}
		}
		r.Done(rowsLine(rows)+" on "+short(fork)+"'s source; "+tree+" back on "+short(head), "cd "+tree)
		return data, nil
	}

	command = inLongSlot(command)
	var verdict, output string
	var rows []testRow
	var onHead testOutput
	if err := r.Step("test-head", strings.Join(command, " "), func() (string, error) {
		got, _ := run(tree, nil, "", command[0], command[1:]...)
		output = withoutQueueLines(got.log)
		onHead = readTestOutput(output)
		if whole, why := wholeRunVerdict(onHead, got.ok); whole != "" {
			verdict, rows = whole, wholeRunRows(newTests, whole, "on head: "+why)
			return "", notHeld(whole)
		}
		return fmt.Sprintf("%d failed on head", len(onHead.failed)), sameAsBaseline(tree, baseline)
	}); err != nil {
		return nil, err
	}
	if verdict != "" {
		if err := sameAsBaseline(tree, baseline); err != nil {
			return nil, err
		}
		return report(verdict, output, rows)
	}

	mine := treeClaim{Pid: os.Getpid(), Started: processStarted(os.Getpid())}
	restore := func() error { return restoreHead(r, tree, head, path, mine, files, baseline) }
	if err := r.Step("swap", "base's content into the named paths", func() (string, error) {
		temp, err := writeTemp(path, treeClaim{mine.Pid, mine.Started, head, fork, files})
		if err == nil {
			err = os.Rename(temp, path)
		}
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("%d files on %s", len(files), short(fork)), swapTo(tree, fork, files)
	}); err != nil {
		return nil, errors.Join(err, restore())
	}

	var restoreErr error
	func() {
		defer func() { restoreErr = restore() }()
		_ = r.Step("test-base", strings.Join(command, " "), func() (string, error) {
			got, _ := run(tree, nil, "", command[0], command[1:]...)
			output = withoutQueueLines(got.log)
			verdict, rows = judgeRun(output, got.ok, newTests, onHead)
			if verdict != verdictRed {
				return "", notHeld(verdict)
			}
			return verdict, nil
		})
	}()
	if restoreErr != nil {
		return nil, restoreErr
	}
	return report(verdict, output, rows)
}

// a suite is a long round, so each run takes the queue's long slot; a test stays off the real slot unless it plants a queue
func inLongSlot(command []string) []string {
	if os.Getenv("X_TEST") != "" && os.Getenv("X_FRAME_ROOT") == "" {
		return command
	}
	return append([]string{filepath.Join(frameRoot(), "script/gate-queue.sh"), "--long"}, command...)
}

// the queue's wait lines name its holder's command, whose words are no test's; its deadline line stays, the only reason a run did not run
func withoutQueueLines(log string) string {
	var kept []string
	for line := range strings.SplitSeq(log, "\n") {
		if !strings.HasPrefix(line, "gate-queue: waiting ") && !strings.HasPrefix(line, "gate-queue: took the turn") {
			kept = append(kept, line)
		}
	}
	return strings.Join(kept, "\n")
}

func rowsLine(rows []testRow) string {
	var parts []string
	for _, verdict := range []string{verdictRed, verdictUnread, verdictRedOnHead, verdictStillGreen, verdictBroken, verdictFailed} {
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
	return strings.Join(parts, "; ")
}

// the proof the restore held is git's own compare against the state before the swap
func restoreHead(r *Run, tree, head, path string, mine treeClaim, files []string, baseline string) error {
	return r.Step("restore", "head's content back", func() (string, error) {
		if err := swapTo(tree, head, files); err != nil {
			return "", err
		}
		// the named paths are back, so the claim drops its files; what still differs is the command's own write
		temp, err := writeTemp(path, mine)
		if err == nil {
			err = os.Rename(temp, path)
		}
		if err != nil {
			return "", err
		}
		return "the porcelain compare holds", sameAsBaseline(tree, baseline)
	})
}

func sameAsBaseline(tree, baseline string) error {
	status, err := mustGitIn(tree, "status", "status", "--porcelain", "--untracked-files=no")
	if err != nil {
		return err
	}
	if status != baseline {
		return &Fail{Msg: tree + " differs from before the run: " + status, Next: "git -C " + tree + " status", Log: nonBlank(status)}
	}
	return nil
}
