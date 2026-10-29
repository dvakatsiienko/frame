---
id: PK-145
title: >-
  x lane commit runs typecheck + test twice in frame — skip the lane's ts jobs
  where pre-commit runs them
status: done
assignee: []
created_date: '2026-10-15 13:32'
updated_date: '2026-10-22T18:52:00Z'
due_date: '2026-10-23'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane — its chunk, x:guide-go + a red-proof.
dima, 2026-10-15 (matt's «stop running checks in harness hooks» short): checks belong at commit, never per edit, and pre-commit stays short. measured in frame: typecheck 0.5 s, test 4.7 s, mods 21 s (mods paths only), go test 68 s (x paths). x/go/lane.go:628 ciJobs runs pnpm typecheck + test, then frame's pre-commit hook runs them again on the index copy. fix: the lane runs a ts job only when the repo's own pre-commit does not (bytes keeps it, frame drops it); go test stays (no hook reads go). cli lane, x:guide-go, red-proof the skip.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-405 (cli lane 1, sealed 2026-10-20)

2026-10-22 19:55: closed into FRM-405 at the cli lane 1 spawn (its scope is sealed in that ticket's exit lines; chunk 1 FRM-401 running)

2026-10-22 halt: due moved to 10-23 on dima's word («fold everything that wants me for tomorrow»).
<!-- SECTION:NOTES:END -->
