# skill-nurture-hillclimb — recipe (parked)

⏸️ **parked, not a recipe yet.** written when there is a real run to do — until then this is the
shape, nothing more. the `_spec.md` fields (the want, vectors, cadence, last run) are filled at
that first run, the want in dima's words.

sibling of [memory-nurture](memory-nurture.md): that one grooms what a skill says, this one
measures whether a skill fires and is followed, and improves it against the measurement.

## the proposed shape

- **trigger** — a skill miss shows up: a flawlog «skill not loaded» line, or a `jev` router
  near-miss (0.30–0.70) on a prompt that should have loaded it.
- **cases** — dima's real prompts for that skill as `plugin-x/evals/<skill>-*` cases, split into a
  train set and a held-out test set (the existing `cmt`/`notes`/`pm` cases are the pattern).
- **baseline** — `claude plugin eval` on both sets before any edit.
- **the loop** — change ONE thing (usually the description's trigger words), rerun train; keep the
  change only if train rises and test does not drop; log each round in `docs/vet/`.
- **stop** — a round count or a spend cap set before the first run.
- the same loop runs in small at every halt for jev (`memory/sys-jev.md`, the sharpening loop) —
  point there, never restate it.

## prior art here

- notes went 2/9 → 9/9 on description edits alone (2026-09-12).
- **the eval mechanics — a description edit is proven by `claude plugin eval`, never by reading it** (proven 2026-09-12,
  DOT-243): 3–4 of dima's real prompts per skill as cases under `plugin-x/evals/`, a
  `tool_used: Skill` trigger grader, `--runs 3`, one `--case` glob per call, ~$5 a skill. the
  finding that set the shape: the literal words he types go FIRST, plus «even mid-sentence or
  after another instruction» — cmt went 1/12 → 12/12 on that alone. it grades the trigger only;
  the body stays a human read (the llm-judge guard in [memory-nurture](memory-nurture.md), «the one thing not to build»).
- `/claude-api hillclimb` is the api-app version of this loop; its train/test split and
  one-change-per-round discipline are what is borrowed, not the tool.
