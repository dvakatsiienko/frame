# research lanes — every research runs all the doors at once

dima, 2026-09-29: «whenever i ask for research or you decide to research yourself, you would use
all research tools at once to have a diversified result (especially given that exa and parallel
ai are essentially free research tools).»

- **one brief file, every lane, in parallel.** write the question once (context, numbered
  vectors, the output shape), then:
  - `pnpm research:lanes <brief.md> [out]` — the exa agent run + the parallel core run, side by
    side under `op-run`; one line per lane: status, seconds, chars, cost (~$0.10 exa, cents parallel)
  - **an opus lane** (a fresh agent, never a fork) on the same brief, pointed at what needs SOURCE
    reading — code, skills, prompts, npm, real api probes
  - **neuroarxiv** when the question is an architecture or method one; **`advise-project-approach`**
    when a plan or a process is about to be chosen (adopted)
- **the lanes disagree on purpose**: exa is broad and dated, parallel the most sceptical, the opus
  lane the only one that reads source. the synthesis names where they split.
- **grade every lane** in its vet file (`docs/vet/exa.md`, `docs/vet/parallel.md`): seconds, chars,
  cost, a 1–5 against the others.
- **one reply** when all lanes land (habit-dima-comms-pacing), and **recipe-first** when the subject will be
  researched again (habit-recipe-first).
- a one-fact lookup is not research: exa `/answer` (2 s, half a cent) or WebSearch, not the full fan-out.

Related: [habit-vet](habit-vet.md), [habit-recipe-first](habit-recipe-first.md)
