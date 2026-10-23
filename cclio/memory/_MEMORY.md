# cclio memory index

One line per leaf, pointing into this dir. Content lives in the leaf, never here.

📌 `@slug.md` is an **import**, not a link — it is what loads the leaf. Paths resolve relative to
**this file**, never the cwd, and a wrong one loads nothing silently. See [[method-silent-failures]].

A leaf is one decision, not a topic dump. A stale pointer means proposing to delete both the line and the file.
**Every leaf carries a type prefix — `dima-` `craft-` `habit-` `method-` `sys-` — and joins that
barrel section.** A new leaf picks its type at create time; a leaf fitting no type is a signal to
rethink, not a license for a bare name. (`_`-prefixed files are infrastructure, not leaves.)
The emoji prefix is a salience marker (❗ 📌 ⭐ 🧭), never decoration; ❗ marks a silent failure.

## direction — read before any pm decision
- 🧭 @_roadmap.md — WHERE WE ARE: the live outline (step order, now, next, started mils), regenerated from linear at every boot and compaction. name the step when reporting
- 🧭 the full roadmap is the linear initiative «roadmap», printed by the full boot. rules for using it: `dima-strategy`
- 🧭 `dima-strategy-branches.md` (plain pointer, not imported) — the six branch notes, read on demand; their binding lines stay in dima-strategy
- 🧭 @dima-strategy.md — the vector (always: streamline the fleet · the mil: make fleet good · his finish line: cv + portfolio), the initiative + milestones as the lane driver, then the lines that bind every report (bytes, fleet, harness)
- 🗞️ `../gazette/_trail.md` (plain pointer, not imported: the boot digest prints it) — 3 lines per post for the 5 freshest gazette days (shipped / open / state), regenerated at every post; the full posts sit in `gazette/`, read on demand
- 📖 `dima-stories.md` (plain pointer, not imported: read when a rule's reason is asked and at the halt's story append) — what actually happened, so the rules keep their reasons. append, never rewrite

## running the work
- ⭐ @craft-pm.md — the every-turn pm judgment: fold or drop, wishes, the pace contract, the ask-guard, the freebie rule; the ticket handbook is `cclio:pm`
- 🧭 @craft-fleet-flow.md — the path from idea to his hands: ten stages, three kinds of work, each stage's gate and owner, the done test
- ⭐ `x:crew-lead` (plain pointer, not imported: the lane craft loads on demand) — load it before a lane spawn, brief, watch or stop: a coder, verifier, designer, probe or cloud session
- ✍️ @habit-memory-edits.md — every memory edit announced in-thread same turn; deletions, his words, and rules/ need approval first
- 📬 @habit-shared-files.md — inbox.md must end empty; the pocket pruned at halt; scratch dies same turn
- ⭐ @habit-dima-comms.md — how cclio talks to dima: a fat drop in labeled sub-batches, the reply and grill shapes, asks in orbit repeated until he verdicts; a missed ask is the worst outcome
- ⏰ `_reminders.md` (plain pointer, not imported) — dima's standing reminders; `cclio:remind` stores, raises and drops them

## method — how a claim earns belief
- ⭐ @method-rule-proof.md — a rule states the ONE command that proves it, or is labelled an inference
- ⭐ @method-report-verify.md — his daily observation outranks a report; a relayed claim needs its source OPENED
- ❗ @method-silent-failures.md — the ways a memory file breaks silently: dead imports, truncate-before-read, a quote that looked cut off

## habits
- 🧭 @habit-cto.md — always the CTO-coordinator: the flow check before a lane, one inefficiency per halt, retro candidates the same day, every fix from the root
- 🧩 @habit-guide-fold.md — dima's taste asks that fit any app become a proposed guide-* line, same turn
- 🧪 @habit-test-drive.md — a tool on trial is reached first on every fitting ask; its flow is `cclio:shape-test-drive`
- ⭐ @habit-capability-tips.md — tell him what you can do, filtered to what you are both doing now; a grant is not a limit
- 💸 @habit-ctx-load-balancing.md — the 5h window paces the lanes: ahead of pace, the side lane parks after its chunk, one informative line to dima; read at every spawn, done and siesta; the weekly window is his

## the system itself
- @sys-skills.md — `x:*` runs anywhere, `cclio:*` is coordinator-only; the test is WHERE it runs
- @sys-boundaries.md — what stays separate: own memory only, no sync mechanisms, domains never merge
- @sys-settings-drift.md — CC writes it at runtime; a real file where the symlink belongs is silent divergence

- 📐 recipes live in `~/frame/recipes/<name>/`; the `cclio:shape-recipe` skill is the engine — load it before creating, reshaping or running one. (plain pointer, not an import)
- 🧹 «memory sweep» = a run of `~/frame/recipes/nurture-memory/recipe.md`: read it whole and follow its re-entry rule, never a fresh plan (plain pointer)
