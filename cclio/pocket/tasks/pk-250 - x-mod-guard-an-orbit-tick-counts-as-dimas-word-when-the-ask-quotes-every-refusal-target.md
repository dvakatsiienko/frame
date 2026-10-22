---
id: PK-250
title: >-
  x-mod-guard: an orbit tick counts as dima's word when the ask quotes every
  refusal target
status: done
assignee: []
created_date: '2026-10-22T13:31:00Z'
updated_date: '2026-10-22T15:42:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there.
dima 2026-10-22 (o11 tick): guard reads only the typed prompt (register.ts:704), so o4 and o9 each cost an extra typed turn; the ask text must quote every dima-ok target verbatim, and the tick then counts. ccrow's catch 16:20.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-409
close: moved to linear as FRM-409 (a rider under FRM-304, the mods story), every W-line carried in its wish block — the new contract: a lane wait lives in linear
<!-- SECTION:NOTES:END -->
