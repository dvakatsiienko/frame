---
id: PK-328
title: measure commit gate and red-proof gate perf, then optimize them
status: open
assignee: []
created_date: '2026-11-05T22:23:00Z'
updated_date: '2026-11-06T16:07:00Z'
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

from frame#128's last read, wisphunter, by reading, not run: x/go/gates.go:414, F1's format step greens the gates on the formatted scratch while recordTestedMods records the raw tree, so a file the format step changes loses the commit's test skip; fix: record the formatted tree, a row through push and commit asserting one test run. correction: the numbers above were measured at 01:08, 01:29 is codie's message.

correction, the note above: the skip's log row reads 01:08; 01:29 is codie's message.

2026-11-06 18:03 clio: load 126 with four lanes' gates in parallel (crow's read, mine beside it), 3 commit-hook tests timed out at 5 s on main at 17:59. stagger line sent to all four lanes: wait under load 18 before a gate, mutants last.

crow's read 18:06, on a gate lock in gates.go: the lock first, narrowing next, or narrowing first if one small line. the 18:02 spike had 14 go test, mutant and red-proof runs plus 2+ plugin tests, so a lock on x lane commit and push may not cover them: name what it leaves out, or put the mutation door under it. a run past the deadline prints loudly. pid plus start time, no queue order. check nesting and the 10-min Bash limit, the wait prints while it waits. side, 18:07: no gate limit exists today, x lane commit waits only on git's index lock.
<!-- SECTION:NOTES:END -->
