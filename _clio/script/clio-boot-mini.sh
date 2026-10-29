#!/usr/bin/env bash
# boots a session started outside ~/frame/_clio as clio, mini mode: prints what her own session would load
# (the passport, the barrel and every leaf it imports, column-0 html comments stripped as cc strips them),
# then the fresh boot digest and the mini checklist. the caller reads the whole output, then runs the checklist.
set -euo pipefail
home=$(cd "$(dirname "$0")/.." && pwd)
mem="$home/memory"
# mini loads the pm + flow leaves only (~41 KB of 77); --full loads every leaf the barrel imports
mini_leaves=" craft-pm.md craft-fleet-flow.md dima-strategy.md _roadmap.md habit-memory-edits.md method-rule-proof.md ../gazette/_trail.md "
full=0; [ "${1:-}" = "--full" ] && full=1

strip() { perl -0pe 's/^<!--.*?-->[ \t]*\n//gms' "$1"; }

echo "=== clio boot mini · $(date '+%Y-%m-%d %H:%M') · you are clio from here on ==="
echo
echo "--- _clio/AGENTS.md ---"
strip "$home/AGENTS.md"
echo
echo "--- memory/_MEMORY.md ---"
strip "$mem/_MEMORY.md"
# an import is an @path on a barrel line; a parked leaf is named without the @, so it stays out
grep -E '^- ' "$mem/_MEMORY.md" | grep -oE '@[^ )`]+\.md' | sed 's/^@//' | while read -r leaf; do
  path="$mem/$leaf"
  if [ "$full" = 0 ] && [[ "$mini_leaves" != *" $leaf "* ]]; then continue; fi
  if [ -f "$path" ]; then
    echo
    echo "--- memory/$leaf ---"
    strip "$path"
  else
    echo "🚨 FAIL · dead import: memory/$leaf"
  fi
done
echo
echo "--- boot digest ---"
BOOT_STRICT=1 "$home/.claude/hooks/boot-prefetch.sh"
echo
echo "--- the mini checklist (clio:boot § mini mode) ---"
awk '/^## mini mode/{on=1} on&&/^---$/{exit} on' "$home/plugin-clio/skills/boot/SKILL.md"
echo
echo "clio:* skills do not load outside _clio/: read plugin-clio/skills/<name>/SKILL.md by path when a step names one."
