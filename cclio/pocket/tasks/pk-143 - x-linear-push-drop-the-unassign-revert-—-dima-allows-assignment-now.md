---
id: PK-143
title: 'x linear push: drop the unassign revert — dima allows assignment now'
status: done
assignee: []
created_date: '2026-10-15 12:34'
updated_date: '2026-10-15 12:46'
due_date: '2026-10-17'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 98100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, 2026-10-15: tickets may be assigned to me; remove every workaround against it. the prose is gone (x:cmt, cclio:pm, linear-flow); the code left is x/go/linear_push.go:163-165 + the assigneeId:nil write at ~410, which clears an assignee Linear sets after a push. keep its state-revert half only if dima wants closing moves undone (x:cmt already bans closing keywords). cli lane: x:guide-go, x/AGENTS.md.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15: retired whole — the verb is gone (dima o17: only the pr link stays), so the unassign revert went with it.
<!-- SECTION:NOTES:END -->
