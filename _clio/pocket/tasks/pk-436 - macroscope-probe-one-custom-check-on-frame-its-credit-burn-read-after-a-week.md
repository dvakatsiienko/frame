---
id: PK-436
title: 'macroscope probe: one custom check on frame, its credit burn read after a week'
status: done
assignee: []
created_date: '2026-11-15T20:07:00Z'
updated_date: '2026-11-15T21:12:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 81000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-436:W1 (2026-11-15 22:07, dima): let's probe, so i know for sure whether macroscope is compatible or not.
plan: at the boot, via clio:shape-test-drive: dima signs up ($100 free usage) and installs the github app on frame only; one check-run agent in .macroscope/check-run-agents (t3code's shape); read credits used per pr after a week; research: docs/research/macroscope.md

23:12 moved to docs/test-drive/macroscope.md (dima 23:11: shape-test-drive 1w); close: the test drive owns it
<!-- SECTION:NOTES:END -->
