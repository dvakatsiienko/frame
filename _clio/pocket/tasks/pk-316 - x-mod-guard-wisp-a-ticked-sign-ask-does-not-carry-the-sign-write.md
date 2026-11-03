---
id: PK-316
title: 'x-mod-guard wisp: a ticked sign ask does not carry the sign write'
status: open
assignee: []
created_date: '2026-11-03T19:20:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
21:17 dima ticked o137 «✍️ sign FRM-502: …»; every x linear body --set that added a ## signed line was still refused «ask dima to tick», and the guard store (~/.claude/plugins/store/x-mod-guard_inline-*.json) held no tick or spent key at all. suspects: the tick never reaches the guard's TICKS state (hooks/register.ts tickFor, ~:671), or the parallel orbit resolve in the same step cleared it. blocks FRM-502's sign line.
<!-- SECTION:DESCRIPTION:END -->
