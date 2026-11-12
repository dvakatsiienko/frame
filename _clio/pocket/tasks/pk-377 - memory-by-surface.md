---
id: PK-377
title: memory by surface
status: done
assignee: []
created_date: '2026-11-11T15:17:00Z'
updated_date: '2026-11-12T17:00:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 57000
---

held: 2026-11-11 — FRM-576 sign; the item stays open for its leftover lines (W23–W27, W30), each homed on the main flyway, closed once those land
note: the re-stamped lines numbered 18–21 repeat lines 13–17; cite 13–17 (stamps fixed in place 17:54, clio)
superseded: the five lines stamped «oN» above, the stamp format only

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-377:W1 (2026-11-11 17:10, dima): next is shaping memory by surface (clio:shape-idea) with you. it needs your answers, so it waits until you're back. do now.
PK-377:W2 (2026-11-11 17:10, dima): what i want is the ability to split memories by areas. what is related to mods, because mods allow a lot of granular behavior tricks and simplify a lot of habits. there is an issue, though: memories are tied to an area.
PK-377:W3 (2026-11-11 17:10, dima): for example cc native mods, claude desktop app and herdr desktop app all have their own specific features. cc native mods mostly work and apply to both desktop apps, so both desktop apps can use what native cc mods provide. clarify for me: is it true or not? both desktop apps can use all functionality from native cc mods. is it like this? ❓
PK-377:W4 (2026-11-11 17:10, dima): claude desktop app also has its own feature set, which defines its own habits for you. you should have memories specific only to claude desktop app, like how you manage threads with desktop-specific tools, and other useful info about your habits and capabilities there, like its built-in browser pane.
PK-377:W5 (2026-11-11 17:10, dima): in herdr we have another surface of tools that is specific to herdr, and habits relevant to herdr. when you run in herdr, those habits do not overlap with the habits you have in claude desktop app.
PK-377:W6 (2026-11-11 17:10, dima): each area should be described in its own memory leaf. i think it is worth a dedicated file for each. it would also be very useful, maybe critical, for you to automatically recognize which environment you are running in and use the matching memory part. for example: started in claude desktop app, your desktop-specific memories load, not the herdr ones. loaded in herdr, you load the herdr-specific habits file.
PK-377:W7 (2026-11-11 17:10, dima): what i am not sure about: habits specific to cc native mods. can they be global, applying to everyone? both desktop apps benefit from cc native mods under the hood, right? ❓
PK-377:W8 (2026-11-11 17:10, dima): another part i don't know how to solve gracefully, so it's up to you to propose: how to split memories and balance them across your own clio memories. that is only useful for clio and global fleet memories, and for both of you.
PK-377:W9 (2026-11-11 17:10, dima): clio should have granularized habits by area (cc native, herdr, claude desktop app), and the global fleet probably should have a similar split. this buys some duplication, so propose how to have it gracefully. if we go with this duplication, which i think i can agree with, i want the shape of it exactly mirrored so it doesn't drift.
PK-377:W10 (2026-11-11 17:10, dima): the whole idea is scalability. as you spotted, maybe even yourself, after we moved from claude desktop app to herdr, your habits turned into a salad of habits describing all doors at once. what we are solving now: when clio is called, we remove the salad and structure your memories gracefully. (read "calling colon" as "calling clio"; flagged to clio)
PK-377:W11 (2026-11-11 17:10, dima): propose how to solve it in a good way. perform the analysis. gather all the information you are still missing, and propose a solid solution.
PK-377:W12 (2026-11-11 17:10, dima): use the author-memory skill for all memory and skill edits.

PK-377:W13 (2026-11-11 17:48, dima, o31 steer): do you think it is a global split, or is it only for clio memories? ❓
PK-377:W14 (2026-11-11 17:48, dima, o32 steer): so you are able to tell which environment you run in? if yes, that is good. but can memories be lazy loaded depending on the environment, or must they always be loaded even when not relevant? ❓
PK-377:W15 (2026-11-11 17:48, dima, o32 steer): example: you run in herdr now. can you load only the herdr-specific memories, and not the claude desktop app-specific ones, while you run in herdr? ❓
PK-377:W16 (2026-11-11 17:49, dima, o35 steer): surface-herdr-desktop.md (context, not dima's words: the raw holds only this file name, with no sentence around it.)
PK-377:W17 (2026-11-11 17:49, dima, o36 steer): let's try gradual, but do not forget to measure and lift after 1 week! (read "1w" as "1 week")

PK-377:W18 (2026-11-11 17:48, dima): do you think it is a global split, or is it only for clio memories? ❓
PK-377:W19 (2026-11-11 17:48, dima): so you are able to tell which environment you run in? if yes, that is good. but can memories be lazy loaded depending on the environment, or must they always be loaded even when not relevant? ❓
PK-377:W20 (2026-11-11 17:48, dima): example: you run in herdr now. can you load only the herdr-specific memories, and not the claude desktop app-specific ones, while you run in herdr? ❓
PK-377:W21 (2026-11-11 17:49, dima): surface-herdr-desktop.md (context, not dima's words: the raw holds only this file name, with no sentence around it.)
PK-377:W22 (2026-11-11 17:49, dima): let's try gradual, but do not forget to measure and lift after 1 week! (read "1w" as "1 week")

PK-377:W23 (2026-11-11 17:51, dima): o27, the bare yes. i don't understand. is it related to the yeses i write in the main prompt text box, or to yeses in orbit ticks? ❓
PK-377:W24 (2026-11-11 17:51, dima): the better rule: a "yes" ticks an ask only when my last reply named that ask. the new pick is in orbit. let's do like this, i approve.
PK-377:W25 (2026-11-11 17:51, dima): do not start multiple grills or reviews at once.
PK-377:W26 (2026-11-11 17:51, dima): i did not answer the tiny skill yet, and you already printed a grill. i approve flyway-sync.
PK-377:W27 (2026-11-11 17:51, dima): i was busy with wing 1, so i did not answer the grill.
PK-377:W28 (2026-11-11 17:51, dima): the drawing part is mostly representation, right? it is not very related to habits, because it only shows how i see what is happening under the hood. this part does not need to be folded into habits, right? what must be remembered in habits is things like orbit phases and everything else. this is the boundary, right? ❓ (context, not dima's words: the line dima answers reads "the engine half runs everywhere vs the drawing half doesn't".)
PK-377:W29 (2026-11-11 17:51, dima): file name fix: surface-herdr-desktop.md, not rules-lazy/surface-herdr.md. (context, not dima's words: the raw shows the old name, then an arrow to the new one.)
PK-377:W30 (2026-11-11 17:51, dima): are there too many siestas, or not? is my siesta now over-tuned? before, you all kept forgetting siesta; now it runs pretty often. wishkeeper finds a lot of issues each time, so it is good, but it is not free. is it okay to have it like this? ❓ (after we finish the grill, do not solve two at once)
PK-377:W31 (2026-11-11 18:09, dima, o38 steer): yes, but the band is very similar between the cc desktop app and the herdr desktop app. overall they are shaped the same, so this part should be fine. when the layout is different and drift is present, then it is worth putting into memories. (context, not dima's words: the line dima answers is "the phoenix icon is on herdr's band in herdr and on cc's band in the desktop app; only those 'where to press' lines go in each app's leaf; that's Q1 of round 2." the band is kept as read; flagged to clio.)
PK-377:W32 (2026-11-11 18:09, dima, o39 steer): let's start from this, but i actually wanted to inspect your full memory and remove the memory salad entirely. propose where we can have it.
PK-377:W33 (2026-11-11 18:09, dima, o41 steer): yes, these are stale, because if we make this conditional, the environment will be decided by the actual environment. it's live and different depending on the environment i start everyone in.

ticket: FRM-576
close: 2026-11-11 18:20 — W2–W17, W28, W29, W31–W33 → FRM-576's wish block (renumbered W1–W21); W23–W24 → mods lane 6 rider r7 (built, b0f7c758); W25 and W30 → main flyway PK-349; W26, W27 answered in the thread; W1, W11, W12 settled by the shape; W18–W22 repeat W13–W17

correction 18:38 (wishkeeper): W13–W17 are the lines to cite, the «superseded» note is wrong; the repeats are W18–W22; the held line is void: FRM-576 is signed and the leftovers W25, W30 live on the main flyway PK-349

PK-377:W34 (2026-11-11 18:10, dima): so after you implement, when i start you in herdr, you will load only herdr memories, and the same for the claude desktop app, right? ❓
PK-377:W35 (2026-11-11 18:10, dima): threads started in a plain terminal (cc without herdr or the claude desktop app) will not load any memories related to herdr or the claude desktop app at all, right? ❓
PK-377:W36 (2026-11-11 18:24, dima): who solves this: you or quicklane? ❓
PK-377:W37 (2026-11-11 18:24, dima): use author-memory.
PK-377:W38 (2026-11-11 18:24, dima): herdr codie has nothing to do. let's have him busy as soon as we solve memories. (read "herder codie" as "herdr codie"; flagged to clio.)

PK-377:W39 (2026-11-11 18:15, dima): go.
PK-377:W40 (2026-11-11 18:38, dima, o44 steer): wing 2 has a lane pending. it's parked. (context, not dima's words: "wink 2" read as "wing 2", per clio's wispr note.)
PK-377:W41 (2026-11-11 18:38, dima): proceed, let's solve everything.
PK-377:W42 (2026-11-11 18:38, dima): where do you need me? ❓
PK-377:W43 (2026-11-11 18:38, dima): what's the next step? ❓
PK-377:W44 (2026-11-11 18:38, dima): when can herdr codie start chatter? ❓ (context, not dima's words: "herder codie" read as "herdr codie"; flagged to clio.)
PK-377:W45 (2026-11-11 18:38, dima): what needs to be grilled? ❓
PK-377:W46 (2026-11-11 18:38, dima): and when do we decide how to make herdr pretty, designer or no designer? ❓
PK-377:W47 (2026-11-11 18:38, dima): your build: wing 2 has a parked "tails chords" lane that doesn't do anything. instead of herdr codie, maybe let's hand this over to that parked lane, since it has nothing to do. (context, not dima's words: "tails chords" is kept as read; flagged to clio.)

PK-377:W48 (2026-11-11 19:09, dima): memory by surface: the two clio leaves are written and committing. fully done, or is another chunk pending? ❓
PK-377:W49 (2026-11-11 19:09, dima): when do we solve it? we are currently solving two things, grill and memory. propose how to solve them sequentially.

PK-377:W50 (2026-11-11 19:21, dima): memory chunk 2, swept file by file with your look. let's prio it, solve now.

close: 18:31 2026-11-12 — W34–W50 ride FRM-576 (main's lane, chunk 2 in progress, main flyway #1); nothing left to shape (wing 1, dima's 18:31 question)

18:32 reopened: closing reds 3+ W-lines the close line does not account for in FRM-576's block; the accounting is FRM-576's (main's lane), handed to main

close: 19:00 2026-11-12 — every W-line moved to FRM-576 (W2–W17, W28, W29, W31–W33 as its W1–W21 on 11-11; W1, W23, W24, W34–W50 as its W22–W41 today); FRM-576 closed Done
<!-- SECTION:NOTES:END -->
