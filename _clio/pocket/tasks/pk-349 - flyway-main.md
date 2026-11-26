---
id: PK-349
title: 'flyway: main'
status: open
assignee: []
created_date: '2026-11-07T12:46:00Z'
updated_date: '2026-11-26T17:35:13Z'
labels:
  - s
  - clio-main
dependencies: []
priority: now
type: task
ordinal: 1000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 f142 your one listening session on speak: cut-off sound, double read, pauses (FRM-288:W22) — with: dima
- [ ] #2 f35 ⏳ designer interview for herdr (FRM-591) — waits for: FRM-591
- [ ] #3 f106 ⏳ herdr-lane-3 spec archives with its last open section — waits for: FRM-620
- [ ] #4 f111 ⏳ FRM-407 fresh-eyes: a trial round on speak v2 first screen, then the verdict — waits for: FRM-407
- [ ] #5 f134 ⏳ herdr wisp: a triple click takes one visual line, fixed upstream, waits a herdr release — waits for: FRM-655
- [ ] #6 f145 ⏳ stray 2nd chore: x lane gate passes on any herdr file (lefthook.yaml:128) — waits for: FRM-707
- [ ] #7 f139 📅 FRM-596: the seat switch, 3 test lines and 4 gaps left (its 25 Nov comment) — on: 2026-11-27
- [ ] #8 f149 📅 mini boot grill: one slipstream, a table of kinds (FRM-686), his 19:14 — on: 2026-11-27
- [ ] #9 f150 📅 mini boot: how herdr marks a message as a proposal, FRM-582 herdr half — on: 2026-11-27
- [ ] #10 f148 📅 CPU on Monday's four lanes: his read, still an open topic (FRM-678 want line) — on: 2026-11-30
- [ ] #11 f151 📅 resume speak and herdr from their handoffs, the missed reviews first, then build — on: 2026-11-30
- [ ] #12 f152 📅 speak: kokoro marks' wire shape, your pick before slice 62 (FRM-290) — on: 2026-11-30
- [ ] #13 f146 📅 FRM-677 exit 6: 7 days of asks, none hiding what dima must read — on: 2026-12-01
- [ ] #14 f132 📅 read the first week's typed look and test asks (mods spec after-merge) — on: 2026-12-02
- [ ] #15 f137 📅 orbit asks: 7 days of real ones hold a title, a body and a pick (FRM-695 exit 10) — on: 2026-12-02
- [ ] #16 f110 📅 usage trial, all-fable, a fable reset only at fable 100 %: the 3-week verdict — on: 2026-12-09
- [ ] #17 f42 🦥 FRM-368 tilde grill with dima — later: dima after the herdr move
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
13:19 groomed lines of 26 Nov, each landed:
PK-349:W2473 (2026-11-26 12:53, dima): stray's handoff is relevant? ❓ → landed: answered on the board / in the 13:1x replies
PK-349:W2474 (2026-11-26 12:53, dima): in a boot message tell what stray could do today. → landed: answered on the board / in the 13:1x replies
PK-349:W2475 (2026-11-26 13:11, dima): FRM-360: is this about my wish for a pretty board/stats look with charts in cli? if yes - snooze it, and remove its milestone. ❓ → landed: answered on the board / in the 13:1x replies
PK-349:W2476 (2026-11-26 13:11, dima): i do not see assumptions in herdr yet. (not implemented). → landed: answered on the board / in the 13:1x replies
PK-349:W2477 (2026-11-26 13:11, dima): FRM-660: sign it so it can be picked up by someone, or maybe a stray. → landed: answered on the board / in the 13:1x replies
PK-349:W2478 (2026-11-26 13:11, dima): FRM-660: summon it only if more scope for a bigger batch appears for stray. → landed: answered on the board / in the 13:1x replies
PK-349:W2479 (2026-11-26 13:11, dima): FRM-707: what is it? looks like a freebie? ❓ → landed: answered on the board / in the 13:1x replies

13:26 homes, corrected: W2473 answered on the boot board (the stray's handoff is stale) · W2474 → clio:boot SKILL.md, the 🐕 stray line (a7d52c1b) · W2475 → FRM-387 holds his charts wish (someday, no milestone); FRM-360 left its milestone · W2476 → FRM-620:W88 · W2477–W2478 → FRM-660 already built, o2 · W2479 → FRM-707 signed, held for a stray batch

13:27 homes: W2480, W2481, W2482, W2483, W2484, W2485 → FRM-360 out of its milestone, milestone deleted (13:16); herdr codie answer in the 13:17 reply

13:59 PK-349:W2484 and PK-349:W2485 (2026-11-26 13:16, dima): so the verifier completed his part but codie did not wake up? → answered 13:17 (it woke at 13:02; its turn had ended on its commit's checks), the gap a herdr wisp in herdr-lane-3's lane plan

14:00 home: PK-349:W2485 so the verifier completed his part but codie did not wake up? ❓ → answered 13:17

14:00 home: PK-349:W2484 so yes, he is working, but he was 20m inactive when i wrote to him. → answered 13:17, the herdr wisp in herdr-lane-3's lane plan

14:00 homes:
PK-349:W2480 (2026-11-26 13:16, dima): FRM-360 — looks like another type of «my wish for cli»? not charts, but this ticket is about functionality more useful for me, right? ❓ → FRM-360 out of its milestone, the milestone deleted 13:16
PK-349:W2481 (2026-11-26 13:16, dima): that was an experiment idea. i am not planning it soon. → FRM-360 out of its milestone, the milestone deleted 13:16
PK-349:W2482 (2026-11-26 13:16, dima): so remove it out of a mil and close a mil. → FRM-360 out of its milestone, the milestone deleted 13:16
PK-349:W2483 (2026-11-26 13:16, dima): it will not be done soon most likely, no need for a parked mil. → FRM-360 out of its milestone, the milestone deleted 13:16

19:08 dima o12 steer: «I think Monday will be the test because I think we will have four lanes on Monday… today I saw a red CPU … a few times a day … much calmer than it was before. I treat the current picture as acceptable but I still think that we are somewhere near the edge… Any uncareful move will roast my CPU again so this area is not solved. It is an open topic currently.»
<!-- SECTION:NOTES:END -->
