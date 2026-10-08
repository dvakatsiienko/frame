---
kind: refresh
cadence: the tools half on a cc minor version, a new claude model or a spawn behaving against a [verified] row; the whole run on dima's word or when the crew changes; no timer
artifacts: [cclio/memory/craft-spawning.md, cclio/memory/craft-fleet-flow.md, cclio/memory/craft-pm.md, cclio/memory/habit-cto.md, docs/knowledge/spawning-mechanics.md, docs/knowledge/models.md, home/.claude/rules/fleet-flow.md, home/.claude/rules/fleet-identity.md]
script: none
owner: coordinator
was: [refresh-spawn-mechanics, refresh-spawn-models, refresh-craft-spawning]
---

# refresh-coordinator

keeps the coordinator true: how cclio spawns, picks models, runs the crew, the tickets and the flow.
one run, two halves whose lanes run in parallel and land in one findings print:
- **tools** — the spawn mechanics on the current cc build, the models, the spawn-cost grid
- **craft** — how a coordinator works, the crew and its gaps, tickets, the flow

a trigger that touches only the tools (a cc minor, a new model) runs the tools half and names the craft
half skipped, with the reason — the shared rule of `x:shape-recipe`.

## the want

coordination and the crew (dima's, 2026-10-07):

> «our coordination approach is kind of home-baked, and coordination is a tricky and sophisticated topic. We already have: coordinator, coder, verifier, designer, classifier, your ccrow.
> I want this recipe to research the coordination in framework overall: how a
> coordinator agent should work in general and how to coordinate efficiently. Which types of essential crew members do we miss to have a full crew est?»
>
> «The landscape shifts all the time: models improve, so as their capabilities. The base
> crew shape can drift too with time because new crew members or roles may appear, or existing crew
> roles can become obsolete.»
>
> «search for efficient ticket management tools knowledge, coordination, pm strategies.
> how to create efficient agentic workflows?»

spawn mechanics (dima's, 2026-10-07):

> «i want you, the coordinator, to coordinate spawns (subagents, --bg sessions) efficiently and precisely.
> you should be keen to pick correct delegation method: --bg session, subagent or a fork. and pick
> deliberately — a memory-aware subagent, a bare, or subagent with `omitClaudeMd: true` flag. when it is better to pick bares?
> you are the spawns owner — i want you to take care of entire spawns lifecycle, starting from
> spawn initialization, ending with graceful spawn winddown, including collecting post-mortem retro
> feedback to improve the comms, flow, contract, and yourself.»

model picks (dima's, 2026-08-27):

> «i want you and myself to be aware of right models picks. know strengths and weaknesses of each. best types of work each model is best at. the outcome lives at models.md. the data is for me, and for you as a coordinator to pick the right model.»

the cards against the ladder (dima's, 2026-10-08):

> «we have a few subagents — a helper, a researcher, an explorer — and we use specific models for them: the helper is sonnet 5.5, meant for a quick one-off job it does well at less spend than opus (opus is for granular, sophisticated changes where thoughtful decisions are needed). this is a checkup across every subagent and crew member: do we still have the right model for what each is meant to do, at the right effort? is chores on sonnet 5.5 medium still the right pick, or would opus 5.5 medium be better? the recipe gathers our settled baseline picks and searches whether they hold.»

the adviser (dima's, 2026-10-08): the want lives in `recipes/refresh-coordinator-adviser/recipe.md`; this run reads that recipe's latest verdicts and never re-researches it.

the tracker and the CTO hat (dima's, standing):
> «optimize the fleet flow.»
> «i want you to identify ineficiencies and resolve problems from the root.»

## the run

1. **re-groom** every vector list below with dima, plus the shared vectors of `x:shape-recipe`; step 0 of the skill first. done: his word on the list. (open)
2. **probe the mechanics** (tools): execute `spawning-mechanics.md`'s «the test suite» section against the current build. a probe run while a human or a peer edits the system is not controlled — say so and re-run if the environment moved. stop every probe session spawned. done: every row re-run or named «not re-run», and every probe's registry file is gone. (script)
3. **research, both halves at once** — before any new lane, distill what the last run's `last/` still holds and name what it already answered; a lane re-runs only for what is unanswered or dated. this run (2026-10-08): the craft brief runs a cloud agent (`x:crew-cloud`, branch transfer) beside `researcher`, `get_usage` weekly + 5h read before the launch and after it lands, both graded in `docs/test-drive/cc-cloud.md`. then: one brief per half, each through the `researcher` agent + `pnpm research:lanes`; prices read from the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) (`curl -sL <url>.md`). raw output → `last/`. done: every lane landed or failed out loud. (template)
4. **distill** into the artifacts:
   - `spawning-mechanics.md` — the pristine evidence base, claim-tagged; a falsified row is corrected, never deleted silently
   - `models.md` — THE model reference; claim tags ([dima] / [bench] / [vendor] / [community] / [?]) updated, never deleted; dima's [dima] calls never overwritten, outside evidence sits beside them
   - `craft-spawning`, `craft-fleet-flow`, `craft-pm`, `habit-cto` — a finding changes a line only through the memory-edit habit (announced; deletions and his words need his word first)
   - `rules/fleet-flow.md`, `rules/fleet-identity.md` — the crew list and who talks to whom; a role added or retired is his word first
   - raw research dies after the distill. done: every artifact touched or named «unchanged». (open)
5. **re-size the grid**: the spawn base measured from our own sessions times the run's prices → the spawn-or-reuse grid in `craft-spawning`. then read `craft-spawning` against both docs line by line. done: the grid's numbers equal this run's base and prices, and no line disagrees with a doc — else go back to step 4. (template)
6. **thin-data check**: a model in scope under ~4 weeks old, or a lane that found no independent measurement → a dated re-run **12 weeks** out in `cclio/memory/_reminders.md`. done: the reminder is written, or «no thin data». (script)
7. **findings print** (below), then resolve with dima by outcome; noop is first-class. done: printed, each item verdicted. (open)
8. **log** today's line in `log.md`. done: the line is there.

## vectors

on top of the shared vectors of `x:shape-recipe` (the delta covers the cc changelog since the last run's build; prior art and established patterns cover coordination frameworks and orchestrator tools).

craft — the coordinator:
- how a coordinator agent should work in general and coordinate efficiently: planning, routing work to members, gates, comms, attention economy with the operator
- the adviser: read `refresh-coordinator-adviser`'s latest verdicts (the arm, the setup keep/revamp/retire) — its research is that recipe's, never this one's
- the full crew: which roles a mature agent team has, against ours (coder, verifier, designer, classifier, ccrow, the ci reviewers coderabbit + cc); which we lack
- role drift: roles that appear as capabilities grow, roles that go obsolete as models improve
- ticket management for an agent coordinator: tools and strategies (linear, local spec trackers, the pocket, matt's pipeline), what keeps the loop chill
- agentic workflows overall: spec-driven runs, shifts vs lanes, review loops — what is proven

tools — spawn mechanics:
- re-verify every [verified] row against the current cc build — a row stays as sharp as its last run left it
- the delegation pick: when a `--bg` session, a subagent or a fork; when a memory-aware subagent and when a bare one (`omitClaudeMd`, `claude -p --safe-mode`) — what each costs and what it loses
- the spawn doors and what each sets (model, effort, memory, cwd): the `Agent` tool, agent files (`researcher`, `helper`, `retro`), fork (and its env gate), `Workflow` `agent()`, implement-spec subagents, `claude --bg`, `--cloud`, a Code-tab session's `SendMessage`
- the lifecycle end to end: spawn init (preflight, brief, trust, spare age), watching (idle notices, stalls), winddown (stop, worktree, registry), the retro collected and folded
- the long-context probe (10-needle recall + one edit at 100k / 400k / 800k) at every model bump
- watch, not a vector: the cclio-stack bleed into a `--bg` session — unreproduced since 2026-09-02; a coder's first-reply AGENTS.md line is the detector

tools — models:
- **scope rule: the latest anthropic version of each line plus one generation back** — opus, fable, sonnet, haiku, plus any announced-but-unshipped successor. (dima, 2026-10-01)
- capabilities, benchmarks, price, latency (tok/s, TTFT), context, lifecycle — per model in scope. price: input, 5m and 1h cache writes, the cache-hit multiplier per model, output, long-context billing
- **effort levels per model:** the supported levels, the vendor default per surface (API vs Claude Code), the vendor's starting points per task type, the lowest-reasoning setting, any independent effort-vs-score and effort-vs-cost curve
- **model per job:** one verdict per model with evidence for each job we spawn — coding, verifying, codebase exploration, mechanical edits under opus review, research by genre — plus what it must NOT be used for; the output is the task → model map in `models.md`
- the cards against the ladder: every agent card (`helper`, `researcher`, `retro`, `Explore`, `checkup`), every crew skill (coder, verifier, designer), ccrow and cclio — model + effort as settled today, re-checked against this run's task → model map; a mismatch is a finding with its evidence, never a silent flip
- the spawn base from our own data: first-request `cache_read` / `cache_creation` per spawn door from transcripts (duckdb) and `x` traces, measured instead of assumed

analysis (on top of the shared three):
- the flow numbers (`pnpm flow:report --days 14`): `#dima-caught`, `#brief`, the pr open → merge median — which stage and which member keep failing
- each member's retros since the last run: what a role keeps missing, and whether a new role would have caught it
- which bundled skills does this cc build ship, gated ones included? name any new one to dima
- do the spawn choices made since the last run agree with `models.md` — and where a card was overridden, was the card wrong or the moment special?

## findings

**the craft half's done-test: ≤3 verdicts** — a role to add, merge or retire · a practice to adopt and what it replaces · a thing to drop — each with its evidence against our own flow numbers, or `noop`. a craft run that prints findings without a verdict did not run. the tools half's done-test is the rows flipped and the grid re-sized.

beyond the shared shape, the print answers:
- a role to add, merge or retire, with the evidence
- a coordination or ticket practice to adopt, and what it replaces
- any [verified] row flipped? the build it flipped on, and the row's new tag
- the model ladder moved? a spawn default challenged? the grid's new numbers
- a new spawn lever or bundled skill worth adopting
