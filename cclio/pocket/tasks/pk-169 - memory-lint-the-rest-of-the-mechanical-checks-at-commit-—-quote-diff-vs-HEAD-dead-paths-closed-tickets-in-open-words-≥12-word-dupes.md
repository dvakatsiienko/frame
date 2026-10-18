---
id: PK-169
title: >-
  memory-lint: the rest of the mechanical checks at commit — quote-diff vs HEAD,
  dead paths, closed tickets in open words, ≥12-word dupes
status: open
assignee: []
created_date: '2026-10-16 16:46'
updated_date: '2026-10-18 13:42'
due_date: '2026-10-23'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 98540
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's o87 (10-16) ticked five checks for memory-lint; two run today (the budget, merged bullets). the rest, each red-proven, wired in recipes/nurture-memory/scripts/memory-lint.ts:
- quote-diff vs HEAD on staged memory files (a fold of his words shows beside its new form, never silently)
- dead backticked paths (the naive regex flagged 94 with ~2 real in run #1 — scope it to paths that look like repo paths)
- a closed FRM-N/BYT-N within 2 lines of open-state words (needs linear; cache the states)
- a ≥12-word sentence living in two resident files
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-18 boot: dima steers today to parse + answers + the viz-tool shape; the pocket gets solved after the weekly reset (10-19 07:00)

parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: today is the parse, the answers, the small stuff and the viz-tool shape; the pocket is solved after the reset
<!-- SECTION:NOTES:END -->
