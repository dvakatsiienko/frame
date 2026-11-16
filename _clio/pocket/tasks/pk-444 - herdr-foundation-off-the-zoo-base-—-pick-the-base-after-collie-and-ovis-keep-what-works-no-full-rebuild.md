---
id: PK-444
title: >-
  herdr foundation: off the zoo base — pick the base after collie and ovis, keep
  what works, no full rebuild
status: open
assignee: []
created_date: '2026-11-16T12:59:00Z'
updated_date: '2026-11-16T14:33:00Z'
labels:
  - m
dependencies: []
priority: now
type: task
ordinal: 2099
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-11-16 14:58, typed in herdr; raw text: ~/.local/state/clio/grooms/2026-11-16-1458h.raw.md. his order: explore collie and ovis → the architecture call → the herdr cuts. goes through clio:shape-idea
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-444:W1 (2026-11-16 14:46, dima): zoo's false negative: we still have more zoo parts than the count shows, because many were rebranded into our parts. For example the chatter, the main window where I see messages and the wheel, was borrowed from zoo and is based on zoo.

PK-444:W2 (2026-11-16 14:46, dima): keep shepherdr for now, until we have borrowed everything we want from it and nothing is left to borrow. I am glad with my herdr setup. Then uninstall shepherdr.

PK-444:W3 (2026-11-16 14:46, dima): egg-basket tested: clicking the idle shell tab and cmd-shift-L works, so we can use it as planned.

PK-444:W4 (2026-11-16 14:46, dima): question: is clicking an empty shell tab before a layout switch a safety net in case a focused thread dies on the switch? If so, is it still relevant? I switched theme about 10 times in recent days and no thread died; the tab survives each layout switch.

PK-444:W5 (2026-11-16 14:46, dima): I do not see Zoom. I only know we started my herdr setup based on Zoom, which I do not like.

PK-444:W6 (2026-11-16 14:58, dima): zoo was the wrong foundation. We started a week ago from zoo, rebranded much of it, and it carries dead weight and poorly written code that codie keeps copying.

PK-444:W7 (2026-11-16 14:58, dima): I would have been much happier starting from shepherdr, ovis or collie; they are better starters and build much better.

PK-444:W8 (2026-11-16 14:58, dima): propose how to solve it: the zoo-based setup needs fixes, plus pulls of good parts from shepherdr, ovis and collie.

PK-444:W9 (2026-11-16 14:58, dima): is it too late to switch the database we build on? I want the best foundation picked from shepherdr, ovis and collie, then build on top of it or cut from there, not from zoo.

PK-444:W10 (2026-11-16 14:58, dima): I do not want to rebuild everything. Propose an efficient execution plan to have all that I want.

PK-444:W11 (2026-11-16 14:58, dima): the chatter is the worst part: I want a good high-performance chatter with high FPS. We already spent a lot of effort optimizing it because it scrolled with lags. Magic button, slipstream, orbit and the rest already work and I like them.

PK-444:W12 (2026-11-16 14:58, dima): solve the architecture and overall approach first: what we are building, where, and what it outputs. Then do the cuts with herdr coding, to keep only the good features on the good foundation.

PK-444:W13 (2026-11-16 14:58, dima): explore collie and ovis before we move on. I will then say what I like in each, and we get a better borrow selection.

PK-444:W14 (2026-11-16 15:07, dima): can we swap the chatter to a better one, and build from there? The idea, in steps:

PK-444:W15 (2026-11-16 15:07, dima): step 1: we install ovis and collie to explore and grade them. I also click them around, grade them, and tell what I like from there.

PK-444:W16 (2026-11-16 15:07, dima): step 2: everyone evaluates what is the best on each surface: shepherdr, collie, ovis.

PK-444:W17 (2026-11-16 15:07, dima): step 3: everyone proposes the best parts to borrow from.

PK-444:W18 (2026-11-16 15:07, dima): step 4: everyone proposes which surface has the best chatter.

PK-444:W19 (2026-11-16 15:07, dima): step 5: we switch the chatter and keep the old (current) chatter.

PK-444:W20 (2026-11-16 15:07, dima): step 6: then stabilize the new chatter: cut what is not needed, and pull back from the old, current and zoo chatter everything codie already built into it.

PK-444:W21 (2026-11-16 15:07, dima): step 7: then see where we are.

PK-444:W22 (2026-11-16 15:07, dima): I could still agree with the idea of using a better-built herdr layout as the base and continuing from there. It would be simpler to have a solidly built layout and just cut or trim it to what I actually want, rather than fixing the pile of zoo leftovers as we do now.

PK-444:W23 (2026-11-16 15:10, dima): terminal layout has no human-readable chatter; the chatter must keep chat bubbles. I still like the terminal layout, it is high quality.

PK-444:W24 (2026-11-16 15:10, dima): terminal tabs are better than our current tabs, which were borrowed from Zoom; pull tabs from terminals. What else can we borrow from terminals?

PK-444:W25 (2026-11-16 15:10, dima): terminals list: its tab pills look better and are a third of our code; ours win only on thread names, which a clone can keep.

PK-444:W26 (2026-11-16 15:10, dima): terminals list: its space chip is one chip with a picker, where we spend a sidebar block on one line.

PK-444:W27 (2026-11-16 15:10, dima): terminals list: its frame is 49 lines against our 344 zoo-born ones; our chat and deck sit in any frame.

PK-444:W28 (2026-11-16 15:10, dima): I think I approve, but do a final review once we see the full picture of surfaces we borrow from; then pick the best parts from all surfaces and provide one merged solution of the best parts in my layout.

PK-444:W29 (2026-11-16 15:10, dima): is it worth another research hunt, a final time, for solidly built herdr layouts like shepherdr, ovis and collie, before we start the move and pick what we treat as a base? I want it verified: check all high-quality herdr builds out there that we can start from.

PK-444:W30 (2026-11-16 15:10, dima): research all similarly graded herdr builds like shepherdr, ovis, collie. Zoo-level builds are not allowed.

PK-444:W31 (2026-11-16 15:10, dima): terminals: if there are good parts to borrow from this layout, I allow them, but first tell what we can, and what the terminal layout made better than us. I approve borrows if they are justified.

PK-444:W32 (2026-11-16 15:10, dima): and now we have a pile of crap borrowed from zoo.

PK-444:W33 (2026-11-16 15:10, dima): i wanted for us to start on good foundation for herdr. and now we have

PK-444:W34 (2026-11-16 15:10, dima): how much is still zoo, word for word: the chat 44%.

PK-444:W35 (2026-11-16 15:10, dima): the agents list 80%. We even planned an antenna built on top of 80% of zoo scrap. Then the antenna is built either from another better agents list (if found in a high-graded build), or from scratch instead? What's better? Is zoo truly so bad as I predict?

PK-444:W36 (2026-11-16 15:10, dima): the deck 0%.

PK-444:W37 (2026-11-16 15:10, dima): and tabs?

PK-444:W38 (2026-11-16 15:10, dima): I see, but from my tests shepherdr's chatter is much quicker and very fluent. The FPS was 60 at least when I was testing.

15:40: the map of this call, kept across any second wind: _clio/.scratch/herdr/foundation-state.md (his order, his verdicts so far, the evidence by file, what is on hold)

PK-444:W39 (2026-11-16 15:40, dima): you can add followup clarification questions for researcher while he's still researching.

PK-444:W40 (2026-11-16 15:40, dima): in the current context you contain a lot of useful and important information about steers related to Herdr and problems with zoo. I don't like when you decide to second wind. Ensure that you do not forget my architectural asks about Herdr. It is important. Everything related to all these: shepherder, collie, and zoo cuts.

PK-444:W41 (2026-11-16 15:40, dima): fyi how ovis looks for me and how my herdr desktop app looks with the current setup. /Users/dima/Desktop/screenshots/CleanShot\ 2026-11-16\ at\ 15.33.33.jpg /Users/dima/.config/herdr-app/data/x-herdr-chatter/shots/shot-1794836032497.png

PK-444:W42 (2026-11-16 15:40, dima): what researcher found? any other solid herdr builds worth to look at?

PK-444:W41 (2026-11-16 15:40, dima): fyi how ovis looks for me and how my herdr desktop app looks with the current setup. /Users/dima/Desktop/screenshots/CleanShot 2026-11-16 at 15.33.33.jpg /Users/dima/.config/herdr-app/data/x-herdr-chatter/shots/shot-1794836032497.png

PK-444:W43 (2026-11-16 15:55, dima): no, don't like it. (flockbook)

PK-444:W44 (2026-11-16 15:55, dima): where did you see them? in my chrome opened tabs? ok, the verdict is useful. but I keep them open for a different reason - the look. if under the hood is carp, ensure this verdict is folded. but the look is still nice (waits

PK-444:W45 (2026-11-16 15:55, dima): link pls. its herdr builtin or custom?

16:21 from PK-437 at its close: his want «i want a mods view in the ios app» (PK-437:W10–W12) stays open here: no tool mirrors a herdr mod (collie and ovis both uninstalled 11-16, his verdicts); the door left is his own hq app or a data store any app draws, see .scratch/herdr/foundation-proposal.md § 1.

PK-444:W46 (2026-11-16 16:36, dima, o29 steer): okay, I approve this move. Let's do it in egg-basket, and do TypeScript first, so TypeScript is already fixed along the way. Pull only clean decided features, and do not pull any trash that we will then cut.
<!-- SECTION:NOTES:END -->
