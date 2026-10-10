---
description: load at every siesta — a member's done report lands, a batch of cclio's own commits touched 3+ files or any memory, rule or skill file, or dima says «siesta». the pause between batches as one fixed flow; it ends with what to do next, never a dead stop.
---

# /cclio:siesta — the pause between batches

dima, 2026-10-10: a siesta should be useful with the least noise — once we kick off from it, the next thing is already picked. this skill is the whole flow; `fleet-vibe` holds the word, `habit-usage-pacing` says when to fire it.

## when

- a member's done report lands
- a batch of cclio's own commits touched 3 or more files, or any memory, rule or skill file
- dima says «siesta»
- never on a timer

## the flow, in one turn

1. **wish-review**, unless the batch is small (under 3 files and no memory, rule or skill file): spawn the `wish-review` agent 🐬 in the background, siesta mode, with the commit range since the last siesta and the ticket ids that landed — nothing more; it reads the tickets' want itself
2. **meanwhile, the pick**: exhaust the pocket first (`backlog task list --plain`, open and ready), then open linear tickets cclio could take. pick 1–2 🍀 freebies or almost-freebies, and the next main-lane item. estimates are not a filter (pk-46)
3. **the 5h window**: read it (`habit-usage-pacing`) and print its one line
4. **check before acting**: every high finding from wish-review is opened at its cited spot first; one not checked is printed as `unchecked`
5. **the card**, one reply when wish-review is back:
   - 🐬 **wish-review**: its ≤5 lines, or «no wish-review: small batch»
   - 🍀 **freebie**: what, and why it is small; a duplication finding offers `/simplify` here
   - ➡️ **next**: the main-lane item
   - the ⏳ block
   - the light line only as «meanwhile I did <freebie>», when that is true

## boot

the same agent runs once at boot, in boot mode, right after the inbox is parsed into the pocket (`cclio:boot` step 3): dima's raw inbox text plus where each item landed. its findings fold before the opening board prints.
