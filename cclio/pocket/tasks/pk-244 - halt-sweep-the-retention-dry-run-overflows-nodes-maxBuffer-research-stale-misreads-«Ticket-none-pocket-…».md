---
id: PK-244
title: >-
  halt-sweep: the retention dry run overflows node's maxBuffer; research-stale
  misreads «Ticket: none (pocket …)»
status: open
assignee: []
created_date: '2026-10-21T17:36:00Z'
updated_date: '2026-10-21T17:50:00Z'
due_date: '2026-10-22'
labels:
  - xs
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
flawlog 2026-10-21 20:32: halt-sweep.ts dry run buffers a whole ~/.local/state/looks/ walk (a git repo inside) past maxBuffer — --only inbox worked. research-stale.sh flags system-checkup-prior-art.md and wish-data-loss-audit-2026-10-21.md as «no Ticket line» though both carry «Ticket: none (pocket …)». solve-now sized; the flush (o124) filed it for the next low tide.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
retro 2026-10-21 #3 + #5 (o126): fix at the 10-22 low tide; riders #6: pocket-add.ts --help crashes (parseArgs), backlog task edit has no --due (use the frontmatter or pocket-move)
<!-- SECTION:NOTES:END -->
