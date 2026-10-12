---
id: PK-90
title: >-
  refresh-crew-coordinator run: re-verify spawning-mechanics, right after the
  memory sweep
status: open
assignee: []
created_date: '2026-10-12 11:23'
updated_date: '2026-10-12 17:54'
due_date: '2026-10-26'
labels:
  - m
dependencies: []
priority: later
type: task
ordinal: 100060
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-12 (o3): postpone the spawning-mechanics refresh to right after the memory sweep (FRM-267) is fully resolved. moved here from _reminders.md, whole line kept:
⏰ 🦉📜 spawning-mechanics artifact freshness — `docs/knowledge/spawning-mechanics.md` verified against cc 2.1.283 (2026-09-27, run #3 of `refresh-crew-coordinator`: no row flipped; the compaction hooks proven end to end); re-run the procedure when the cc version changes, or when a spawn behaves against a [verified] row. the subagent stack row is [volatile] — the first thing run #3 probes — set 2026-08-30 · input for the refresh (dima, 2026-10-12): theo's «finally a good small model» on the shelf, `~/.claude/shelf/yt-transcripts/theo-t3gg-finally-a-good-small-model-38_6C0dkKmU/` · due: 2026-10-12
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: waits for the memory sweep (FRM-267) to close; dima, 2026-10-12

dima o94 ✓ 20:54: this run also measures the auto-compact threshold — exercise CLAUDE_AUTOCOMPACT_PCT_OVERRIDE / autoCompactWindow / --autocompact (spawning-mechanics.md:325-329), and where quality drops; the 600–700k manual checkpoint stays until then
<!-- SECTION:NOTES:END -->
