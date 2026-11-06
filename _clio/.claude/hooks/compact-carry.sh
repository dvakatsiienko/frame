#!/usr/bin/env bash
# SessionStart:compact — re-prints clio's last reply that carried a ⏳ block, verbatim from the
# transcript: an auto-compact cannot be steered, and its summary dropped open asks twice (2026-10-08).
set -u
t=$(jq -r '.transcript_path // empty' 2>/dev/null)
# a lane past its round cap: its stop survives this compact, read from the mod's store
s="$HOME/.claude/plugins/store/x-mod-stash_inline-99d499f0f4e0.json"
[ -r "$s" ] && jq -r 'to_entries[]? | select(.key | startswith("lane-rounds:")) | select((.value.count? // 0) >= 3)
  | "📌 \(.key | sub("^lane-rounds:"; "")): round \(.value.count), at or past the cap of 3"' "$s" 2>/dev/null
[ -r "$t" ] || exit 0
last=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text | @json' "$t" 2>/dev/null \
  | grep -F '⏳ waiting on your word' | tail -1 | jq -r .)
[ -n "$last" ] || exit 0
echo "📌 your last reply before the compaction, verbatim — its ⏳ asks are still open unless dima answered them after it:"
printf '%s\n' "$last" | tail -c 6000
