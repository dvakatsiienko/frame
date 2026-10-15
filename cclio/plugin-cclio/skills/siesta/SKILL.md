---
description: load at every siesta — a member's done report lands, a batch of cclio's own commits touched 3+ files or any memory, rule or skill file, or dima says «siesta». the pause between batches as one fixed flow; it ends with what to do next, never a dead stop.
---

# /cclio:siesta — the pause between batches

dima, 2026-10-10: a siesta should be useful with the least noise — once we kick off from it, the next thing is already picked. this skill is the whole flow and its «when» is the one trigger list; `fleet-vibe` holds the word.

## when

- a member's done report lands
- a batch of cclio's own commits touched 3 or more files, or any memory, rule or skill file — in a memory sweep, the cadence in `recipes/nurture-memory/recipe.md` § the run instead (dima, 2026-10-11: «we siesta too often»)
- dima says «siesta»
- never on a timer

## the flow, in one turn

1. **wishkeeper**, unless the batch is small (under 3 files and no memory, rule or skill file): spawn the `wishkeeper` agent 🐬 in the background, siesta mode, with `effort: high` on the call, with the commit range since the last siesta, the ticket ids touched, the pocket items touched, cclio's session transcript path (for its promises and claims checks) and the open orbit asks (so it skips what is already asked) — nothing more; it reads the tickets' want itself
2. **meanwhile, the pick, in this order** (dima, 2026-10-10): due reminders first, then the pocket (`node script/pocket-check.ts` red = the pocket is the next item, never the main lane), then the main lane. the one exception: a pocket left with only small items runs the main lane plus one pocket item per batch
2.5 **finished lanes end here**: every 🛼 glide whose items are all done, or whose last member stopped, gets orbit op `glide` act `end` with its id (dima's o57 and o78: a card stays a few turns, then the siesta or the halt clears it)
3. **the 5h window**: read it (`habit-ctx-load-balancing`)
3.5 **the helper count**: a `helper-lite` agent counts `helper` and `helper-lite` spawns per live session since the last siesta (the `subagent_type` of each `Agent` call in its transcript); a member with real work and zero is nudged the same turn, and the count joins the card
4. **check before acting**: every high finding from wishkeeper is opened at its cited spot first; one not checked is printed as `unchecked`
5. **the card**, one reply when wishkeeper is back:
   - 🐬 **wishkeeper**: its top 5 and the count of the rest, or «no wishkeeper: small batch»
   - 🍀 **freebie**: what, and why it is small; a duplication finding offers `/simplify` here
   - ➡️ **next**: the main-lane item
   - the asks and the plan go to orbit, never into the card
   - one light line: a fact with a twist, a dry joke, or «meanwhile I did <freebie>» when that is true (`fleet-vibe`)

## boot

the same agent runs once at boot, in boot mode, beside ccrow's board review (`cclio:boot` step 7): dima's boot prompt, his raw inbox text and where each item landed. its findings fold before the opening board prints.
