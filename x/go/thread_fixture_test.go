package main

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/creack/pty"
)

type scripted struct {
	code int
	out  string
}

// x on a pty, the agent env stripped: what a member's `env -u CLAUDECODE -u AI_AGENT script -q /dev/null x …` runs
// (script(1) itself takes other flags on linux, so the test opens the pty)
func scriptX(t *testing.T, env []string, args ...string) scripted {
	t.Helper()
	c := exec.Command(xbin, append(args, "--json")...)
	c.Env = append(append(cleanEnv(), "X_TEST=1", "HC_TERMINAL_ID="), env...)
	ptmx, err := pty.Start(c)
	if err != nil {
		t.Fatal(err)
	}
	defer ptmx.Close()
	out, _ := io.ReadAll(ptmx)
	return scripted{exitOf(c.Wait()), string(out)}
}

// FRM-600 exit 4: one rename moves the record, the herdr tab and the cc name; a display resolves to its session id
type renameWorld struct {
	env                         []string
	store, hcLog, tabs, lockLog string
}

// renameFixture plants a live quick codie on herdr terminal t9 and fake hc and herdr-app clis that log what they are told;
// herdrFails makes the fake window refuse a tab.rename, noTab leaves the terminal in no tab, and the thread reads working for
// its first busy hc get calls
func renameFixture(t *testing.T, records string, herdrFails, noTab bool, busy int) renameWorld {
	t.Helper()
	const rule = "────────────────────────────────────────"
	sessions, bin := t.TempDir(), t.TempDir()
	w := renameWorld{store: filepath.Join(t.TempDir(), "threads.json"), hcLog: filepath.Join(bin, "hc.log"), tabs: filepath.Join(bin, "herdr.log"), lockLog: filepath.Join(bin, "lock.log")}
	write(t, filepath.Join(sessions, "s1.json"), fmt.Sprintf(`{"sessionId":"s1","pid":%d}`, os.Getpid()))
	write(t, w.store, records)
	write(t, filepath.Join(bin, "screen.txt"), "❯ an old prompt\n\n● an answer\n\n"+rule+"\n❯ \n"+rule+"\n  the status line\n")
	write(t, filepath.Join(bin, "draft.txt"), "❯ an old prompt\n\n● an answer\n\n"+rule+"\n❯ half a prompt\n"+rule+"\n  the status line\n")
	write(t, filepath.Join(bin, "hc"), fmt.Sprintf(`#!/bin/sh
case "$1" in
ls) echo '{"terminals":[{"address":"t9","agent":"claude-code"}]}' ;;
get) n=$(cat %s 2>/dev/null || echo 0); echo $((n+1)) > %s; state=done; [ "$n" -lt %d ] && state=working; echo '{"pid":%d,"status":{"state":"'$state'"}}' ;;
read) r=$(cat %s 2>/dev/null || echo 0); echo $((r+1)) > %s; if [ -n "$DRAFT" ] && [ "$r" -ge "${DRAFT_AFTER:-0}" ]; then cat %s; else cat %s; fi ;;
send) echo "send $2 $3" >> %s; case "$3" in /rename*) [ -z "$FAIL_RENAME" ] || exit 1 ;; esac ;;
esac
`, filepath.Join(bin, "gets"), filepath.Join(bin, "gets"), busy, os.Getpid(), filepath.Join(bin, "reads"), filepath.Join(bin, "reads"), filepath.Join(bin, "draft.txt"), filepath.Join(bin, "screen.txt"), w.hcLog))
	tab := `[{"id":"tbA","terminals":[{"terminal":"t9"}]}]`
	if noTab {
		tab = `[]`
	}
	write(t, filepath.Join(bin, "herdr-app"), fmt.Sprintf(`#!/bin/sh
case "$1 $2" in
"ls ") echo '{"spaces":[{"tabs":%s}]}' ;;
"do terminal.keep") echo "keep $3" >> %s; echo '{"tab":"tbNew"}' ;;
"do tab.rename") python3 -c 'import fcntl,sys
f=open(sys.argv[1]+".lock","a")
try:
    fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB); print("free")
except OSError:
    print("held")' "$X_THREADS" >> %s; echo "rename $3" >> %s; n=$(cat %s 2>/dev/null || echo 0); echo $((n+1)) > %s; [ "%t" = true ] && { echo window refused >&2; exit 1; }; [ "$n" -ge "${TAB_FAILS:-0}" ] || { echo not yet >&2; exit 1; }; echo '{}' ;;
esac
`, tab, w.tabs, w.lockLog, w.tabs, filepath.Join(bin, "tabs.n"), filepath.Join(bin, "tabs.n"), herdrFails))
	for _, name := range []string{"hc", "herdr-app"} {
		if err := os.Chmod(filepath.Join(bin, name), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	w.env = []string{"X_SESSIONS=" + sessions, "X_THREADS=" + w.store, "X_HC=" + filepath.Join(bin, "hc"), "X_HERDR_APP=" + filepath.Join(bin, "herdr-app"), "HC_TERMINAL_ID=t3b"}
	return w
}

const quickCodie = `{"sessionId":"s1","role":"codie","lane":"chores","laneKind":"quick","ticket":"FRM-1","area":"stray"}`
