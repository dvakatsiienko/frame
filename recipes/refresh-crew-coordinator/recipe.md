---
kind: refresh
owner: coordinator
artifacts: [home/.claude/plugin-x/skills/crew-lead/, _clio/memory/craft-fleet-flow.md, _clio/memory/craft-pm.md, _clio/memory/habit-cto.md, home/.claude/plugin-x/skills/crew-lead/references/spawn-mechanics.md, home/.claude/plugin-x/skills/crew-lead/references/model-cards.md, home/.claude/plugin-x/skills/crew-lead/references/card-craft.md, home/.claude/rules/fleet-flow.md, home/.claude/rules/fleet-identity.md, home/.claude/agents/, _clio/.claude/agents/, x:crew-sixth-sense]
script: none
groomed: 2026-10-21 (dima)
was: [refresh-spawn-mechanics, refresh-spawn-models, refresh-craft-spawning, refresh-coordinator]
---

# refresh-crew-coordinator

keeps the coordinator true: how clio spawns, picks models, runs the crew, the tickets and the flow.

## contents

- the want
- the run
- vectors
- artifacts
- findings

## the want

coordination and the crew (dima's, 2026-10-07):

> «our coordination approach is home-baked, and coordination is a tricky and sophisticated topic. We already have: coordinator, coder, verifier, designer, classifier, your ccrow.
> I want this recipe to research the coordination in framework overall: how a
> coordinator agent should work in general and how to coordinate efficiently. Which types of essential crew members do we miss to have a full crew est?»
>
> «The landscape shifts all the time: models improve, and so do their capabilities. The base
> crew shape can drift over time too, because new crew members or roles may appear, or existing crew
> roles can become obsolete.»
>
> «search for knowledge on efficient ticket management tools, coordination, pm strategies.
> how to create efficient agentic workflows?»

spawn mechanics (dima's, 2026-10-07):

> «i want you, the coordinator, to coordinate spawns (subagents, --bg sessions) efficiently and precisely.
> you should be keen to pick the correct delegation method: a --bg session, a subagent or a fork. and pick
> deliberately — a memory-aware subagent, a bare, or a subagent with the `omitClaudeMd: true` flag. when is it better to pick bares?
> you are the spawns owner — i want you to take care of the entire spawn lifecycle, starting from
> spawn initialization, ending with a graceful spawn wind-down, including collecting post-mortem retro
> feedback to improve the comms, flow, contract, and yourself.»

model picks (dima's, 2026-08-27):

> «i want you and me to be aware of the right model picks. know the strengths and weaknesses of each, and the types of work each model is best at. the outcome lives in models.md. the data is for me, and for you as a coordinator to pick the right model.»

the cards against the ladder (dima's, 2026-10-08):

> «we have a few subagents — a helper, a researcher, an explorer — and we use specific models for them: the helper is sonnet 5.5, meant for a quick one-off job it does well at less spend than opus (opus is for granular, sophisticated changes where thoughtful decisions are needed). this is a checkup across every subagent and crew member: do we still have the right model for what each is meant to do, at the right effort? is chores on sonnet 5.5 medium still the right pick, or would opus 5.5 medium be better? the recipe gathers our settled baseline picks and searches whether they hold.»

the subagents, card by card (dima's, 2026-10-15, folded):

> «i want our subagents to serve a well-defined, clear purpose and do the right job, with a good subagent file (description, instructions) and good frontmatter settings. every run hunts what helps sharpen each of them — researcher, sifter, wishkeeper and the rest (sifter, now `helper-lite`) — so which questions should the research ask to find the most relevant data?»
>
> «every run includes all our custom subagents, the old ones too: we change them often, and we create new ones between runs.»

haiku 5.5 (dima's, 2026-10-15, folded):

> «haiku 5.5 holds real roles now (composer, helper-lite), so refresh its knowledge thoroughly: its best use cases, its baseline effort, as a subagent and as a sidecar. i want you to know this very well.»
>
> «keep haiku as a classifier engine in the search: it can be a powerful classifier, and we never sharpened jev well enough or found a good use case for it yet.»

the tracker and the CTO hat (dima's, standing):
> «optimize the fleet flow.»
> «i want you to identify inefficiencies and resolve problems from the root.»
## the run

one run, two halves whose lanes run in parallel and land in one findings print:
- **tools** — the spawn mechanics on the current cc build, the models, the spawn-cost grid
- **craft** — how a coordinator works, the crew and its gaps, tickets, the flow

a trigger that touches only the tools (a cc minor, a new model) runs the tools half and names the craft
half skipped, with the reason — the shared rule of `clio:shape-recipe`.
- **deep or skip** (dima, 2026-10-21, settled after run #6): the distill ranks the findings per file, at most 3 files change deep, every other file is named «unchanged» or «next run» in one line; the print is a page that opens with the surprising bits, and the reply is ≤5 lines plus its link
- suggest a run when: a cc minor ships, a new claude model ships, a spawn behaves against a [verified] row, the crew changes

1. **groom**: `clio:shape-recipe` step 0, the grill. done: his word on the list. (open)
2. **the roster**: `ls home/.claude/agents/ _clio/.claude/agents/` plus the built-in types and the parked sidecars (`jq -r .name ~/.claude/sessions/*.json`) — every card and seat found is in this run, the old ones too; one new since the last run is named in the print. done: the roster list in `last/`, each card with its file. (script)
3. **probe the mechanics** (tools): execute `crew-lead/references/spawn-mechanics.md`'s «the test suite» section against the current build, plus every `probe:` line in the vectors. a probe run while a human or a peer edits the system is not controlled — say so and re-run if the environment moved. stop every probe session spawned. done: every row re-run or named «not re-run», and every probe's registry file is gone. (script)
4. **research, both halves at once**: distill what `last/` still holds first and name what it answered; a lane re-runs only for what is unanswered or dated. one brief per half, the run's focus section leading it ahead of `pnpm recipe:brief`'s output (run #6: a lane answered the shared part and skipped a focus placed last), through the `researcher` agent + `pnpm research:lanes` + a `neuroarxiv` lane every run (dima, 2026-10-21: «the coordinator recipe must have it, it's useful»), its paper reads one `helper-lite` per paper; prices from the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) (`curl -sL <url>.md`). raw output → `last/`. the brief rule of `clio:shape-recipe` holds. done: every lane landed or failed out loud, and every vector lists ≥1 source or prints `open`. (template)
5. **distill** into the artifacts:
   - `crew-lead/references/spawn-mechanics.md` — the pristine evidence base, claim-tagged; a falsified row is corrected, never deleted silently
   - `crew-lead/references/model-cards.md` — the cards: per model only price · effort · pick for · never · ≤3 deciding numbers, each tagged; a stale number is replaced, a benchmark list or anecdote stays in `last/`; dima's [dima] calls never overwritten; under 8 KB (its cap test)
   - `x:crew-lead`, `craft-fleet-flow`, `craft-pm`, `habit-cto` — a finding changes a line only through the memory-edit habit (announced; deletions and his words need his word first)
   - `rules/fleet-flow.md`, `rules/fleet-identity.md` — the crew list and who talks to whom; a role added or retired is his word first
   - raw research stays in `last/` until the next run's distill. done: every artifact touched, or named «unchanged» with the finding that left it so. (open)
6. **re-size the grid**: the spawn base measured from our own sessions times the run's prices → the spawn-or-reuse grid in `x:crew-lead`. then read `x:crew-lead` against both docs line by line. done: the grid's numbers equal this run's base and prices, and no line disagrees with a doc — else go back to step 5. (template)
7. **thin-data check**: a model in scope under ~4 weeks old, or a lane that found no independent measurement → a dated re-run **12 weeks** out in `_clio/memory/_reminders.md`. done: the reminder is written, or «no thin data». (script)
8. **findings print** (below), then resolve with dima by outcome; noop is first-class. done: printed, each item verdicted. (open)
9. **log** today's line in `log.md`. done: the line is there.

## vectors

### research

on top of the shared vectors of `clio:shape-recipe` (the delta covers the cc changelog since the last run's build; prior art and established patterns cover coordination frameworks and orchestrator tools).

**craft — the coordinator:**
- how a coordinator agent should work in general and coordinate efficiently: planning, routing work to members, gates, comms, attention economy with the operator
- the adviser: read `refresh-crew-coordinator-adviser`'s latest verdicts (the arm, the setup keep/revamp/retire) — its research is that recipe's, never this one's
- the full crew: which roles a mature agent team has, against ours (codie, sixth sense, designer, classifier, crow, the ci reviewers coderabbit + cc); which we lack. the crew checklist re-runs every run, even when the last said «nothing missing» — the field moves
- per seat: each crew role (codie, sixth sense, designer, the ci reviewers) and each card (`helper`, `researcher`, `retro`, `helper-lite`, `scout`, `wishkeeper`) judged by its own job — still needed, merged or missing, plus the prior art for that job (reviewer agents, design agents). the designer reads `refresh-crew-designer`'s latest verdicts, the way the adviser reads its own recipe
- the subagent roster against outside practice: which in-session subagent roles mature setups run (anthropic's own cards and plugins, public `<repo>/.claude/agents/` collections, multi-agent frameworks), which jobs our cards miss, which overlap enough to merge; seed: `docs/research/subagent-roster.md` (dima, 2026-10-10)
- the review shape: what a review subagent reads (the wish and spec, not only the diff), its output cap, its model tier, checking a finding at its cited line before acting, and whether cleanup is a separate pass (`/simplify`) — measured where a source measured it
- role drift: roles that appear as capabilities grow, roles that go obsolete as models improve
- ticket management for an agent coordinator: tools and strategies (linear, local spec trackers, the pocket, matt's pipeline), what keeps the loop chill
- estimates and priorities an agent coordinator sets: what a size means when agents do the work, a rubric an agent applies the same way every time, order vs priority labels, calibration against actuals, and the failure modes (everything «high», fields set once and never read); seed: `clio:pm` § every create and every update, where the first research landed (dima, 2026-10-10)
- acceptance criteria an agent writes and an agent grades: who writes, who checks, what an independent oracle looks like (a blind critic, frozen criteria, red-first tests, a risk tier that keeps dima's word), and our own miss rate per lane; seed: `docs/research/exit-lines-delegation.md` (dima, 2026-10-10)
- agentic workflows overall: spec-driven runs, shifts vs lanes, review loops — what is proven
- operator overload, the coordinator's half: how a coordinator paces one human — batching, collapsing asks, holding member traffic, the siesta — and which remedies measurably shrank his load (dima, 2026-10-08: the thread spam; the adviser recipe researches the detector, this one the remedy)

**craft — the classifier seat:** read `refresh-crew-classifier`'s latest verdicts (the engine judged, the jobs found, the budget gate) — its research is that recipe's, never this one's; a seat is a type of operation, never one engine

**tools — spawn mechanics:**
- re-verify every [verified] row against the current cc build — a row stays as sharp as its last run left it
- the delegation pick: when a `--bg` session, a subagent or a fork; when a memory-aware subagent and when a bare one (`omitClaudeMd`, `claude -p --safe-mode`) — what each costs and what it loses
- the spawn doors and what each sets (model, effort, memory, cwd): the `Agent` tool, agent files (`researcher`, `helper`, `retro`), fork (and its env gate), `Workflow` `agent()`, implement-spec subagents, `claude --bg`, `--cloud`, a Code-tab session's `SendMessage`
- the lifecycle end to end: spawn init (preflight, brief, trust, spare age), watching (idle notices, stalls), winddown (stop, worktree, registry), the retro collected and folded
- the long-context probe (10-needle recall + one edit at 100k / 400k / 800k) at every model bump
- watch, not a vector: the clio-stack bleed into a `--bg` session — unreproduced since 2026-09-02; codie's first-reply AGENTS.md line is the detector

- probe: claude-code#88822 — does a subagent's final report still come back as a bare pointer, body lost (auto-closed stale 2026-10-15; reproduces → refile with a fresh repro)
- probe: the auto-compact threshold — `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `autoCompactWindow`, `--autocompact` (`spawn-mechanics.md`), and where quality drops; the 600–700k manual checkpoint stays until then
- probe: a parked sidecar's keep-warm — a cold restart's cache write against pings' reads over an idle hour (helga went cold after 1h32m, 2026-10-15)

**tools — the subagents, card by card** (the roster is step 2's list, never a list kept here):
- per card, every run: its official role in plain words beside its vibe name (crow = adviser; what are wishkeeper and helga?) · is its purpose well defined, does its shape cover the role · what it does not do that its contract should hold, does it want an extension · model and effort against the task → model map · which instructions work in a subagent file and which do not · the frontmatter (`description` as the trigger, `model`, `effort`, `tools`, `omitClaudeMd`) · body leanness and first-request size, measured
- per card, every run, the two numbers `references/card-craft.md` holds the method for: is it picked up (calls per session from the transcripts, by caller role) and what it saves (its ceiling, then net tokens of card plus caller); a card at 0 calls gets its description re-aimed before anything else
- seeds, dima's: researcher — which model researches best (opus or sonnet, can haiku research?), its baseline effort, how a solid researcher file reads · wishkeeper — opus still right, a coordinator's verifier by role? · helper-lite — are its settings right for a bulk reader
- generic against ours: what `general-purpose` is (model, memory, tools), when it beats a card, or never while our cards exist; one table of the doors — generic, fork, our cards, arms A/B, `--bg` — with stats and capabilities
- probe: `Agent(general-purpose)` in the user `permissions.deny` still refuses the type on the current build (proven 2026-10-15, [sub-agents doc](https://code.claude.com/docs/en/sub-agents) § disable specific subagents); one refused call

**tools — fan-out:**
- when x10 or x100 is right, who cuts the chunks, which card runs them — for any worker tier, haiku, sonnet or opus
- the common shapes and use cases: a strong orchestrator over smaller workers, or mixed tiers, and how to mix them
- probe: one helper-lite x10 fan-out on a real job — tokens and wall time against one agent doing it whole

**tools — haiku 5.5:**
- the effort curve, the >100k ×5 price cliff, sidecar against subagent, anchor-edit reliability
- haiku as a classifier engine: where it beats a model call we make today
- images: the best way to bulk-read screenshots with agents, data precise and image reads out of the main thread; haiku's image accuracy against opus

**tools — models:**
- **scope rule: only the latest anthropic version of each line** — opus, fable, sonnet, haiku, plus any announced-but-unshipped successor. a new generation REPLACES the old card in `crew-lead/references/model-cards.md` and `x:crew-lead/models.md` in the same run, never sits beside it (dima, 2026-10-09; was «plus one generation back», 2026-10-01)
- capabilities, benchmarks, price, latency (tok/s, TTFT), context, lifecycle — per model in scope. price: input, 5m and 1h cache writes, the cache-hit multiplier per model, output, long-context billing
- **effort levels per model:** the supported levels, the vendor default per surface (API vs Claude Code), the vendor's starting points per task type, the lowest-reasoning setting, any independent effort-vs-score and effort-vs-cost curve
- **model per job:** one verdict per model with evidence for each job we spawn — coding, verifying, codebase exploration, mechanical edits under opus review, research by genre — plus what it must NOT be used for; the output is the task → model map in `models.md`
- the cards against the ladder: every agent card (`helper`, `researcher`, `retro`, `helper-lite`, `scout`, `wishkeeper`), every crew skill (codie, sixth sense, designer), crow and clio — model + effort as settled today, re-checked against this run's task → model map; a mismatch is a finding with its evidence, never a silent flip
- the spawn base from our own data: first-request `cache_read` / `cache_creation` per spawn door from transcripts (duckdb) and `x` traces, measured instead of assumed

### analysis

on top of the shared three:
- the flow numbers (`x fleet flow --days 14`): `#dima-caught`, `#brief`, the pr open → merge median — which stage and which member keep failing
- each member's retros since the last run: what a role keeps missing, and whether a new role would have caught it
- each card on a test drive (`docs/test-drive/<card>.md`, fresh-eyes from 2026-10-21): its rounds since the last run, read against its test card
- which bundled skills does this cc build ship, gated ones included? name any new one to dima
- do the spawn choices made since the last run agree with `crew-lead/models.md` (the contract) and `references/model-cards.md` — and where a card was overridden, was the card wrong or the moment special?

## artifacts

- `home/.claude/plugin-x/skills/crew-lead/` — the spawn craft and the spawn-or-reuse grid; the distill changes a line only through the memory-edit habit, and the grid is re-sized at step 6
- `_clio/memory/craft-fleet-flow.md` — the path from idea to hands; changes through the memory-edit habit
- `_clio/memory/craft-pm.md` — the pm judgment; changes through the memory-edit habit
- `_clio/memory/habit-cto.md` — the CTO hat; changes through the memory-edit habit
- `home/.claude/plugin-x/skills/crew-lead/references/spawn-mechanics.md` — the pristine evidence base, claim-tagged; a falsified row is corrected, never deleted silently
- `home/.claude/plugin-x/skills/crew-lead/references/model-cards.md` — the model cards in a fixed shape, under 8 KB; dima's [dima] calls never overwritten
- `home/.claude/plugin-x/skills/crew-lead/references/card-craft.md` — how a subagent card earns its calls: the trigger, the answer contract, model and tools, the save measured first; the distill adds what a run proved, one line each
- `home/.claude/rules/fleet-flow.md` — who talks to whom; a role added or retired is his word first
- `home/.claude/rules/fleet-identity.md` — the crew list; a role added or retired is his word first
- `home/.claude/agents/` — the global cards; a card's frontmatter or body changes through the memory-edit habit, a new or retired card is his word first
- `_clio/.claude/agents/` — clio's own cards (wishkeeper); same rule
- `x:crew-sixth-sense` — the sixth sense contract; changed only when a run proves a change worth its cost (dima, 2026-10-21), through the memory-edit habit

## findings

**the craft half's done-test: ≤3 verdicts** — a role to add, merge or retire · a practice to adopt and what it replaces · a thing to drop — each with its evidence against our own flow numbers, or `noop`. `noop` is valid only when every craft vector names its sources; a vector with none prints as `open`, never as `noop`. the tools half's done-test is the rows flipped and the grid re-sized.

the print carries the parts of `clio:shape-recipe`; its checklists here: every card on step 2's roster, one line each (role · keep, sharpen, merge or retire · frontmatter changes), the crew, seat by seat (still needed · merged · missing), and the classifier seat (the engine judged, the jobs found, the budget gate — never a retire verdict without the engine named).

beyond that shape, the print answers:
- a role to add, merge or retire, with the evidence
- a coordination or ticket practice to adopt, and what it replaces
- any [verified] row flipped? the build it flipped on, and the row's new tag
- the model ladder moved? a spawn default challenged? the grid's new numbers
- a new spawn lever or bundled skill worth adopting
