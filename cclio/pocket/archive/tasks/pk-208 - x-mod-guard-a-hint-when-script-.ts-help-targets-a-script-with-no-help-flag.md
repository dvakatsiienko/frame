---
id: PK-208
title: 'x-mod-guard: a hint when <script>.ts --help targets a script with no help flag'
status: done
assignee: []
created_date: '2026-10-19 17:13'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-27'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10966
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there.
flawlog 2026-10-19 (dima's yes in the halt flush): `node script/skill-memory-sync-mirror.ts --help` ran the render instead of printing help — a repeat of the fleet-hazards bare --help line, whose guard covers obsidian only. the hint: a Bash call `<path>.ts --help` (or -h) on a frame/cclio script whose source names no help flag gets a guard hint before it runs.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: moved — FRM-428 carries this item (its body lists «pocket PK-208») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
