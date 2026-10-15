---
id: PK-150
title: 'x-mod-guard: refuse backlog task edit --notes on a task that has notes'
status: waiting
assignee: []
created_date: '2026-10-15 17:39'
updated_date: '2026-10-15 17:42'
due_date: '2026-10-18'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — it opens after the memory sweep
2026-10-15: a cclio pocket close with --notes replaced PK-90's and PK-141's notes, dima's quoted steers (o45, o34) included; they came back only from git. the rule: x-mod-guard refuses `backlog task edit` carrying --notes (never --append-notes) when the task already holds notes, and the refusal names --append-notes. owner: the mods lane (PK-120); ccrow's 20:38 note asked for a guard, not a habit.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
waiting for the mods lane, due 2026-10-24

2026-10-15 halt flush: also fix the frozen-lockfile hint — it names --no-frozen-lockfile, which pnpm 12's add refuses; the door in a main checkout is a plain pnpm add
<!-- SECTION:NOTES:END -->
