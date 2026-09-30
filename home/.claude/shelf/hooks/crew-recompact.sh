#!/usr/bin/env bash
# SessionStart:compact — a crew member re-reads its contract after every compaction. claude code
# re-attaches loaded skills cut at 19,995 chars, and none at all when a resumed process compacts
# (probe 2026-09-30), so the contract comes back from disk. stdout lands in the compacted context.
set -u
transcript=$(jq -r '.transcript_path // empty')
[ -f "$transcript" ] || exit 0
skills=~/frame/home/.claude/plugin-x/skills
for role in coder verifier designer cloud; do
  grep -q "<command-name>/x:crew-${role}</command-name>" "$transcript" || continue
  files="${skills}/crew-${role}/SKILL.md"
  [ "$role" = coder ] && files="$files and ${skills}/crew-coder/how-you-work.md"
  echo "📌 you are a ${role}: this session was compacted and your crew-${role} contract did not survive it whole. before your next action, Read ${files} in full — they bind as they did at spawn. the job, ticket and coordinator name are in the summary above."
  exit 0
done
