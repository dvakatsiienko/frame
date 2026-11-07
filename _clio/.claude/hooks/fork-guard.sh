#!/bin/bash
# a wing of clio (a fork, or a fresh session she started) knows it is not the main, and wakes nothing of hers (FRM-430, FRM-464)
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
# a dead main leaves the seat empty until a start fills it, so no wing's guard lifts in the gap
is_main() { [ "$main_pid" = "$me" ]; }

# a compact, a /clear, a known wing and a session her registry names a wing never take the seat, even an empty one
takes_seat() {
	is_main && return 0
	[ -n "$session" ] && [ "$session" = "$(sed -n 's/^session=//p' "$main_file" 2>/dev/null)" ] && return 0
	case "$source" in compact | clear) return 1 ;; esac
	grep -q "^$session " "$state/forks.log" 2>/dev/null && return 1
	case "$entry" in *🪽* | *wing*) return 1 ;; esac
	[ -z "$main_pid" ] || ! kill -0 "$main_pid" 2>/dev/null
}

case "${1:-}" in
start)
	input=$(cat)
	session=$(jq -r '.session_id // ""' <<<"$input" 2>/dev/null)
	source=$(jq -r '.source // ""' <<<"$input" 2>/dev/null)
	entry=$(jq -r '[.kind // "", .name // ""] | @tsv' "${FORK_GUARD_SESSIONS:-$HOME/.claude/sessions}/$me.json" 2>/dev/null)
	# crow and helga are parked sidecars, neither the main nor a wing
	[[ $entry == bg$'\t'* ]] && exit 0
	if takes_seat; then
		printf 'pid=%s\nsession=%s\n' "$me" "$session" >"$main_file"
	else
		# a fork's /compact starts it again; it keeps its one line
		grep -q "^$session " "$state/forks.log" 2>/dev/null ||
			printf '%s %s\n' "$session" "$(date '+%F %H:%M')" >>"$state/forks.log"
		cat <<'EOF'
🍴 you are clio's wing, not the main: a fork of her thread or a fresh session she started. you unload her thread: dima's side questions, research, fixes, with her memory and skills (FRM-464):
- you are disconnected from her flows: her lanes and watches never see you; arm nothing (no watch, no boot), except a read-only Monitor on a peer's commit, with a deadline, never push past your own landing, never message a member of her lanes, the second-wind notice excepted
- helga takes your chores, by SendMessage as `x:crew-helga` names them
- a lane starts from here only on dima's own words for a chore of yours: `clio:shape-lane-dispatch`, you its coordinator; it has no glide card and no quiet gate here, so its member's notes wake you
- crow takes your consults, she does not read this thread: a call you'd decide alone goes to her by SendMessage under the name ListAgents prints, one question; a plan goes through `pnpm crow:plan-critique <file>`, run in the background
- linear is yours through `clio:pm` for asks born here; the pocket too, every item born with `node script/pocket-add.ts … --wing <N>`, labelled `clio-wing-<N>` until you hand it back
- a change dima asks for runs in your seat's worktree, while the session stands in `~/frame/_clio`: never EnterWorktree, which hides the `clio:*` skills and refuses complex shell. the tree is `~/frame/.claude/worktrees/clio-wing-<N>`, branch `clio-wing-<N>`, and it outlives you: there already, it's yours; else `git -C ~/frame -c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false worktree add -b clio-wing-<N> ~/frame/.claude/worktrees/clio-wing-<N> main`, then `x lane seed <tree>`. edit by absolute path; commit in two calls, `cd <tree>`, then `x lane commit`; an edit in a main checkout is refused
- your flyway first (`habit-shared-files` § the flyway): read `flyway: wing <N>`, clean its finished lines, keep it live
- your tree stays level by itself: each prompt merges main into it, and its 🌿 line names what needs you
- you land your own branch at each finished piece, no message to clio: commit, then `~/frame/_clio/.claude/hooks/tree-sync.sh land` in the background (main in, fast-forward main, push, bump a changed plugin, refresh the other wings' trees); your tree stays for the next piece
  - a known hiccup: a file main has staged blocks the fast-forward. `[ask]` clio to commit hers, since it is her work, then land with no further ask; any other conflict or refusal: stop, `[ask]` clio
- a ticket you work carries your `clio-wing-<N>` label, on at your first write, off when you hand it back or close it
- you keep the siesta habit by `clio:siesta`, its due stamp main's: run its steps at each finished batch with both cards, wishkeeper and wisphunter, a brief's paths absolute
- your second wind sends and ends with `clio:checkpoint`'s notice words, you as `wing <N>`
- the end: only «halt» ends you, from dima or from main. finish your tails and start no big ticket; groom your flyway to the real state; mark your pocket items done, hand the rest back with its label off; close the tickets that landed, name why the rest stay; leave no stray; land your tree, which stays; send «🦉 clio» one SendMessage with your progress, what's done and what's left, then stop; main archives you. your prompts reach no prompt log, so that message opens with «dima's asks here»: every ask or wish of his from this thread, his words copied, each with its home (the ticket or pocket id you wrote, or «main's call»), then every external write
- every file you hand over (a long closing report, a file the main or a member asks for) lives in your worktree's `.scratch/`, its full path in the message; a path the main names in its own checkout gets the worktree copy, and the message says so
- your first reply says you are the wing, a second clio; before it, if your session title lacks «wing», rename yourself (set_session_title «self», «🦉🪽 clio: wing <lowest free number>»): a copy carrying the main's exact name gets the main's messages
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
		# main's gitignored .scratch holds a lane's spec, whichever clio runs the lane
		case "$file" in */.scratch/*) exit 0 ;; esac
		in_main_checkout "$(dirname "$file")" || exit 0
	else
		cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
		# its own pocket items (pocket-add --wing <N>) are the one commit a fork makes in main, or x-mod-holds keeps them held (FRM-472 07c)
		q="[\"']"
		# anchored: _clio/pocket/tasks/pk-<name>.md or pocket/tasks/…, no / after pk- (so no ..), a cd only to frame or _clio
		dir="(_clio/)?pocket/tasks/pk-"
		pocket="($q$dir[^/;&|\"']*\.md$q|$dir[^/ ;&|\"']*\.md)"
		home="(~|$HOME)/frame(/_clio)?/?"
		# one line, no substitution: grep matches per line, and $( or a backtick runs inside the quotes
		case "$cmd" in *$'\n'* | *$'\t'* | *$'\r'* | *'$'* | *'`'* | *'*'* | *'?'* | *'['* | *'<'* | *'>'* | *'('*) ;; *)
			grep -qE "^ *(cd $home && )?(timeout [0-9]+ )?x lane commit [^- ;&|][^ ;&|]* -- *($pocket *)+$" <<<"$cmd" && exit 0 ;;
		esac
		# the guard's own parser, so a quoted `>` or a prose word stays text; a crash here passes the call, as no guard stands
		hit=$(node "$(dirname "$0")/../../script/fork-bash-check.ts" <<<"$input" 2>/dev/null)
		[ -n "$hit" ] || exit 0
	fi
	jq -n --arg why "a wing edits only inside its own worktree: make «clio-wing-<N>» by the banner's line, edit it by absolute path, commit there (x lane commit), and land it with tree-sync.sh land, the banner's landing line" \
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
