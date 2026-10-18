---
id: PK-179
title: >-
  Backlog.md 1.54 drops `task complete` — migrate the halt, pocket-check and
  habit-shared-files before brew upgrades it
status: open
assignee: []
created_date: '2026-10-18 13:41'
updated_date: '2026-10-18 13:58'
due_date: '2026-10-20'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10150
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
found at the 2026-10-18 boot (upstream read): v1.54.0 (10-16) removed `task complete` (archive replaces it), changed the default task ordering, and made `cleanup` interactive-only. installed: 1.53.0. callers: plugin-cclio/skills/halt/SKILL.md, memory/habit-shared-files.md, script/pocket-check.ts + its test. pin or migrate before the next brew upgrade.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima, 2026-10-18: plan it tomorrow or the day after, before the next evergreen (Wednesday 10-21).
<!-- SECTION:NOTES:END -->
