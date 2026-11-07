---
id: PK-342
title: 'wire what we build, cli and mods: chores go to the wings, main coordinates'
status: open
assignee: []
created_date: '2026-11-06T19:53:00Z'
updated_date: '2026-11-07T13:27:00Z'
labels:
  - s
  - main-lane
dependencies: []
priority: next
type: task
ordinal: 42000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-342:W1 (2026-11-06 21:15, dima): This is the main problem with what we do with CLI and mods: everything that we built, you always forget to wire, probably because of the chaos happening in your main lane. With the new ability to have multiple wings, now let's prioritize offloading the stuff, like you currently do with PK-328, to your wings instead. This way, your main window will be only for coordination and related to decisions, so you then will be least likely to forget to wire stuff and that lends along with chunks.

the offload half lives in PK-332 (W2, W3) and craft-fleet-flow's lanes-are-main's line. reads owed: the cli chunks' wiring, main's; the mods chunks' wiring, wing 3's groom, asked when main's messages resume.

wing 3, 2026-11-06 22:20, the mods half of the wiring read, each chunk's caller: FRM-501 the quiet gate on every member send, the sender's line in quiet.ts. FRM-505 each session's own x-mod-stash; owed in its landing: clio:shift and rules/fleet-mods.md, a 🪢 line. FRM-504 codie's round send through the SendMessage hook; compact-carry.sh:8 reads its key, seen. FRM-490 every session's WebFetch hook and reply-check. FRM-493 x lane gate on a guard rule commit; owed in its landing: mods/AGENTS.md and x:crew-sixth-sense, which names no replay today, 🪢 lines. FRM-510, FRM-519, FRM-472, FRM-489: none — fix, doors and tests that already run.

PK-342:W2 (2026-11-07 14:43, dima): let's do this now with you.

PK-342:W3 (2026-11-07 14:43, dima): then this (answers FRM-410: groom, close).

PK-342:W4 (2026-11-07 14:43, dima): already planned, it is left to finish it (maybe today), drop reminder.

PK-342:W5 (2026-11-07 14:43, dima): drop, wing 2 solving.

PK-342:W6 (2026-11-07 14:43, dima): i think pk-310 is also wing 1 property.

PK-342:W7 (2026-11-07 14:43, dima): attach to wing 1, same issue: perf and cpu load.

PK-342:W8 (2026-11-07 14:43, dima): it's her property.

PK-342:W9 (2026-11-07 14:43, dima): what are looks cards? ❓

PK-342:W10 (2026-11-07 14:43, dima): checked out by me? ❓

PK-342:W11 (2026-11-07 14:43, dima): if yes, let me see what's needed and close.

PK-342:W12 (2026-11-07 14:43, dima): what is review.md? ❓

PK-342:W13 (2026-11-07 14:43, dima): your new key file? ❓

PK-342:W14 (2026-11-07 14:43, dima): how to get use from it? ❓

PK-342:W15 (2026-11-07 14:43, dima): create pocket item for wing 2 to explore and setup review.md convention usage for us everywhere.

PK-342:W16 (2026-11-07 14:43, dima): PK-304, PK-308, PK-332 reassign to wing 2.

PK-342:W17 (2026-11-07 14:43, dima): with you.

PK-342:W18 (2026-11-07 14:43, dima): pk-336 and pk-346 — groom the bodies according to scopes of each other and create day plan for yourself.

PK-342:W19 (2026-11-07 14:43, dima): if pk items for wings are wing-* which is yours? ❓

PK-342:W20 (2026-11-07 14:43, dima): i think you also need a label, top7 name, propose.

PK-342:W21 (2026-11-07 15:02, dima): where? SW clicking works at a band and board (session list) for me at. passd? ❓

PK-342:W22 (2026-11-07 15:02, dima): i ticked o4 but do not see any toasts. how it should look like? ❓

PK-342:W23 (2026-11-07 15:02, dima): observe

PK-342:W24 (2026-11-07 15:02, dima): i want all my wishes in this new format.

15:27 crow's root fix, for a ticket or a no: orbit add refuses a hidden note promising a re-sign when the ask's text has no ✍️ sign shape; his 15:12 tick cost a second tick.
<!-- SECTION:NOTES:END -->
