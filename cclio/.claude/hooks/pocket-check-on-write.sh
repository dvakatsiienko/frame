#!/bin/bash
# a pocket write runs pocket-check and hands a red back to the session; backlog's own hook fires on a status move only (PK-89)
set -uo pipefail
event="$(cat)"
tool="$(jq -r '.tool_name // ""' <<<"$event")"
case "$tool" in
Bash) jq -r '.tool_input.command // ""' <<<"$event" | grep -qE 'backlog task (create|edit|archive|demote)|pocket/(archive/)?tasks' || exit 0 ;;
Edit | Write) jq -r '.tool_input.file_path // ""' <<<"$event" | grep -q '/pocket/' || exit 0 ;;
*) exit 0 ;;
esac
check="${POCKET_CHECK_CMD:-node $HOME/frame/cclio/script/pocket-check.ts}"
out="$($check 2>&1)" && exit 0
reds="$(grep '^🔴' <<<"$out" || printf '%s' "$out")"
jq -n --arg reason "pocket-check is red after this write — fix it now: $reds" '{decision: "block", reason: $reason}'
