---
id: PK-261
title: ccrow's packet shows a compaction summary as a dima block
status: done
assignee: []
created_date: '2026-10-22T18:57:00Z'
updated_date: '2026-10-23T10:47:00Z'
due_date: '2026-10-23'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
parked: a ccrow packet fix, not yet sized by a read. from the PK-254 coder retro (2026-10-22): «the compaction summary (isCompactSummary) lands in the packet as a ## dima block» — ccrow then reads cclio's own summary as dima's words.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-23 13:48 cclio: already fixed — ccrow/lib.ts:523 skips isCompactSummary for dima blocks, test lib.test.ts:200 "leaves out a compaction's summary", commit 56de46c5. the halt files it.
<!-- SECTION:NOTES:END -->
