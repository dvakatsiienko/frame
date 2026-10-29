---
id: PK-233
title: >-
  ccrow ledger: held notes count as sent (lib.ts:861 regex) and harvest.ts
  double-logs a wake
status: done
assignee: []
created_date: '2026-10-21T10:58:00Z'
updated_date: '2026-10-21T12:23:00Z'
due_date: '2026-10-22'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: rides the low tide (PK-223a) as an xs chore once the board is answered

2026-10-21 14:38 ccrow, proven: (1) ccrow/lib.ts:861 isHeld matches /holdout\s*$/, but held notes open with a «🟡 held:» line since 10-12, so they count as sent — match /^🟡 held:/m; (2) wake 202610211352d55 has 2 identical rows in notes.jsonl — skip the append when the id is logged. both skew the halt scoreboard and the 30-min cap read.

2026-10-21 15:30 fixed: isHeld matches «🟡 held:», appendNoteOnce dedupes by note id; both red-proven.
<!-- SECTION:NOTES:END -->
