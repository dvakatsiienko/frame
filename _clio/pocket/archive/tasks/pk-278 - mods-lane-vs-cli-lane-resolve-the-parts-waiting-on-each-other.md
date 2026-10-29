---
id: PK-278
title: 'mods lane vs cli lane: resolve the parts waiting on each other'
status: done
assignee: []
created_date: '2026-10-27T12:58:00Z'
updated_date: '2026-10-27T14:04:00Z'
due_date: '2026-10-27'
labels:
  - s
dependencies: []
priority: now
type: wish
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W259 (2026-10-27 inbox, dima) look into the mods lane and cli lane scopes; the next lane i want to dispatch is the mods lane — it has lots of stuff accumulated
W260 (2026-10-27 inbox, dima) from what i saw, some parts of the mods lane chunks are related to the cli lane
W261 (2026-10-27 inbox, dima) ❓ if that is true, what in the cli lane wants the mods lane done first? and vice versa?
W262 (2026-10-27 inbox, dima) i want to resolve the «waiting on each other» parts
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
raw drop (2026-10-27 inbox, dima): 2. look into mods lane and cli lanes scopes. the next lane i want to dispatch is mods lane (it have lots of stuff accumulated). but from what i saw, some of mods lane chunk parts are related to cli lane. if it is true — what in cli lane wants mods lane done first? nad vice versa? i want to resolve are «waiting on each other» parts.

close: answered 15:05 and 15:22 — nothing in the cli lane waits on mods, or the other way round; the mods lane dispatched 15:56 (FRM-425)

close: W259 done (scope read), W260 done (only FRM-428 ↔ FRM-439 relate, no block), W261 done (answered: none either way), W262 done (nothing left waiting)
<!-- SECTION:NOTES:END -->
