#!/usr/bin/env bash
# SessionStart:compact — a cclio running a shift re-reads its plan after every compaction. the
# running plan is the file in shifts/ whose header says `status: running` (cclio:shift writes it at
# start, flips it to `done` at the report). stdout lands in the compacted context.
set -u
shifts="${SHIFTS_DIR:-$HOME/frame/cclio/shifts}"
plan=$(grep -l -m1 '^status: running' "$shifts"/*.md 2>/dev/null | head -1)
[ -n "$plan" ] || exit 0
skill="$HOME/frame/cclio/plugin-cclio/skills/shift/SKILL.md"
echo "🛑 STOP — you are cclio, a shift is running (${plan}) and this session was just compacted. your NEXT tool call is Read ${plan} in full, then Read ${skill} — no other tool or message before them. resume from the last lines of its ## log; the ⏳ block stays suspended. the log's tail, as it stood:"
awk '/^## log/{on=1;next} on&&/^## /{exit} on&&NF' "$plan" | tail -5
echo "(a plan left at status: running by a shift that ended is stale — flip it to done.)"
