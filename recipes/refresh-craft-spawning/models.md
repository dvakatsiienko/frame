# refresh-spawn-models — recipe

Keeps the model knowledge current across the fleet: which model does what best, at what price,
spawned how. Lands what [DOT-130](https://linear.app/x-com/issue/DOT-130) asked for. Recipe
entity per [_spec.md](_spec.md).

## the want (dima's, 2026-08-27)

> i want awareness of picked models (mine and ours, fleet interest — haiku 4.5, sonnet 5,
> opus 5, fable 5) to be up to date. know strengths and weaknesses of each. best types of work
> each model is best at. the outcome lives at models.md. the data is for me, and for you as a
> coord to pick the right model. any other fleet member only peeks there if i ask something
> about which model.

## research vectors (derived from the want + DOT-130's asks — re-groom each run)

- **scope rule: the latest anthropic version of each line plus one generation back** — opus,
  fable, sonnet, haiku, e.g. fable 5.1 + fable 5, opus 5.5 + opus 5. plus any
  announced-but-unshipped successor. (dima, 2026-10-01)
- capabilities, benchmarks, price, latency (tok/s, TTFT), context, lifecycle — per model in scope.
  price is read from the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing)
  (`curl -sL <url>.md`): input, 5m and 1h cache writes, the cache-hit multiplier per model (it
  differs: 0.025× fable 5.1, 0.05× opus 5.5, 0.1× the rest on 2026-10-06), output, long-context
  billing. a moved price re-sizes the spawn-or-reuse grid in `craft-spawning`, same run.
- **effort levels per model:** the supported levels, the vendor default per surface (API vs
  Claude Code), the vendor's starting points per task type, the lowest-reasoning setting (can
  thinking be turned off?), and any independent effort-vs-score and effort-vs-cost curve.
- **helper-lane fit for every non-default model:** one verdict each, with evidence, for codebase
  exploration, mechanical edits under opus review, a verifier's second pair of eyes, research
  lanes — plus what it must NOT be used for.
- best-fit per research activity type — which model for which research genre
- bake the model-split reasoning against real data; verify assumptions → fact-based
  model-spawn strategy map per task type
- the spawn doors (which door sets model and effort) live in `refresh-spawn-mechanics`; both recipes feed the one spawn-or-reuse grid in `craft-spawning`

## analysis vectors (local evidence — the running agent is the instrument)

- do the actual spawn choices made since last run agree with `models.md` — and where a card was
  overridden, was the card wrong or the moment special?
- did any spawn outcome contradict a card (a sonnet acing hard multi-step, an opus writing
  poems where prose was asked)? a contradiction is a card edit candidate.
- does `craft-spawning.md` still agree with `models.md` line by line?

## artifacts (pointed at, never housed)

- `docs/knowledge/models.md` — THE model reference: cards, spawn defaults, dima's live task→model
  calls. Distill everything here; claim tags ([dima]/[bench]/[vendor]/[community]/[?]) never
  deleted, only updated.
- `cclio/memory/craft-spawning.md` carries the resident distillate — check it agrees after
  every refresh.

## the run

1. re-groom the research vectors with Dima
2. spawn researchers per vector (benchmarks + community patterns + vendor claims, tagged)
3. distill: clever-merge into `models.md`; raw output dies; Dima's [dima]-tagged calls are
   never overwritten by outside evidence — they sit beside it
4. eval + print findings: ladder moved? spawn defaults challenged? craft-spawning drifted?
5. resolve with Dima by outcome; noop is first-class

## cadence

Event-driven: a new Claude model ships, a major benchmark lands, or a spawn decision feels
stale. No timer.

- **thin-data rule:** when a model in scope is under ~4 weeks old, or a lane finds no independent
  measurement, the run ends with a dated re-run **12 weeks** out, written into `_reminders.md`.

## last run

2026-09-28 — opus-5.5 + fable-5.1 cards added, opus-5 / fable-5 kept as history with their [dima] reads, sonnet-5's permanent $2/$10, spawn defaults re-synced with craft-spawning (opus-5.5 `medium`, verifier `medium`). sources: the bundled `claude-api` skill + one `parallel-cli` core lane. dima's ask: «refresh models.md specifically with information about fable 5.1 and opus 5.5».


2026-08-27 — recipe created from the standing docs (models.md already pristine;
`claude-model-strengths.md` research doc retired into it). No fresh research spawned.
