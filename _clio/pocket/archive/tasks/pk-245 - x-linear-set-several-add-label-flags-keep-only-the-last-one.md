---
id: PK-245
title: 'x linear set: several --add-label flags keep only the last one'
status: done
assignee: []
created_date: '2026-10-21T17:36:00Z'
updated_date: '2026-10-23T09:31:00Z'
due_date: '2026-10-23'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 152000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane — its chunk (FRM-401 → 403 → 405 → 404 first).
flawlog 2026-10-21 14:55: BYT-128 lost the agent label until a second call.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-22 halt: due moved to 10-23 on dima's word («fold everything that wants me for tomorrow»).

seen again 2026-10-22 21:59: x linear set FRM-414 --add-label agent --add-label feature kept only feature; a second call added agent.

ticket: FRM-415 — moved to linear 2026-10-23 on dima's o1 tick; the pocket item dies here.
<!-- SECTION:NOTES:END -->
