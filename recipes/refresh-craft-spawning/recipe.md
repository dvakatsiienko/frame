---
kind: refresh
cadence: a cc minor version change, a new claude model or a major benchmark, or a spawn behaving against a [verified] row or a model card; no timer
artifacts: [docs/knowledge/spawning-mechanics.md, docs/knowledge/models.md, cclio/memory/craft-spawning.md]
script: none
---

# refresh-craft-spawning

keeps `craft-spawning` true on both of its halves: the spawn mechanics against the current claude code
build, and the model picks (which model does what best, at what price, spawned how) — lands what
[FRM-130](https://linear.app/x-com/issue/FRM-130) asked for. one run covers both, and both feed the one
spawn-or-reuse grid.

## the want

spawn mechanics (dima's, 2026-10-07):

> «i want you, the coordinator, to coordinate spawns (subagents, --bg sessions) efficiently and precisely.
> you should be keen to pick correct delegation method: --bg session or subagent or a fork. and pick
> deliberately — a memory-aware subagent, or a bare one. when it is better to pick bares?
> you are the spawns owner — i want you to take care of entire spawns lifecycle, starting from efficient
> spawn initialization, ending with graceful spawn winddown, including collecting post-mortem retro
> feedback to improve the comms, flow, contract, and yourself.»

model picks (dima's, 2026-08-27):

> «i want awareness of picked models (mine and ours, fleet interest — haiku 4.5, sonnet 5,
> opus 5, fable 5) to be up to date. know strengths and weaknesses of each. best types of work
> each model is best at. the outcome lives at models.md. the data is for me, and for you as a
> coord to pick the right model. any other fleet member only peeks there if i ask something
> about which model.»

## the run

1. **re-groom** both vector lists below with dima, plus the shared vectors of `x:shape-recipe`. done: his word on the list. (open)
2. **probe the mechanics**: execute `spawning-mechanics.md`'s «the test suite» section against the current build. a probe run while a human or a peer edits the system is not controlled (the doc's own lesson) — say so and re-run if the environment moved. stop every probe session spawned. done: every row re-run or named «not re-run», and every probe's registry file is gone. (script)
3. **research the models**: researcher lanes per vector — benchmarks, community patterns, vendor claims, each tagged; prices read from the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) (`curl -sL <url>.md`). raw output → `last/`. done: every lane landed or failed out loud. (template)
4. **distill** into the two docs:
   - `spawning-mechanics.md` — the pristine evidence base, claim-tagged; its readers are any session that spawns, so it sits beside `models.md`, never under `cclio/`. update tags and rows in place; a falsified row is corrected, never deleted silently — the retraction pattern in the doc shows the shape
   - `models.md` — THE model reference: cards, spawn defaults, dima's live task→model calls. clever-merge; claim tags ([dima] / [bench] / [vendor] / [community] / [?]) are updated, never deleted; dima's [dima]-tagged calls are never overwritten by outside evidence, they sit beside it
   - raw research dies after the distill
   - done: both docs touched or named «unchanged». (open)
5. **re-size the grid**: the spawn base measured from our own sessions (vector below) times the run's prices → the spawn-or-reuse grid in `craft-spawning`. a moved price re-sizes the grid the same run. then read `craft-spawning` against both docs line by line. done: the grid's numbers equal this run's base and prices, and no line disagrees with a doc — else go back to step 4. (template)
6. **thin-data check**: a model in scope under ~4 weeks old, or a lane that found no independent measurement → the run ends with a dated re-run **12 weeks** out in `cclio/memory/_reminders.md`. done: the reminder is written, or «no thin data». (script)
7. **findings print** (below), then resolve with dima by outcome; noop is first-class. done: printed, each item verdicted. (open)
8. **log** today's line in `log.md`. done: the line is there.

## vectors

on top of the shared vectors of `x:shape-recipe` (the delta covers the cc changelog since the last run's build; prior art covers orchestrator practices).

research — spawn mechanics:
- re-verify every [verified] row against the current cc build — a row stays as sharp as its last run left it
- the delegation pick: when a `--bg` session, a subagent or a fork; when a memory-aware subagent and when a bare one (`omitClaudeMd`, `claude -p --safe-mode`) — what each costs and what it loses
- the spawn doors and what each sets (model, effort, memory, cwd): the `Agent` tool, agent files (`researcher`, `chore-helper`, `retro-runner`), fork (and its env gate), `Workflow` `agent()`, implement-spec subagents, `claude --bg`, `--cloud`, a Code-tab session's `SendMessage`
- the lifecycle end to end: spawn init (preflight, brief, trust, spare age), watching (idle notices, stalls), winddown (stop, worktree, registry), the retro collected and folded
- the long-context probe (10-needle recall + one edit at 100k / 400k / 800k) — due: opus 5.5 and fable 5.1 shipped with no probe logged
- watch, not a vector: the cclio-stack bleed into a `--bg` session — unreproduced since 2026-09-02; a coder's first-reply AGENTS.md line is the detector

research — models:
- **scope rule: the latest anthropic version of each line plus one generation back** — opus, fable, sonnet, haiku, e.g. fable 5.1 + fable 5, opus 5.5 + opus 5. plus any announced-but-unshipped successor. (dima, 2026-10-01)
- capabilities, benchmarks, price, latency (tok/s, TTFT), context, lifecycle — per model in scope. price: input, 5m and 1h cache writes, the cache-hit multiplier per model, output, long-context billing
- **effort levels per model:** the supported levels, the vendor default per surface (API vs Claude Code), the vendor's starting points per task type, the lowest-reasoning setting, any independent effort-vs-score and effort-vs-cost curve
- **model per job:** one verdict per model with evidence for each job we spawn — coding, verifying, codebase exploration, mechanical edits under opus review, research by genre — plus what it must NOT be used for; the output is the task → model map in `models.md`

research — both halves:
- the spawn base from our own data: first-request `cache_read` / `cache_creation` per agent kind from transcripts (duckdb) and `x` traces, measured instead of assumed, times the prices in `models.md`

analysis (on top of the shared three):
- which bundled skills does this cc build ship, gated ones included? list them from the build's bundled-skills dir or the binary, and name any new one to dima
- do the spawn choices made since the last run agree with `models.md` — and where a card was overridden or a spawn contradicted a card, was the card wrong or the moment special?

## findings

beyond the shared shape, the print answers:
- any [verified] row flipped? the build it flipped on, and the row's new tag
- the model ladder moved? a spawn default challenged?
- `craft-spawning` drifted from either doc, and the grid's new numbers
- a new spawn lever or bundled skill worth adopting
