package main

import (
	"os"
	"strings"
)

func commit(r *Run, args []string, flags Flags) (_ any, err error) {
	leaveTurn := func(error) {}
	defer func() { leaveTurn(err) }()
	call, err := readCommitCall(args, flags)
	if call.piped != "" {
		defer os.Remove(call.piped)
	}
	if err != nil {
		return nil, err
	}

	tree, err := top()
	if err != nil {
		return nil, err
	}
	paths, err := commitPaths(tree, call)
	if err != nil {
		return nil, err
	}
	if err := os.Chdir(tree); err != nil {
		return nil, err
	}
	name, _ := git("symbolic-ref", "--quiet", "--short", "HEAD")
	r.Open(name.out)
	if err := dryRefusal(tree, call); err != nil {
		return nil, err
	}

	if err := r.Step("tree", "checking the tree", func() (string, error) {
		return home(tree), assertUnlocked(tree)
	}); err != nil {
		return nil, err
	}
	// before all that reads the tree or the index: a git commit holds the shared index lock through its hook, so a stage outside
	// the turn dies on a peer's, an edit in the wait would skip format and quotes, and a peer's commit moves the HEAD a dry run copies
	retry := commitRetryLines(call)
	if err := r.Step("turn", "waiting for the gate turn", func() (string, error) {
		leave, err := takeGateTurn(retry.verb+retry.paths, retry.verb+retry.rest())
		leaveTurn = leave
		return "", err
	}); err != nil {
		return nil, err
	}
	var dryIndex []string
	var dryTree func() (string, error)
	if call.dry {
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
	bumped, paths, undoBump, err := bumpForCommit(r, tree, call, paths)
	if err != nil {
		return nil, err
	}
	landed := false
	defer func() {
		if !landed && (err != nil || call.dry) {
			undoBump()
		}
	}()
	if err := peerHoldsStep(r, tree, paths, call.paths, retry.head); err != nil {
		return nil, err
	}
	present, paths, err := sortCommitPaths(call, paths)
	if err != nil {
		return nil, err
	}
	waited, err := stageCommit(r, tree, present, paths)
	if err != nil {
		return nil, err
	}
	if err := r.Step("quotes", "dima's quoted lines in memory, skill and rules files", func() (string, error) {
		return quotesKept(call.message, call.msgFile, paths)
	}); err != nil {
		return nil, err
	}
	message := call.message
	copied, err := ftrMessage(r, tree, message, paths)
	if err != nil {
		return nil, err
	}
	if copied != "" {
		defer os.Remove(copied)
		message = copied
	}

	if call.dry {
		return dryCommit(r, tree, message, dryIndex, dryTree, "x lane commit --dry "+retry.rest(), "x lane commit "+retry.rest())
	}

	aside, err := holdUnstaged(r, tree, call.hold, paths)
	if err != nil {
		return nil, err
	}
	sha, took, stopped := commitHooked(r, tree, name.out, message, "x lane commit "+retry.rest(), paths)
	// from here the bump is in HEAD: a failed restore of the held files must not take it back
	landed = stopped == nil
	if err := restoreUnstaged(r, tree, sha, aside, stopped); err != nil {
		return nil, err
	}
	return reportCommit(r, commitDone{sha, tree, present, aside, bumped, waited + took})
}
