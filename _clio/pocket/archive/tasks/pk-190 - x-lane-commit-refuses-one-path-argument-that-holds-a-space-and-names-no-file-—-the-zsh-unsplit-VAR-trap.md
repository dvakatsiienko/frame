---
id: PK-190
title: >-
  x lane commit refuses one path argument that holds a space and names no file —
  the zsh unsplit $VAR trap
status: done
assignee: []
created_date: '2026-10-18 16:59'
updated_date: '2026-10-22T16:51:00Z'
due_date: '2026-10-25'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 100800
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane — its chunk.

halt flush 2026-10-18: 17:09 a zsh `$P` path list reached `x lane commit` as one word, «nothing staged»; method-silent-failures names the trap, nothing guards it.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-405 (cli lane 1, sealed 2026-10-20)

2026-10-22 19:55: closed into FRM-405 at the cli lane 1 spawn (its scope is sealed in that ticket's exit lines; chunk 1 FRM-401 running)
<!-- SECTION:NOTES:END -->
