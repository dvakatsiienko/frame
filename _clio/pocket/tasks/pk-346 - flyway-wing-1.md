---
id: PK-346
title: 'flyway: wing 1'
status: open
assignee: []
created_date: '2026-11-07T12:03:00Z'
updated_date: '2026-11-25T16:38:02Z'
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
- [ ] #1 f96 FRM-582 two reads before dispatch: edge cases, then prior art with dima — waits for: FRM-585 — parked: 2026-11-25
- [ ] #2 f102 FRM-630 comms log, its review half: right after the first deletion scan — with: dima
- [ ] #3 f104 board: the «assumed» list and the eight blank text boxes in herdr, keep, move or drop — with: dima
- [ ] #4 f82 ⏳ FRM-702 the two slow test files split, once gate-queue.test.ts is quiet — waits for: FRM-596
- [ ] #5 f93 ⏳ bytes#176 github-actions pr: merge it once renovate stability-days goes green — waits for: bytes#176 release age
- [ ] #6 f76 📅 BYT-135 renovate weekly minutes under 120: read after 16:52, close if it holds — on: 2026-11-26
- [ ] #7 f83 📅 PK-468 ticket flow: its real check — on: 2026-12-01
- [ ] #8 f52 📅 FRM-465 exit 5: did a scheduled renovate run open the minors prs inside the wednesday window — on: 2026-12-02
- [ ] #9 f103 📅 FRM-706 lost-ping alarm: 7 days after its land, a true gap since? none → the cut to dima — on: 2026-12-04
- [ ] #10 f31 🦥 redraw the refresh-crew-coordinator board — later: dima 19:21
- [ ] #11 f32 🦥 FRM-525 cpu overload: the sudo read first, then the stopped-sessions A/B — later: dima, after herdr and speak v2
- [ ] #12 f33 🦥 FRM-537 perf probes: a menu to run when usage is spare — later: dima, after herdr and speak v2
- [ ] #13 f35 🦥 FRM-650 measuring, one solution: the shape-idea grill — later: dima 20:47 («later, more important grills first»)
- [ ] #14 f60 🦥 the picture: one grill over blueprint v2 (FRM-614) and the mods big picture (FRM-611) — later: dima 14:34
- [ ] #15 f84 🦥 FRM-696 hang-heal: the full shape-idea grill — later: dima 15:08
- [ ] #16 f85 🦥 github event streams: is gh event listen worth it for our ci and pr watches — later: dima 15:08
- [ ] #17 f99 🦥 the guard, an emoji may allow anything (FRM-582:W94): a grill on his time — later: dima 16:55
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
21:23 wing 1: that clear answers his PK-363:W389 and W398 (11-10), read from herdr by the herdr codie 21:23: the status bar is the bottom strip, our x-herdr-status in layouts/x-herdr-layout.json; its VS Code button runs `code <folder>` on the focused terminal's folder (x-herdr-status/main.js:26, 45–60), a Folder button opens it in Finder; herdr runs no outside terminal: its terminals live in herdr-core with Ghostty's libghostty-vt bundled, so rex is not hosted inside it (inference from the binaries)

PK-346:W93 (2026-11-25 12:46, dima, o3 steer): discuss with wing, after everything pending solved

13:02 f52: frame's only minor, @raycast/api 2.13.1, kept out of the evergreen landing (crow) so the window can be read; no renovate run inside the 07:00–23:59 window yet at 13:02; taken by hand at the window's end if it never wakes

his o4 steer (2026-11-25 13:11, dima): me with wing 1 after evergreen, one topic at a time, not all at once.

PK-346:W94 (2026-11-25 13:11, dima, o4 steer): me with wing 1 after evergreen, one topic at a time, not all at once.

PK-346:W94 stamp corrected: his o4 steer was at 13:08 (the packet), not 13:11

13:36 f52: my 13:23 dispatch (force off, both repos) proved the window opens a minors pr when a run lands in it: frame 184, bytes 178. not proven: a scheduled run landing in it unaided (none since 07:00); that half moves to 12-02, exit 5 stays open. raycast comes by merging frame 184 after main's push

PK-346:W95 (2026-11-25 13:29, dima): let's see what we have to solve.
PK-346:W96 (2026-11-25 13:29, dima): and btw: refresh lowtide to also hunt stray tickets everywhere that are in false non-closed state: hung in progress, and others just done but forgotten to close.
PK-346:W97 (2026-11-25 13:29, dima): it is the first step of lowtide always, start with it.
PK-346:W98 (2026-11-25 13:29, dima): (after your gate-speed proposal)
13:49 the 13:29 groom: PK-346:W96 and PK-346:W97 landed in lowtide's SKILL.md and references/false-open-hunt.md; PK-346:W95 and PK-346:W98 wait behind his 13:34 «perf and bytes first»

14:34 the false-open hunt (his o16 tick, 14:29): 136 open FRM and BYT tickets read, 37 of them someday or snoozed and skipped, 0 falsely open; FRM-497 is built, its look left, sent to main; gate-speed verdict closed (his o15), FRM-704 its fix

14:49 the 14:41 groom:
PK-346:W99 (2026-11-25 14:41, dima): FRM-26 slightly later, snooze it.
PK-346:W100 (2026-11-25 14:41, dima): i expected that at the start if lowtide you would first print me a list of your tails. then we set the order to solve them and then hunt.
PK-346:W101 (2026-11-25 14:41, dima): how to have it? is any other skill would be needed to run first to have that list/plan? ❓
PK-346:W102 (2026-11-25 14:41, dima): or its better to extend/fix lowtide itself? ❓
14:49 the four lines above: the snooze done, the rest answered and built into lowtide, landing
PK-346:W103 (2026-11-25 14:46, dima, o2 steer): ok. you list all possible tails: ones you can solve yourself next step (mechanical) on my plain «go» (first to solve), and list of other items — everything inside your flyway and pocket parks, and non-lane-linear stuff, not-snoozed, not someday. if i query you to hunt over snoozed/someday - we switch to that filter (lowtide is flexible with non-snoozelike default mode)

done 2026-11-25 14:53: f73 trials, one topic at a time with dima after evergreen: gate-speed, review-rounds, wisphunter verdicts — with: dima

done 2026-11-25 14:53: f75 lowtide run: the false-open hunt first, then the tails (PK-346:W95) — waits for: perf and bytes — parked: 2026-11-25 (PK-346 open)

done 2026-11-25 14:53: f81 ⏳ FRM-702 the two slow test files split, after gate-queue.test.ts goes quiet — waits for: FRM-645 (FRM-702 Triage, FRM-645 Done)

14:53 f81 was reworded (FRM-645 is Done), not done: FRM-702 waits on FRM-596 now; f73 and f75 became f78 and f79

done 2026-11-25 15:09: f61 PK-468 ticket flow: where we stand and his next step — with: dima (PK-468 open)

done 2026-11-25 15:09: f59 FRM-696 hang-heal: the full shape-idea grill — with: dima (FRM-696 Todo)

done 2026-11-25 15:09: f72 github event streams: is gh event listen worth it for our ci and pr watches — after everything pending — with: dima

done 2026-11-25 15:09: f79 lowtide run: the list is with dima, his go and order on o3 — with: dima

done 2026-11-25 15:09: f55 FRM-582 emoji reactions: its ten questions, three a batch — with: dima (FRM-582 Todo)

done 2026-11-25 15:09: f71 FRM-639 events piece 2: six questions, the draft in mods-lane-9/frm-639-section.md — with: dima (FRM-639 Todo)

15:09 reworded or reordered, not done: f61 to f83, f59 to f84, f72 to f85, f71 and f55 re-added in his 15:08 order (trials, events, emoji); f79 done, his go came 15:08

PK-346:W104 (2026-11-25 15:08, dima): ticket flow: fix lowtide. date-gated items are excluded from lowtide.
PK-346:W105 (2026-11-25 15:08, dima): correction, time gated for TODAY like with 15:25 are ok to stay. everything tomorrow+ is excluded.
PK-346:W106 (2026-11-25 15:08, dima): approve the list lets do. exclude hung thread notices for now (later, i have more important side asks)
PK-346:W107 (2026-11-25 15:08, dima): github event streams: too, slightly later.
PK-346:W108 (2026-11-25 15:08, dima): need-you list, this order: 7, 9, 10, my asks here, 12, 8, 11.
PK-346:W109 (2026-11-25 15:08, dima): ticket flow: on dec 1.
PK-346:W110 (2026-11-25 15:08, dima): linux vm for go tests (FRM-551): same stuff, do not propose date-gated stuff. we won't solve it before date, it only clutters the list.
PK-346:W111 (2026-11-25 15:08, dima): go
15:17 the eight lines above: the date rule in lowtide's filter, f83 and f84 and f85 moved, his order on the flyway, the go running
15:17 the stamp of his o2 steer is 14:48, not 14:46; the groomed line:
PK-346:W103 (2026-11-25 14:48, dima): ok. you list all possible tails: ones you can solve yourself next step (mechanical) on my plain «go» (first to solve), and list of other items — everything inside your flyway and pocket parks, and non-lane-linear stuff, not-snoozed, not someday. if i query you to hunt over snoozed/someday - we switch to that filter (lowtide is flexible with non-snoozelike default mode)

done 2026-11-25 15:23: f78 trials, one at a time: review-rounds, then wisphunter, verdicts due 27 Nov (gate-speed closed) — with: dima

done 2026-11-25 15:24: f77 ⏳ FRM-704 the cited-docs check at commit: built in my tree after the rerun, main pulled first — waits for: FRM-596 (FRM-704 Triage, FRM-596 In Progress)

15:24 f77 reworded (no wait on FRM-596, main asked only to pull main first), not done; the 20:24 stash tick of PK-467 now lives here as its own flyway line; the shrink read is the second half of that tick

done 2026-11-25 15:24: f91 x-mod-stash shrink read: 50,171 lines, 49 fixes in 7 days, what to cut (his o6 tick, 24 Nov 20:24; PK-467 closed) — parked: 2026-11-25 (PK-467 done)

15:24 f91 reworded without the closed id, not done

done 2026-11-25 15:32: f80 ⏳ evergreen tail: PK-469 closes once bytes#176 merges — waits for: PK-469 (PK-469 open)

done 2026-11-25 15:32: f74 ⏳ bytes prod: rerun the five failed deploys at 15:25, read every app Ready — waits for: pnpm 12.23 release age

done 2026-11-25 15:53: f88 FRM-690 three clio test files split to the map: a helper moves them, then the equality proof and the land — parked: 2026-11-25 (FRM-690 In Progress)

done 2026-11-25 15:53: f90 FRM-704 the cited-docs check at commit: built after 15:25, main pulled first, timed before and after — parked: 2026-11-25 (FRM-704 In Progress)

PK-346:W112 (2026-11-25 15:46, dima): events: let's do when you can.
PK-346:W113 (2026-11-25 15:46, dima): tell what it is, why we have it, and proposed action items from you.
PK-346:W114 (2026-11-25 15:46, dima): the 14 tickets: yes they are all out of lowtide scope. lab is experiments (not tails) (fix skill), and portfolip is kinda app (not really but it is unclear yet actually will it be an app or not).
PK-346:W115 (2026-11-25 15:46, dima): wisphunter (not gated by 27 Nov): do after events then.
PK-346:W116 (2026-11-25 15:46, dima): go events
PK-346:W117 (2026-11-25 15:46, dima): after SW? ❓
15:57 the lines above: events is the first thing after the reset, the lab and portfolio rule is in shapes.md, wisphunter after events

done 2026-11-25 15:57: f94 ⏳ FRM-690 and FRM-704 close once the checks of their push are green — waits for: CI d5761785 (FRM-690 In Progress, FRM-704 In Progress)

done 2026-11-25 16:05: f95 ⏳ FRM-690 and FRM-704 close once CI of their push (7a852ebf or newer) is green — waits for: CI (FRM-690 Done, FRM-704 Done)

done 2026-11-25 16:42: f86 FRM-639 events piece 2: six questions, the draft in mods-lane-9/frm-639-section.md — with: dima (FRM-639 Todo)

done 2026-11-25 16:42: f89 trials: wisphunter, its verdict due 27 Nov (review-rounds adopted, gate-speed closed) — with: dima

16:55 W-lines of his 16:44 prompt about the shrink read (groomed to FRM-582): FRM-582:W90 (2026-11-25 16:44, dima): after that: the shrink read of the board mod, from your tick of 24 Nov. it was about 50,000 lines with 49 fixes in seven days. FRM-582:W91 (2026-11-25 16:44, dima): what is it about? why? ❓ FRM-582:W92 (2026-11-25 16:44, dima): i can't recall the tick. → answered 16:48 (what it is, 17,000 lines of code today, 52 fixes in the week)

done 2026-11-25 17:08: f87 FRM-582 emoji reactions: its ten questions, three a batch — with: dima (FRM-582 Todo)

17:15 flyway notes swept: old done notes of all four flyways moved whole to pocket/archive/notes (his 17:12 word, o1 tick); the code for it (flyway-done --sweep, pocket-check, wish-cover, --next readers) follows

done 2026-11-25 17:23: f92 x-mod-stash shrink read: 50,171 lines, 49 fixes in 7 days, what to cut (his o6 tick, 24 Nov 20:24) — parked: 2026-11-25

PK-346:W118 (2026-11-25 17:10, dima): pk-468 is done with you yesterday? ❓
PK-346:W119 (2026-11-25 17:10, dima): can you fix your flyway cleaning habit? ❓
PK-346:W120 (2026-11-25 17:10, dima): i see lots of stale/not-relevant-anymore implementation notes across all flyways.
PK-346:W121 (2026-11-25 17:10, dima): can you clean them occasionally? ❓
PK-346:W122 (2026-11-25 17:10, dima): which are good spots to clean them? ❓
PK-346:W123 (2026-11-25 17:10, dima): i think at least at halt is a must.
PK-346:W124 (2026-11-25 17:13, dima): i just opened the full flyway of main clio and it is fucking huge.
PK-346:W125 (2026-11-25 17:13, dima): i was looking only from rex backlog view and never saw the full list (not scrolled).
PK-346:W126 (2026-11-25 17:13, dima): fix the list immediately.
PK-346:W127 (2026-11-25 17:13, dima): do you want main clio to open a 2k line flyway on each small edit?! ❓
PK-346:W128 (2026-11-25 17:13, dima): flyways are intended to be slim and robust.
PK-346:W129 (2026-11-25 17:13, dima): 2k file is not robust. 2.9k.
PK-346:W130 (2026-11-25 17:13, dima): attached screenshot: /Users/dima/.local/state/clio/prompts/wing-1/2026-11-25-files/b57d068e-aab7-467b-8c63-b50e5da23cd8-2-CleanShot 2026-11-25 at 17.12.25.jpg

17:24 W118–W130: PK-346:W118 answered 17:16 (built 24 Nov, open for its 1 Dec check); PK-346:W119–PK-346:W129 the lists moved 17:15 (01c1b805), the sweep in code is being built in clio-wing-1, run by every pocket write and the halt

17:26 FRM-596 seat test: this line is wing 1's, written as main in the main checkout and committed by `x lane commit`

17:38 the sweep landed (64f3c228, pushed with d9faf8fe); the pocket hook runs it at every pocket write

PK-346:W131 (2026-11-25 17:52, dima, o3 steer): no, do only FRM-630, and nothing else from that list today; all my future asks come from my stash file (i drop them myself one by one as we solve them).

PK-346:W132 (2026-11-25 17:57, dima): lowtide fix: do not use the lowtide next catch shape to tell your next steps in the current thing we do right now.
PK-346:W133 (2026-11-25 17:57, dima): the next catch block is only for cases when you propose the next big item in your list. for example the next item in your list should be FRM-630, so next catch shouldn't tell about the next substeps of the current task that you do now. only next big solvable items like FRM-630 or similar ones.

18:38 f99: dima ticked «a) no fence, closed for good» on the folder his ticks live in (main, 18:37; FRM-582's comment), so the guard grill never raises it
<!-- SECTION:NOTES:END -->
