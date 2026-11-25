package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
)

var modDir = regexp.MustCompile(`^home/\.claude/plugin-x/mods/[^/]+/`)

// the commit hook only reports (lefthook must never rewrite files it holds aside), so the
// format runs here, before staging, on the named paths alone; a failure is left for the hook to name
func format(tree string, paths []string) string {
	biome := filepath.Join(tree, "node_modules/.bin/biome")
	hasConfig := exists(filepath.Join(tree, "biome.json")) || exists(filepath.Join(tree, "biome.jsonc"))
	if len(paths) == 0 || !hasConfig || !exists(biome) {
		return "no biome here, skipped"
	}
	_, _ = run(tree, nil, "", biome, append([]string{"check", "--write", "--no-errors-on-unmatched", "--files-ignore-unknown=true"}, paths...)...)
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
	// runs around argv, never named in what the caller reads
	wrap []string
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
		argv := append(slices.Clone(job.wrap), job.argv...)
		if done, _ := run(job.dir, job.env, "", argv[0], argv[1:]...); !done.ok {
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
			jobs = append(jobs, ciJob{module, []string{"GIT_CONFIG_GLOBAL=/dev/null"}, []string{"go", "test", "./..."}, cpuBudgetLog(tree, module)})
		}
	}
	if ts {
		scripts := packageScripts(tree)
		hooked := preCommitRuns(tree)
		for _, script := range []string{"typecheck", "test"} {
			if scripts[script] != "" && !hooked[script] {
				jobs = append(jobs, ciJob{dir: tree, argv: []string{"pnpm", script}})
			}
		}
	}
	return jobs
}

// a repo that keeps a test-cpu-budget logs this run's cost; log only, since a commit never reds on cost
func cpuBudgetLog(tree, module string) []string {
	suite, err := filepath.Rel(tree, module)
	budget := filepath.Join(tree, "script/test-cpu-budget.sh")
	if err != nil || !exists(budget) {
		return nil
	}
	return []string{budget, "--log-only", strings.ReplaceAll(suite, "/", "-")}
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
	return "", &Fail{Refused: true, Msg: "a quote of dima's changed or went; show him each line, then add a line holding only quotes: shown to the message file:\n" + checked.out,
		Next: "printf '\\nquotes: shown\\n' >> " + msgFile + " && x lane commit " + msgFile + " -- <paths>"}
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

// the copy the commit reads in the message's place, when it stamps ftr: none; the caller removes it
func ftrMessage(r *Run, tree, message string, paths []string) (copied string, err error) {
	err = r.Step("ftr", "an app's code staged without its FTR.md", func() (string, error) {
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
		return "ftr: none added, " + strings.Join(missing, ", ") + " unchanged", nil
	})
	return copied, err
}
