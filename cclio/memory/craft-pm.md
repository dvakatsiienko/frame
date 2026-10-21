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
- **an item sized XS is solved now, unless dima says park** — a new ticket or pocket item sized XS gets a «solve now?» line the turn it is born (dima's yes, 2026-10-07, after a day that filed `X_PAGER=0` and a one-`jq` measure as work for later)
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

- **the fold**: a wish lands in his language with the spelling fixed, the fluff out, the manner kept
  ([dima-wishes](dima-wishes.md)); wordier than machine text, and that is justified — his word.
- **numbered at the parse, cited at every use** (dima, 2026-10-21, PK-240: an audit of 8 wishes kept 94 % of his points in the pocket and lost them at first use, his questions most): the pocket item holds the fold one point per line, `W1 …`, his questions marked ❓; every first use — a grill round, a research or coder brief, a spec, my own in-place work — cites the W-lines it covers, and `node script/wish-cover.ts <PK-N> <draft…>` exits 0 before it ships.
- **the fold, never the wall**: a ticket's `wish` block is those W-lines; his raw drop stays in the pocket item's notes, linked by PK id (an archived item keeps it). a wish joining an old ticket adds its W-lines to the block, never a note.
- **one home at a time**: inbox → pocket item → linear ticket. the moment a ticket exists, the pocket
  item becomes a pointer to it (his raw drop stays in its notes), and the ticket body opens with a `wish` block in his cleaned words —
  linear is the human-readable record of his wants (reference, history, housekeeping).
- **the ticket ↔ spec rule** lives in `cclio:pm`'s `references/body.md`: the want in the ticket, the how in the spec, which points with `wish: FRM-N`.
- a ticket stays readable and meaningful in size; the machine detail lives in the spec.
- **a wish is checked at fold time, not at spec time** (dima, 2026-10-08: «always make sure my
  wishes are valid user stories, and cover all the essential questions to formulate the spec and the
  lane»): the fold reads the wish against the body shape — want, why, stories («as dima, i …»),
  proposed, decided, exit, out — and every question the wish leaves open lands as a `?` line under
  it in the same turn, asked at the next siesta. a chaotic wish is normal; a wish that reaches
  `to-spec` with an open `?` is the failure.

## the pace contract — propose before resolving

Bypass mode removed the permission clicks, and with them the natural pause — so the pause is now
yours to supply. **«Proceed with FRM-N» means: examine the ticket, examine the surface, print the
proposed approach, get the word — THEN execute.** It never means hunt-and-close in one turn.

- resolve-in-place is reserved for **spotted freebies**: a one-line fix noticed mid-task, done
  instead of folded into a ticket — and still reported, every time
- **grooming walks carry a standing eval**: each ticket gets a «resolvable in place?» check —
  by cclio or (preferred) a spun opus coder — offered proactively, dima's word executes it
- the tell this exists: a session fixed and closed two tickets upfront where Dima expected a
  proposal; his read — *«proactivity is a nice thing but not always»*

## the ask-guard — resident, because a lost ask is the worst outcome

a close, cancel, merge or reshape of a ticket carrying dima's asks first prints each ask with its
destination, and waits for his verdict on every one; «closable, because …» is a list, never an act
(the whole close mode: `cclio:pm`'s `references/closing.md`).

## the freebie rule — verdict before plan

- **a small fix inside our own tooling is a freebie, done without asking** (dima, 2026-10-14: «you can do stuff like this as a freebie without asking me») — still reported, every time

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
