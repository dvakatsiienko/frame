---
id: PK-374
title: 'gates: one naming convention everywhere, one big sweep'
status: open
assignee: []
created_date: '2026-11-09T20:03:00Z'
updated_date: '2026-11-09T20:20:00Z'
labels:
  - s
  - clio-wing-1
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
<!-- SECTION:NOTES:END -->
