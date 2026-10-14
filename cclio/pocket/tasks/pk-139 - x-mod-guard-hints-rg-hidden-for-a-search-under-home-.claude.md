---
id: PK-139
title: x-mod-guard hints rg --hidden for a search under home/.claude
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
ordinal: 124000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
rg skips dot dirs, so a «0 stale pointers» proof on 10-14 missed 4 live ones under home/.claude. a guard hint on an rg over a path holding a dot dir, without --hidden. flawlog flush 10-14.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: rides the cli or mods lane after the memory sweep (flawlog flush 10-14), a guard-or-verb chunk, not a pocket solve
<!-- SECTION:NOTES:END -->
