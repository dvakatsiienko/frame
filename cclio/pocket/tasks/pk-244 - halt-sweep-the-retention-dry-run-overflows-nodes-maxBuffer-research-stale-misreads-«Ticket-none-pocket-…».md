---
id: PK-244
title: >-
  halt-sweep: the retention dry run overflows node's maxBuffer; research-stale
  misreads «Ticket: none (pocket …)»
status: done
assignee: []
created_date: '2026-10-21T17:36:00Z'
updated_date: '2026-10-22T19:01:00Z'
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
flawlog 2026-10-21 20:32: halt-sweep.ts dry run buffers a whole ~/.local/state/looks/ walk (a git repo inside) past maxBuffer — --only inbox worked. research-stale.sh flags system-checkup-prior-art.md and wish-data-loss-audit-2026-10-21.md as «no Ticket line» though both carry «Ticket: none (pocket …)». solve-now sized; the flush (o124) filed it for the next low tide.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
retro 2026-10-21 #3 + #5 (o126): fix at the 10-22 low tide; riders #6: pocket-add.ts --help crashes (parseArgs), backlog task edit has no --due (use the frontmatter or pocket-move)

2026-10-22: moved now → next to fit the now cap of 3 when the railway breach took a now slot; still due today, rides the low tide

2026-10-22 halt: due moved to 10-23 on dima's word («fold everything that wants me for tomorrow»).

done 2026-10-22 halt: halt-sweep run() takes a 64 MB maxBuffer and trashes in 500-path batches (a 23,834-file retention hit E2BIG next); research-stale.sh reads «Ticket: none (…)» as none — 1 of 27 docs flagged now, was 3.
<!-- SECTION:NOTES:END -->
