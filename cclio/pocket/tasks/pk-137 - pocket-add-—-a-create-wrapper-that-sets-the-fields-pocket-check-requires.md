---
id: PK-137
title: 'pocket:add — a create wrapper that sets the fields pocket-check requires'
status: open
assignee: []
created_date: '2026-10-14 18:06'
updated_date: '2026-10-14 18:06'
due_date: '2026-10-21'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pocket creates went red twice on 10-14 (14:48 three ways; 20:35 PK-136 with no priority and no type): `backlog task create` sets none of the fields the gate wants. a wrapper sets status, priority, type, size and the ordinal band by default. flawlog flush 10-14.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: rides the cli or mods lane after the memory sweep (flawlog flush 10-14), a guard-or-verb chunk, not a pocket solve
<!-- SECTION:NOTES:END -->
