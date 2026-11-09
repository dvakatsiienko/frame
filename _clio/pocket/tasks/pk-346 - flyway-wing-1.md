---
id: PK-346
title: 'flyway: wing 1'
status: open
assignee: []
created_date: '2026-11-07T12:03:00Z'
updated_date: '2026-11-09T22:08:00Z'
labels:
  - s
  - clio-wing-1
dependencies: []
priority: now
type: task
ordinal: 1001
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ⏳ perf lane 1/5 FRM-551: #153 at f36c25ba, all green but sixth sense's stamp past the 3-round cap; then merge-auto, x lane landed — waits for: dima's o99 tick
- [ ] #2 ⏳ perf lane 2/5 FRM-557 test hooks trimmed: 🟢 greenlit, slices 06–11, the vm codie, first thing tomorrow; FRM-537's vitest-pools rider inside — waits for: FRM-551 landed
- [ ] #3 ⏳ perf lane 3/5 FRM-539 gate step time budget: signed, quick, same codie by a next: message — waits for: FRM-534 closed (11-10 read)
- [ ] #4 ⏳ perf lane 4/5 FRM-533 reuse proven results: needs a sign, same codie, after FRM-557 — waits for: its 11-10 day read and dima's sign
- [ ] #5 ⏳ perf lane 5/5 FRM-535 small go trims: needs a sign, same codie, each slice on a budget row — waits for: dima's sign; herdr first, so 3–5 may park
- [ ] #6 ⏳ FRM-548, FRM-549, FRM-553, FRM-509 close at the next frame pr's merge-auto run, the first live read of #152's checks — waits for: #153's merge
- [ ] #7 ⏳ cli lane 6's rest, all signed: FRM-384 (gate runner, body guard, own-branch push, brief lint, the 19:27 gate riders, FRM-554), FRM-436, FRM-424, plus FRM-560 (main's call) — waits for: dima's word on a new cli codie
- [ ] #8 ⏳ FRM-537 other probes, by hand, no lane — waits for: spare usage
- [ ] #9 ⏳ the stray FRM-383 tree and branch (16 squashed lane commits, held by cli lane 6's stopped codie): decamp — waits for: dima's word
- [ ] #10 📅 FRM-517 temp dir: count at 17:28 against 345, under 100 grown closes it — on: 2026-11-10
- [ ] #11 📅 FRM-534 related tests at commit: the day read at 17:30, then close — on: 2026-11-10
- [ ] #12 📅 speak v2 planning with dima, after herdr's move and the mods scope (dima 23:50); FRM-497 speak meter 120 → 60 fps rides it — on: 2026-11-11
- [ ] #13 📅 FRM-525 cpu overload, the week's read in gate-speed.md — on: 2026-11-14
- [ ] #14 💤 PK-300 one complete measuring solution — later: dima 11-11
- [ ] #15 💤 PK-374 gates naming: one convention, one big sweep — later: dima picks the window (o80)
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

19:45 gate tails and the watch-pr undo moved to wing 2's cli lane as riders (dima 19:21); 33+79 branches deleted, tips logged in the wing 1 tree's .scratch/branches-deleted-tips.txt

2026-11-09 19:59 groom (dima 19:58 via wing 2): done and cleared — PK-357 branches closed (status done, every W-line routed, verified by pocket-check green); the open lines rewritten to read alone, ordered by date, each ticket's state read live (all Todo).

done 2026-11-09: FRM-537 mods test-cost probe — 4 files hold 69 % of 286 user-s, comment on FRM-537, doors-left door 10 (dima's o55). groomed 20:11 to the flyway shape (dima's o68 via wing 2).

done 2026-11-09: mods test trim shaped into FRM-555 (dima's o56, o57); the perf watch moved to 💤 on his 20:18 word

done 2026-11-09: FRM-555 grill 1 answered (o58–o61), kept in its decided; unsigned on dima's 20:32 word — the mods lane waits for main's herdr revisit pass; handed to main, label off

done 2026-11-09: FRM-551 kill gate read 2 — 288 cpu-s a day idle at 4 vcpus, under the 320 line; comment on FRM-551; vm frm536 stopped 20:37

2026-11-09 21:21: speak v2 moves to wing 1 (dima 21:17 PK-370:W5, via wing 2's low tide triage); FRM-530 back on the flyway as 💤

done 2026-11-09 21:26: 💤 PK-370 move tests off pre-commit, to ci or pre-push — later: dima, a little later (his 18:43) (PK-370 done)

done 2026-11-09 21:29: FRM-525 perf line: talk it through with dima, his «drop it» (21:24), right after the FRM-557 call (FRM-525 Todo, FRM-557 Todo)

2026-11-09 21:29: FRM-525 line dropped on dima's word (21:24, «drop the FRM-525 line»; 21:28 «proceed»): the cpu watch until 11-14 ends; the ticket stays open as the performance umbrella (parent of FRM-533, 537, 551, 555, 557)

done 2026-11-09 22:39: FRM-530 gates catalog: fold o74–o87 into decided, refresh its body (the page, not the old gates.md), then close it naming 78d1d545 and 7abb406d (FRM-530 Done)

2026-11-09 22:50 wing 1, dima's «sync your flyway with actual scope»: FRM-530 closed and out; FRM-383's real call done (wing 2's three runs, 22:18–22:20); FRM-557 dispatched; the mods-tests follow-up from o91 is FRM-555, main's

done 2026-11-09 22:54: ⏳ PK-357 branches: W5 «gba prints clean», the last stray is bytes' proof/frm-547-review-cite, then close — waits for: dima's delete tick (PK-357 done)

2026-11-09 22:59: the FRM-414 re-grill line went back to wing 2 (dima 22:57 «let's regrill now so it is not a tail»)

done 2026-11-09 23:18: FRM-383 x verify: time W3 «faster», one pair through x verify red and the old red-proof from 0bd86a17, on a quiet mac, then x lane landed FRM-383 --pr 150 --apply, by 11-12 (FRM-383 Done)

2026-11-10 00:09 wing 1: the perf order, adopted by main (dima's reuse-before-summon rule, 00:01/00:07): one lane, the vm codie and its sixth sense, sequential; FRM-555 to main's herdr mods pass, FRM-560 to cli lane 6's next codie
<!-- SECTION:NOTES:END -->
