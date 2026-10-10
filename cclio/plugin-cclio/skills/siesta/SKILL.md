---
description: load at every siesta — a member's done report lands, a batch of cclio's own commits touched 3+ files or any memory, rule or skill file, or dima says «siesta». the pause between batches as one fixed flow; it ends with what to do next, never a dead stop.
---

# /cclio:siesta — the pause between batches

dima, 2026-10-10: a siesta should be useful with the least noise — once we kick off from it, the next thing is already picked. this skill is the whole flow; `fleet-vibe` holds the word, `habit-ctx-load-balancing` says when to fire it.

## when

- a member's done report lands
- a batch of cclio's own commits touched 3 or more files, or any memory, rule or skill file
- dima says «siesta»
- never on a timer

## the flow, in one turn

1. **wish-review**, unless the batch is small (under 3 files and no memory, rule or skill file): spawn the `wish-review` agent 🐬 in the background, siesta mode, with the commit range since the last siesta, the ticket ids that landed and the open orbit asks (so it skips what is already asked) — nothing more; it reads the tickets' want itself
2. **meanwhile, the pick, in this order** (dima, 2026-10-10): due reminders first, then the pocket (`node script/pocket-check.ts` red = the pocket is the next item, never the main lane), then the main lane. the one exception: a pocket left with only small items runs the main lane plus one pocket item per batch
3. **the 5h window**: read it (`habit-ctx-load-balancing`); it steers the next lane start and is never printed
4. **check before acting**: every high finding from wish-review is opened at its cited spot first; one not checked is printed as `unchecked`
5. **the card**, one reply when wish-review is back:
   - 🐬 **wish-review**: its ≤5 lines, or «no wish-review: small batch»
   - 🍀 **freebie**: what, and why it is small; a duplication finding offers `/simplify` here
   - ➡️ **next**: the main-lane item
   - the asks and the plan go to orbit, never into the card
   - the light line only as «meanwhile I did <freebie>», when that is true

## boot

the same agent runs once at boot, in boot mode, right after the inbox is parsed into the pocket (`cclio:boot` step 3): dima's raw inbox text plus where each item landed. its findings fold before the opening board prints.
