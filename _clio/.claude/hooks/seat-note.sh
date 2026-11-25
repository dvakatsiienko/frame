#!/bin/bash
# a thread whose main seat moved reads its line once, at its next prompt; `x thread rename --role` writes the file
set -uo pipefail
input=$(cat)
session=$(jq -r '.session_id // ""' <<<"$input" 2>/dev/null)
[[ "$session" =~ ^[A-Za-z0-9-]+$ ]] || exit 0
note="${FORK_GUARD_STATE:-$HOME/.local/state/clio}/seat-notes/$session"
taken="$note.taken.$$"
# the mv is the claim: of two prompts at once, one takes the file
mv "$note" "$taken" 2>/dev/null || exit 0
line=$(cat "$taken" 2>/dev/null)
trash "$taken" 2>/dev/null
# an idle herdr thread gets the same line as its prompt
jq -e --arg line "$line" '(.prompt // "") | contains($line)' <<<"$input" >/dev/null 2>&1 || printf '%s\n' "$line"
exit 0
