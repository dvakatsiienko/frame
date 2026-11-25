package main

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

func peerHoldsStep(r *Run, tree string, paths, typed []string, retryHead string) error {
	return r.Step("holds", "the paths another session holds", func() (string, error) {
		if held := heldByOthers(tree, paths); len(held) > 0 {
			// heldByOthers reads root-form paths; the retry reruns from this cwd, so it names them as typed
			for i := range held {
				if at := slices.Index(paths, held[i].named); at >= 0 && at < len(typed) {
					held[i].named = typed[at]
				}
			}
			return "", heldFail(held, retryHead, typed)
		}
		return "none held by another session", nil
	})
}

// the named paths formatted, a mod among them validated, then staged
func stageCommit(r *Run, tree string, present, paths []string) (waited time.Duration, err error) {
	if err := r.Step("format", "biome on the named paths", func() (string, error) {
		return format(tree, onDisk(present)), nil
	}); err != nil {
		return 0, err
	}
	if err := r.Step("mods", "claude plugin validate", func() (string, error) {
		return validateMods(tree, present)
	}); err != nil {
		return 0, err
	}
	err = r.Step("stage", "git add", func() (string, error) {
		if len(present) > 0 {
			added, took, err := lockedGit(append([]string{"add", "-A", "--"}, present...)...)
			waited = took
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
	})
	return waited, err
}
