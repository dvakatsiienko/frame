---
id: PK-463
title: >-
  mods tests cpu: research the cc plugin test cost, prior art, and our suite's
  redundancy
status: open
assignee: []
created_date: '2026-11-20T18:17:00Z'
updated_date: '2026-11-20T18:33:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 78000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
20:17 wish:
- PK-463:W1 (2026-11-20 20:16, dima): how much time is needed for all of that? (answered in the reply)
- PK-463:W2 (2026-11-20 20:16, dima): tests: I think the problem isn't solved, because you just postponed it. maybe we should write fewer tests, or rethink them.
- PK-463:W3 (2026-11-20 20:16, dima): maybe it's worth another research, specifically on cc mods tests: if they create such a hard bottleneck, maybe it's a well-known problem; someone else may already know about it and may have found a solution, or there are open issues on the cc github side about it.
- PK-463:W4 (2026-11-20 20:16, dima): are you sure we write tests the right way? maybe some of our tests are redundant?

20:27 reads landed: source lane .scratch/mods-tests-cpu/source-lane.md (per-test reload ~0.2 s cpu, #106331, #108931), web lanes .scratch/mods-tests-cpu/lanes/, messhunter: guard 24 files → ~4, 7 pure stash files to vitest (mods/AGENTS.md:11 bans it), slow.test.ts guards a deleted feature, quiet-gate:818/833 and board:411 long polls; ~−39 of 76 boots. moves asked on orbit.

20:33 wish:
- PK-463:W5 (2026-11-20 20:32, dima): «I'm watching both now» ← oh yes, you do watch it, because you wrote a test system in the most expensive way inside your own framework, for your own internals, on my system, and blocked the entire fleet with this bottleneck.
- PK-463:W6 (2026-11-20 20:32, dima): I approve the optimization, but first consult with wing 1, with crow, with the mods codie and with the verifier on the old data. ensure they know the research data and the problem, and let's use the combined consultation results to produce a good, solid, unified solution.
- PK-463:W7 (2026-11-20 20:32, dima): afterwards, propose how not to forget it and set it as default practice for cc mods, so this never happens again. cc mods tests should never roast my cpu and create bottlenecks like this. afterwards the mods codie should fix it now.
- PK-463:W8 (2026-11-20 20:32, dima): fix cc mods: cpu roasting is not allowed, the bottleneck must be resolved. from now on, if we have cpu roasting problems because of tests, the fix door is searching the external internet for similar symptoms and existing solutions, or gh issues.
- PK-463:W9 (2026-11-20 20:32, dima): now: consult with crow, the mods lane codie and the verifier, and wing 1 and the stray. tell them the problem fully and make sure they know the context, the root of the problem and the solutions you found through the research. propose the final weighted solution.
- PK-463:W10 (2026-11-20 20:32, dima): then: 1. how to prevent this in future? another roasted cpu bottleneck is treated as a critical failure. 2. create a fix plan and tell when it can be implemented (estimate).
<!-- SECTION:NOTES:END -->
