---
id: PK-183
title: ✨ x-mod-stash band test red on main — blocks every x mods edit push
status: done
assignee: []
created_date: '2026-10-18 15:46'
updated_date: '2026-10-18 16:13'
due_date: '2026-10-19'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10120
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
found 2026-10-18 while flipping FRM-398: `x mods edit test` is red on one x-mod-stash test, «the 🔭 line prints who it waits on in bold» (tests/band.test.ts:93), with only the guard touched — so main itself is red, and the all-or-nothing push refuses every mod edit. FRM-398 waits in the x mods edit scratch (register.ts: raw-linear out of WARN_ONLY; tests/linear.test.ts: the warn test becomes a refuse test), guard green; push it the turn this goes green. relates PK-164 (bold names in the 🔭 strip). evidence for the flip: zero raw-linear warnings in the otel tap 10-16..10-18; 10-11..10-15 not on disk.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:13 mods coder's finding: main is green (stash 699/0). the red came from the x mods edit overlay, which carried a half-done parse.ts written 10-16 14:11 by cclio session 7267c76e (PK-160's «one waiting on» merge, parse half only) — so «red on main» was cclio's misread of the overlay. the parse.ts copy is parked untouched in the scratch + byte-exact in the coder's scratchpad; its fate is dima's pick on the coder's orbit (o2).
<!-- SECTION:NOTES:END -->
