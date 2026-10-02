# recipe — the entity spec

A **recipe** is a repeatable flow — a maintenance run with research vectors, or a plain execution script (`docs/knowledge/impeccable-refine.md` is one; it lives outside `cclio/` because coders read it), run from time to time, owned jointly: Dima
owns the want and the research vectors, agents own the execution. Born 2026-08-27 from noticing
that the writing-for-humans research, the nurture-memory flow, the gazette, and the model-kb
refresh all share one skeleton.

## the fields, and who owns them

- **the want** — WHY the recipe exists and what problem it solves. **Dima's, always.**
  Creating a recipe without his stated want is not allowed: ask him for it, in his words,
  before the recipe is real. An agent-invented want is a recipe serving nobody.
- **research vectors** — the questions each run investigates against the OUTSIDE world, via
  web_search-armed researchers. **Dima's wording**, re-groomed with him at every run before
  spawning any researcher. Stale vectors produce confident answers to yesterday's questions.
- **analysis vectors** — the same contract, different instrument: questions answered by LOCAL
  evidence — field reports, disk, git, the agent's own reasoning. No researcher spawns; the
  running agent is the instrument. A recipe carries research vectors, analysis vectors, or
  both.
- **artifacts** — the pristine distilled docs this recipe maintains, listed by path.
  📌 **The recipe points at its artifacts; it never houses them.** Artifacts live where
  their READERS expect them (`docs/knowledge/models.md` beside its consumers, skills in their
  plugins). Raw research is transient: distilled into the artifacts, then deleted — a research
  doc kept beside its pristine version is sediment.
- **the run** — the execution script. Agents own it.

## the four phases, always

1. **research** — spawn against the current research vectors.
2. **distill** — CLEVER-MERGE findings into the artifacts: keep the useful existing data,
   merge in only the useful new; two runs back-to-back may both yield keepers — all good stuff
   goes in. Avoid bloat, but completeness outranks thinness. Raw researcher output dies here.
3. **eval + findings** — self-eval the merged picture and print Dima the delta: anything new
   worth trying? does a downstream artifact need a refresh? A run that ends without this
   printout did not finish.
4. **resolve** — with Dima, by outcome: what the findings say gets done, folded, or dropped.
   **Noop is a first-class outcome** — a run that found nothing new applies nothing; tweaking
   afterward is never a must.

## file shape — one flat file per recipe

`cclio/docs/recipes/<name>.md`, entity-first name. Sections: the want · research vectors ·
artifacts · the run · cadence · last run. A folder appears only when a recipe needs its own
assets (a bench corpus, samples) — then `<name>/recipe.md` plus the assets.

«Run the refresh-writing-for-humans recipe» = open the file, follow it.

## why this exists

Research docs were dead weight: written once, never revisited. A recipe turns research into
pristine, maintained artifacts with an owner, a cadence, and a script that consumes them — and
saves Dima re-printing the same asks each time.
