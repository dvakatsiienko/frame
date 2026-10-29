---
id: PK-169
title: >-
  memory-lint: the rest of the mechanical checks at commit — quote-diff vs HEAD,
  dead paths, closed tickets in open words, ≥12-word dupes
status: done
assignee: []
created_date: '2026-10-16 16:46'
updated_date: '2026-10-19 15:53'
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

10-19 18:30: three of four landed in memory-lint.ts, each red-proven (15 tests): quote-diff vs HEAD (warning), dead backticked paths (a warning: 4 of today's 5 hits were planned paths, dated history and a folder-relative path — it resolves file-relative now), a 12+ word sentence in two resident files (warning). the fourth (a closed ticket id near open-state words) needs linear — left out; the checkup's memory-lint line covers the rest. one dup today: guide-react/guide-typescript line 8, a deliberate twin.

18:40, wishkeeper siesta: reopened — dima's o87 ticked the fourth check (a closed FRM-N/BYT-N within 2 lines of open-state words, linear states cached) and it was dropped without his word; that is this item's open line now. also open: the quote-diff warning prints only the old quote, his ask was the fold beside its new form.

18:55: the fourth check landed (dima o73 «build now», o78 commit) — all four ticked checks in, as ticked. today it warns 3 times on history lines naming done tickets (FRM-305, FRM-385).
<!-- SECTION:NOTES:END -->
