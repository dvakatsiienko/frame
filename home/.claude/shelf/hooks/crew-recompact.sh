#!/usr/bin/env bash
# SessionStart:compact — a crew member re-reads its contract after every compaction. claude code
# re-attaches loaded skills cut at 19,995 chars, and none at all when a resumed process compacts
# (probe 2026-09-30), so the contract comes back from disk. stdout lands in the compacted context.
set -u
transcript=$(jq -r '.transcript_path // empty')
[ -f "$transcript" ] || exit 0
# a crew member's opening prompt is the command; a later mention (cclio talking about it) is not one
opening=$(head -40 "$transcript" | grep -m1 '"type":"user"')
skills=~/frame/home/.claude/plugin-x/skills
for role in coder verifier designer cloud; do
  printf '%s' "$opening" | grep -q "<command-name>/x:crew-${role}</command-name>" || continue
  files="${skills}/crew-${role}/SKILL.md"
  [ "$role" = coder ] && files="$files and ${skills}/crew-coder/how-you-work.md"
  echo "🛑 STOP — you are a ${role} and this session was just compacted; your crew-${role} contract did not survive it whole. your NEXT tool call is Read ${files}, in full — no other tool, message, comment or reviewer request before it, even when the summary says what to do next. they bind as they did at spawn; then resume from the summary."
  exit 0
done
