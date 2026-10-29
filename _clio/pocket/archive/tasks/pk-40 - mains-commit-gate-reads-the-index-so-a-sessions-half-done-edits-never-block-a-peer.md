---
id: PK-40
title: >-
  main's commit gate reads the index, so a session's half-done edits never block
  a peer
status: done
assignee: []
created_date: '2026-10-09 12:49'
updated_date: '2026-10-10 08:07'
due_date: '2026-10-10'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
check: FRM-367 (x lane gate) lands
ccrow 10-09 15:47: the mods coder's FRM-354 commit was refused by pnpm test over cclio's unstaged crew-* edits; «retry» was a firmer-intention fix. options: (a) the pre-commit test runs against the index (lefthook stash of unstaged, or tests read git show :path) — fixes it for every session; (b) a session with a peer on main drafts skill+test edits in .scratch/ and moves in only green. (b) is cclio's habit from 15:50; (a) is the mechanism
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
closed 10-10: FRM-367 landed, frame's gates run on a temp copy of the index (script/index-run.sh)
<!-- SECTION:NOTES:END -->
