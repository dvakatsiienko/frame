package main

import (
	"os"
	"strings"
	"time"
)

// the ci jobs, the hooks and the commit, once more on a red of timeouts alone; stopped is what ended it, ci or the hooks
func commitHooked(r *Run, tree, branch, message, retryLine string, paths []string) (sha string, waited time.Duration, stopped error) {
	if branch == "main" {
		stopped = r.Step("ci", "the ci jobs for the touched paths", func() (string, error) {
			return runCI(tree, paths)
		})
	} else {
		r.skip("ci")
	}
	if stopped != nil {
		return "", 0, stopped
	}
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
		waited = took
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
			refused := hookFail(committed.log, retryLine)
			refused.Log = append(refused.Log, messageReds(tree, message, committed.log)...)
			return "", refused
		}
		sha, err = head()
		return withWait(took, short(sha)+"  "+firstLine(message)+proven+retried), err
	})
	return sha, waited, stopped
}
