#!/bin/bash
# a fork of cclio knows it is a fork, and wakes nothing of hers (FRM-430)
# usage: fork-guard.sh start            SessionStart, first: record the main, or print the fork banner
#        fork-guard.sh announce         UserPromptSubmit: the main names each new fork once
#        fork-guard.sh fork-edit        PreToolUse Edit|Write: a fork edits only inside its own worktree
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
		# a fork's /compact starts it again; it keeps its one line
		grep -q "^$session " "$state/forks.log" 2>/dev/null ||
			printf '%s %s\n' "$session" "$(date '+%F %H:%M')" >>"$state/forks.log"
		cat <<'EOF'
🍴 you are a fork of cclio, not the main. dima forked you to explore and prepare beside her:
- you see her whole thread, but you are disconnected from every flow: ccrow, composer, the lanes and the watches never see you, and you arm nothing (no Monitor, no watch, no boot)
- never write the pocket, linear, orbit asks for lanes, or a push; never message a lane member, ccrow or composer; scratch files are fine
- a change dima asks for runs in your own worktree: EnterWorktree with name «fork-<your session id's first 8>», edit and `x lane commit` there; an edit in a main checkout is refused; leave it with ExitWorktree «keep» (the seed's ignored files read as uncommitted), the halt merges or drops its branch
- your one route out is the main: when dima says the work is done, send «🦉 cclio» one SendMessage with the results (a longer report as a file in .scratch, its path in the message), then stop; dima archives you from the sidebar
- your prompts reach no prompt log, so that report opens with «dima's asks here»: every ask or wish of his from this thread, his words copied, each with where it should go; the main folds them- your first reply says you are the fork
- 🗨️ a reader with read-only tools is a /btw side chat, not this fork: answer only, and end with a «copy → cclio» fence for dima to paste if it is worth keeping
EOF
	fi
	;;
announce)
	# the main's prompt hook: one «🍴» line per fork, once it has a first prompt of dima's to name it by
	is_main || exit 0
	seen="$state/forks.seen"
	touch "$seen"
	projects="${FORK_GUARD_PROJECTS:-$HOME/.claude/projects}"
	while read -r sid day hm; do
		[ -n "$sid" ] && ! grep -qx "$sid" "$seen" || continue
		transcript=$(ls "$projects"/*/"$sid.jsonl" 2>/dev/null | head -1)
		[ -n "$transcript" ] || continue
		# bsd date on the mac, gnu date on ci
		since=$(date -j -f '%F %H:%M' "$day $hm" +%s 2>/dev/null || date -d "$day $hm" +%s 2>/dev/null) || continue
		topic=$(jq -r --argjson since "$since" 'select(.type == "user" and (.message.content | type) == "string")
			| select((.timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) >= $since)
			| .message.content | select(test("^\\s*[<\\[]") | not) | split("\n")[0][0:60]' "$transcript" 2>/dev/null | head -1)
		[ -n "$topic" ] || continue
		printf '🍴 fork «%s» started %s\n' "$topic" "$hm"
		echo "$sid" >>"$seen"
	done <"$state/forks.log" 2>/dev/null
	;;
fork-edit)
	# PreToolUse on Edit|Write: a fork edits only inside its own worktree, never a main checkout (FRM-430)
	is_main && exit 0
	input=$(cat)
	file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
	dir=$(dirname "$file")
	while [ -n "$dir" ] && [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
	gitdir=$(git -C "$dir" rev-parse --absolute-git-dir 2>/dev/null) || exit 0
	common=$(cd "$dir" && cd "$(git rev-parse --git-common-dir)" && pwd -P)
	# a linked worktree has its own git dir; a main checkout's git dir is the common one
	[ "$gitdir" != "$common" ] && exit 0
	sid=$(jq -r '.session_id // ""' <<<"$input" | cut -c1-8)
	jq -n --arg why "a fork edits only inside its own worktree: call EnterWorktree with name «fork-$sid» first, then edit and commit there (x lane commit); the main merges its branch worktree-fork-$sid" \
		'{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $why}}'
	;;
main-only)
	shift
	[ "${1:-}" = "--" ] && shift
	is_main || exit 0
	# one string, so a piped hook command («jq … | xargs …») keeps its pipe
	exec bash -c "$*"
	;;
*)
	echo "usage: fork-guard.sh start | announce | fork-edit | main-only -- <cmd>" >&2
	exit 2
	;;
esac
