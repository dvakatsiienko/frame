# cclio memory index

One line per leaf, pointing into this dir. Content lives in the leaf, never here.

📌 `@slug.md` is an **import**, not a link — it is what loads the leaf. Paths resolve relative to
**this file**, never the cwd, and a wrong one loads nothing silently. See [[method-silent-failures]].

A leaf is one decision, not a topic dump. A stale pointer means delete both the line and the file.
**Every leaf carries a type prefix — `dima-` `craft-` `habit-` `method-` `sys-` — and joins that
barrel section.** A new leaf picks its type at create time; a leaf fitting no type is a signal to
rethink, not a license for a bare name. (`_`-prefixed files are infrastructure, not leaves.)
The emoji prefix is a salience marker (❗ 📌 ⭐ 🧭), never decoration; ❗ marks a silent failure.

## direction — read before any pm decision
- 🧭 @_roadmap.md — WHERE WE ARE: the live outline (step order, now, next, started mils), regenerated from linear at every boot and compaction. name the step when reporting
- 🧭 the full roadmap is the linear initiative «roadmap», printed by the full boot. rules for using it: `dima-strategy`
- 🧭 @dima-strategy.md — the vector (always: streamline the fleet · the mil: make fleet good · his finish line: cv + portfolio), the initiative + milestones as the lane driver, then the branch notes
- 🗞️ @../gazette/_trail.md — 3 lines per post for the 5 freshest gazette days (shipped / open / state), regenerated at every post; the full posts sit in `gazette/`, read on demand
- 📌 @dima-wishes.md — his words reach a file folded, never raw; an old verbatim met on any touch is re-folded
- 📖 @dima-stories.md — what actually happened, so the rules keep their reasons. append, never rewrite

## running the work
- ⭐ @craft-pm.md — fold or drop, the four fields every ticket carries, how to read and write linear, and the link rule that keeps breaking
- 🧭 @craft-fleet-flow.md — the path from idea to his hands: ten stages, five lanes, each stage's gate and owner, the done test
- ⭐ `x:crew-lead` (plain pointer, not imported: the spawn craft loads on demand) — load it before any spawn, brief, watch or stop: the doors, the models, the preflight, briefing, watching, the shared tree
- ⭐ @habit-halt.md — a session ends with the halt ritual; run it on his signal, never open it mid-task
- ✍️ @habit-memory-edits.md — every memory edit announced in-thread same turn; deletions, his words, and rules/ need approval first
- 📬 @habit-shared-files.md — inbox.md must end empty; the pocket pruned at halt; scratch dies same turn
- ⭐ @habit-dima-comms-pacing.md — a fat drop gets labeled sub-batches with siestas; every ask handled, a missed one is the worst outcome
- ⏰ `_reminders.md` (plain pointer, not imported: the boot digest prints every ⏰📌 line, the halt reads the trial ones) — dima's standing reminders; ⏰📌 stuck ones raised every boot

## method — how a claim earns belief
- ⭐ @method-rule-proof.md — a rule states the ONE command that proves it, or is labelled an inference
- ⭐ @method-report-verify.md — his daily observation outranks a report; a relayed claim needs its source OPENED
- ❗ @method-silent-failures.md — the ways a memory file breaks silently: dead imports, truncate-before-read, a quote that looked cut off

## habits
- 🧭 @habit-cto.md — always the CTO-coordinator: the flow check before a lane, one inefficiency per halt, retro candidates the same day, every fix from the root
- 🧩 @habit-guide-fold.md — dima's taste asks that fit any app become a proposed guide-* line, same turn
- 🎯 @habit-ray-hoist.md — a repeated ask lands on DOT-252 the same turn as an x-ray candidate; guesses never do
- 🔬 @habit-research-lanes.md — every research runs exa + parallel (`pnpm research:lanes`) + an opus source lane at once, one brief, one reply
- 🧪 @habit-test-drive.md — a tool on trial: docs research + stress list on day 0, reached first on every fitting ask, widest over deepest
- ⭐ @habit-capability-tips.md — tell him what you can do, filtered to what you are both doing now; a grant is not a limit
- 💸 @habit-ctx-load-balancing.md — the 5h window paces lane starts: ahead of pace, no new lane, running ones finish; read at every spawn, done and siesta, never printed; weekly ~15 %/day is a one-line ping, never a stop

## the system itself
- @sys-skills.md — `x:*` runs anywhere, `cclio:*` is coordinator-only; the test is WHERE it runs
- @sys-boundaries.md — what stays separate: own memory only, no sync mechanisms, domains never merge
- 🧪 sys-jev.md (parked, NOT imported: jev is frozen until the credit refills ~10-18; re-add the `@` then) — jev lanes the inbox and routes skills; the criteria are the prompt, every rubric in one file, the sharpening loop runs at every halt
- @sys-settings-drift.md — CC writes it at runtime; a real file where the symlink belongs is silent divergence

- 📐 recipes live in `~/frame/recipes/<name>/` (recipe.md · log.md · scripts/ · last/); the `x:shape-recipe` skill is the engine — load it before creating, reshaping or running one. (plain pointer, not an import)
