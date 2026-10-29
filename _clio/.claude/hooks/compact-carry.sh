#!/usr/bin/env bash
# SessionStart:compact — re-prints cclio's last reply that carried a ⏳ block, verbatim from the
# transcript: an auto-compact cannot be steered, and its summary dropped open asks twice (2026-10-08).
set -u
t=$(jq -r '.transcript_path // empty' 2>/dev/null)
[ -r "$t" ] || exit 0
last=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="text") | .text | @json' "$t" 2>/dev/null \
  | grep -F '⏳ waiting on your word' | tail -1 | jq -r .)
[ -n "$last" ] || exit 0
echo "📌 your last reply before the compaction, verbatim — its ⏳ asks are still open unless dima answered them after it:"
printf '%s\n' "$last" | tail -c 6000
