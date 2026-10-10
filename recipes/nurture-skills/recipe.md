---
draft: true   # the want is owed by dima; the shape test skips want and run until it lands
kind: nurture
owner: coordinator
artifacts: []
script: none
was: [nurture-skills-hillclimb]
---

# nurture-skills

⏸️ **parked, not a recipe yet.** written when there is a real run to do — until then this is the
shape, nothing more. the want and vectors are filled at
that first run, the want in dima's words.

sibling of [nurture-memory](../nurture-memory/recipe.md): that one grooms what a skill says, this one
measures whether a skill fires and is followed, and improves it against the measurement.

## the run

- **step 1, the census**: read `refresh-agent-ops`' skill-load measure; a skill nobody fires and that costs context is a prune candidate before any hillclimb (dima's yes, 2026-10-06)
- **trigger** — a skill miss shows up: a flawlog «skill not loaded» line, or a `jev` router
  near-miss (0.30–0.70) on a prompt that should have loaded it.
- **cases** — dima's real prompts for that skill as `plugin-x/evals/<skill>-*` cases, split into a
  train set and a held-out test set (the existing `cmt`/`notes`/`pm` cases are the pattern).
- **baseline** — `claude plugin eval` on both sets before any edit.
- **the loop** — change ONE thing (usually the description's trigger words), rerun train; keep the
  change only if train rises and test does not drop; log each round in `docs/test-drive/`.
- **stop** — a round count or a spend cap set before the first run.
- the same loop runs in small at every halt for jev (`memory/sys-jev.md`, the sharpening loop) —
  point there, never restate it.

## vectors

### research

- prior art: see `docs/knowledge/authoring-skill.md` § evals — prior art
