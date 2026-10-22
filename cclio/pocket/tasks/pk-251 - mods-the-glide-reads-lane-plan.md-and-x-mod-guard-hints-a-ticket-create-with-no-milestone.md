---
id: PK-251
title: >-
  mods: the glide reads lane-plan.md, and x-mod-guard hints a ticket create with
  no milestone
status: done
assignee: []
created_date: '2026-10-22T14:40:00Z'
updated_date: '2026-10-22T17:49:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there.
dima 2026-10-22 (PK-103 round 1 Q7, round 4 Q1): no verb — x-mod-stash reads the lane's .scratch/<feature>/lane-plan.md on each board poll and draws the glide steps from its sealed lines (cclio links the file at glide create); and an x-mod-guard hint, never a refusal, when `linear issue create` runs without --milestone in a project that has milestones. until then cclio copies the sealed steps into the glide by hand.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-410
close: moved to linear as FRM-410 (a rider under FRM-304, the mods story), every W-line carried in its wish block — the new contract: a lane wait lives in linear

correction 19:2x: the close line above overstates it — this item held no W-lines, so its words were copied as written (FRM-409 W1 is cclio's fold of the note above; FRM-410 carries PK-103's W41, W53, W73)

correction 20:5x (wishkeeper L14): the 19:2x correction above was copied from PK-250 word for word — «FRM-409 W1 is cclio's fold of the note above» is false here; PK-251 went to FRM-410, which carries PK-103's W41, W53, W73
<!-- SECTION:NOTES:END -->
