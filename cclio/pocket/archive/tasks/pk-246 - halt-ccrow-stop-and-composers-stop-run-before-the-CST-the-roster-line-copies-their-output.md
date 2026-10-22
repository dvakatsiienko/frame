---
id: PK-246
title: >-
  halt: ccrow:stop and composer's stop run before the CST; the roster line
  copies their output
status: done
assignee: []
created_date: '2026-10-21T17:50:00Z'
updated_date: '2026-10-21T17:50:00Z'
due_date: '2026-10-22'
labels:
  - xs
dependencies: []
priority: now
type: task
ordinal: 9999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
retro 2026-10-21 #1 (o126): the CST said «ccrow stopped, card archived» before the stop ran and failed (ccrow's catch 20:39). fix: halt phase 5 order. composer's stop line landed 20:50.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-21 20:51 solved: halt phase 0 names composer, phase 5 runs both stops before the CST
<!-- SECTION:NOTES:END -->
