---
id: PK-169
title: >-
  memory-lint: the rest of the mechanical checks at commit — quote-diff vs HEAD,
  dead paths, closed tickets in open words, ≥12-word dupes
status: open
assignee: []
created_date: '2026-10-16 16:46'
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
