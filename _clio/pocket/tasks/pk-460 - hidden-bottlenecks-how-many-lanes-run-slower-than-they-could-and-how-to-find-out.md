---
id: PK-460
title: >-
  hidden bottlenecks: how many lanes run slower than they could, and how to find
  out
status: open
assignee: []
created_date: '2026-11-20T12:38:00Z'
updated_date: '2026-11-20T13:11:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 3100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's 14:20 question (PK-349:W1290–W1293); next after the herdr focus dispatch; a pace read across lanes, proposed to him first
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-349:W1290 (2026-11-20 14:20, dima): My question in general: how many tickets like this are executed in such an optimal way? ❓
PK-349:W1291 (2026-11-20 14:20, dima): The thing is I only picked, inside Moscow (?), the pace only with this big ticket because I really spotted that it is going for too long.
PK-349:W1292 (2026-11-20 14:20, dima): I worry that a lot of other tickets could actually be done at a much slower pace than they could be done instead if a more optimal approach is chosen. I worry about hidden bottlenecks.
PK-349:W1293 (2026-11-20 14:20, dima): How do I think about how severe this potential issue could be and what we can do to find out if my suspiciousness is true? ❓

14:45 PK-460:W5 (2026-11-20 14:45, dima) yes, I want to know how to prevent invisible bottlenecks for lanes, because they are very bad and dangerous. a lane can do something basic for half a day and I would trust its pace and think it is normal, while really it does something useless, and the bottleneck could be solved in 20 minutes. the big register.tsx is proof of such a case; that's why I'm raising it now.

14:46 id fix: the line above is PK-460:W1294 (numbered per home by prompt-groom --next; «W5» was a slip)

15:11 PK-460:W1295 (2026-11-20 15:02, dima) I want a precise answer about this incident: codie started with such an unoptimal approach that the whole register would have taken days; after the optimization it was solved in about an hour or less.
PK-460:W1296 (2026-11-20 15:02, dima) how much time did it take the mods codie to solve the register with the new approach? ❓ → answered 15:04, corrected at the siesta card
PK-460:W1297 (2026-11-20 15:02, dima) how to solve this dangerous hazard?? when a codie gets stuck with an unoptimal approach, stuff that could be solved in 10 or 20 minutes takes 4 hours. ❓
PK-460:W1298 (2026-11-20 15:02, dima) I treat this case as very hazardous because it is expensive time-wise.
PK-460:W1299 (2026-11-20 15:06, dima) does this optimization apply to the mods codie's other activities? is it worth taking as its default approach? will it improve the mods codie's shipping speed overall? does it apply to the herdr codie too? ❓
id note: the 14:45 line stays written «W5» (notes are append-only); it is W1294
<!-- SECTION:NOTES:END -->
