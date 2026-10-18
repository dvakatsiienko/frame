---
id: PK-181
title: >-
  Explore card → a custom name: deny the built-in Explore, rename our sonnet
  card
status: open
assignee: []
created_date: '2026-10-18 13:59'
updated_date: '2026-10-18 13:59'
due_date: '2026-10-19'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10160
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-18 (inbox Q2, his 🛎️ on o4): is there a way to disable explore fully, so we are not restricted to the Explore.md filename and our card can carry a custom name? docs (code.claude.com/docs/en/sub-agents): `permissions.deny` `Agent(Explore)`, or `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` (drops Explore + Plan, v2.1.198+); then our card ships under its own name. probe: deny it, fresh session, `/agents` no longer lists the built-in, our renamed card answers. a settings change — the permissions block is read byte-for-byte before the merge (sys-settings-drift). name via x:top-seven.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: until the weekly reset (2026-10-19 07:00) — dima 10-18: an xs after the reset
<!-- SECTION:NOTES:END -->
