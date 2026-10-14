---
id: PK-134
title: >-
  x lane verify-tree <pr|main:sha>: one verb makes the verifier's worktree
  (git-crypt flags + seed)
status: open
assignee: []
created_date: '2026-10-14 15:49'
due_date: '2026-10-17'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 95100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
verifier idea #3 (PK-84, dima o73 18:49: build). today crew-verifier step 1.1 hand-rolls git -c filter.git-crypt.smudge=cat -c filter.git-crypt.required=false worktree add, then x lane seed. one verb replaces it; crew-verifier's step then names the verb. lands with the cli lane (PK-74 first).
<!-- SECTION:DESCRIPTION:END -->
