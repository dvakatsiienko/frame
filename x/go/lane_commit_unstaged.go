package main

import "errors"

// --hold-unstaged: every other change in the tree set aside, so the hooks read the commit alone
func holdUnstaged(r *Run, tree string, hold bool, paths []string) (aside *held, err error) {
	if !hold {
		r.skip("hold", "restore")
		return nil, nil
	}
	err = r.Step("hold", "moving the other changes aside", func() (string, error) {
		taken, err := holdAside(tree, paths)
		if err != nil {
			if taken != nil {
				err = errors.Join(err, taken.restore(tree, ""))
			}
			return "", err
		}
		aside = taken
		return aside.summary(), nil
	})
	return aside, err
}

// the held files come back whether the hooks passed or refused; its error is the run's: what stopped the commit, a failed
// restore, or both
func restoreUnstaged(r *Run, tree, sha string, aside *held, stopped error) error {
	if aside == nil {
		return stopped
	}
	if err := r.Step("restore", "putting the held files back", func() (string, error) {
		return plural(len(aside.files), "file") + " back, byte for byte", aside.restore(tree, sha)
	}); err != nil {
		// both failed: the hook's words and the held dir are each the caller's next move
		if refused, ok := errors.AsType[*Fail](stopped); ok {
			both := &Fail{Msg: refused.Msg + "; and " + err.Error(), Log: refused.Log}
			if lost, ok := errors.AsType[*Fail](err); ok {
				both.Next = lost.Next
			}
			return both
		}
		return err
	}
	return stopped
}
