---
id: PK-207
title: >-
  orbit: drop ask expiry (dies) from x-mod-stash — every ask stays until dima
  answers
status: done
assignee: []
created_date: '2026-10-19 16:35'
updated_date: '2026-10-25T11:44:00Z'
due_date: '2026-10-27'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10965
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next mods coder lane (PK-120) — a rider there.
dima o91, 2026-10-19: «simply dropping a trial entry is not enough because that expiry ask type is still in source code for mods coders, so it should be cleaned … otherwise park as another rider cleaning ticket for the ongoing next mods lane.»
not a cclio freebie: ~30 lines across hooks/orbit.ts (15), hooks/register.tsx (9), types/stash.d.ts, FTR.md, GLOSSARY.md, plus the orbit tool's description (the dies field) and its tests.
the trial: docs/test-drive/orbit-expiry.md — 0 wins, 1 miss (cclio set dies:3 on a real decision); dropped.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-427

close: moved — FRM-427 carries this item (its body lists «pocket PK-207») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
