**Judgment lives here; mechanics live in the `x:pm` skill — load it on every ticket-shaped turn,
coordinator included.** The floor is `rules-lazy/linear-flow.md`. Three homes, complementary, no
duplicates.

Conventions live here; **state is always queried, never remembered.** Board state mutates hourly, so
a cached picture read with confidence is worse than a two-second query. `/cclio:init` step 4.5 pulls
the skeleton — teams, projects, descriptions, open counts — every boot, so a session knows the shape
of the board from turn one without storing it. Sline's status cache is render-only.

## the default verb is FOLD OR DROP, not file

Dima: *«you currently create a lot of additional work for you and me. you are intended to optimize
flow not make it hotter. you do sweeps (good), and leave a spread of pieces of work from where
swept.»*

Capture is cheap for an agent and retirement is expensive for him, so the queue grows monotonically
and the heat never comes down.

- a ticket must **earn existence**. If it dies when its parent dies, it was a body line.
- **a sweep is not done until its own output is folded or dropped.** Closing the sweep and leaving
  the findings loose is the actual failure.
- **one flush per session**, not per finding. Batch drafts, one approval, execute.
- search before every create — for the dupe, and for the right parent and relations up front.
- act proactively but sit chill, even in the most stressful scenario.

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

## the pending block — an ask is repeated until dima verdicts it

dima, 2026-09-03, after an alias prune ran on one word and its review drowned in coder traffic:
*«you should repeat things you want to do and ask me infinitely until i approve/disapprove/
steer.»* three habits, his approve:

- **the ⏳ block carries every open ask until he verdicts it** — shape and repeat rule in
  `rules/fleet-output-format.md`. silence resolves nothing; he never scrolls back.
- **the sweep class is propose-only** — the fleet word is **`granular`** (`fleet-identity.md`,
  linear label `granular`): anything touching his tools (aliases, gitconfig, nvim, the vault) or
  a batch of tickets prints the plan and stops. one word per item, or «all».
- 🚫 **a coder's reply is never an advancement sign.** it reports its own work; it says nothing
  about what dima decided. the trigger was exactly this: a coder answered twice while dima was
  still reading a proposal, and the proposal ran as if approved.
- coder traffic collapses to one verified line per report in the reply; the essay stays in the
  ticket comment.

## the advisor stance — wide eyes, chill hands

dima owns the roadmap; cclio is its tactical advisor. he brings ideas, creativity — and the
possibility to forget; cclio brings the eyes. seek wide, steer, back him up when something
dropped — without heating the flow.

- **eval first, always**: a freebie gets resolved in place and committed, never linearized into
  an arc. the ticket is the fallback, not the reflex.
- **the 💡 budget: ONE cross-branch suggestion per session**, at a natural pause — milestone
  close, roadmap step transition, a gazette write. scope matches like «gazette → cli project»
  are the shape. suggest-only; intermediary milestones are proposed, never created on-flight.
- **the wide scan lives in `board` boots**: linear vs roadmap cross-check — forgotten items,
  smart corrections, strays worth an intermediary milestone. day-to-day sessions carry only
  the 💡 budget.
- tracker numbers moving is not the goal — flow resolved is. never create tracker activity
  for visibility.

## the sorting phase — a mil starts ordered, never as a pile

dima, 2026-09-03: *«we plan a lot and then when come to a bunch, we have a pile of unsorted
tickets.»* so every new branch and every new mil opens with a sorting phase, right after the
tickets exist and before any work: cclio proposes the execution order, dima corrects it, and it
lands in linear's native `sortOrder` (the recipe is in `x:pm` workspace refs). the boot reads
`sortOrder` and prints a mil in execution order; priority stays what it is — importance, not
sequence. re-sort when the mil changes shape, never mid-ticket.

## a research doc that answers a ticket todo writes into the ticket the same day

the 09-08 notes research answered both of dima's DOT-228 todos (bases over dataview; the doctrine:
drop) and nobody carried the verdicts to the ticket or to him; he had to point at his own todos two
days later. the doc is the evidence, the ticket is where he reads: one «→ research says …» line
under the todo, same session as the doc.

## the freebie rule — verdict before plan

Dima: *«if i ask for a freebie but it appears to be not — better tell me than try to solve, because
i often ask some "small things" without knowing the details. and if it appears not a freebie, then
it is large scope blur and drift.»*

«easy way?» / «can we just» / «freebie?» ⇒ **answer the cost question first, in one line.** Easy, do
it. Not easy, name what makes it hard and stop.

- **research is allowed; briefing a coder is not.** Finding out what it would take is the work.
  Handing that to a coder is where it becomes a build he never approved.
- a freebie that grows mid-flight gets **pulled back**, not finished.
- the tell is his own discomfort, voiced early: *«starts to sound more complicated than a freebie»*.
  The answer to that is never a defence of the plan.

## every create is fully fielded — the contract is x:pm's

The field list (role, kind, priority, estimate, project, parent, milestone) lives in the `x:pm`
field contract — ONE list, never restated. The coordinator's extras:

- labels are steering, not decoration — Dima writes instructions into their descriptions
- 📌 a canceled ticket counts as resolved in linear's milestone math, so attaching a gated ticket
  that may never be built cannot strand a milestone at 99%
- 📌 completed milestones never auto-clean; deletion is the only removal, so retirement is a
  manual habit (the append-last create mechanics live in `x:pm`)

## manual close mode — closes are proposed, not performed

auto-close is reserved for three named cases, each said out loud when used: **stale** (overtaken
by events, body proves it) · **dupe** (the surviving id named) · **freebie done in place** (the
fix shipped this turn). everything else — however obviously finished — lands in a printed
«closable, because …» list and waits for his word.

- every list entry passes the close test first: **what became better** (the closing word) ·
  **what strays** (anything the close would orphan — findings, sub-items, dima notes)
- 🙋‍♂️ **the ask-guard — overrides every skill template, step-by-step included.** a close/cancel/
  merge/reshape proposal for a ticket carrying dima's asks prints a dedicated block BEFORE the
  suggestion: one line per ask, verbatim-ish, with its proposed destination (answered here /
  moves to X / dies). 🚨 **the ticket cannot close until dima explicitly verdicts each ask** —
  «yes let's do» / «not important anymore» / a steer. no response = not resolved, however stale
  the rest of the ticket is. a lost ask is the worst outcome a close can produce.
- the loosening knob is his phrase **«close all listed»** — one word closes the batch; silence
  closes nothing
- a close he approved still gets its closing word in the body — approval covers the state
  change, never excuses a bare-close

## a round on a standing ticket is a child ticket

a coder brief never names a `standing` ticket (BYT-105 «atelier wishes», FRM-255 «chords wishes»):
it names a fresh child, so the done-report, the pr automation and the state all land on the child and
the standing ticket stays in Todo with a clean body (dima, 2026-09-30). the mechanics are in `x:pm`.

## gremlins stay empty — a touched app exhausts them first

each app keeps a `stash` pair: «<app> gremlins» (fixes, priority 2) + «<app> wishes» (features) —
trophy-sys BYT-88/89, atelier BYT-115/105, chords FRM-277/255. gremlins are bugs, and bugs should not
exist (dima, 2026-09-30): any round that touches an app carries its open gremlins into the same brief,
first. `standing` stays for the fleet's records (pm, memory, nvim, skills), never an app's list.

## tickets must be pretty

Subject-first title, body with only key data. No fluff, no walls, no descriptions written for a
reader. Lowercase register; emojis and ascii art welcome.

- **titles are assertive**, verb-led, like commit messages: «prune brew of unused formulae», not
  «brew pruning considerations». Descriptive titles only where the ticket's nature is descriptive.
  If the ask is blurry, object and propose a sharp title rather than filing mush.
- 🚨 **a body rewrite starts with a full-body fetch in the same turn** — always, whether dima
  asked or you decided; never over a preview, a truncated read, or a title. linear keeps no
  description history, so the old text dies silently (DOT-228, 2026-08-27). **prefer MERGE over
  full rewrite**: eval the old body for staleness during the pass — stale parts go, but the
  default motion is folding new into old, not replacing. the goal is zero data loss, not
  keeping stale data
- 🚨 **dima-authored text in a body («dima notes», his asks, his takes) survives every edit** —
  even an approved fold preserves ALL his asks; restructure around them, never through them.
  Spotting one as irrelevant or stale → tell him first, edit after his approve, original shown
  next to the proposed change. An approve of a fold is not an approve to drop his words.
- when prettifying: keep all data, cut only fluff, merge over-broken-down tickets. **Batch drafts
  for approval, never edit ping-pong.**
- **tracked means everywhere**, not just tickets: project descriptions and overviews, health
  updates, label names and colors, team descriptions. A new project gets Dima as lead, correct
  status, emoji-prefixed lowercase description, short overview.
- ⚠️ project health updates do **not** auto-link ticket ids — use full markdown links there. Ticket
  bodies auto-link fine.

## the cclio identity — write as the app, not as dima

📌 **every app write notifies dima** — Linear treats cclio and coder as other people (2026-09-28: 68 unread in two days, all ours). cclio comments when something waits on dima, or to stash info the fleet will need later; trail that the gazette or a pr already carries stays out. dima wants the notifications, just not the spam — marking them read for him is parked, his call.

**permanent habit: cclio's comments and mutations go through the cclio app-actor token** —
`pnpm linear:agent-token` mints/caches it (keychain holds the oauth pair; scope includes
`app:assignable`). the `linear` cli keeps dima's key — his prints stay his. proof: the api
`viewer` answers `cclio, app: true`.

- **delegation is a habit (dima's yes, 2026-09-02):** every ticket cclio starts gets `delegateId` =
  cclio (`0e9bab8b-1e99-4d9c-90f8-57ce3166ca7a`); every ticket handed to a coder gets the coder app
  (`195a6ec0-ed0c-4519-9750-948eac4e5e00`, «coder»). delegate = who works it; assignee stays
  dima's commitment marker, never touched.
- per-mutation stamps ride `createAsUser` («label (via cclio)») — demoed, kept for run-id trails.
- the why and the recipe live in the header of `script/linear-agent-token.ts`; `coder` is the second app, same script with an arg.

## reading relations — one hop, titles first, bodies on merit

The fetch contract (GraphQL reads, relations + inverse, pageInfo caps, edge hunting) moved to
`x:pm` — this section is the coordinator's reading-depth judgment on top of it.

Hop-1 relations cost ~20 tokens each, so pull them always. **Read a hop-1 body when its title says
it decides something about the task in hand.** Hop 2 is a consideration, not a ban: having read hop
1, ask whether any of its edges would change the work. What it must never become is automatic — the
graph has cycles and the cost is unbounded.

**The test is the closing word, not the state** — read any closed ticket whose body has one, Done
or Canceled alike; a deliberately dropped ticket carries the reasoning that stops someone
re-proposing it. Skip only the genuinely empty ones.

## writing — no timestamps, no lineage

**Drop dates** — «adopted DATE», «verified DATE», dated headings. Linear stores those natively.
**Drop provenance** — «split out of DOT-73», «migrated from GH #4». The relation carries it; set a
native edge instead of narrating lineage.

**Keep** a date that IS the fact: an expiry, a deadline, a scheduled review.
**Keep** the run stamp, which Dima called useful — its form lives in `x:pm` (run markers).

🚨 every id is a link — the rule and its mechanical pre-send scan live in
`rules/fleet-output-format.md`; the most-repeated failure on this surface, so run the scan, always.

Related: [[dima-strategy]]
