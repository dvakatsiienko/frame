---
id: PK-134
title: >-
  x lane verify-tree <pr|main:sha>: one verb makes the verifier's worktree
  (git-crypt flags + seed)
status: done
assignee: []
created_date: '2026-10-14 15:49'
updated_date: '2026-10-22T18:47:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 95100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane — lands after PK-74.
verifier idea #3 (PK-84, dima o73 18:49: build). today crew-verifier step 1.1 hand-rolls git -c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false worktree add, then x lane seed. one verb replaces it; crew-verifier's step then names the verb. lands with the cli lane (PK-74 first).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**waiting for:** the cli lane opening — lands after PK-74 (boot 10-16)

2026-10-18 boot: dima steers today to parse + answers + the viz-tool shape; the pocket gets solved after the weekly reset (10-19 07:00); cli lanes come after mods (dima 10-18)

ticket: FRM-403 (cli lane 1, sealed 2026-10-20)

done 2026-10-22: landed as x lane verify-tree in frame#96 (FRM-403).
<!-- SECTION:NOTES:END -->
