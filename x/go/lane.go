package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	cryptMagic = []byte("\x00GITCRYPT\x00")
	modDir     = regexp.MustCompile(`^home/\.claude/plugin-x/mods/[^/]+/`)
	// only git's own lines: curl's over https, github's over ssh («remote: Internal Server Error», «[remote rejected] … (Internal Server
	// Error)»); a pre-push hook's words never match, and a 4xx is a refusal that a retry only repeats
	serverError = regexp.MustCompile(`(?im)requested URL returned error: 5\d\d\b|RPC failed; HTTP 5\d\d\b|^remote: (internal server error|bad gateway|service unavailable|gateway time-?out)\s*$|\[remote rejected\].*\((internal server error|bad gateway|service unavailable|gateway time-?out)\)`)
)

const (
	pushTries = 3
	pushPause = 2 * time.Second
	// a peer session's git holds the shared index lock for a moment; commit waits it out before add and commit
	lockWait  = 30 * time.Second
	lockPause = 200 * time.Millisecond
)

// the one door from core to an add-on, filled at the add-on's init; its zero value is the plain flow
var laneAddOn struct {
	// the branch a pr opens onto; "" keeps main
	prBase func(Flags) (string, error)
	// the layers a pr merges with; nil for a plain pr
	layersOf func(repo, n string, pr pullHead) (*prLayers, error)
	// lands a pr and every layer below it in one call
	mergeLayers func(repo, n, head string) (merged, sha string, err error)
	// one line per layer of the stack a pr tops, bottom-up: its pr, head and base
	stackShown func(repo, n string) ([]string, error)
}

// a pr that merges together with the layers under it
type prLayers struct {
	trunk string   // where every layer lands
	below []string // the open layers under the pr, bottom-up
	wait  string   // why it cannot merge now; "" lets the checks decide
}

/* Verbs */
func commit(r *Run, args []string, flags Flags) (any, error) {
	msgFile, paths := args[0], args[1:]
	// `-` takes the message on stdin, so no message file is kept or reused (a reused one glued two messages, 2026-10-14)
	if msgFile == "-" {
		piped, err := stdinMessage()
		if err != nil {
			return nil, err
		}
		defer os.Remove(piped)
		msgFile = piped
	}
	if _, err := os.Stat(msgFile); err != nil {
		return nil, usageFail("no message file at "+msgFile, "x lane commit <msg-file> -- <paths…>")
	}
	if len(paths) == 0 {
		return nil, usageFail("no paths — name what goes into the commit", "x lane commit "+msgFile+" -- <paths…>")
	}
	message, _ := filepath.Abs(msgFile)
	if repo, _ := flags["repo"].(string); repo != "" {
		if err := enterMain(repo); err != nil {
			return nil, err
		}
	}

	tree, err := top()
	if err != nil {
		return nil, err
	}
	// paths are written from the root; a cwd that drifted into a subdir would miss them
	if err := os.Chdir(tree); err != nil {
		return nil, err
	}
	name, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Open(name.out)

	if err := r.Step("tree", "checking the tree", func() (string, error) {
		return home(tree), assertUnlocked(tree)
	}); err != nil {
		return nil, err
	}
	if err := r.Step("holds", "the paths another session holds", func() (string, error) {
		if held := heldByOthers(tree, paths); len(held) > 0 {
			return "", heldFail(held, msgFile, paths)
		}
		return "none held by another session", nil
	}); err != nil {
		return nil, err
	}

	// a path gone from both the tree and the index (the old side of a mv) kills `add`,
	// so stage only what exists and let the index carry the removal
	var present []string
	for _, path := range paths {
		if exists(path) || ok(git("ls-files", "--error-unmatch", "--", path)) {
			present = append(present, path)
		} else if words := strings.Fields(path); len(words) > 1 && !ok(git("cat-file", "-e", "HEAD:"+path)) {
			// zsh hands a quoted "$paths" over as one argument; «nothing staged» hid that (2026-10-18)
			return nil, usageFail(fmt.Sprintf("%q names no file: the path list arrived as one word", path),
				"x lane commit "+msgFile+" -- "+strings.Join(words, " "))
		}
	}
	if err := r.Step("format", "biome on the named paths", func() (string, error) {
		return format(tree, onDisk(present)), nil
	}); err != nil {
		return nil, err
	}
	if err := r.Step("mods", "claude plugin validate", func() (string, error) {
		return validateMods(tree, present)
	}); err != nil {
		return nil, err
	}
	var waited time.Duration
	if err := r.Step("stage", "git add", func() (string, error) {
		if len(present) > 0 {
			added, took, err := lockedGit(append([]string{"add", "-A", "--"}, present...)...)
			waited += took
			if err != nil {
				return "", err
			}
			if !added.ok {
				return "", &Fail{Msg: "git add failed: " + added.log, Next: "git status"}
			}
		}
		if !isMerging() && ok(git(append([]string{"diff", "--cached", "--quiet", "--"}, paths...)...)) {
			return "", &Fail{Refused: true, Msg: "nothing staged under those paths — empty diff, no commit",
				Next: "x lane commit <msg-file> -- <paths that changed>"}
		}
		return withWait(waited, fmt.Sprintf("%s: %s", plural(len(present), "path"), strings.Join(present, ", "))), nil
	}); err != nil {
		return nil, err
	}
	if err := r.Step("quotes", "dima's quoted lines in memory, skill and rules files", func() (string, error) {
		return quotesKept(message, msgFile, paths)
	}); err != nil {
		return nil, err
	}
	var copied string
	if err := r.Step("ftr", "an app's code staged without its FTR.md", func() (string, error) {
		raw, err := os.ReadFile(message)
		if err != nil {
			return "", err
		}
		missing := ftrMissing(tree, paths)
		if len(missing) == 0 || ftrNone.Match(raw) {
			return "nothing to add", nil
		}
		// the caller's file stays as written; the commit reads a copy beside the index
		gitDir, err := mustGitIn(tree, "rev-parse", "rev-parse", "--path-format=absolute", "--git-dir")
		if err != nil {
			return "", err
		}
		copied = filepath.Join(gitDir, fmt.Sprintf("x-msg-%d", os.Getpid()))
		if err := os.WriteFile(copied, []byte(withFtrNone(string(raw))), 0o600); err != nil {
			return "", err
		}
		message = copied
		return "ftr: none added, " + strings.Join(missing, ", ") + " unchanged", nil
	}); err != nil {
		return nil, err
	}
	if copied != "" {
		defer os.Remove(copied)
	}

	hold := flags["hold-unstaged"] == true
	if !hold {
		r.skip("hold", "restore")
	}
	var aside *held
	if hold {
		if err := r.Step("hold", "moving the other changes aside", func() (string, error) {
			taken, err := holdAside(tree, paths)
			if err != nil {
				if taken != nil {
					err = errors.Join(err, taken.restore(tree))
				}
				return "", err
			}
			aside = taken
			return plural(len(aside.files), "file") + " held in " + home(aside.dir), nil
		}); err != nil {
			return nil, err
		}
	}

	// the first step that stops the commit: ci or the hooks
	var stopped error
	if name.out == "main" {
		stopped = r.Step("ci", "the ci jobs for the touched paths", func() (string, error) {
			return runCI(tree, paths)
		})
	} else {
		r.skip("ci")
	}
	var sha string
	if stopped == nil {
		stopped = r.Step("commit", "hooks, then the commit", func() (string, error) {
			commitArgs := []string{"commit", "-F", message}
			if !isMerging() {
				commitArgs = append(append(commitArgs, "--"), paths...)
			}
			committed, took, err := lockedGit(commitArgs...)
			waited += took
			if err != nil {
				return "", err
			}
			if !committed.ok {
				return "", hookFail(committed.log, "x lane commit "+msgFile+" -- "+strings.Join(paths, " "))
			}
			sha, err = head()
			return withWait(took, short(sha)+"  "+firstLine(message)), err
		})
	}
	// the held files come back whether the hooks passed or refused
	if aside != nil {
		if err := r.Step("restore", "putting the held files back", func() (string, error) {
			return plural(len(aside.files), "file") + " back, byte for byte", aside.restore(tree)
		}); err != nil {
			// both failed: the hook's words and the held dir are each the caller's next move
			if refused, ok := errors.AsType[*Fail](stopped); ok {
				both := &Fail{Msg: refused.Msg + "; and " + err.Error(), Log: refused.Log}
				if lost, ok := errors.AsType[*Fail](err); ok {
					both.Next = lost.Next
				}
				return nil, both
			}
			return nil, err
		}
	}
	if stopped != nil {
		return nil, stopped
	}
	branch, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Done(fmt.Sprintf("%s on %s, %s", short(sha), branch.out, plural(len(present), "path")), "x lane push --apply")
	data := ordered{{"branch", branch.out}, {"sha", sha}, {"tree", tree}}
	if said := withWait(waited, ""); said != "" {
		data = append(data, kv{"waited", said})
	}
	return data, nil
}

// lockedGit runs a git that takes the index lock: it waits out a lock a peer holds, and once more when the lock
// was taken again in the gap between the wait and the run
func lockedGit(args ...string) (result, time.Duration, error) {
	took, err := waitIndexLock()
	if err != nil {
		return result{}, took, err
	}
	got, _ := git(args...)
	if got.ok || !strings.Contains(got.log, "index.lock': File exists") {
		return got, took, nil
	}
	again, err := waitIndexLock()
	if err != nil {
		return result{}, took + again, err
	}
	got, _ = git(args...)
	return got, took + again, nil
}

// a wait or a poll an env var shortens, under X_TEST only
func durationEnv(name string, fallback time.Duration) time.Duration {
	if os.Getenv("X_TEST") != "" {
		if d, err := time.ParseDuration(os.Getenv(name)); err == nil {
			return d
		}
	}
	return fallback
}

// waitIndexLock waits while the repo's index lock exists, up to lockWait; it never removes a lock itself
func waitIndexLock() (time.Duration, error) {
	lock, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-path", "index.lock")
	if err != nil {
		return 0, err
	}
	deadline := durationEnv("X_LOCK_WAIT", lockWait)
	started := time.Now()
	for {
		info, err := os.Stat(lock)
		if err != nil {
			return time.Since(started), nil
		}
		if time.Since(started) >= deadline {
			return time.Since(started), &Fail{
				Msg:  fmt.Sprintf("index lock still held after %s: %s, %s old", deadline, lock, time.Since(info.ModTime()).Round(time.Second)),
				Next: "ps -A | grep '[g]it ' — a live git: wait and rerun; none: a crash left the lock, check it, then remove it by hand",
			}
		}
		time.Sleep(lockPause)
	}
}

// withWait leads a step's line with the wait, when there was one
func withWait(waited time.Duration, line string) string {
	if waited < lockPause {
		return line
	}
	said := fmt.Sprintf("index lock held, waited %s", waited.Round(time.Second))
	if line == "" {
		return said
	}
	return said + "; " + line
}

type pushTarget struct {
	branch, sha, from, reason string
}

func pushPlan(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	tree, err := top()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var target pushTarget
	if err := r.Step("tree", "checking the tree", func() (string, error) { return home(tree), nil }); err != nil {
		return nil, err
	}
	if err := r.Step("plan", "reading HEAD and the push home", func() (string, error) {
		sha, err := head()
		if err != nil {
			return "", err
		}
		from, reason, err := pushHome()
		target = pushTarget{name, sha, from, reason}
		// counted from the remote's own sha: a local origin/<branch> ref can be stale
		detail := fmt.Sprintf("%s to origin/%s", short(sha), name)
		if remote, _ := remoteSha(name); remote != "" {
			if ahead, _ := git("rev-list", "--count", remote+"..HEAD"); ahead.ok {
				n, _ := strconv.Atoi(ahead.out)
				detail = fmt.Sprintf("%s to origin/%s", plural(n, "commit"), name)
			}
		}
		if from != tree {
			detail += ", from " + home(from)
		}
		return detail, err
	}); err != nil {
		return nil, err
	}
	return planOf(target), nil
}

func planOf(t pushTarget) ordered {
	return ordered{{"branch", t.branch}, {"sha", t.sha}, {"from", t.from}, {"reason", t.reason}}
}

func askPush(plan any) string {
	fields := plan.(ordered)
	return fmt.Sprintf("push %s to origin/%s?", short(fields[1].value.(string)), fields[0].value)
}

func push(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	name, sha, from := fields[0].value.(string), fields[1].value.(string), fields[2].value.(string)
	if err := r.Step("push", "git push", func() (string, error) {
		pushed, tries := pushRetrying(from, sha+":refs/heads/"+name)
		if !pushed.ok {
			return "", &Fail{Msg: fmt.Sprintf("push failed after %s — the git and hook output is above", plural(tries, "try")),
				Next: "fix what the pre-push hooks name, then x lane push --apply", Log: nonBlank(pushed.log)}
		}
		if tries > 1 {
			return fmt.Sprintf("origin/%s, on try %d of %d", name, tries, pushTries), nil
		}
		return "origin/" + name, nil
	}); err != nil {
		return nil, err
	}
	var remote string
	if err := r.Step("verify", "reading the remote back", func() (string, error) {
		var err error
		if remote, err = remoteSha(name); err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Msg: fmt.Sprintf("remote is %s, HEAD is %s", or(remote, "empty"), sha), Next: "x lane push --apply"}
		}
		return "the remote holds " + short(remote), nil
	}); err != nil {
		return nil, err
	}
	r.Done(fmt.Sprintf("%s on origin/%s", short(sha), name), "x lane pr-open <title> <body-file>")
	return ordered{{"branch", name}, {"from", from}, {"remote", remote}, {"sha", sha}}, nil
}

func pushRetrying(from string, args ...string) (result, int) {
	var pushed result
	tries := 1
	for ; ; tries++ {
		pushed, _ = gitIn(from, append([]string{"push", "-q", "origin"}, args...)...)
		if pushed.ok || tries == pushTries || !serverError.MatchString(pushed.log) {
			return pushed, tries
		}
		time.Sleep(time.Duration(tries) * pushPause)
	}
}

func prPlan(r *Run, args []string, flags Flags) (any, error) {
	title, bodyFile := args[0], args[1]
	if !exists(bodyFile) {
		return nil, usageFail("no body file at "+bodyFile, "x lane pr-open <title> <body-file>")
	}
	name, err := branch()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	var argv []string
	base := "main"
	if err := r.Step("plan", "checking the branch is pushed", func() (string, error) {
		if laneAddOn.prBase != nil {
			onto, err := laneAddOn.prBase(flags)
			if err != nil {
				return "", err
			}
			base = cmp.Or(onto, base)
		}
		remote, err := remoteSha(name)
		if err != nil {
			return "", err
		}
		sha, err := head()
		if err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Refused: true, Msg: "origin/" + name + " is not at HEAD", Next: "x lane push --apply"}
		}
		argv = []string{"pr", "create", "--base", base, "--head", name, "--title", title, "--body-file", bodyFile}
		return fmt.Sprintf("%s → %s: %s", name, base, title), nil
	}); err != nil {
		return nil, err
	}
	return ordered{{"argv", argv}, {"branch", name}, {"base", base}}, nil
}

func askPR(plan any) string {
	fields := plan.(ordered)
	return fmt.Sprintf("open a pr from %s onto %s as x-codie-cc?", fields[1].value, fields[2].value)
}

func prOpen(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	name, argv := fields[1].value.(string), fields[0].value.([]string)
	var url string
	if err := r.Step("open", "gh pr create as x-codie-cc", func() (string, error) {
		opened, err := ghRaw(argv...)
		if err != nil {
			return "", err
		}
		if !opened.ok {
			return "", &Fail{Msg: "gh pr create failed — its output is above", Next: "gh pr view", Log: nonBlank(opened.log)}
		}
		url = opened.out
		return url, nil
	}); err != nil {
		return nil, err
	}
	r.Done(url, "")
	return ordered{{"branch", name}, {"url", url}}, nil
}

func mergeMain(r *Run, _ []string, _ Flags) (any, error) {
	name, err := branch()
	if err != nil {
		return nil, err
	}
	r.Open(name)
	if err := r.Step("fetch", "git fetch origin main", func() (string, error) {
		_, err := mustGit("fetch", "fetch", "-q", "origin", "main")
		return "origin/main", err
	}); err != nil {
		return nil, err
	}
	var sha string
	if err := r.Step("merge", "merging origin/main", func() (string, error) {
		merged, _ := git("merge", "--no-edit", "origin/main")
		if !merged.ok {
			conflicts, _ := git("diff", "--name-only", "--diff-filter=U")
			if conflicts.out == "" {
				return "", &Fail{Msg: "merge failed without conflicts: " + gitReason(merged.log), Next: "git status", Log: nonBlank(merged.log)}
			}
			files := strings.Split(conflicts.out, "\n")
			return "", &Fail{Msg: "conflicts: " + strings.Join(files, ", "),
				Next: "resolve them, then x lane commit <msg-file> -- <resolved paths>", Log: files}
		}
		var err error
		sha, err = head()
		return "HEAD is " + short(sha), err
	}); err != nil {
		return nil, err
	}
	r.Done(short(sha)+" on "+name+", main merged in", "x lane push --apply")
	return ordered{{"sha", sha}}, nil
}

// the recipe from shelf/hooks/worktree-seed.sh: the key lives in the main .git, and the
// unlock runs `git status`, which dies on the clean filter unless both filters are off
func unlock(r *Run, _ []string, _ Flags) (any, error) {
	tree, err := top()
	if err != nil {
		return nil, err
	}
	name, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Open(name.out)
	var locked []string
	if err := r.Step("scan", "reading the git-crypt set", func() (string, error) {
		var err error
		locked, err = lockedPaths(tree)
		return plural(len(locked), "file") + " hold ciphertext", err
	}); err != nil {
		return nil, err
	}
	if len(locked) == 0 {
		r.ran = len(r.steps)
		r.Done("nothing to decrypt", "")
		return ordered{{"tree", tree}, {"unlocked", 0}}, nil
	}
	if err := r.Step("decrypt", "git-crypt unlock", func() (string, error) { return "unlocked with the main key", decrypt(tree) }); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the set again", func() (string, error) {
		left, err := lockedPaths(tree)
		if err == nil && len(left) > 0 {
			err = &Fail{Msg: "still ciphertext: " + strings.Join(left, ", "), Next: "git-crypt status"}
		}
		return "no ciphertext left", err
	}); err != nil {
		return nil, err
	}
	r.Done(plural(len(locked), "file")+" decrypted", "")
	return ordered{{"tree", tree}, {"unlocked", len(locked)}}, nil
}

func decrypt(tree string) error {
	common, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return err
	}
	key := filepath.Join(common, "git-crypt/keys/default")
	if !exists(key) {
		return &Fail{Refused: true, Msg: "no git-crypt key at " + key, Next: "run git-crypt unlock in the main checkout first"}
	}
	gitDir, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-dir")
	if err != nil {
		return err
	}
	if !exists(filepath.Join(gitDir, "git-crypt")) {
		env := []string{"GIT_CONFIG_COUNT=2", "GIT_CONFIG_KEY_0=filter.git-crypt.clean", "GIT_CONFIG_VALUE_0=cat",
			"GIT_CONFIG_KEY_1=filter.git-crypt.required", "GIT_CONFIG_VALUE_1=false"}
		if unlocked, _ := run(tree, env, "", "git-crypt", "unlock", key); !unlocked.ok {
			return &Fail{Msg: "git-crypt unlock failed — its output is above", Next: "git-crypt status", Log: nonBlank(unlocked.log)}
		}
	}

	// in a real frame tree the unlock decrypts by itself; in a fresh fixture git sees the
	// ciphertext as unchanged and never re-smudges it. so the set is read again, and a file
	// is removed only while its raw bytes ARE its index blob
	still, err := lockedPaths(tree)
	if err != nil {
		return err
	}
	for _, path := range still {
		raw, err := mustGitIn(tree, "hash-object", "hash-object", "--no-filters", "--", path)
		if err != nil {
			return err
		}
		staged, err := mustGitIn(tree, "ls-files", "ls-files", "-s", "--", path)
		if err != nil {
			return err
		}
		if fields := strings.Fields(staged); len(fields) < 2 || fields[1] != raw {
			return &Fail{Refused: true, Msg: path + " differs from its index blob — not touching it",
				Next: "git -c filter.git-crypt.clean=cat diff -- " + path}
		}
		if err := os.Remove(filepath.Join(tree, path)); err != nil {
			return err
		}
		if _, err := mustGitIn(tree, "checkout", "checkout", "--", path); err != nil {
			return err
		}
	}
	left, err := lockedPaths(tree)
	if err != nil {
		return err
	}
	if len(left) > 0 {
		return &Fail{Msg: "still ciphertext: " + strings.Join(left, ", "), Next: "git-crypt status"}
	}
	return nil
}

/* Steps */
// the commit hook only reports (lefthook must never rewrite files it holds aside), so the
// format runs here, before staging, on the named paths alone; a failure is left for the hook to name
func format(tree string, paths []string) string {
	biome := filepath.Join(tree, "node_modules/.bin/biome")
	hasConfig := exists(filepath.Join(tree, "biome.json")) || exists(filepath.Join(tree, "biome.jsonc"))
	if len(paths) == 0 || !hasConfig || !exists(biome) {
		return "no biome here, skipped"
	}
	_, _ = run(tree, nil, "", biome, append([]string{"format", "--write", "--no-errors-on-unmatched", "--files-ignore-unknown=true"}, paths...)...)
	return "biome on " + plural(len(paths), "path")
}

// a mod a named path sits in must pass the engine's own validator, checked before anything is staged:
// a mod round chained `validate && commit` by hand and still committed past a red (FRM-307)
func validateMods(tree string, paths []string) (string, error) {
	seen := map[string]bool{}
	for _, path := range paths {
		abs, _ := filepath.Abs(path)
		rel, _ := filepath.Rel(tree, abs)
		dir := strings.TrimSuffix(modDir.FindString(filepath.ToSlash(rel)), "/")
		if dir == "" || seen[dir] || !exists(filepath.Join(tree, dir, ".claude-plugin/plugin.json")) {
			continue
		}
		seen[dir] = true
		if checked, _ := run(tree, nil, "", "claude", "plugin", "validate", dir); !checked.ok {
			return "", &Fail{Refused: true, Msg: "claude plugin validate refused " + dir + " — its output is above; nothing was staged",
				Next: "claude plugin validate " + dir, Log: nonBlank(checked.log)}
		}
	}
	if len(seen) == 0 {
		return "no mod among the paths", nil
	}
	return plural(len(seen), "mod") + " valid", nil
}

type ciJob struct {
	dir  string
	env  []string
	argv []string
}

// a direct commit on main reaches ci only after the push, so the jobs ci.yml runs for the
// touched paths run here first: main went red twice on 10-07 from commits ci never saw
func runCI(tree string, paths []string) (string, error) {
	jobs := ciJobs(tree, paths)
	if len(jobs) == 0 {
		return "no go or ts among the paths", nil
	}
	var ran []string
	for _, job := range jobs {
		command := strings.Join(job.argv, " ")
		if job.dir != tree {
			command = "(" + home(job.dir) + ") " + command
		}
		if done, _ := run(job.dir, job.env, "", job.argv[0], job.argv[1:]...); !done.ok {
			lines := nonBlank(done.log)
			return "", &Fail{Refused: true, Msg: command + " is red — its output is above; nothing was committed",
				Next: command, Log: lines[max(0, len(lines)-40):]}
		}
		ran = append(ran, command)
	}
	return strings.Join(ran, ", ") + " green", nil
}

func ciJobs(tree string, paths []string) []ciJob {
	var jobs []ciJob
	seen := map[string]bool{}
	ts := false
	for _, path := range paths {
		switch filepath.Ext(path) {
		case ".ts", ".tsx":
			ts = true
		}
		if module := goModule(tree, filepath.Dir(filepath.Join(tree, path))); module != "" && !seen[module] {
			seen[module] = true
			// the same isolation pnpm x-go:test runs under: no global gitconfig reaches a fixture repo
			jobs = append(jobs, ciJob{module, []string{"GIT_CONFIG_GLOBAL=/dev/null"}, []string{"go", "test", "./..."}})
		}
	}
	if ts {
		scripts := packageScripts(tree)
		hooked := preCommitRuns(tree)
		for _, script := range []string{"typecheck", "test"} {
			if scripts[script] != "" && !hooked[script] {
				jobs = append(jobs, ciJob{tree, nil, []string{"pnpm", script}})
			}
		}
	}
	return jobs
}

var (
	memoryFile   = regexp.MustCompile(`(^|/)(rules|rules-lazy|skills|memory)/.*\.md$|(^|/)(SKILL|AGENTS|CLAUDE)\.md$`)
	quotesShown  = regexp.MustCompile(`(?m)^quotes: shown\s*$`)
	quoteSummary = regexp.MustCompile(`(?m)^(\d+) quote\(s\) gone`)
)

// a «» line of dima's in a memory file twice went through as «not his» (2026-10-15), so a gone one stops the commit
func quotesKept(message, msgFile string, paths []string) (string, error) {
	// the named paths, never only those on disk: a moved file's old path carries the quotes HEAD holds
	staged, err := mustGit("quotes", append([]string{"diff", "--cached", "--name-only", "--"}, paths...)...)
	if err != nil {
		return "", err
	}
	var files []string
	for path := range strings.Lines(staged) {
		if path = strings.TrimSpace(path); memoryFile.MatchString(path) {
			files = append(files, path)
		}
	}
	if len(files) == 0 {
		return "no memory, skill or rules file", nil
	}
	script := filepath.Join(sourceDir(), "../../_clio/script/quote-diff.py")
	if !exists(script) {
		return "not checked: no " + home(script), nil
	}
	// the summary line, never the exit: a new file exits 2 («not checked») and loses no quote
	checked, _ := run("", nil, "", "python3", append([]string{script, "HEAD"}, files...)...)
	summary := quoteSummary.FindStringSubmatch(checked.out)
	switch {
	case summary == nil:
		return "", &Fail{Msg: "quote-diff printed no summary — its output is above", Next: "python3 " + home(script) + " HEAD <files>", Log: nonBlank(checked.log)}
	case summary[1] == "0":
		return plural(len(files), "file") + ", every quote kept", nil
	}
	if raw, _ := os.ReadFile(message); quotesShown.Match(raw) {
		return "quotes: shown — " + summary[1] + " gone quotes passed", nil
	}
	return "", &Fail{Refused: true, Msg: "a quote of dima's changed or went; show him each line, then add «quotes: shown» to the message:\n" + checked.out,
		Next: "x lane commit " + msgFile + " -- <paths>, its message carrying quotes: shown"}
}

// a pnpm or turbo typecheck/test call on a run line; a comment or a `mods:test` never matches
var lefthookCall = regexp.MustCompile(`(?m)^\s*\S*lefthook\s+run\s+"?pre-commit"?`)

var hookJob = regexp.MustCompile(`(?:^|\s)(?:pnpm|turbo)(?:\s+(?:run|turbo|exec\s+turbo))?\s+(typecheck|test)(?:\s|'|$)`)

// the jobs the repo's own pre-commit runs, only while its hook is installed and calls lefthook
func preCommitRuns(tree string) map[string]bool {
	runs := map[string]bool{}
	// lefthook's own off switch: its hook then exits 0 and runs nothing
	if off := os.Getenv("LEFTHOOK"); off == "0" || off == "false" {
		return runs
	}
	hookPath, err := mustGitIn(tree, "hook", "rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit")
	if err != nil {
		return runs
	}
	// git skips a hook without the exec bit, silently
	if info, err := os.Stat(hookPath); err != nil || info.Mode()&0o111 == 0 {
		return runs
	}
	if hook, err := os.ReadFile(hookPath); err != nil || !lefthookCall.Match(hook) {
		return runs
	}
	var config []byte
	for _, name := range []string{"lefthook.yaml", "lefthook.yml"} {
		if config, err = os.ReadFile(filepath.Join(tree, name)); err == nil {
			break
		}
	}
	inPreCommit := false
	for line := range strings.Lines(string(config)) {
		if line != "" && line[0] != ' ' && line[0] != '\t' && line[0] != '#' {
			inPreCommit = strings.HasPrefix(line, "pre-commit:")
			continue
		}
		if !inPreCommit || strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}
		for _, match := range hookJob.FindAllStringSubmatch(line, -1) {
			runs[match[1]] = true
		}
	}
	return runs
}

// goModule is the nearest dir at or above dir, inside the tree, that holds a go.mod
func goModule(tree, dir string) string {
	for dir == tree || strings.HasPrefix(dir, tree+string(filepath.Separator)) {
		if exists(filepath.Join(dir, "go.mod")) {
			return dir
		}
		if dir == tree {
			break
		}
		dir = filepath.Dir(dir)
	}
	return ""
}

func packageScripts(tree string) map[string]string {
	var manifest struct {
		Scripts map[string]string `json:"scripts"`
	}
	raw, _ := os.ReadFile(filepath.Join(tree, "package.json"))
	_ = json.Unmarshal(raw, &manifest)
	return manifest.Scripts
}

/* Git */
// a worktree codie's other-repo half lands on that repo's main and nowhere else
func enterMain(repo string) error {
	root, _ := gitIn(repo, "rev-parse", "--show-toplevel")
	if !root.ok {
		return usageFail(repo+" is not a git repo", "x lane commit --repo <git repo on main> <msg-file> -- <paths…>")
	}
	name, _ := gitIn(root.out, "symbolic-ref", "--quiet", "--short", "HEAD")
	if name.out != "main" {
		return &Fail{Refused: true, Msg: fmt.Sprintf("%s is on %s, not main", root.out, or(name.out, "a detached HEAD")),
			Next: "switch " + root.out + " to main, then rerun"}
	}
	// the bare mid-merge commit would conclude someone else's merge under this message
	// absolute: in a linked worktree --git-path already answers absolute, and joining it to root breaks
	mergeHead, _ := gitIn(root.out, "rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD")
	if mergeHead.ok && exists(mergeHead.out) {
		return &Fail{Refused: true, Msg: root.out + " is mid-merge — not committing into someone else's merge",
			Next: "finish the merge in " + root.out + ", then rerun"}
	}
	return os.Chdir(root.out)
}

func isMerging() bool {
	path, _ := git("rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD")
	return path.ok && exists(path.out)
}

func assertUnlocked(tree string) error {
	locked, err := lockedPaths(tree)
	if err != nil {
		return err
	}
	if len(locked) > 0 {
		return &Fail{Refused: true, Msg: fmt.Sprintf("git-crypt files hold ciphertext here (%s) — any add dies on the clean filter", strings.Join(locked, ", ")),
			Next: "x lane unlock"}
	}
	return nil
}

func lockedPaths(tree string) ([]string, error) {
	attributes, err := os.ReadFile(filepath.Join(tree, ".gitattributes"))
	if err != nil || !bytes.Contains(attributes, []byte("git-crypt")) {
		return nil, nil
	}
	files, err := mustGitIn(tree, "ls-files", "ls-files", "-z")
	if err != nil {
		return nil, err
	}
	attrs, _ := run(tree, nil, files, "git", "check-attr", "-z", "--stdin", "filter")
	fields := strings.Split(attrs.out, "\x00")
	var crypted []string
	for i := 0; i+2 < len(fields); i += 3 {
		if fields[i+2] == "git-crypt" && startsWithMagic(filepath.Join(tree, fields[i])) {
			crypted = append(crypted, fields[i])
		}
	}
	return crypted, nil
}

func startsWithMagic(path string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()
	head := make([]byte, len(cryptMagic))
	n, _ := file.Read(head)
	return bytes.Equal(head[:n], cryptMagic)
}

// frame's pre-push mirror gate reads ~ symlinks that point at the main checkout, so a
// frame worktree's own push always fails; the main checkout pushes the same sha (shared objects)
func pushHome() (string, string, error) {
	tree, err := top()
	if err != nil {
		return "", "", err
	}
	common, linked, err := worktreeOf(tree)
	if err != nil {
		return "", "", err
	}
	if !linked {
		return tree, "main checkout", nil
	}
	frameCommon, _ := gitIn(sourceDir(), "rev-parse", "--path-format=absolute", "--git-common-dir")
	if frameCommon.out != common {
		return tree, "worktree", nil
	}
	return filepath.Dir(common), "frame worktree: the mirror gate passes only in the main checkout", nil
}

// worktreeOf answers the repo's common git dir and whether tree is a linked worktree of it
func worktreeOf(tree string) (common string, linked bool, err error) {
	own, err := mustGitIn(tree, "rev-parse", "rev-parse", "--path-format=absolute", "--git-dir")
	if err != nil {
		return "", false, err
	}
	common, err = mustGitIn(tree, "rev-parse", "rev-parse", "--path-format=absolute", "--git-common-dir")
	return common, err == nil && own != common, err
}

func top() (string, error)  { return mustGit("rev-parse", "rev-parse", "--show-toplevel") }
func head() (string, error) { return mustGit("rev-parse", "rev-parse", "HEAD") }

func branch() (string, error) {
	found, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	if !found.ok {
		return "", &Fail{Refused: true, Msg: "detached HEAD", Next: "git switch -c <branch>"}
	}
	return found.out, nil
}

func remoteSha(name string) (string, error) {
	out, err := mustGit("ls-remote", "ls-remote", "origin", "refs/heads/"+name)
	sha, _, _ := strings.Cut(out, "\t")
	return sha, err
}

type result struct {
	ok       bool
	out, log string
}

func mustGit(step string, args ...string) (string, error) { return mustGitIn("", step, args...) }

func mustGitIn(cwd, step string, args ...string) (string, error) {
	got, _ := gitIn(cwd, args...)
	if !got.ok {
		return "", &Fail{Msg: "git " + step + " failed: " + got.log, Next: "git status"}
	}
	return got.out, nil
}

func git(args ...string) (result, error)               { return gitIn("", args...) }
func gitIn(cwd string, args ...string) (result, error) { return run(cwd, nil, "", "git", args...) }

func run(cwd string, env []string, input, command string, args ...string) (result, error) {
	c := exec.Command(command, args...)
	c.Dir = cwd
	c.Env = append(os.Environ(), env...)
	if input != "" {
		c.Stdin = strings.NewReader(input)
	}
	return runCmd(c)
}

func runCmd(c *exec.Cmd) (result, error) {
	command, args := c.Path, c.Args[1:]
	var stdout, stderr bytes.Buffer
	c.Stdout, c.Stderr = &stdout, &stderr
	err := c.Run()
	logger.Debug("spawn", "cmd", command, "args", args, "err", err)
	out := strings.TrimSpace(stdout.String())
	errText := stderr.String()
	if err != nil && errText == "" {
		errText = err.Error()
	}
	return result{ok: err == nil, out: out, log: strings.TrimSpace(out + "\n" + errText)}, err
}

func ok(got result, _ error) bool { return got.ok }

/* Helpers */
func exists(path string) bool { _, err := os.Stat(path); return err == nil }

func onDisk(paths []string) []string {
	var found []string
	for _, path := range paths {
		if exists(path) {
			found = append(found, path)
		}
	}
	return found
}

func firstLine(path string) string {
	body, _ := os.ReadFile(path)
	line, _, _ := strings.Cut(strings.TrimSpace(string(body)), "\n")
	return line
}

// gitReason is the line git leads its refusal with, so an envelope reader needs no stderr
func gitReason(log string) string {
	lines := nonBlank(log)
	for i, line := range lines {
		if strings.HasPrefix(line, "error: ") || strings.HasPrefix(line, "fatal: ") {
			// a reason ending in «:» names its files on the next line
			if strings.HasSuffix(line, ":") && i+1 < len(lines) {
				return line + " " + strings.TrimSpace(lines[i+1])
			}
			return line
		}
	}
	if len(lines) == 0 {
		return "git printed nothing"
	}
	return lines[len(lines)-1]
}

// a refused commit: the whole hook log goes to a file, the reply carries only the lines that say why — the caller
// never pipes the commit into `tail` (8 guard refusals on 10-14)
var hookRed = regexp.MustCompile(`(?i)error|fail|refus|✖|×|lane gate|exit status|did not match|not found`)

func hookFail(log, next string) *Fail {
	full := filepath.Join(os.TempDir(), fmt.Sprintf("x-commit-%d.log", os.Getpid()))
	saved := os.WriteFile(full, []byte(log), 0o600) == nil
	var why []string
	for _, line := range nonBlank(log) {
		if hookRed.MatchString(line) && len(why) < 20 {
			why = append(why, line)
		}
	}
	if len(why) == 0 {
		why = nonBlank(log)
		why = why[max(0, len(why)-20):]
	}
	msg := "commit failed — the hook's own lines are below"
	if saved {
		msg += ", the whole log at " + full
	}
	return &Fail{Msg: msg, Next: next, Log: why}
}

// stdinMessage saves the message piped on stdin to a temp file the commit reads, refusing an empty one
func stdinMessage() (string, error) {
	raw, err := io.ReadAll(os.Stdin)
	if err != nil {
		return "", err
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return "", usageFail("an empty message on stdin", "x lane commit - -- <paths…> <<'MSG' … MSG")
	}
	file, err := os.CreateTemp("", "x-msg-*.txt")
	if err != nil {
		return "", err
	}
	defer file.Close()
	if _, err := file.Write(raw); err != nil {
		return "", errors.Join(err, os.Remove(file.Name()))
	}
	return file.Name(), nil
}

func nonBlank(log string) []string {
	var lines []string
	for line := range strings.SplitSeq(log, "\n") {
		if strings.TrimSpace(line) != "" {
			lines = append(lines, line)
		}
	}
	return lines
}

func short(sha string) string { return sha[:min(7, len(sha))] }

func home(path string) string {
	if dir, err := os.UserHomeDir(); err == nil && strings.HasPrefix(path, dir) {
		return "~" + strings.TrimPrefix(path, dir)
	}
	return path
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

func or(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}
