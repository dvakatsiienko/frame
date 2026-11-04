---
id: PK-309
title: 'x-mod-guard: one writer list, so a script the turn rewrote is never read stale'
status: done
assignee: []
created_date: '2026-11-03T13:24:00Z'
updated_date: '2026-11-04T13:51:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
wishkeeper's FRM-472 pre-merge read (15:23): dima's o83 «a script this turn wrote that holds a refused command is refused when run by its path» is only partly met at ff02e946 — 6 variants run with no warn (python rewrite, nested sh -c / eval rewrite, gsed -i, mv, bash /dev/stdin <; rows in ~/.local/state/x/lanes/mods-lane-4/issues/08-escape-table.md). FRM-471's runner only replays rows, so no ticket fixes them. root: lineWrites vs writtenPaths drift (sixth sense retro). next: a mods chunk for dima's sign, or his no
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-472
close: 2026-11-04 — rider in FRM-472, his o62
<!-- SECTION:NOTES:END -->
