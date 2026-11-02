#!/bin/bash
# a side channel of clio (a fork, or a fresh session she started) knows it is not the main, and wakes nothing of hers (FRM-430, FRM-464)
# usage: fork-guard.sh start            SessionStart, first: record the main, or print the fork banner
#        fork-guard.sh announce         UserPromptSubmit: the main names each new fork once
#        fork-guard.sh fork-edit        PreToolUse Edit|Write: a fork edits only inside its own worktree
#        fork-guard.sh fork-bash        PreToolUse Bash: the same for a shell write (a redirect, tee, an in-place verb)
#        fork-guard.sh main-only -- cmd  run cmd (stdin passed through) only in the main session
set -uo pipefail
state="${FORK_GUARD_STATE:-$HOME/.local/state/clio}"
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
🍴 you are clio's side channel, not the main: a fork of her thread or a fresh session she started. you unload her thread: dima's side questions, research, fixes, with her memory and skills (FRM-464):
- you are disconnected from her flows: crow, helga, the lanes and the watches never see you; arm nothing (no Monitor, no watch, no boot), never push, never message a lane member, crow or helga
- linear is yours through `clio:pm` for asks born here; the pocket too, every item born with `node script/pocket-add.ts … --side`, which the main's next boot takes over
- a change dima asks for runs in your own worktree: EnterWorktree with name «fork-<your session id's first 8>», edit and `x lane commit` there; an edit in a main checkout is refused; leave it with ExitWorktree «keep» (the seed's ignored files read as uncommitted), the halt merges or drops its branch
- the end: when dima says the work is done, send «🦉 clio» one SendMessage, then stop; dima archives you from the sidebar. your prompts reach no prompt log, so it opens with «dima's asks here»: every ask or wish of his from this thread, his words copied, each with its home (the ticket or pocket id you wrote, or «main's call»), then every external write; a long report goes to a .scratch file, its path in the message
- your first reply says you are the side channel; before it, if your session title lacks «(side», rename yourself (set_session_title «self», «🦉 clio (side)»): a copy carrying the main's exact name gets the main's messages and helga's trust
- 🗨️ a reader with read-only tools is a /btw side chat, not this fork: answer only, and end with a «copy → clio» fence for dima to paste if it is worth keeping
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
fork-edit | fork-bash)
	# PreToolUse: a fork writes only inside its own worktree, never a main checkout (FRM-430; Bash: FRM-462)
	is_main && exit 0
	input=$(cat)
	# a linked worktree has its own git dir; a main checkout's git dir is the common one
	in_main_checkout() {
		local dir=$1 gitdir common
		# a git hook's inherited GIT_DIR would answer for the hook's repo, not the edited file's
		unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR
		while [ -n "$dir" ] && [ ! -d "$dir" ]; do dir=$(dirname "$dir"); done
		gitdir=$(git -C "$dir" rev-parse --absolute-git-dir 2>/dev/null) || return 1
		common=$(cd "$dir" && cd "$(git rev-parse --git-common-dir)" && pwd -P)
		[ "$gitdir" = "$common" ]
	}
	if [ "$1" = fork-edit ]; then
		file=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
		in_main_checkout "$(dirname "$file")" || exit 0
	else
		cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
		cwd=$(jq -r '.cwd // ""' <<<"$input")
		hit=""
		# redirect and tee targets, resolved against the cwd
		for t in $(grep -oE '(>>?|tee( -a)?) *[^ ;&|<>]+' <<<"$cmd" | sed -E 's/^(>>?|tee( -a)?) *//'); do
			case "$t" in /dev/*) continue ;; /*) f=$t ;; "~"/*) f="$HOME/${t#\~/}" ;; *) f="$cwd/$t" ;; esac
			in_main_checkout "$(dirname "$f")" && { hit=$f; break; }
		done
		# an in-place verb writes where the shell stands
		if [ -z "$hit" ] && grep -qE '(^|[;&|] *)(sd|sed -i|mv|cp|trash|rm|git (commit|add|checkout|reset|stash)|x lane commit)( |$)' <<<"$cmd"; then
			in_main_checkout "$cwd" && hit=$cwd
		fi
		[ -n "$hit" ] || exit 0
	fi
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
