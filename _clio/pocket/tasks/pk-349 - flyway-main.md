---
id: PK-349
title: 'flyway: main'
status: open
assignee: []
created_date: '2026-11-07T12:46:00Z'
updated_date: '2026-11-25T15:05:21Z'
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
- [ ] #1 f120 the plan over all herdr work (FRM-616): talk it through — with: dima
- [ ] #2 f121 FRM-678: the queue's free-CPU number from two days of rows, one number to dima — waits for: FRM-678 — parked: 2026-11-25
- [ ] #3 f129 FRM-700 close: its 141 rider (12ad6787) is on main, one live refusal seen, then the close — parked: 2026-11-25
- [ ] #4 f130 FRM-596: the seat switch tested with a live wing, by 27 Nov (both halves on main) — parked: 2026-11-25
- [ ] #5 f35 ⏳ designer interview for herdr (FRM-591) — waits for: FRM-591
- [ ] #6 f106 ⏳ herdr-lane-3 spec archives with its last open section — waits for: FRM-620
- [ ] #7 f111 ⏳ FRM-407 fresh-eyes: a trial round on speak v2 first screen, then the verdict — waits for: FRM-407
- [ ] #8 f126 ⏳ kokoro engine upgrade: before and after sounds to dima, told when it lands — waits for: FRM-669
- [ ] #9 f134 ⏳ herdr wisp: a triple click takes one visual line, fixed upstream, waits a herdr release — waits for: FRM-655
- [ ] #10 f136 ⏳ the two old speak verify trees go, their env files moved first — waits for: FRM-669
- [ ] #11 f138 ⏳ your one listening session on speak: cut-off sound, double read, pauses (FRM-288:W22) — waits for: FRM-669
- [ ] #12 f131 📅 FRM-645: a shot dima sent through herdr on 25 Nov still opens — on: 2026-11-26
- [ ] #13 f132 📅 read the first week's typed look and test asks (mods spec after-merge) — on: 2026-12-02
- [ ] #14 f137 📅 orbit asks: 7 days of real ones hold a title, a body and a pick (FRM-695 exit 10) — on: 2026-12-02
- [ ] #15 f110 📅 usage trial, all-fable, a fable reset only at fable 100 %: the 3-week verdict — on: 2026-12-09
- [ ] #16 f42 🦥 FRM-368 tilde grill with dima — later: dima after the herdr move
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-349:W2428 (2026-11-25 12:32, dima): afk 1 min, brewing coffee
raw drop (2026-11-25 12:32, dima): afk 1 min, brewing coffe

PK-349:W2429 (2026-11-25 12:39, dima, herdr-typed): herdr codie too
raw drop (2026-11-25 12:39, dima): herdr codie too

PK-349:W2430 (2026-11-25 12:55, dima): summon wing 1 and ask to do evergreen
PK-349:W2431 (2026-11-25 12:55, dima): you do this now
PK-349:W2432 (2026-11-25 12:55, dima): yesterday i did it with wing (verify), and remove the schedule.
PK-349:W2433 (2026-11-25 12:55, dima): system checkup is run on my word (we should've been set it with wing 1 yesterday)

done 2026-11-25 13:01: f116 decamp the verify trees (frame 5, bytes FRM-683 after its round 2) — waits for: FRM-645 — parked: 2026-11-24 (FRM-683 In Progress, FRM-645 In Progress)

done 2026-11-25 13:01: f115 FRM-596 slice 09: my hook design, and its live-wing done test — on: 2026-11-27 — parked: 2026-11-24 (FRM-596 In Progress)

PK-349:W2434 (2026-11-25 13:08, dima): so it busts the cache? ❓
PK-349:W2435 (2026-11-25 13:08, dima): typing clear is nearly the same as starting a fresh thread? ❓
PK-349:W2436 (2026-11-25 13:08, dima): are you sure we want to fix it? ❓
PK-349:W2437 (2026-11-25 13:08, dima): if it is a cc native behaviour even in cli - i dont really want to spend time on this.
PK-349:W2438 (2026-11-25 13:08, dima): cc will maybe fix it itself later.
PK-349:W2439 (2026-11-25 13:08, dima): so you just read skills by hand.
PK-349:W2440 (2026-11-25 13:08, dima): what i want is our part to work as native.
PK-349:W2441 (2026-11-25 13:08, dima): if skill typed from quill in herdr, it opens a message that expands - it is fine then.

done 2026-11-25 13:09: f113 the plan over all herdr work (FRM-616), parked on his word — later: dima 19:32 («tomorrow or the day after») — parked: 2026-11-24 (FRM-616 Todo)

done 2026-11-25 13:09: f114 FRM-678: the queue's free-CPU number, read from two days of rows, then one number to dima — on: 2026-11-26 — parked: 2026-11-24 (FRM-678 Todo)

his o6 tick (2026-11-25 13:13): the lanes file rider goes to the mods codie after FRM-645

correction to W2441, helga's groom flipped it (his raw, 13:08): if a skill typed from the quill in herdr, that opens a message, expands - it is fine then

PK-349:W2442 (2026-11-25 13:19, dima, wing 1's o7 tick steer): tell main clio to consult with lane when to upgrade kokoro engine better. and i want to see differences after upgrade let me know when it will be done

done 2026-11-25 13:20: f122 FRM-700 close: refusal seen live (FRM-639, 13:21), the 141 rider sits in the mods lane plan; closing word and Done — waits for: FRM-645 — parked: 2026-11-25 (FRM-700 Todo, FRM-639 Todo, FRM-645 In Progress)

moved: W2442 to FRM-669:W4 and W5 (wing 1 writes them, 2026-11-25)

PK-349:W2441 (2026-11-25 13:08, dima): if skill typed from quill in herdr, that opens a message, expands - it is fine then.
PK-349:W2443 (2026-11-25 13:34, dima): put 1 probe ask on orbit (i tell when to remove). and ask wing 1 to put one. i test cmd+shit+k
PK-349:W2444 (2026-11-25 13:37, dima, herdr-typed): also - do you see auto-sw notice? why not second winding? waiting for anything? ❓
PK-349:W2445 (2026-11-25 13:37, dima, herdr-typed): cmd+shift+k wisp: when i am in your thread and press this, wing 1 asks get ticked. instead cmd+shift+k should tick all asks of a thread i currently see opened. → FRM-620:W61
PK-349:W2446 (2026-11-25 13:37, dima, herdr-typed): note: there is a trick, when i hover the asks area and cmd+shift+k, it ticks the hovered area asks, this should still work, if i want a targeted asks group tick while being in a certain thread. → FRM-620:W62

PK-349:W2447 (2026-11-25 13:40, dima, herdr-typed): remove probes now. when it is fixed bring back same probes so i testt out

done 2026-11-25 14:02: f119 decamp bytes' verify tree after speak's round 2 — waits for: FRM-683 — parked: 2026-11-25 (FRM-683 Done)

done 2026-11-25 14:02: f124 kokoro engine upgrade: the speak codie's pick of the slot, then before/after sounds to dima — waits for: FRM-683 — parked: 2026-11-25 (FRM-683 Done)

done 2026-11-25 14:02: f127 ⏳ bytes tree verify-FRM-683 goes once the speak sixth sense leaves it — waits for: FRM-406 (FRM-683 Done, FRM-406 In Progress)

groomed 2026-11-25 14:10, answered in the thread; the want's home is the mods lane's takeSteers rider (wishkeeper's 14:04 high):
PK-349:W2448 (2026-11-25 13:46, dima): I have a question about second wind.
PK-349:W2449 (2026-11-25 13:46, dima): I recently asked about it so I don't know how it works now.
PK-349:W2450 (2026-11-25 13:46, dima): You tell me. ❓
PK-349:W2451 (2026-11-25 13:46, dima): Previously it was like this: when you start a second wind, you send a push message to everyone telling them that you are second winding and so no one should message you back until you second wind, compact, and return.
PK-349:W2452 (2026-11-25 13:46, dima): This is to avoid lost messages but I told them that it is inefficient because it is.
PK-349:W2453 (2026-11-25 13:46, dima): Instead we agreed to change it in a way where we just make held messages more hardened and robust so that in any thread, even when it gets compacted, all messages would still reach the thread.
PK-349:W2454 (2026-11-25 13:46, dima): For example if they get attached to a thread while it is compacted, it would still receive those messages after post-compaction.
PK-349:W2455 (2026-11-25 13:46, dima): Tell me if it is the case already, or not yet, or planned, or lost somewhere, because I don't remember that you were telling me that it was completed at some point. ❓
PK-349:W2456 (2026-11-25 13:51, dima): so you now do not send everyone the second wind notice (push) from your side? ❓
PK-349:W2457 (2026-11-25 13:51, dima): it would be nice to trace.
PK-349:W2458 (2026-11-25 13:51, dima): can you trace it? ❓
PK-349:W2459 (2026-11-25 13:51, dima): so we know for sure if hole is there (not a good one)
PK-349:W2460 (2026-11-25 13:51, dima): confirmed ✓ remove asks probes.
PK-349:W2461 (2026-11-25 13:55, dima): what tails can we solve on your side? ❓
PK-349:W2462 (2026-11-25 13:55, dima): i run lowtide with wing 1 meanwhile (currently solving evergreen and perf topics)

done 2026-11-25 14:23: f123 nudge comments for cc#100797 and cc#100193 as drafts for his yes, before 7 Dec — with: dima

done 2026-11-25 14:40: f125 FRM-700 close: the refusal is seen live, its 141 rider sits in the mods plan — waits for: FRM-645 — parked: 2026-11-25 (FRM-700 Todo, FRM-645 Done)

done 2026-11-25 14:40: f118 FRM-596 slice 09 hook half: built with the x half, then the live-wing done test — waits for: FRM-645 — parked: 2026-11-25 (FRM-596 In Progress, FRM-645 Done)

reopened 2026-11-25 14:40: f125 cleared by a --help mistake, re-added as a new line; f118 reworded, its wait FRM-645 arrived

done 2026-11-25 15:20: f107 ⏳ herdr wisp: a triple click selects one visual run, not the bullet (shot 24 Nov) — waits for: FRM-620 (FRM-620 In Progress)

PK-349:W2463 (2026-11-25 15:28, dima): how does crow do its second wind? does it see auto second wind? i expected crow to auto second wind before 60  → answered 15:29: sees the 55 % notice, waited for 65 %; crew-adviser now says the wind is the next act

(the W2463 line above lost its tail; whole:) PK-349:W2463 (2026-11-25 15:28, dima): how does crow do its second wind? does it see auto second wind? i expected crow to auto second wind before 60 % (it has nothing to do except advising and being parked), but i often saw it at ~60 % context. ❓

done 2026-11-25 15:45: f104 ⏳ herdr wisp: the slash list misses his skill, in chat's commands() — waits for: FRM-620 (FRM-620 In Progress)

done 2026-11-25 15:45: f105 ⏳ herdr wisps: the phases steer text empties; a Read picture says «gone» on click — waits for: FRM-620 (FRM-620 In Progress)

done 2026-11-25 15:45: f108 ⏳ herdr wisp: a click on a file path or dir link does nothing (his o6) — waits for: FRM-620 (FRM-620 In Progress)

done 2026-11-25 15:45: f112 ⏳ FRM-585 annotate (F6) seal, right after FRM-699 — waits for: FRM-699 (FRM-585 Todo, FRM-699 Done)

done 2026-11-25 15:52: f128 ⏳ the speak sixth sense leaves its old bytes verify tree, then it goes — waits for: FRM-406 (FRM-406 Done)

PK-349:W2464 (2026-11-25 15:42, dima): your o1: how to probe? i do not see paths and two pictures; can you post them in a reply, so i probe? ❓
PK-349:W2465 (2026-11-25 15:42, dima, herdr-typed): all worked.
→ answered 15:42 with samples in the reply; a look or test ask that needs a thing to press posts it

PK-349:W2466 (2026-11-25 16:00, dima, on crow's rule written into its skill): do not rush the second wind; it is not immediately required, by design. i just wanted to make sure that it actually works.
PK-349:W2467 (2026-11-25 16:00, dima): what i want: when nothing is planned at all and nothing is pending, a thread should auto second wind right away at 55 %.
PK-349:W2468 (2026-11-25 16:00, dima): anyone else who has been working on something, a lane or you, with pending items, picks a good point, and has a wide context range for a second wind, up to 65 %.
→ crew-adviser reworded; the 55 % notice's own words are a rider on the mods lane (mods-lane-9/lane-plan.md, not greenlit)

done 2026-11-25 16:08: f135 ⏳ two old speak verify trees (FRM-683, FRM-406) with env files of their own go — waits for: FRM-669 (FRM-683 Done, FRM-406 Done, FRM-669 In Progress)

done 2026-11-25 16:55: f133 FRM-689 starts in the mods lane: dispatch marks, steer to its spec — waits for: FRM-695 — parked: 2026-11-25 (FRM-689 In Progress, FRM-695 Done)

PK-349:W2469 (2026-11-25 17:00, dima): i want everyone to do as much as possible before we wind down.
PK-349:W2470 (2026-11-25 17:00, dima): i want the wind-down to be notice-based (informative), not stopping immediately.
PK-349:W2471 (2026-11-25 17:00, dima): while we wind down i also plan the next day, so until we finish planning the next day with your wing, everyone should still be active.
<!-- SECTION:NOTES:END -->
