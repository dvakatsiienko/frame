---
id: PK-48
title: 'x stats shows the cli''s own size, rendered with charm'
status: done
assignee: []
created_date: '2026-10-10 09:45'
updated_date: '2026-10-11 21:36'
due_date: '2026-10-12'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
parked: the cli lane starts after the mods lane (dima, 2026-10-11, o1)
parked: grilled with the next cli batch, while the second lane is prepped (dima, 2026-10-10)
dima, 2026-10-10: «can i have this command as a cli verb itself? i want it to print pretty stats, utilizing charm's capabilities. how best to have it in the cli? a separate command, or part of the existing stats commands? x stats?» — today it is `pnpm x-cli-go:loc` (tokei over x/go, tests excluded and included); the pnpm key dies when the verb lands. cli-drift-check before the brief.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
a dupe of FRM-387 (the x stats charm board + its size tab), folded 2026-10-12 (o308)
<!-- SECTION:NOTES:END -->
