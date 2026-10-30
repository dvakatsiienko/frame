---
description: load at every siesta — a member's done report lands, a batch of clio's own commits touched 3+ files or any memory, rule or skill file, or dima says «siesta». the pause between batches as one fixed flow; it ends with what to do next, never a dead stop.
---

# /clio:siesta — the pause between batches

dima, 2026-10-10: a siesta should be useful with the least noise — once we kick off from it, the next thing is already picked. this skill is the whole flow and its «when» is the one trigger list; `fleet-vibe` holds the word.

## when

- a member's done report lands
- a batch of clio's own commits touched 3 or more files, or any memory, rule or skill file — in a memory sweep, the cadence in `recipes/nurture-memory/recipe.md` § the run instead
- dima says «siesta»
- never on a timer

## the flow, in one turn

1. **wishkeeper**, unless the batch is small (under 3 files and no memory, rule or skill file): spawn the `wishkeeper` agent 🐬 in the background, siesta mode, at its medium default (`effort: high` only on dima's ask), with the commit range since the last siesta, the ticket ids touched, the pocket items touched, clio's session transcript path (for its promises and claims checks) and the open orbit asks (so it skips what is already asked) — nothing more; it reads the tickets' want itself
2. **meanwhile, the pick, in this order**: due reminders first, then the pocket (`node script/pocket-check.ts` red = the pocket is the next item, never the main lane), then the main lane. the one exception: a pocket left with only small items runs the main lane plus one pocket item per batch
2.2 **a freebie while wishkeeper reads, done, not listed** — the hunt starts in the same message as the wishkeeper spawn, since wishkeeper runs 5–7 min (dima, 2026-10-16: «while wishkeeper is waiting, you could pick up some stuff to do in the meantime for each siesta»). the sources, first hit wins: a small fix spotted this batch, an xs or s pocket item, a trial due within 3 days (`pnpm test-drive:check`) logging a round, an unread changedetector change. an inbox answer dima asked for runs beside it, never in its place; never a file wishkeeper is reading. the card's 🍀 line names what got done, or the sources checked when every one came up empty
2.5 **finished lanes end here**: every 🛼 glide whose items are all done, or whose last member stopped, gets orbit op `glide` act `end` with its id; a landed lane's clean trees are decamped (`x lane decamp --apply`), a dirty one is an ⚠️ ask
2.6 **the boards**: `node ~/frame/_clio/script/blueprint-drift.ts --since <last siesta, HH:MM local>`; each board it names gets a phases line «redraw <board>», drawn once this batch's steers and tweaks land, never skipped (dima, 2026-10-22: the board is our main reference for our flows); the card names it
3. **the 5h window**: read it (`habit-ctx-load-balancing`)
3.2 **ci reds**: the unseen rows of n8n's 🔴 ci watch, the same read as the boot digest's n8n section; a red gets one card line and a fix or an ask
3.3 **the groom check**: `node ~/frame/_clio/script/prompt-groom.ts --day`; each red prompt is groomed with helga or gets a `HH:MM — <why>` no-wish line, each homeless W-line gets its home
3.5 **the helper count**: `node ~/frame/_clio/script/helper-count.ts --since <last siesta, HH:MM local>` prints `helper` and `helper-lite` spawns per live session; a member with real work and zero is nudged the same turn, and the count joins the card
4. **check before acting**: every high finding from wishkeeper or crow, and any finding that would change a rule or a claim made to dima, is opened at its cited spot first; one not checked is printed as `unchecked`; a high's fix names its cause, «fixed» or «ticketed FRM-N», before its commit
5. **the card**, one reply when wishkeeper is back:
   - 🐬 **wishkeeper**: its top 5 and the count of the rest, or «no wishkeeper: small batch»
   - 🍀 **freebie**: what step 2.2 got done; a duplication finding offers `/simplify` here
   - ➡️ **next**: the main-lane item
   - the asks and the plan go to orbit, never into the card
   - one light line: a fact with a twist, a dry joke, or «meanwhile I did <freebie>» when that is true (`fleet-vibe`)

## boot

the same agent runs once at boot, in boot mode, beside crow's board review (`clio:boot` step 8): dima's boot prompt, his raw inbox text and where each item landed. its findings fold before the opening board prints.

