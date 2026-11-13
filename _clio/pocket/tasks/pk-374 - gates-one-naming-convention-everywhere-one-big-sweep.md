---
id: PK-374
title: 'gates: one naming convention everywhere, one big sweep'
status: done
assignee: []
created_date: '2026-11-09T20:03:00Z'
updated_date: '2026-11-13T20:06:00Z'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 104000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-374:W1 (2026-11-09 21:59, dima, o80): for now, let's not do a sweep, because it affects a lot of places. i still want it: the file we just created is useful, but it isn't useful in day-to-day moves when we discuss everything.

PK-374:W2 (2026-11-09 21:59, dima, o80): it would be very good for me to have all gates standardized, so whenever you tell me about any gate, it is clearly highlighted that it is a gate, by some kind of prefix. i want it as a nice-to-have.

PK-374:W3 (2026-11-09 21:59, dima, o80): resolve the gates pocket item as done, and create a new one about unifying gate naming conventions everywhere through one big, single sweep that solves everything at once, because it's costly: a sweep like this is better done across everything at once. mark it as zzz.

PK-374:W4 (2026-11-09 21:59, dima, o80): i will pick a good time when we can do this, probably not this week, because we moved ahead of pace with the pile of shares from today. keep this pocket item parked until we have capacity and a window for it.

kept: 2026-11-09 — 💤 on dima's word (o80), a pocket item by his own choice, not linear; the facts for the sweep: required ci checks are named in branch protection (bytes: lint + typecheck + test + build, apps essentials, skip-marker; frame: check + typecheck + test, Test x), so a rename moves protection in the same step; x verbs are their own families; the list is docs/knowledge/gates-catalog.md

PK-374:W5 (2026-11-07 16:40, dima, from FRM-530:W6): i want all gates to have consistent names: a lot of differently named gates is confusing and not good.

PK-374:W6 (2026-11-09 21:32, dima, from FRM-530:W18): then i would like to revisit the gates naming, because another issue with gates is that all gates are named randomly. i want all gates consistently named following the fleet naming guidelines, and maybe some memory rules are also worth updating so all new gates are named properly following the established naming conventions.

PK-374:W7 (2026-11-09 21:42, dima, from FRM-530:W23): what about naming conventions for the actual gates? do you think a rename sweep is a good idea, to have all gates follow a convention like gate-*? ❓ (answered 21:46: not now, the sweep is this item)

note 2026-11-09 22:40 wing 1: W8–W17 are helga's groom of the o80 steer, the sanctioned fold; W1–W4 above fold the same steer by hand, so the two say one thing

PK-374:W8 (2026-11-09 22:39, dima, o80 steer): for now, let's not do a sweep because it affects a lot of places.

PK-374:W9 (2026-11-09 22:39, dima, o80 steer): i still want to have it because having a file like this that we created just now is useful, but it isn't useful in day-to-day moves when we discuss everything.

PK-374:W10 (2026-11-09 22:39, dima, o80 steer): it would be very good for me to have all gates standardized, so whenever you tell me about any gate, it is clearly highlighted that it is a gate via some kind of prefix.

PK-374:W11 (2026-11-09 22:39, dima, o80 steer): i want it as a nice-to-have.

PK-374:W12 (2026-11-09 22:39, dima, o80 steer): you can resolve this pocket item about gates as done and create a new one about unifying gate naming conventions everywhere via some big, single sweep to solve everything at once, because it's kind of costly.

PK-374:W13 (2026-11-09 22:39, dima, o80 steer): a sweep like this is better to do across everything at once.

PK-374:W14 (2026-11-09 22:39, dima, o80 steer): mark it as zzz.

PK-374:W15 (2026-11-09 22:39, dima, o80 steer): i will pick a good time when we can do this.

PK-374:W16 (2026-11-09 22:39, dima, o80 steer): probably not this week, because we moved ahead of pace with the pile of shares from today.

PK-374:W17 (2026-11-09 22:39, dima, o80 steer): let's keep this pocket item parked until we have capacity and use a window for that.

PK-374:W18 (2026-11-09 21:59, dima): gates: do the cheap wins and clean up everywhere.

note 2026-11-10 14:50 wing 1: the 21:59 groom (siesta red). W1–W4 carry the 21:59 stamp but fold the o80 steer, the same words as W8–W17 (22:39); kept as written, W8–W17 is the sanctioned fold

kept: 2026-11-12 — 💤 on his word (o80), unchanged

close: 22:06 PK-374:W1–W18 kept here, linked from wing 1's flyway as a 💤 line (dima 22:04: «keep them linked in wing 1 flyway, mark as 💤, i'll tell when»)
<!-- SECTION:NOTES:END -->
