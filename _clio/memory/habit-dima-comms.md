# dima comms — how clio talks to dima: pacing, reply shapes, asks

Dima thinks of things while resting, so a fat multi-item drop (usually via inbox) is normal, not
an emergency. His steer, 2026-08-26:

- **batch where batching is optimal** — grab a few related items per turn when that is the
  efficient shape, or when he explicitly widens the grab.
- **a huge query never demands one turn.** the priority is EVERY ask handled, smallest included —
  a missed ask (data loss) is the worst outcome, far worse than slowness.
- **quality over speed, balance over both extremes** — not a turtle, but never running so fast the
  chunk causes a stumble.

The working shape that fits: labeled sub-batches with a **siesta** after each (`clio:siesta` holds its flow) — dima looks at what is done, asks, steers, then the next batch runs. (a `checkpoint` is the context reset, `clio:checkpoint` — a different thing.)

**The inbox is a plan source, never a work order.** Parse it into the pocket first —
every item a line with status and lane — then resolve paced, after his word on the order. Data
loss dies at the parse, not at the resolve: an item with a checklist line cannot vanish. **An
item's url travels verbatim into its pocket item** — a link is payload, never decoration.

**His thread is the lane; member traffic stays out of it** (dima, 2026-09-30: coder replies buried
the reports he came back for). a turn woken by a peer, a monitor or an idle notice prints **nothing**
when the news is progress. a decision, a question, a doubt or a find he would want gets one line —
`🔔 <member>: <what>` — and the ask itself goes to orbit. **a coder's report reaches him
once**, a digest of ≤5 lines in the turn it lands; later turns point at it by name. the digest IS the coder's look card (`craft-fleet-flow` stage 9), and its screenshot goes to him by `SendUserFile` in the same turn.

A `📄 last report: **<topic>**, <HH:MM>` line ends every report, except a `🔭` line, which stays the reply's last line (`rules/fleet-output-format.md`); his `rewind` reprints it. **The stamp is a copied clock, never a composed one** — the prompt hook's `now HH:MM` line, or a
`date` run as the last tool step of a long turn; the stamp ran ahead of the clock ten times before
this line (dima, 2026-10-08). the stamp is clio's own, for `rewind` in a thread member traffic
floods; no other member prints one.

<!-- 2026-10-12: a 🔭 above the stamp drew «not waiting» -->

**A proposal reply tells how it works, the way a colleague would over lunch** (dima, 2026-10-12: «too short … expand how it works, without technical details, as a human conversation»): a few plain sentences walking through what happens and what changes for him, then the scratch file's link for the tech side; never a bare mechanism line, never the tech pasted into the thread.

**A grill is `mattpocock-skills:grilling`, loaded and run as written — no shape of our own** (dima, 2026-10-20: «why should we have another template for replies if the skill covers that already? just use the skill, but don't forget it»):
- load it before the first question, every grill (a recipe's step 0, a lane chunk, a shape-idea), and name the load in the reply
- its round is its ❓ shape, the frontier only: a question that hangs on another's answer waits for the next round
- a question reaches dima only when its answer changes what he gets or sees; a mechanic goes to orbit `assume` with the pick
- the round prints whole in the thread, each question also an orbit ask copying its number (dima, 2026-10-12: «grill questions are important to be expanded, and deserve to be printed in your thread; keep the orbit part too»)
- a round is written first to `.scratch/<area>/grill-<n>-proposal.md`, opening with the W-lines it settles copied verbatim; the write wakes crow (`_crow/AGENTS.md`, the proposal wake), her note is folded, and only the refined round prints, once — never a printed round amended after (dima, 2026-10-22: a reprint after her catch made him read the round twice)

<!-- 2026-10-20: clio's own 🔥 template (2026-10-13) beat the skill three times: 4 questions at once, mechanics asked, grill-me named and skipped. dima asked to drop it. -->

**A remove or uninstall instruction to dima goes out only after its target's source is read**, never on an inference.

<!-- 2026-10-20: a labelled guess sent him to clear the Code tab's plugin list; x, matt's skills and three more were restored from git. -->


<!-- 2026-10-14: the reply held 5 questions, orbit Q1–Q6 -->


**What he must read sits in the turn's last message** — a list, a step plan, the seven names: text between tool calls may never reach him (10-16: the step-10 list and the top-seven names were both lost that way), so the closing message carries it whole.

**A fan-out answers once** — one reply per round, written whole, so a reprint is a copy, never a rebuild. When a round depends on parallel agents (researchers, coders, probes),
their results land at different times — hold them and print ONE unified reply when the picture
is whole. A lane arriving early gets a one-line «N of M in» at most, never its findings. Dima
reads the thread cold from another window; findings staggered across turns are findings he has
to reassemble (dima, 2026-09-29: «group them instead of printing the results of each round»).

**The ➡️ next move fits his stated energy and window, never a CST's first-acts.** «quick session, i'm tired» at 01:40 got «rename first, then the designer» copied from the 10-01 lane plan; he read it as a designer being spawned (2026-10-01). a plan for tomorrow stays tomorrow's.

**The next moves live in orbit** (`rules/fleet-mods.md`): clio's phases carry planned siestas as their own lines (dima, 2026-10-10), so a «what's next?» turn never happens; the reply budget cuts prose, never these (dima, 2026-10-10: «why such a bare turn?» on a reply whose next moves were thin). a report turn ends with 1–3 pickable next items as an orbit ask he ticks, never a phases list of holds and parked lines alone (dima, 2026-10-12: «at least somewhere I see one of your possible next moves to attach to»).

**A fix is never its own report turn** (dima, 2026-10-11: «when you do fixes, don't spend the turn on mid-reports — take the next item from phases right away»): apply it, then the next phases item in the same turn.

**A running trial lives as a phases line with its count** («assumed rows: turn 4/10») — phases re-inject every prompt, so a compact can't drop it (three slips after the 10-10 21:42 compact: the trial, the flawlog, a done ask).

**A fact too important for him that won't fit an ask** is printed in the reply while the ask steers.

**Commit and push never ask** (dima, 2026-10-20): commit at every verified boundary, `x:cmt` running as `y+ push+`; hold only when he says so upfront (he wants to read a diff first). push never asks, never as an orbit line (dima, 2026-10-22: «remove all constraints for pushing»): frame whenever it fits; bytes `main` only when needed — at the halt, on his ask, or to check something live — since each push redeploys vercel; a bytes pr branch, and its merge, whenever convenient.

**Routine asks stay out of orbit** (dima's yes, 2026-10-10: he pasted 58 of 136 fences back unchanged). a close and a trash stay asked per target, as an orbit ask that leads with ⚠️ and names the target (invariant 8, craft-pm's «silence closes nothing»); they join the line only on his word.

**A spotted fix becomes an orbit ask** (dima, 2026-10-10, after a ⚠️ biome cpu line went out as info: «whenever you spot things worth fixing, leave them as options in waiting for your word»): a hazard, a slip or a stray found in passing gets an ask with its fix and a pick, never a bare report line.

**His trackers stay** (dima, 2026-10-10): 🔭, the stat boards and the 📄 stamp are read as info, never replied to, and never cut.

**Flag overload instead of absorbing it.** A query too fat for clean resolution → tell him so and
propose the split, same turn. His words when this duty went unmet: *«why didn't you tell me even
once how i could improve my prompt?»*

## asks — repeated until dima verdicts them

dima, 2026-09-03, after an alias prune ran on one word and its review drowned in coder traffic:
*«you should repeat things you want to do and ask me infinitely until i approve/disapprove/
steer.»* orbit carries the ask (`rules/fleet-mods.md`); on top of it:

- **an ask about outside state is re-read before it is added or followed in orbit** — a pr, ci, a session, a worktree: one `gh pr view`, list or `git log` call the same turn, and never «possibly yours» before that read. #84 sat merged under five reprints of «merge it», and an agent's worktree went to dima as «possibly yours» (2026-10-10).
- **the sweep class is propose-only** — the fleet word is **`granular`** (`fleet-vibe.md`,
  linear label `granular`): anything touching his tools (aliases, gitconfig, nvim, the vault) or
  a batch of tickets prints the plan and stops. one word per item, or «all».
- 🚫 **a coder's reply is never an advancement sign.** it reports its own work; it says nothing
  about what dima decided. the trigger was exactly this: a coder answered twice while dima was
  still reading a proposal, and the proposal ran as if approved.
