---
id: PK-328
title: measure commit gate and red-proof gate perf, then optimize them
status: open
assignee: []
created_date: '2026-11-05T22:23:00Z'
updated_date: '2026-11-05T23:29:00Z'
labels:
  - s
  - side
  - side-channel-owned
dependencies: []
priority: next
type: task
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima's word 11-06 00:23: solve with the side channel tomorrow.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
W1 (2026-11-06 00:23, dima): one more item to solve with the side channel tomorrow: measure commit gate and red-proof gate perf and optimize it.
kept here, not in linear: a measure first, today-or-tomorrow work; FRM-473 and FRM-383 touch these gates (FRM-383's red-proof is a rewrite), read them before optimizing so the work doesn't collide.

input from cli codie, FRM-473's D1, measured 11-06 01:29: overlay 15 s, commit 88 s at load 38, the skip fires («1 skipped on tested bytes»), and 2,820 of the commit's rows belong to the 3 mods the commit never touched. candidate: skip a mod whose subtree equals HEAD's, one condition in test.ts; a look first, since a mod's tests can read outside its folder through the engine.
<!-- SECTION:NOTES:END -->
