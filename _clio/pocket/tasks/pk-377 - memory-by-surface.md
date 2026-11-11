---
id: PK-377
title: memory by surface
status: open
assignee: []
created_date: '2026-11-11T15:17:00Z'
updated_date: '2026-11-11T15:20:00Z'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 9999
---

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
<!-- SECTION:NOTES:END -->
