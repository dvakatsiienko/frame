---
id: PK-72
title: 'Backlog.md #1070: PR the j/k fix ourselves'
status: done
assignee: []
created_date: '2026-10-11 22:25'
updated_date: '2026-10-11 22:32'
due_date: '2026-10-13'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's yes, o311 (2026-10-12): [MrLesk/Backlog.md#1070](https://github.com/MrLesk/Backlog.md/issues/1070) — the task list ignores j/k and arrows after editing a task with E; the maintainer called it a bug.
- a coder in a fork: branch named for the issue, the fix + a test, `bun run test`, `npx biome check .`, a PR linked to #1070 (their CONTRIBUTING.md); load x:github-contrib, footer «— printed by Claude Code, signed by me.»
- #1071 (priority + ordinal sort) waits: he wants one sorting handler for every interface — a comment proposing the shape first, never a PR that sets the scope
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
no PR needed (dima 01:31): the maintainer's own MrLesk/Backlog.md#1089 says «Fixes #1070», and #1092 brings one shared ordering for every interface plus a priority arrow in TUI rows, which covers #1071. both open, unmerged at 01:31
<!-- SECTION:NOTES:END -->
