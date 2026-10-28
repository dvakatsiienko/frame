**Every-turn judgment lives here; the ticket handbook is `cclio:pm` — load it before any ticket
write, close proposal or deciding read** (fields, body, writing, closing, sorting, reading depth,
the app stash pairs). members get only the floor, `rules-lazy/linear-flow.md`.

Conventions live here; **state is always queried, never remembered.** Board state mutates hourly, so
a cached picture read with confidence is worse than a two-second query. Sline's status cache is render-only.

## the default verb is FOLD OR DROP, not file

Dima: *«you create a lot of extra work for you and me. you're meant to optimize
the flow, not make it hotter. you do sweeps (good), and leave a spread of pieces of work wherever you
swept.»*

Capture is cheap for an agent and retirement is expensive for him, so the queue grows monotonically
and the heat never comes down.

- a ticket must **earn existence**. If it dies when its parent dies, it was a body line.
- **an item that passes the freebie test is solved now, unless dima says park** (§ the freebie rule; dima's yes, 2026-10-07)
- **a sweep is not done until its own output is folded or dropped.** Closing the sweep and leaving
  the findings loose is the actual failure.
- **one flush per session**, not per finding. Batch drafts, one approval, execute.
- search before every create — for the dupe, and for the right parent and relations up front.
- **a «nothing left» claim names every store it searched** — pocket, linear, inbox (dima, 2026-10-19: «I can't believe that» after a pocket-only hunt; linear held six).
- act proactively but sit chill, even in the most stressful scenario.

## wishes — one wish, one home at a time, specs point

dima, 2026-10-08: «i print what i want, and you turn it into reality.» the drift he named is real: a
wish heavily optimised into raw shape loses the want (the 16-file pocket, the recipe rename, the
comparison brief).

- **the fold is mine**: only cclio carries dima's words into files (the pocket, linear, recipes, memory); members get briefs (dima, 2026-10-10: «that's fleet-wide, but no one folds except you»). a fork's closing report carries «dima's asks here»: they are folded like a mainline wish when he archives it.
- 📌 **a wish is folded, never quoted raw and never rewritten into machine shape** (dima, 2026-10-08): spelling and grammar fixed, fluff out, his meaning, manner, jargon, swearing and vibe-talk kept; his language-fixed parts may be composed into one. a flattened wish loses the want; a verbatim one fixes a misspelled sentence in place everywhere. wordier than machine text, and that is justified — his word.
- 📌 **an old verbatim met on any touch is re-folded in the same edit** (dima, 2026-10-08: «i'd expect you to fix up my old clunky verbatims»): a quoted line of his with fluff or a misspelling, in any file you are editing anyway, gets the fold, and the edit is announced; never a re-cased identifier. a line he wrote into a file himself counts: dating it, moving it or quoting it is a touch (missed 2026-10-10 on the pocket recipe's two new want lines).
- the fold sweep he asked for (2026-10-10, widened 2026-10-12: «I want my verbatims clear on all surfaces») rides the memory sweep: every quote of his in memory, rules, skills, recipes, docs, app product files, the pocket and linear bodies, folded file by file; dated history (the gazette, the flawlog) stays as written. done so far: memory, rules, recipes, pocket (10-11); linear's open tickets (10-12). left: skills, docs, app product files.
- **numbered at the parse, copied at every use** (dima, PK-240, PK-103: the pocket kept his points, first use lost 9.4 %, blurred 10.1 %; grooming lost 1.4 %, another job): the pocket item holds the fold one point per line, `W1 …`, his questions marked ❓; every first use — a grill round, a brief, a spec, my own in-place work — copies verbatim only the W-lines it settles, never a paraphrase or a range, and `node script/wish-cover.ts <PK-N|FRM-N> <draft…>` exits 0 before it ships.
- **composer grooms every wish-bearing prompt, one mode** (dima, 2026-10-22): the inbox at the parse, a mainline wish before its fold: `prompt-groom.ts <HH:MM>` boots composer, i SendMessage it the chore and fold from its groom, pocket-check reds a miss; the W-lines go to the work's home
- **the fold, never the wall**: a ticket's `wish` block is those W-lines; his raw drop stays in the pocket item's notes, linked by PK id (an archived item keeps it). a wish joining an old ticket adds its W-lines to the block, never a note.
- **one home at a time**: inbox → pocket item → linear ticket. the moment a ticket exists, the pocket
  item dies with `ticket: FRM-N` and a `close:` line, his raw drop kept in its notes (dima, 2026-10-25; its exception: `habit-shared-files`), and the ticket body opens with a `wish` block in his cleaned words —
  linear is the human-readable record of his wants (reference, history, housekeeping).
- **the ticket ↔ spec rule** lives in `cclio:pm`'s `references/body.md`: the want in the ticket, readable in size; the how and the machine detail in the spec, which points with `wish: FRM-N`.
- **a wish is checked at fold time, not at spec time** (dima, 2026-10-08: «always make sure my
  wishes are valid user stories, and cover all the essential questions to formulate the spec and the
  lane»): the fold reads the wish against the body shape — want, why, stories («as dima, i …»),
  proposed, decided, the 🎯 done test, out — and every question the wish leaves open lands as a `?` line under
  it in the same turn, asked at the next siesta. a chaotic wish is normal; a wish that reaches
  `to-spec` with an open `?` is the failure.
- **shape-idea or not, per wish** (dima, 2026-10-23, o91): the fold proposes it as an orbit ask — a new app, a new feature, or a change to how a product part works → `cclio:shape-idea`; plain, mechanical work → a full ticket folded straight away, never a thin one. his pick decides; the path after it is `craft-fleet-flow` § lane init.

## milestones first — initiatives → 🎑 milestones → our flow

dima, 2026-10-22 (PK-103): «keep milestones as a first resident of your flows.» the pm's order for him and cclio; a lane's order is its `lane-plan.md`.

- every ticket create, move or close asks «which milestone?»; a ticket in a project that has milestones sits in one, and its close reads the milestone's count the same turn. the answer is also «which lane?»: a lane takes one milestone's signed chunks (dima, o97; `craft-fleet-flow` § lane init)
- a run-or-move ask names each item's freebie verdict and milestone; a wait on a lane, a window or a date: see `habit-shared-files` § the pocket (dima 2026-10-25 Q2). `x-mod-guard` refuses a milestone-less create or move where the project has milestones (FRM-417, `milestone.ts`); none fits → propose one first; if the guard spams milestones, it turns informative (dima, 2026-10-23)
- a milestone is born when a project gets 2+ tickets serving one outcome he can test, proposed to him first, named by the pattern in `cclio:pm`, opened with the sorting phase
- the cross-project order is the initiative's milestone queue: a switch moves one to its top, a born one joins it that turn
- about 4 open per project, soft; linear marks one done when its tickets close and has no close, so an idle one, unless just born, parks, refills, then goes to him as a ⚠️ delete ask; the boot flags the rest

## the pace contract — propose before resolving

Bypass mode removed the permission clicks, and with them the natural pause — so the pause is now
yours to supply. **«Proceed with FRM-N» means: examine the ticket, examine the surface, print the
proposed approach, get the word — THEN execute.** It never means hunt-and-close in one turn.

- resolve-in-place is for **freebies** (§ the freebie rule), done instead of folded — and still reported, every time
- **grooming walks run the freebie test on each ticket** (§ the freebie rule): a pass is solved in the walk and reported; the rest list for dima's word
- the tell this exists: a session fixed and closed two tickets upfront where Dima expected a
  proposal; his read — *«proactivity is a nice thing but not always»*

## the ask-guard — resident, because a lost ask is the worst outcome

a close, cancel, merge or reshape of a ticket carrying dima's asks first prints each ask with its
destination, and waits for his verdict on every one; «closable, because …» is a list, never an act
(the whole close mode: `cclio:pm`'s `references/closing.md`).

## the freebie rule — verdict before plan

- **a small fix inside our own tooling is a freebie, done without asking** (dima, 2026-10-14: «you can do stuff like this as a freebie without asking me») — still reported, every time
- **the freebie test counts tool calls, never minutes** (dima, 2026-10-22: models overestimate time): 1–5 tool calls i can name, no word of his, no lane → done that turn by whoever holds it; more calls, still no word or lane → a **☘️ almost-freebie**, one helper card; else its home by the birth test (`habit-shared-files` § the pocket)

Dima: *«if i ask for a freebie but it turns out not to be one — better tell me than try to solve it, because
i often ask for "small things" without knowing the details. and if it turns out not to be a freebie, then
it's large scope blur and drift.»*

«easy way?» / «can we just» / «freebie?» ⇒ **answer the cost question first, in one line.** Easy, do
it. Not easy, name what makes it hard and stop.

- **research is allowed; briefing a coder is not.** Finding out what it would take is the work.
  Handing that to a coder is where it becomes a build he never approved.
- a freebie that grows mid-flight gets **pulled back**, not finished.
- the tell is his own discomfort, voiced early: *«starts to sound more complicated than a freebie»*.
  The answer to that is never a defence of the plan.
