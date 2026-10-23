#!/usr/bin/env bash
# PostToolUse hook — warns the turn an edit pushes a budgeted memory file past its row in
# recipes/nurture-memory/scripts/memory-budgets.tsv, instead of the commit refusing it later.
# Silent on any file without a row; never fails the edit.
set -uo pipefail

path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null) || exit 0
[ -f "$path" ] || exit 0
case "$path" in *.md) ;; *) exit 0 ;; esac

root=$(git -C "$(dirname "$path")" rev-parse --show-toplevel 2>/dev/null) || exit 0
tsv="$root/recipes/nurture-memory/scripts/memory-budgets.tsv"
[ -f "$tsv" ] || exit 0

real=$(cd "$(dirname "$path")" && pwd -P)/$(basename "$path")
rel=${real#"$(cd "$root" && pwd -P)/"}
budget=$(awk -F'\t' -v p="$rel" '$1 == p { print $2; exit }' "$tsv")
[ -n "$budget" ] || exit 0

size=$(wc -c <"$path" | tr -d ' ')
[ "$size" -gt "$budget" ] || exit 0

msg="memory budget: $rel is $size B, $((size - budget)) B over its $budget B row — regroom it now (x:author-memory), or raise its row in memory-budgets.tsv with the reason; the commit gate refuses it as is"
jq -n --arg m "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $m}}'
