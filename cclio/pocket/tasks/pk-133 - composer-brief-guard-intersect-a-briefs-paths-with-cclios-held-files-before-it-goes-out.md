---
id: PK-133
title: >-
  composer brief guard: intersect a brief's paths with cclio's held files before
  it goes out
status: open
assignee: []
created_date: '2026-10-14 15:29'
updated_date: '2026-10-14 15:33'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ccrow 18:28: b2 (17:43) and b4 (18:11) broke on a held file, round B's plan would have broken a third time. a check (a script or an x brief verb) refuses a composer brief that names a path cclio holds or that git status shows dirty. flawlog 17:43 already calls it a brief-check candidate.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
second check (18:33, b6 chore 9): every anchor is one physical line copied from a sed -n print and matches exactly once before the brief goes out; a glued two-line anchor failed twice and the retry left a stray «)»
<!-- SECTION:NOTES:END -->
