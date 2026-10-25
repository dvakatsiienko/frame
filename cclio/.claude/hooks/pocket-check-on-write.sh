#!/bin/bash
# a pocket write runs pocket-check and hands a red back to the session; backlog's own hook fires on a status move only (PK-89)
set -uo pipefail
event="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$event")"
case "$tool" in
Bash)
	# a redirect to /dev/null or a fd dup is no write
	cmd="$(jq -r '.tool_input.command // ""' <<<"$event" | sed -E 's#[0-9]*>>?[[:space:]]*/dev/null##g; s#[0-9]*>&[0-9]+##g')"
	# write verbs only; a read (grep, cat, ls) of the pocket never fires it
	grep -qE 'backlog task (create|edit|archive|demote)' <<<"$cmd" ||
		{ grep -qE 'pocket/(archive/)?tasks' <<<"$cmd" && grep -qE '(^|[[:space:];&|(])(mv|trash|rm|tee|cp)[[:space:]]|sed[[:space:]]+(-[a-zA-Z]*[[:space:]]+)*-i|>' <<<"$cmd"; } || exit 0
	;;
Edit | Write) jq -r '.tool_input.file_path // ""' <<<"$event" | grep -q '/pocket/' || exit 0 ;;
*) exit 0 ;;
esac
check="${POCKET_CHECK_CMD:-node $HOME/frame/cclio/script/pocket-check.ts}"
out="$($check 2>&1)" && exit 0
reds="$(grep '^🔴' <<<"$out" || printf '%s' "$out")"
jq -n --arg reason "the pocket is red — fix it now: $reds" '{decision: "block", reason: $reason}'
