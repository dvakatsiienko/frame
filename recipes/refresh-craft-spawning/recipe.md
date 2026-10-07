---
kind: refresh
cadence: a cc minor version change, a new claude model or a major benchmark, or a spawn behaving against a [verified] row or a model card; no timer
artifacts: [docs/knowledge/spawn-mechanics.md, docs/knowledge/models.md, cclio/memory/craft-spawning.md]
script: none
---

# refresh-craft-spawning

keeps `craft-spawning` true on both of its halves: the spawn mechanics against the current claude code
build, and the model picks (which model does what best, at what price, spawned how) — lands what
[DOT-130](https://linear.app/x-com/issue/DOT-130) asked for. one run covers both, and both feed the one
spawn-or-reuse grid.

## the want

spawn mechanics (dima's, 2026-08-27):

> «i want you, coordinator, to coordinate with spawns (subagents) efficiently and precisely.
> should work for now, with only you occasionally spawning a coder. the wants for this will
> grow when we add verifiers and the rest of the zoo.»

model picks (dima's, 2026-08-27):

> «i want awareness of picked models (mine and ours, fleet interest — haiku 4.5, sonnet 5,
> opus 5, fable 5) to be up to date. know strengths and weaknesses of each. best types of work
> each model is best at. the outcome lives at models.md. the data is for me, and for you as a
> coord to pick the right model. any other fleet member only peeks there if i ask something
> about which model.»

## the run

1. **re-groom** both vector lists below with dima, plus the shared vectors of `x:shape-recipe`. done: his word on the list. (open)
2. **probe the mechanics**: execute `spawn-mechanics.md`'s «the test suite» section against the current build. a probe run while a human or a peer edits the system is not controlled (the doc's own lesson) — say so and re-run if the environment moved. stop every probe session spawned. done: every row re-run or named «not re-run», and every probe's registry file is gone. (script)
3. **research the models**: researcher lanes per vector — benchmarks, community patterns, vendor claims, each tagged; prices read from the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) (`curl -sL <url>.md`). raw output → `last/`. done: every lane landed or failed out loud. (template)
4. **distill** into the two docs:
   - `spawn-mechanics.md` — the pristine evidence base, claim-tagged; its readers are any session that spawns, so it sits beside `models.md`, never under `cclio/`. update tags and rows in place; a falsified row is corrected, never deleted silently — the retraction pattern in the doc shows the shape
   - `models.md` — THE model reference: cards, spawn defaults, dima's live task→model calls. clever-merge; claim tags ([dima] / [bench] / [vendor] / [community] / [?]) are updated, never deleted; dima's [dima]-tagged calls are never overwritten by outside evidence, they sit beside it
   - raw research dies after the distill (run #1 found the old artifact line naming the raw research doc itself, which is why that doc never died)
   - done: both docs touched or named «unchanged». (open)
5. **re-size the grid**: a fresh agent's first-request warm / cold split (`cache_read` vs `cache_creation`) times the run's prices → the spawn-or-reuse grid in `craft-spawning`. a moved price re-sizes the grid the same run. then read `craft-spawning` against both docs line by line. done: the grid's numbers equal this run's base and prices, and no line disagrees with a doc — else go back to step 4. (template)
6. **thin-data check**: a model in scope under ~4 weeks old, or a lane that found no independent measurement → the run ends with a dated re-run **12 weeks** out in `cclio/memory/_reminders.md`. done: the reminder is written, or «no thin data». (script)
7. **findings print** (below), then resolve with dima by outcome; noop is first-class. done: printed, each item verdicted. (open)
8. **log** today's line in `log.md`. done: the line is there.

## vectors

research — spawn mechanics:
- re-verify every [verified] row against the current cc build — the standing mechanical pass; a row stays as sharp as run #2 left it (a subagent's cwd is the parent's bash shell cwd, sharper than «parent's cwd»)
- the spawn doors: which door (Agent tool, agent file, fork, Workflow `agent()`, `claude --bg`) sets model AND effort on the current cc version; what the built-in subagents (Explore, Plan) run on
- new spawn surfaces or flags in the cc changelog since the last run's build (the log names it)
- the cclio-stack bleed (§11 of the evidence base): why a `cwd: ~/frame` `--bg` session once loaded the coordinator's stack — non-deterministic, trigger unknown, the cost is a session quietly wearing cclio's brain. explained for subagents (inheritance, run #2); a watch for `--bg`, unreproduced 2/2
- the long-context probe (10-needle recall + one edit at 100k / 400k / 800k) at every model bump — `craft-spawning` names this recipe as its home
- orchestrator best-practices sweep — BOUNDED: one pass, findings land as evidence-base rows or die
- dima's standing word: cclio doing the spawning is fine for now
- closed at the 2026-08-31 groom: worktree-safety (the `EnterWorktree` hook automated the guard, proven live). earlier cuts stand: the cloud row, `claude attach`, `notify_when_idle`. closed by run #2: workflow per-call `effort` (honoured)

research — models:
- **scope rule: the latest anthropic version of each line plus one generation back** — opus, fable, sonnet, haiku, e.g. fable 5.1 + fable 5, opus 5.5 + opus 5. plus any announced-but-unshipped successor. (dima, 2026-10-01)
- capabilities, benchmarks, price, latency (tok/s, TTFT), context, lifecycle — per model in scope. price: input, 5m and 1h cache writes, the cache-hit multiplier per model (it differs: 0.025× fable 5.1, 0.05× opus 5.5, 0.1× the rest on 2026-10-06), output, long-context billing
- **effort levels per model:** the supported levels, the vendor default per surface (API vs Claude Code), the vendor's starting points per task type, the lowest-reasoning setting (can thinking be turned off?), any independent effort-vs-score and effort-vs-cost curve
- **helper-lane fit for every non-default model:** one verdict each, with evidence, for codebase exploration, mechanical edits under opus review, a verifier's second pair of eyes, research lanes — plus what it must NOT be used for
- best fit per research activity type — which model for which research genre
- bake the model-split reasoning against real data; verify assumptions → a fact-based model-spawn strategy map per task type

research — both halves:
- the spawn base and the grid: the warm / cold split (measured 35k / 102k on 2026-10-06) times the prices in `models.md`, recomputed every run

analysis (local evidence — the running agent is the instrument):
- which [verified] rows did live sessions contradict since the last run? a contradiction outranks the row's age as a refresh trigger
- did any spawn incident reveal a gap the evidence base has no row for — a flag nobody measured, a failure shape nobody named?
- is `spawn-mechanics.md` still claim-tagged throughout, or have untagged assertions crept in?
- which bundled skills does this cc build ship, gated ones included? a skill with model invocation gated off never appears in the session's list (`/verify` sat unseen until 2026-09-26) — list them from the build's bundled-skills dir or the binary, and name any new one to dima
- do the spawn choices made since the last run agree with `models.md` — and where a card was overridden, was the card wrong or the moment special?
- did any spawn outcome contradict a card (a sonnet acing hard multi-step, an opus writing poems where prose was asked)? a contradiction is a card edit candidate
- does `craft-spawning` still agree with both docs line by line?

## findings

beyond the shared shape, the print answers:
- any [verified] row flipped? the build it flipped on, and the row's new tag
- the model ladder moved? a spawn default challenged?
- `craft-spawning` drifted from either doc, and the grid's new numbers
- a new spawn lever or bundled skill worth adopting
- what was not re-run this time, named
