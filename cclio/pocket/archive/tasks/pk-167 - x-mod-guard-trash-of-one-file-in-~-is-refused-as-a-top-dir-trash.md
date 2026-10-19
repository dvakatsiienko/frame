---
id: PK-167
title: 'x-mod-guard: trash of one file in ~ is refused as a top-dir trash'
status: done
assignee: []
created_date: '2026-10-16 15:25'
updated_date: '2026-10-18 16:31'
due_date: '2026-10-23'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 98520
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120).
seen 10-16 18:13–18:21: a helper's empty `~/r3w.tmp.txt` could not be trashed, not by the helper, not by cclio. root: `hooks/rules/hazard.ts:29` `isTopDir` returns true for any direct child of home, file or folder. fix: a path that exists as a regular file is never a top dir; a missing or directory path stays refused. red-proof: `trash ~/a.txt` (planted file) passes, `trash ~/Documents` still refused (tests/additions.test.ts top-dir rows).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:31 landed on main (cafb2855, unpushed): a regular dotfile in ~ trashes; mods coder SP-5.2.
<!-- SECTION:NOTES:END -->
