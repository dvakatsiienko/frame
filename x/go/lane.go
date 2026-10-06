package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var (
	cryptMagic = []byte("\x00GITCRYPT\x00")
	modDir     = regexp.MustCompile(`^home/\.claude/plugin-x/mods/[^/]+/`)
)

/* Verbs */
func commit(r *Run, args []string, flags Flags) (any, error) {
	msgFile, paths := args[0], args[1:]
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

	// a path gone from both the tree and the index (the old side of a mv) kills `add`,
	// so stage only what exists and let the index carry the removal
	var present []string
	for _, path := range paths {
		if exists(path) || ok(git("ls-files", "--error-unmatch", "--", path)) {
			present = append(present, path)
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
	if err := r.Step("stage", "git add", func() (string, error) {
		if len(present) > 0 {
			if _, err := mustGit("add", append([]string{"add", "-A", "--"}, present...)...); err != nil {
				return "", err
			}
		}
		if !isMerging() && ok(git(append([]string{"diff", "--cached", "--quiet", "--"}, paths...)...)) {
			return "", &Fail{Msg: "nothing staged under those paths — empty diff, no commit",
				Next: "x lane commit <msg-file> -- <paths that changed>"}
		}
		return fmt.Sprintf("%s: %s", plural(len(present), "path"), strings.Join(present, ", ")), nil
	}); err != nil {
		return nil, err
	}

	var sha string
	if err := r.Step("commit", "hooks, then the commit", func() (string, error) {
		commitArgs := []string{"commit", "-F", message}
		if !isMerging() {
			commitArgs = append(append(commitArgs, "--"), paths...)
		}
		committed, _ := git(commitArgs...)
		if !committed.ok {
			return "", &Fail{Msg: "commit failed — the hook output is above",
				Next: "x lane commit " + msgFile + " -- " + strings.Join(paths, " "), Log: nonBlank(committed.log)}
		}
		sha, err = head()
		return short(sha) + "  " + firstLine(message), err
	}); err != nil {
		return nil, err
	}
	branch, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Done(fmt.Sprintf("%s on %s, %s", short(sha), branch.out, plural(len(present), "path")), "x lane push --apply")
	return ordered{{"branch", branch.out}, {"sha", sha}, {"tree", tree}}, nil
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
		pushed, _ := gitIn(from, "push", "-q", "origin", sha+":refs/heads/"+name)
		if !pushed.ok {
			return "", &Fail{Msg: "push failed — the git and hook output is above",
				Next: "fix what the pre-push hooks name, then x lane push --apply", Log: nonBlank(pushed.log)}
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

func prPlan(r *Run, args []string, _ Flags) (any, error) {
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
	if err := r.Step("plan", "checking the branch is pushed", func() (string, error) {
		remote, err := remoteSha(name)
		if err != nil {
			return "", err
		}
		sha, err := head()
		if err != nil {
			return "", err
		}
		if remote != sha {
			return "", &Fail{Msg: "origin/" + name + " is not at HEAD", Next: "x lane push --apply"}
		}
		argv = []string{"pr", "create", "--base", "main", "--head", name, "--title", title, "--body-file", bodyFile}
		return fmt.Sprintf("%s → main: %s", name, title), nil
	}); err != nil {
		return nil, err
	}
	return ordered{{"argv", argv}, {"branch", name}}, nil
}

func askPR(plan any) string {
	return fmt.Sprintf("open a pr from %s onto main as x-coder-cc?", plan.(ordered)[1].value)
}

func prOpen(r *Run, _ []string, _ Flags, plan any) (any, error) {
	fields := plan.(ordered)
	name, argv := fields[1].value.(string), fields[0].value.([]string)
	wrap := filepath.Join(sourceDir(), "../../home/.claude/plugin-x/bin/github-token-wrap")
	var url string
	if err := r.Step("open", "gh pr create as x-coder-cc", func() (string, error) {
		opened, _ := run("", nil, "", wrap, argv...)
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
				return "", &Fail{Msg: "merge failed without conflicts — its output is above", Next: "git status", Log: nonBlank(merged.log)}
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
		return &Fail{Msg: "no git-crypt key at " + key, Next: "run git-crypt unlock in the main checkout first"}
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
			return &Fail{Msg: path + " differs from its index blob — not touching it",
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
			return "", &Fail{Msg: "claude plugin validate refused " + dir + " — its output is above; nothing was staged",
				Next: "claude plugin validate " + dir, Log: nonBlank(checked.log)}
		}
	}
	if len(seen) == 0 {
		return "no mod among the paths", nil
	}
	return plural(len(seen), "mod") + " valid", nil
}

/* Git */
// a worktree coder's other-repo half lands on that repo's main and nowhere else
func enterMain(repo string) error {
	root, _ := gitIn(repo, "rev-parse", "--show-toplevel")
	if !root.ok {
		return usageFail(repo+" is not a git repo", "x lane commit --repo <git repo on main> <msg-file> -- <paths…>")
	}
	name, _ := gitIn(root.out, "symbolic-ref", "--quiet", "--short", "HEAD")
	if name.out != "main" {
		return &Fail{Msg: fmt.Sprintf("%s is on %s, not main", root.out, or(name.out, "a detached HEAD")),
			Next: "switch " + root.out + " to main, then rerun"}
	}
	// the bare mid-merge commit would conclude someone else's merge under this message
	// absolute: in a linked worktree --git-path already answers absolute, and joining it to root breaks
	mergeHead, _ := gitIn(root.out, "rev-parse", "--path-format=absolute", "--git-path", "MERGE_HEAD")
	if mergeHead.ok && exists(mergeHead.out) {
		return &Fail{Msg: root.out + " is mid-merge — not committing into someone else's merge",
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
		return &Fail{Msg: fmt.Sprintf("git-crypt files hold ciphertext here (%s) — any add dies on the clean filter", strings.Join(locked, ", ")),
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
	gitDir, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-dir")
	if err != nil {
		return "", "", err
	}
	common, err := mustGit("rev-parse", "rev-parse", "--path-format=absolute", "--git-common-dir")
	if err != nil {
		return "", "", err
	}
	if gitDir == common {
		return tree, "main checkout", nil
	}
	frameCommon, _ := gitIn(sourceDir(), "rev-parse", "--path-format=absolute", "--git-common-dir")
	if frameCommon.out != common {
		return tree, "worktree", nil
	}
	return filepath.Dir(common), "frame worktree: the mirror gate passes only in the main checkout", nil
}

func top() (string, error)  { return mustGit("rev-parse", "rev-parse", "--show-toplevel") }
func head() (string, error) { return mustGit("rev-parse", "rev-parse", "HEAD") }

func branch() (string, error) {
	found, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	if !found.ok {
		return "", &Fail{Msg: "detached HEAD", Next: "git switch -c <branch>"}
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

func nonBlank(log string) []string {
	var lines []string
	for _, line := range strings.Split(log, "\n") {
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
