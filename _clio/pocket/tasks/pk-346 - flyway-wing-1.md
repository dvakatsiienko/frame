---
id: PK-346
title: 'flyway: wing 1'
status: open
assignee: []
created_date: '2026-11-07T12:03:00Z'
updated_date: '2026-11-09T17:01:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: next
type: task
ordinal: 18998
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PK-300 one complete measuring solution
- [ ] #2 FRM-497 speak meter: starts with speak v2, not before
- [ ] #3 standing: FRM-525 performance topic, wing 1 owns it, anything performance comes here
- [ ] #4 PK-357 git: old branches, why they gather, a habit, perf effect — with dima, when free
- [ ] #5 PK-370 perf: tests off pre-commit, to ci or pre-push
- [ ] #6 PK-371 gates file name: gates museum
- [ ] #7 standing: FRM-525 cpu, watch until 2026-11-14 (moved a day)
- [ ] #8 gate tails: wishkeeper's 4 lows on FRM-520's 11-09 comment, for the next gate touch
- [ ] #9 FRM-517 temp dir: the top-level count 11-10 17:28 against 345, under 100 grown closes it
- [ ] #10 perf left in order: FRM-534 close and FRM-533 day read 11-10, FRM-537 probes, FRM-535 -parallel grid
- [ ] #11 FRM-551 vm-go-test: signed; step 1 now, the idle-cost kill gate (dima 19:01)
- [ ] #12 FRM-383 close: W3 timing run, then x lane landed FRM-383 --pr 150 --apply, by 2026-11-12
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
14:50 main, his 14:43 word: core.bare and PK-310 are this plan's; PK-304, PK-308, PK-332 went to wing 2; PK-334 and PK-310's watch came from PK-336.

14:56 doses, ram disk and LANG read; LANG landed; long-slot line dropped: the dose curve says a queue only moves the wait, so no slot change.

17:33: the queue line dropped, his tick: a queue only moves the wait, only a cheaper run helps.

17:34: the PK-310 line dropped: closed on his 15:06 word, so the second watch was a stale tail of mine; a burst seen again reopens it. PK-300 parked, his 17:26 word.

low tide split 11-07, dima's yes 17:36: FRM-517 joins; PK-300 and FRM-530 parked on his word.

PK-346:W1 (2026-11-07 21:48, dima): wing 1 can be an owner of the performance issues topic, so anything performance-related can go to wing one.

2026-11-09 14:55 wing 2 triage, settled on dima's o7: +PK-355, +FRM-383. FRM-503 stays split by step (dima o6): #8 door 1 here, the lane run on main's PK-349 #5.

16:03 main's slipstream, dima's o18: FRM-503 moves to wing 1 fully, label on; door 1 (merge-auto reads mergeable state and deploy) shapes for his sign, joins cli lane 6 after FRM-383; ⏰ 11-14

16:37 groom (wishkeeper siesta read): FRM-520 and FRM-536 lines done; FRM-383 dispatched; FRM-503 door 1 signed, after FRM-383; the cpu watch moved to 11-14

17:06 correcting the 16:37 groom: FRM-520 is not done, its line merged into #11 (gate lane 1); FRM-517 closed 11-09 on o38 (wishkeeper siesta 17:04)

17:17 dima 17:02 via main: both lanes finish and merge what they hold, then park until further steps; cli lane 6 lands FRM-383 and does NOT start FRM-503 door 1; gate lane 1 lands FRM-534 + FRM-520 and parks; park = alive and idle, never stopped (he attaches from herdr). gate lane 1 landed FRM-520 17:16, both codies parked. the 17:06 note's «#11» means the gate lane 1 line

17:18 dima 17:16 via main changes the 17:02 park: cli lane 6 does not park, it takes FRM-503 door 1 after FRM-383 lands; gate lane 1's codie is the herdr probe host

17:29 FRM-520 closed (dima o43); FRM-517 reopened (dima o44), its count 345 at 17:28, read again 11-10 17:28

17:36 dima o32: the lane walks 🐉 review loop gets verbs after door 1; o34: after FRM-503 lands, cli lane 6 and its codie move to wing 2. FRM-383 reopened In Progress, blocked by FRM-503: W3 kept open on his «do»

18:53 cli lane 6 handed to wing 2 (dima o34): handover at .scratch/handover-cli-lane-6.md in the wing 1 tree, glide l55 ended

19:02 synced: FRM-503 closed (o49), cli lane 6 handed to wing 2, gate lane 1 lines done; PK-358 rex walkthrough reassigned to main on dima's 19:01 word
<!-- SECTION:NOTES:END -->
