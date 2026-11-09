---
id: PK-355
title: 'commit gate: simple memory edits must not block for minutes'
status: done
assignee: []
created_date: '2026-11-07T20:25:00Z'
updated_date: '2026-11-09T13:10:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: later
type: task
ordinal: 103000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-355:W1 (2026-11-07 22:21, dima): what do you wait for for so long? the red proofs and all these tests. do you really need them to make such simple commits like memory edits?

PK-355:W2 (2026-11-07 22:23, dima): build it now if you can, because for simple memory edits i have to wait for 10 minutes. it currently blocks.

PK-355:W3 (2026-11-07 22:25, dima): tell wing 1 about this case. for simple commits like this, wing 1 rethinks how commit-gate-centered proofs gate work, so simple edits like this would not block for so long. wing 1 optimizes this part, via a pocket item, not today.

measured 11-07, wing 2: a commit's suite 14-36 s at load 8-41; a push about 40 s, its twin reruns vitest; a landing with two plugin bumps is 3 commits and 3 pushes, about 4 min; each waits the machine-wide gate turn. most of the 10 min was retries on refused commits plus the chain.

a draft to take or drop, never landed: /Users/dima/frame/.claude/worktrees/clio-wing-2/.scratch/winged-v2/gate-draft.patch and gate-draft-memory-only.sh beside it. an allow-list of memory paths runs only the 10 tests reading memory, about 6 s, at commit and in the push twin; a landing bumps first and pushes once. not proven red; recipe-shape's 2 reds on that set in the tree, unread.

linear may own part of this: FRM-534 vitest at commit, related tests only; FRM-520; FRM-530. dima asked for a pocket item, so it stays here until wing 1 reads them. a red-proof round on a mod reruns the whole suite per plant, 2 min each at load: part of the same waste.

PK-355:W4 (2026-11-07 22:26, dima): no, solve it yourself to unblock you now so we can finish winged clio v2 today sooner, but the full-scale fix is for wing 1 after monday.

wing 2 lands the small fix tonight: memory-only commits and pushes run only the tests reading memory, a landing pushes once. the rethink is still wing 1's, after monday.

kept: 2026-11-09 — commit-gate speed, goes to wing 1's perf topic at today's low tide

kept: 2026-11-09 — dima 14:42: wing 1's for today

2026-11-09 wing 1 read: a memory-only commit's gates run about 10 s (tests 7, typecheck 2, n=16); its queue wait p90 42 s, max 93 s, the same before and after FRM-521's queue fix; on 11-07 22:05-22:19 main's transcript spent 86 s of 790 in tool calls, the commit+push about 70 s in the background, the rest model time and about 4 min idle. the exact 10-min moment is not found in any transcript (helper-lite, 58 searched). verdict, inference: the gate is not the wait now; the minutes are the turn's chain around a commit.

close: 2026-11-09 dima's o7 tick — the gate is about 10 s since the queue fix; a slow memory commit again reopens it
<!-- SECTION:NOTES:END -->
