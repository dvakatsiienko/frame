package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

func commit(r *Run, args []string, flags Flags) (_ any, err error) {
	leaveTurn := func(error) {}
	defer func() { leaveTurn(err) }()
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
	bumpName, _ := flags["bump"].(string)
	if len(paths) == 0 && bumpName == "" {
		return nil, usageFail("no paths — name what goes into the commit", "x lane commit "+msgFile+" -- <paths…>")
	}
	message, _ := filepath.Abs(msgFile)
	dry := flags["dry"] == true
	startCwd, _ := os.Getwd()
	repo, _ := flags["repo"].(string)
	if repo != "" {
		if dry {
			return nil, usageFail("--dry reads this tree's hook, never another repo's", "x lane commit --dry "+msgFile+" -- <paths…>")
		}
		if err := enterMain(repo); err != nil {
			return nil, err
		}
	}

	tree, err := top()
	if err != nil {
		return nil, err
	}
	// a path resolves from the cwd, as git resolves a pathspec; every later step reads the root form, and a retry hint keeps
	// the form the caller typed, since it reruns from the same cwd
	typedPaths := slices.Clone(paths)
	prefix := ""
	if repo != "" {
		prefix = prefixInside(tree, startCwd)
	} else if shown, _ := git("rev-parse", "--show-prefix"); shown.ok {
		prefix = shown.out
	}
	if prefix != "" {
		if paths, err = rootPaths(tree, prefix, paths); err != nil {
			return nil, err
		}
	}
	if err := os.Chdir(tree); err != nil {
		return nil, err
	}
	name, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Open(name.out)
	if dry && !exists(filepath.Join(tree, gateCopyRun)) {
		return nil, usageFail("--dry reads a frame-shaped hook: this tree has no "+gateCopyRun, "x lane commit "+msgFile+" -- <paths…>")
	}
	if dry && midOperation() {
		return nil, usageFail("--dry cannot mirror a commit mid-merge, mid-cherry-pick, mid-revert or mid-rebase", "x lane commit "+msgFile+" -- <paths…>")
	}

	if err := r.Step("tree", "checking the tree", func() (string, error) {
		return home(tree), assertUnlocked(tree)
	}); err != nil {
		return nil, err
	}
	// before all that reads the tree or the index: a git commit holds the shared index lock through its hook, so a stage outside
	// the turn dies on a peer's, an edit in the wait would skip format and quotes, and a peer's commit moves the HEAD a dry run copies
	namedPaths := strings.Join(typedPaths, " ")
	// every retry this run names carries the flag and the caller's own paths, never the manifest the bump adds
	bumpFlag := ""
	if bumpName != "" {
		bumpFlag = "--bump " + bumpName + " "
	}
	callerPaths := slices.Clone(typedPaths)
	again := strings.TrimSuffix("x lane commit "+bumpFlag+msgFile+" -- "+namedPaths, " -- ")
	verb := "x lane commit "
	switch {
	case dry:
		verb += "--dry "
	case flags["hold-unstaged"] == true:
		verb += "--hold-unstaged "
	}
	if err := r.Step("turn", "waiting for the gate turn", func() (string, error) {
		leave, err := takeGateTurn(verb+namedPaths, strings.TrimSuffix(verb+bumpFlag+msgFile+" -- "+namedPaths, " -- "))
		leaveTurn = leave
		return "", err
	}); err != nil {
		return nil, err
	}
	var dryIndex []string
	var dryTree func() (string, error)
	if dry {
		env, treeOf, done, err := headIndex(tree)
		if err != nil {
			return nil, err
		}
		defer done()
		// from here on every git of this run stages and reads the temp index, as a pathspec commit's hooks do
		_, path, _ := strings.Cut(env[0], "=")
		if err := os.Setenv("GIT_INDEX_FILE", path); err != nil {
			return nil, err
		}
		dryIndex, dryTree = env, treeOf
	} else {
		r.skip("gates")
	}
	// the bump is written before the holds and the gates read the paths, and put back on any stop before the commit lands
	var bumped *bumpTarget
	landed := false
	if bumpName == "" {
		r.skip("bump", "refresh")
	} else {
		var was []byte
		var index string
		if err := r.Step("bump", "the plugin's patch version", func() (string, error) {
			b, said, err := planBump(tree, bumpName)
			if err != nil {
				return "", err
			}
			if was, err = os.ReadFile(b.manifest); err != nil {
				return "", err
			}
			// the index entry as it stood, so a stop puts back a staged edit too, never only HEAD's
			staged, _ := git("ls-files", "-s", "--", b.manifest)
			index = staged.out
			if err := writeVersion(b.manifest, b.from, b.to); err != nil {
				return "", err
			}
			bumped = &b
			return said, nil
		}); err != nil {
			return nil, err
		}
		rel, _ := filepath.Rel(tree, bumped.manifest)
		if !slices.Contains(paths, rel) {
			paths = append(paths, rel)
		}
		defer func() {
			if landed || (err == nil && !dry) {
				return
			}
			_ = os.WriteFile(bumped.manifest, was, 0o644)
			if dry {
				return
			}
			// `<mode> <sha> <stage>\t<path>`: the entry before the bump goes back as it was
			if mode, rest, ok := strings.Cut(index, " "); ok {
				if sha, _, ok := strings.Cut(rest, " "); ok {
					_, _ = git("update-index", "--cacheinfo", mode+","+sha+","+rel)
					return
				}
			}
			_, _ = git("reset", "-q", "--", rel)
		}()
	}
	if err := r.Step("holds", "the paths another session holds", func() (string, error) {
		if held := heldByOthers(tree, paths); len(held) > 0 {
			// heldByOthers reads root-form paths; the retry reruns from this cwd, so it names them as typed
			for i := range held {
				if at := slices.Index(paths, held[i].named); at >= 0 && at < len(typedPaths) {
					held[i].named = typedPaths[at]
				}
			}
			return "", heldFail(held, bumpFlag+msgFile, callerPaths)
		}
		return "none held by another session", nil
	}); err != nil {
		return nil, err
	}

	// a path gone from both the tree and the index (the old side of a mv) kills `add`,
	// so stage only what exists and let the index carry the removal
	var present, named []string
	for _, path := range paths {
		named = append(named, path)
		if exists(path) || ok(git("ls-files", "--error-unmatch", "--", path)) {
			present = append(present, path)
		} else if logged, _ := git("log", "-1", "--format=%h", "--", path); !ok(git("cat-file", "-e", "HEAD:"+path)) && logged.out != "" {
			// a racing commit (the pocket hook's) already landed this delete: nothing is left to commit for it
			named = named[:len(named)-1]
		} else if words := strings.Fields(path); len(words) > 1 && !ok(git("cat-file", "-e", "HEAD:"+path)) {
			// zsh hands a quoted "$paths" over as one argument; «nothing staged» hid that (2026-10-18)
			return nil, usageFail(fmt.Sprintf("%q names no file: the path list arrived as one word", path),
				"x lane commit "+msgFile+" -- "+strings.Join(words, " "))
		} else if dry {
			// a dry run's index holds HEAD, so a path it cannot find matches nothing a real commit could take
			return nil, &Fail{Refused: true, Msg: "pathspec " + path + " matches no file: a real commit refuses it", Next: "x lane commit --dry " + msgFile + " -- <paths that exist>"}
		}
	}
	paths = named
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
			return "", &Fail{Refused: true, Msg: "nothing staged under " + strings.Join(paths, ", ") + " (repo-root paths) — empty diff, no commit",
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

	if dry {
		named := strings.TrimSuffix(bumpFlag+msgFile+" -- "+namedPaths, " -- ")
		return dryCommit(r, tree, message, dryIndex, dryTree, "x lane commit --dry "+named, "x lane commit "+named)
	}

	hold := flags["hold-unstaged"] == true
	if !hold {
		r.skip("hold", "restore")
	}
	// the first step that stops the commit: ci or the hooks
	var stopped error
	var aside *held
	if hold {
		if err := r.Step("hold", "moving the other changes aside", func() (string, error) {
			taken, err := holdAside(tree, paths)
			if err != nil {
				if taken != nil {
					err = errors.Join(err, taken.restore(tree, ""))
				}
				return "", err
			}
			aside = taken
			return aside.summary(), nil
		}); err != nil {
			return nil, err
		}
	}

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
			merging := isMerging()
			if !merging {
				commitArgs = append(append(commitArgs, "--"), paths...)
			}
			proven := ""
			// read after each lock wait, right before its commit: a peer's commit in the wait moves HEAD, and the proof goes with it
			readProof := func() {
				proven = ""
				_ = os.Unsetenv("LEFTHOOK_EXCLUDE")
				if gates := provenOnThisTree(tree, paths); !merging && len(gates) > 0 {
					_ = os.Setenv("LEFTHOOK_EXCLUDE", strings.Join(gates, ","))
					proven = ", " + strings.Join(gates, ", ") + " already green on these bytes"
				}
			}
			committed, took, err := lockedGitAfter(readProof, commitArgs...)
			waited += took
			if err != nil {
				return "", err
			}
			retried := ""
			if !committed.ok && timeoutOnly(committed.log) {
				retried = ", retried a timeout-only red"
				var again time.Duration
				committed, again, err = lockedGitAfter(readProof, commitArgs...)
				took += again
				waited += again
				if err != nil {
					return "", err
				}
			}
			if !committed.ok {
				refused := hookFail(committed.log, again)
				refused.Log = append(refused.Log, messageReds(tree, message, committed.log)...)
				return "", refused
			}
			sha, err = head()
			return withWait(took, short(sha)+"  "+firstLine(message)+proven+retried), err
		})
	}
	// from here the bump is in HEAD: a failed restore of the held files must not take it back
	landed = stopped == nil
	// the held files come back whether the hooks passed or refused
	if aside != nil {
		if err := r.Step("restore", "putting the held files back", func() (string, error) {
			return plural(len(aside.files), "file") + " back, byte for byte", aside.restore(tree, sha)
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
	data := append(ordered{{"branch", branch.out}, {"sha", sha}, {"tree", tree}}, aside.leftForPeers()...)
	if said := withWait(waited, ""); said != "" {
		data = append(data, kv{"waited", said})
	}
	if bumped == nil {
		// a reminder, never a refusal: a plugin edit can wait for a later bump on purpose
		if plugins := unbumpedPlugins(tree, present); len(plugins) > 0 {
			var bumps []string
			for _, plugin := range plugins {
				bumps = append(bumps, "x plugin bump "+plugin+" --apply")
			}
			reminder := strings.Join(plugins, ", ") + " changed without --bump; the install keeps the old copy until a bump: " + strings.Join(bumps, ", ")
			r.Done(fmt.Sprintf("%s on %s, %s; %s", short(sha), branch.out, plural(len(present), "path"), reminder), "x lane push --apply")
			data = append(data, kv{"reminder", reminder})
		}
		return data, nil
	}
	data = append(data, kv{"bump", ordered{{"name", bumped.name}, {"from", bumped.from}, {"to", bumped.to}}})
	if bumped.market == "" {
		r.skip("refresh")
		return data, nil
	}
	// the commit stands whatever the refresh says: its fail names the claude call to run again
	var cache string
	if err := r.Step("refresh", "the plugin's marketplace and install", func() (string, error) {
		found, err := refreshPlugin(bumped.name+"@"+bumped.market, bumped.market, bumped.to)
		cache = found
		return home(cache), err
	}); err != nil {
		return nil, err
	}
	older := olderCopies(filepath.Dir(cache), bumped.to)
	reload := reloadLine(bumped.name, bumped.to, older)
	r.Done(short(sha)+" on "+branch.out+", "+reload, "/reload-plugins")
	return append(data, kv{"cache", cache}, kv{"reload", "/reload-plugins"}, kv{"older", older}, kv{"message", reload}), nil
}
