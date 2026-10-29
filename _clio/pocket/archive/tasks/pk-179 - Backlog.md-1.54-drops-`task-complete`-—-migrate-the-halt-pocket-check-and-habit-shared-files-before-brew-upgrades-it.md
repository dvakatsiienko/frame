---
id: PK-179
title: >-
  Backlog.md 1.54 drops `task complete` — migrate the halt, pocket-check and
  habit-shared-files before brew upgrades it
status: done
assignee: []
created_date: '2026-10-18 13:41'
updated_date: '2026-10-19 12:39'
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
**waiting for:** brew to serve backlog-md 1.54 (`brew info --json backlog-md | jq -r '.[0].versions.stable'`, 1.53.0 on 2026-10-18); the migration lands in one step with the upgrade, plan in the notes.
found at the 2026-10-18 boot (upstream read): v1.54.0 (10-16) removed `task complete` (archive replaces it), changed the default task ordering, and made `cleanup` interactive-only. installed: 1.53.0. callers: plugin-cclio/skills/halt/SKILL.md, memory/habit-shared-files.md, script/pocket-check.ts + its test. pin or migrate before the next brew upgrade.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima, 2026-10-18: plan it tomorrow or the day after, before the next evergreen (Wednesday 10-21).

2026-10-18 read of the 1.54 notes: on 1.53 `task archive` releases the id and drops links, so the switch cannot happen early — it lands in one step with the upgrade: (1) brew upgrade backlog-md once brew serves 1.54 (`brew info --json backlog-md | jq -r '.[0].versions.stable'`, 1.53.0 today), (2) `backlog doctor` preview then `--fix` (moves pocket/completed into archive/tasks), (3) halt/SKILL.md:47 `task complete` → `task archive`, (4) habit-shared-files.md:24 the same, (5) pocket-check.ts:53 + its test:158 message → archive, and check it reads archive/tasks not completed/, (6) `cleanup` is interactive-only now: never scripted. the Backlog.md reminder (due 10-21) already gates the upgrade on this item.

10-19: done. brew 1.54.0; doctor --fix moved 140 items completed/ → archive/tasks (ids kept), after two empty probe stubs (archive pk-1 «probe: config check», pk-143 «x») were set aside to cclio/.scratch/backlog-probe-stubs/ — they collided with real ids; halt SKILL, habit-shared-files, pocket-check + test now say task archive; vitest 26/26.
<!-- SECTION:NOTES:END -->
