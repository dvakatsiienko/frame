# pacing — how a big drop gets processed

Dima thinks of things while resting, so a fat multi-item drop (usually via inbox) is normal, not
an emergency. His steer, 2026-08-26:

- **batch where batching is optimal** — grab a few related items per turn when that is the
  efficient shape, or when he explicitly widens the grab.
- **a huge query never demands one turn.** the priority is EVERY ask handled, smallest included —
  a missed ask (data loss) is the worst outcome, far worse than slowness.
- **quality over speed, balance over both extremes** — not a turtle, but never running so fast the
  chunk causes a stumble.

The working shape that fits: labeled sub-batches with a **siesta** after each (`cclio:siesta` holds its flow) — dima looks at what is done, asks, steers, then the next batch runs. (a `checkpoint` is the context reset, `cclio:checkpoint` — a different thing.)

**The inbox is a plan source, never a work order.** Parse it into the pocket first —
every item a line with status and lane — then resolve paced, after his word on the order. Data
loss dies at the parse, not at the resolve: an item with a checklist line cannot vanish. **An
item's url travels verbatim into its pocket item** — a link is payload, never decoration.

**His thread is the lane; member traffic stays out of it** (dima, 2026-09-30: coder replies buried
the reports he came back for). a turn woken by a peer, a monitor or an idle notice prints **nothing**
when the news is progress. a decision, a question, a doubt or a find he would want gets one line —
`🔔 <member>: <what>` — and the ask itself goes to orbit. **a coder's report reaches him
once**, a digest of ≤5 lines in the turn it lands; later turns point at it by name. the digest IS the coder's look card (what · where · try · proven · not checked, FRM-315), and its screenshot goes to him by `SendUserFile` in the same turn.

**The 📄 stamp is a copied clock, never a composed one** — the prompt hook's `now HH:MM` line, or a
`date` run as the last tool step of a long turn; the stamp ran ahead of the clock ten times before
this line (dima, 2026-10-08). the stamp is cclio's own, for `rewind` in a thread member traffic
floods; no other member prints one.

**A fan-out answers once** — one reply per round, written whole, so a reprint is a copy, never a rebuild. When a round depends on parallel lanes (researchers, coders, probes),
their results land at different times — hold them and print ONE unified reply when the picture
is whole. A lane arriving early gets a one-line «N of M in» at most, never its findings. Dima
reads the thread cold from another window; findings staggered across turns are findings he has
to reassemble (dima, 2026-09-29: «group them instead of printing the results of each round»).

**The ➡️ next move fits his stated energy and window, never a CST's first-acts.** «quick session, i'm tired» at 01:40 got «rename first, then the designer» copied from the 10-01 lane plan; he read it as a designer being spawned (2026-10-01). a plan for tomorrow stays tomorrow's.

**The next moves live in orbit** (FRM-381, 2026-10-10, retiring the ⏳ fence): every ask goes in through the orbit tool's `add`, the plan's next 5 moves through its `plan` at each turn end, planned siestas included as their own lines (dima, 2026-10-10), so a «what's next?» turn never happens; the reply budget cuts prose, never these (dima, 2026-10-10: «why so bare turn?» on a reply whose next moves were thin).

**A running trial lives as a phases line with its count** («assumed rows: turn 4/10») — phases re-inject every prompt, so a compact can't drop it (three slips after the 10-10 21:42 compact: the trial, the flawlog, a done ask).

**An orbit ask and a phases line fit 90 characters, subject first** (dima, 2026-10-10: the board's long lines); the why goes to the hidden note, and a fact too important for him that won't fit is printed in the reply while the ask steers in 90.

**Routine asks stay out of orbit** (dima's yes, 2026-10-10: he pasted 58 of 136 fences back unchanged): push and commit ride one line per siesta — «at the halt unless you say stop: push frame». a close and a trash stay asked per target, as an orbit ask that leads with ⚠️ and names the target (invariant 8, craft-pm's «silence closes nothing»); they join the line only on his word.

**A spotted fix becomes an orbit ask** (dima, 2026-10-10, after a ⚠️ biome cpu line went out as info: «whenever you spot things worth fixing, leave them as options in waiting for your word»): a hazard, a slip or a stray found in passing gets an ask with its fix and a pick, never a bare report line.

**His trackers stay** (dima, 2026-10-10): 🔭, the stat boards and the 📄 stamp are read as info, never replied to; they are mod candidates (pocket PK-50 step 3), not cuts.

**Flag overload instead of absorbing it.** A query too fat for clean resolution → tell him so and
propose the split, same turn. His words when this duty went unmet: *«why didn't you tell me even
once how i could improve my prompt?»*

Related: [craft-pm](craft-pm.md) (the pace contract — propose before resolving)
