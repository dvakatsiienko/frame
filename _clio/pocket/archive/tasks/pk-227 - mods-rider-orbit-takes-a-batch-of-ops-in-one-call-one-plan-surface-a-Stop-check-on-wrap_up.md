---
id: PK-227
title: >-
  mods rider: orbit takes a batch of ops in one call, one plan surface, a Stop
  check on wrap_up
status: done
assignee: []
created_date: '2026-10-20 17:34'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-31'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 149000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120).
retro 2026-10-20 #4, dima o83 ✓: ~243 of ~1,110 tool calls were bookkeeping (orbit 157, update_plan 43, wrap_up 43). orbit accepts several ops per call; one plan surface; a Stop check reds a turn ending on wrap_up while an orbit ask is open. **waiting for:** the mods lane (PK-120).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-427

close: moved — FRM-427 carries this item (its body lists «pocket PK-227») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
