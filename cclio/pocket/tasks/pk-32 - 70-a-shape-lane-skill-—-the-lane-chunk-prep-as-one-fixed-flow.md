---
id: PK-32
title: '[70] a shape-lane skill — the lane-chunk prep as one fixed flow'
status: done
assignee: []
created_date: '2026-10-09 10:38'
updated_date: '2026-10-09 16:49'
labels:
  - m
dependencies: []
priority: next
type: idea
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket 70 · status line was: `open · idea` · inbox-free, dima 2026-10-09 · shape first (`x:shape-idea`)

- dima, 2026-10-09: «we had issues with planning … problematic, chaotic planning. maybe it is worth creating something like a shape-lane skill. each time we prep a lane chunk, our flow is fixed for this part, and we then solve chunk-prep issues in the scope of that skill — flow and process are not scattered.»
- what it must fix, his list: the grill skill was not loaded and the grill improvised; clunky grill outputs to him; hard-to-read grill bodies
- the parts today: `habit-grill-shape` (cclio leaf), matt `grilling`, `x brief preflight`, the exit-line rules in `craft-spawning` — a skill would own the order (title → body → grill rounds → exit lines → seal) and carry what the leaf holds now
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
r1 decided (dima 16:57): home cclio:shape-lane · starts at chunk picked, ends at the spawn ask, never spawns · habit-grill-shape dies into it, the exit-line lessons → exit-lines.md beside it, craft-spawning keeps one pointer · order: step 0 read decided + wish → title + body (≤5 lines) → grill rounds → exit lines grepped → seal (x brief preflight) → spawn ask (verifier y/n) · done test: next 3 preps, 0 #dima-caught on grill or exit lines, dima calls each readable. r2 next: triggers + print shapes

r2 decided (dima 17:11): triggers = chunk picked, «prep», «grill <ticket>», «next chunk» · print: card = title + 2-line body (why we have it · what we want out of it), then rounds + pre-filled fence, one «🔒 N exit lines, sealed» line, spawn ask in ⏳ · prep state: ticket body (decided/exit), pocket notes before a ticket, never both · plan critic only on feature/app lanes · build: cclio on main, a diff first, habit-grill-shape dies in it

done 10-09: cclio:shape-lane shipped (0.3.124+), habit-grill-shape folded in, exit-lines.md beside it
<!-- SECTION:NOTES:END -->
