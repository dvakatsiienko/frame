---
description: load at every siesta — a lane member's done lands, a ticket closed or signed, 15 files of clio's or 3 memory, rule or skill text files, or dima says «siesta». the pause between batches as one fixed flow; it ends with what to do next, never a dead stop.
---

# /clio:siesta — the pause between batches

dima, 2026-10-10: a siesta should be useful with the least noise — once we kick off from it, the next thing is already picked. this skill is the whole flow and its «when» is the one trigger list; `fleet-vibe` holds the word.

🪽 **every clio runs it, on its own stamp** (PK-351:W78): the gate finds the thread. a wing's batch, tickets, lanes and flyway are its own, and it never moves or touches main's; step 3.2 and the chores line are main's alone; 3.3 runs in every thread (o76).

## when

- a codie's, sixth sense's or designer's `[done]` or `final` lands; a progress line never
- clio closes, cancels or signs a ticket, or lands a lane (`siesta-gate.ts` reads them); a lone one inside 30 min of the last siesta waits
- 15 files of clio's since the last siesta, or 3 memory, rule or skill text files (`.md`; a skill's code file counts only toward the 15) (the Stop hook's «🌤️ siesta due»); a memory sweep: `recipes/nurture-memory/recipe.md` § the run
- dima says «siesta»
- a lane he steers live (a piece of its name on a line of `~/.local/state/clio/live-lanes`) batches its bare `[done]`s: three, or the oldest an hour old; its «final» beside a sha still counts at once (dima's tick, 2026-11-10)
- never on a timer

`siesta-gate.ts` blocks once a siesta is due, again each hour it stays ignored, and rides his prompts; it closes on dima's own next prompt after the card, afk once each high is settled; a card left an hour stops pausing the count.

## the flow, in one turn

0. `node ~/frame/_clio/script/siesta-gate.ts open` prints `<last siesta>` for 1, 2.5, 2.6, 3.5 and any high left open by the last card, which joins this one; it stamps and opens

1. **the checks, then wishkeeper**: `node ~/frame/_clio/script/siesta-checks.ts --since <last siesta>` runs every siesta, audit-codie too. wishkeeper runs on every siesta whose window holds a reply to dima or a commit (dima, 2026-11-04: «he is a prio»; FRM-491 re-sign, 11-11); a window with neither runs `siesta-gate.ts skip '<why>'` instead, and the card is refused until one of the two happened. spawn the `wishkeeper` agent 🐬 in the background, siesta mode, at its medium default (`effort: high` for a chunk read or a 15-file batch, or on dima's ask), with:
   - the `<last siesta>` stamp, local with its UTC offset, and clio's transcript path (it finds the claims to dima there itself)
   - the open findings: the open highs step 0 printed, each answered `fixed` or `still open`
   - the checks' output, the commit range since the last siesta, the ticket ids and pocket items touched
   - each chunk a `[done]` named with its pr unmerged: its base..head, and the head of its last wishkeeper read, so an unchanged chunk is not read twice
   - the open orbit asks, so it skips what is already asked
   - nothing more; it reads the tickets' want and crow's notes itself
2. **meanwhile, the pick, in this order**: due reminders first, then In Progress tickets (W37), then the pocket (a red pocket-check section puts it before the main lane), then the main lane. the one exception: a pocket left with only small items runs the main lane plus one pocket item per batch
2.2 **a freebie while wishkeeper reads, done, not listed** — the hunt starts in the same message as the wishkeeper spawn, since wishkeeper runs 5–7 min (dima, 2026-10-16: «while wishkeeper is waiting, you could pick up some stuff to do in the meantime for each siesta»). the sources, first hit wins: a line of my flyway solvable now, solved in place (step 1's flyway homes section names the dead ones; his o181 steer), a small fix spotted this batch, an xs or s pocket item, a trial due within 3 days (`pnpm test-drive:check`) logging a round, an unread changedetector change. an inbox answer dima asked for runs beside it, never in its place; never a file wishkeeper is reading. the card's 🍀 line names what got done, or the sources checked when every one came up empty
2.4 **the close net**: `x linear list --state "In Progress"`; step 1's close net section; a red ticket is closed now by `clio:pm` `references/closing.md`, or gets its `⏰ due:` line or its orbit ask this turn (`craft-fleet-flow` stage 8)
2.5 **finished lanes end here**: every 🛼 glide whose items are all done, or whose last member stopped, gets orbit op `glide` act `end` with its id; a lane merged since the last siesta runs `x lane landed <ticket> --pr <n> --apply` (a quick lane drops `--pr`), the one decamp door, and so goes each quick lane's `verify-<sha>` tree whose sha is on origin/main (a sixth sense's probes are throwaway, its `[done]` names a kept one); a dirty one is an ⚠️ ask
2.6 **the boards**: step 1's blueprint drift section; each board it names gets a phases line «redraw <board>», drawn once this batch's steers and tweaks land, never skipped (dima, 2026-10-22: the board is our main reference for our flows); the card names it
2.7 ⏭️ **the retros, paused** (dima, 2026-11-07): a filed one waits for `clio:boot`'s weekly card
3. **5h window**, unless paused (`habit-ctx-load-balancing`); back on pace, each spec holding a pace-park line resumes: its codie gets one «resume» message, the line gets `resumed <HH:MM>`
3.2 **ci reds**: the unseen rows of n8n's 🔴 ci watch, the same read as the boot digest's n8n section; a red gets one card line and a fix or an ask
3.3 **the groom check**: `node ~/frame/_clio/script/prompt-groom.ts --day`; each red prompt groomed with helga or given `prompt-groom.ts --no-wish <HH:MM|oN> '<why>'`, each homeless W-line its home; the card closes on green
3.5 **the helper count**: step 1's helper count section: `helper` and `helper-lite` spawns per live session; a member with real work and zero is nudged the same turn, and the count joins the card
4. **check before acting** — wishkeeper owns the files, the tracker and whether a claim to dima holds at HEAD; crow owns intent, process and a claim with no receipt as it is made; every high finding from either, and any finding that would change a rule or a claim made to dima, is opened at its cited spot first; one not checked is printed as `unchecked`; a high's fix names its cause, «fixed» or «ticketed FRM-N», before its commit
5. **the card**, one reply when wishkeeper is back, after `node ~/frame/_clio/script/siesta-gate.ts card '<high 1>' …` (one quoted arg each; a high settled later: `… high <n> fixed|parked <why>`):
   - 🐬 **wishkeeper**: its top 5 and the count of the rest, or the skip's why; one `## rounds` row of `docs/test-drive/pre-merge-siesta.md` per run: tokens, findings by severity, highs real y/n, acted or dropped (`docs/research/wishkeeper-cadence.md` remeasures them)
   - 🎀 **chores**: the lines of `… card-lines <transcript>`
   - 🍀 **freebie**: what step 2.2 got done; a duplication finding offers `/simplify` here
   - ➡️ **next**: your flyway's next line
   - the asks and the plan go to orbit, never into the card
   - one light line: a fact with a twist, a dry joke, or «meanwhile I did <freebie>» when that is true (`fleet-vibe`)

## boot

the same agent runs once at boot, in boot mode, beside crow's board review (`clio:boot` step 8): dima's boot prompt, his raw inbox text and where each item landed. its findings fold before the opening board prints.

