---
id: PK-269
title: 'x lane restack: a rival push mid-restack dead-ends'
status: waiting
assignee: []
created_date: '2026-10-23T20:05:00Z'
updated_date: '2026-10-23T20:33:00Z'
due_date: '2026-10-24'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 162000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** a cli lane chunk
FRM-423 #107 verifier, accepted for the mvp by dima o196: a rival push mid-restack dead-ends (stop → rerun → x lane push → non-ff); the way out is a hand reset of the local layer.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
more from the FRM-423 retros: restack --take-origin <layer>; x lane stack link names a stray non-dir under .git/worktrees/ and its trash step; a seed check refusing to finish while .git/hooks/* names a worktree path
<!-- SECTION:NOTES:END -->
