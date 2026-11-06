---
id: PK-328
title: measure commit gate and red-proof gate perf, then optimize them
status: open
assignee: []
created_date: '2026-11-05T22:23:00Z'
updated_date: '2026-11-06T16:36:00Z'
labels:
  - s
  - side
  - side-channel-owned
  - wing-1
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

PK-328:W2 (2026-11-06 18:15, dima): yesterday i peeked into the mods coder window and spotted the commit gate and red-proof gate taking a lot of time. codie itself told me it would make sense to offload it to the background and parallelize it, since codie waits up to a few minutes for commits only. one commit at 3 minutes, 10 commits: half an hour just waiting for commits.
PK-328:W3 (2026-11-06 18:15, dima): maybe rethink this approach at all: why do we have pre-commit, and all these checks on the commits? maybe move them to the push event. commits get much faster, and the gate is still there, just later on push instead of on each commit. i think it would make coders much faster. ❓

measured 18:18, from two commit logs this hour: a non-mods commit takes 16-17 s, test 15-17, typecheck 2-4, under load; the minutes dima saw are mods-test (not timed yet, its log carries no duration here). crow 18:15: split by where the commit lands, branch lanes to push, main keeps typecheck and path tests, plus a nudge at N unpushed commits. landed in my tree: untouched mods skip; gate-queue.sh.

main's pick 18:32, crow's catch: one turn makes a 16 s commit wait behind a whole mutant round, 10+ min at load 19 (my own commit died at 590 s waiting). long rounds, mutants and whole suites, get their own slot, a commit never waits behind one; gate-queue logs each wait's seconds.

PK-328:W4 (2026-11-06 18:32, dima): another reason to optimize commits: if everyone commits and runs gates during the commit, each one draws CPU, and the system is overloaded by everyone committing. not good at all.
PK-328:W5 (2026-11-06 18:32, dima): i thought our tests via Go and vitest are fast tools. why do they overload my CPU? maybe our testing tools are not properly configured. add this to the scope, identify the bottlenecks and fix them. maybe vitest or Go tests need to be parallelized, maybe they use one core instead of many. ❓
PK-328:W6 (2026-11-06 18:32, dima): perform as wide an analysis as possible, use all your tools and helpers, and use all threads for consultation and data gathering. i want these issues optimized.
PK-328:W7 (2026-11-06 18:32, dima): i assume this CPU overloading was only partially related to the finder issues, most likely caused by gate commits.

PK-328:W8 (2026-11-06 18:36, dima): good ideas, fold and consider to implement: reuse the «already tested these bytes» record for typecheck and tests, not just mods; run only the tests related to the staged paths at commit, with the full set at push; commit in the background, so a coder keeps working during the gate; give each gate a time budget that goes red when exceeded, so slowness can't creep back.
<!-- SECTION:NOTES:END -->
