package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
)

// seed hands a hand-made worktree to the same hook EnterWorktree fires, so one script holds the
// recipe: git-crypt unlock, the mods' generated types and tsconfigs, the repo's install
func seed(r *Run, args []string, _ Flags) (any, error) {
	tree, err := filepath.Abs(args[0])
	if err != nil || !exists(filepath.Join(tree, ".git")) {
		return nil, &Fail{IsUsage: true, Msg: args[0] + " is not a git worktree", Next: "git worktree add <path> && x lane seed <path>"}
	}
	hook := filepath.Join(sourceDir(), "../../home/.claude/shelf/hooks/worktree-seed.sh")
	r.Open(tree)
	if err := r.Step("seed", "the EnterWorktree seed hook", func() (string, error) {
		payload, _ := json.Marshal(map[string]any{"tool_response": map[string]string{"worktreePath": tree}})
		got, err := run(tree, nil, string(payload), "sh", hook)
		// each failure line the hook prints says «failed»; its other line is advice for a repo with no worktree:seed
		if err != nil || strings.Contains(got.out, "failed") {
			return "", &Fail{Msg: "the seed hook reported a failure", Next: "sh " + hook + " < payload.json", Log: nonBlank(got.log)}
		}
		return "unlocked, types copied, installed", nil
	}); err != nil {
		return nil, err
	}
	if err := r.Step("verify", "reading the git-crypt set", func() (string, error) {
		left, err := lockedPaths(tree)
		if err == nil && len(left) > 0 {
			err = &Fail{Msg: "still ciphertext: " + strings.Join(left, ", "), Next: "x lane unlock"}
		}
		return "no ciphertext left", err
	}); err != nil {
		return nil, err
	}
	r.Done("seeded "+tree, "")
	return ordered{{"tree", tree}}, nil
}
