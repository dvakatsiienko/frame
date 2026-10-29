---
id: PK-258
title: an isolated coder has no x lane door past a rebase conflict
status: done
assignee: []
created_date: '2026-10-22T18:39:00Z'
updated_date: '2026-10-25T11:47:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
parked: needs a design (a verb or a guarded continue) — cli lane 2. FRM-403's coder + verifier, 21:39: rebase-main exits 4 on a paused rebase and tells the coder to run git rebase --continue, which the worktree sandbox may refuse (inference); the auto-continue path was cut after verifier round 2 found it wiped a hand-resolved conflict.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-437
close: moved to FRM-437, its wish block carries them (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
