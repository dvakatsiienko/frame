#!/bin/bash
# a fork of cclio knows it is a fork, and wakes nothing of hers (FRM-430)
# usage: fork-guard.sh start            SessionStart, first: record the main, or print the fork banner
#        fork-guard.sh main-only -- cmd  run cmd (stdin passed through) only in the main session
set -uo pipefail
state="${FORK_GUARD_STATE:-$HOME/.local/state/cclio}"
main_file="$state/main-session"
mkdir -p "$state"

# the cc process is the nearest ancestor running claude; a shell may sit between it and this script
cc_pid() {
	[ -n "${FORK_GUARD_CC_PID:-}" ] && { echo "$FORK_GUARD_CC_PID"; return; }
	local p=$PPID
	for _ in 1 2 3 4; do
		ps -o command= -p "$p" 2>/dev/null | grep -qE '(^|/)claude( |$)' && { echo "$p"; return; }
		p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
		[ -z "$p" ] && break
	done
	echo "$PPID"
}

me=$(cc_pid)
main_pid=$(sed -n 's/^pid=//p' "$main_file" 2>/dev/null)
# the main is classified positively: its own pid, or the seat is free (none recorded, or that pid is dead)
is_main() { [ -z "$main_pid" ] || [ "$main_pid" = "$me" ] || ! kill -0 "$main_pid" 2>/dev/null; }

case "${1:-}" in
start)
	input=$(cat)
	session=$(jq -r '.session_id // ""' <<<"$input" 2>/dev/null)
	if is_main; then
		printf 'pid=%s\nsession=%s\n' "$me" "$session" >"$main_file"
	else
		printf '%s %s\n' "$session" "$(date '+%F %H:%M')" >>"$state/forks.log"
		cat <<'EOF'
🍴 you are a fork of cclio, not the main. dima forked you to explore and prepare beside her:
- you see her whole thread, but you are disconnected from every flow: ccrow, composer, the lanes and the watches never see you, and you arm nothing (no Monitor, no watch, no boot)
- never write the pocket, linear, orbit asks for lanes, or a push; never message a lane member, ccrow or composer; scratch files are fine
- your one route out is the main: when dima says the work is done, send «🦉 cclio» one SendMessage with the results (a longer report as a file in .scratch, its path in the message), then stop; dima archives you from the sidebar
- your prompts reach no prompt log, so that report opens with «dima's asks here»: every ask or wish of his from this thread, his words copied, each with where it should go; the main folds them- your first reply says you are the fork
EOF
	fi
	;;
main-only)
	shift
	[ "${1:-}" = "--" ] && shift
	is_main || exit 0
	# one string, so a piped hook command («jq … | xargs …») keeps its pipe
	exec bash -c "$*"
	;;
*)
	echo "usage: fork-guard.sh start | main-only -- <cmd>" >&2
	exit 2
	;;
esac
