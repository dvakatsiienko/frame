---
id: PK-191
title: >-
  #dima-caught tripled in 14 days (75 vs 23) — split the tags by source to see
  if reply-check tagging drives it
status: done
assignee: []
created_date: '2026-10-18 16:59'
updated_date: '2026-10-19 13:39'
due_date: '2026-10-20'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
halt flush 2026-10-18, x fleet flow --days 14: #dima-caught 75 vs baseline 23, #brief 9 vs 47. inference: the reply-check hook tags more shapes since 10-16; the check is a 10-day split of #dima-caught lines by source (flawlog hand lines vs hook lines). answer goes into the habit-cto halt read.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: the next halt's habit-cto flow read runs it

10-19: measured (.scratch/dima-caught/split.md): 0 of 75 tags come from a hook — all hand-written by cclio, ~64 distinct, ~11 repeats. the «23» is a hardcoded pre-tagging figure (x/go/fleet_flow.go:65), and the window before 10-06 holds 0 tags. no real trend yet: compare 10-20 → 11-02 against 75; the halt reads the hardcoded 23 as a baseline until the cli lane fixes it.
<!-- SECTION:NOTES:END -->
