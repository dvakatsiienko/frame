---
researched: 2026-09-28
refresh-when: a new model ships (Sonnet 5.5 and Haiku 5.5 are announced «in the coming weeks»), a benchmark is published, or Dima's lived read changes
ticket: DOT-130
---

# Models — the full reference

**Read on demand when a model-selection question opens.** The distilled version cclio acts on
lives in `cclio/memory/craft-spawning.md`; the two must agree line by line.

📌 This file stays evergreen — [DOT-130](https://linear.app/x-com/issue/DOT-130) owns that, the
`refresh-model-knowledge` recipe (`cclio/docs/recipes/`) runs it. Add measurements and Dima's live
calls; never delete a claim tag. Sources of the 2026-09-28 run: the bundled `claude-api` skill
(Anthropic's own model tables and migration guides) + one `parallel-cli` research lane
(`docs/research/` holds no copy — this file is the distillate).

Claim tags: **[dima]** his own assessment, assert it · **[bench]** published benchmark (who ran it
is named) · **[vendor]** Anthropic's framing · **[community]** repeated practitioner pattern ·
**[?]** no evidence either way.

📌 A session knows its model from startup and **cannot detect a mid-thread switch.** Never claim
to notice one.

📌 Benchmarks below are not apples-to-apples — effort, harness and safeguard fallbacks differ, and
a system-card run and a public leaderboard give different numbers for the same test.

## opus-5.5 — `claude-opus-5-5` · the default coder

Launched 2026-09-22. **$4/$20** per MTok (20 % below opus-5), cache reads $0.20, 1M context, 128K
output. Fast mode $8/$40 (API only).

- **Effort defaults to `medium`**, one level below opus-5's `high`, and it **thinks more per turn
  than opus-5 at the same level**, most at `xhigh`/`max`. Carry no effort setting over from opus-5
  — sweep again. Thinking can't be disabled; effort is the only dial. **[vendor]**
- **Best at** — multistep agentic coding in a real repo (a change carried until the tests pass),
  large migrations, codebase audits, efficient tool use, self-checking. At default `medium` it
  matched or beat opus-5 with fewer tokens; typical workloads ~40 % cheaper, output ~30 % faster.
  **[vendor]**
- Reads charts, diagrams and screenshots far more precisely — at `low` more accurately than opus-5
  at its highest effort; visual scaffolding built for older models may be dead weight. **[vendor]**
- Clearer prose in its work reports — says what it did, found and needs, less jargon. **[vendor]**
  Whether that fixes opus-5's prose habits (below) is **[?]** until Dima reads a week of it.
- SWE-bench Pro **89.9 %**, FrontierCode **54.4 %**, Terminal-Bench 4.0 **66.4 %** at xhigh,
  ProgramBench (to the full 1M window) **91.2 %**, OSWorld 2.0 81.8 % partial / 48.7 % strict
  (Anthropic system card). **[bench]** Independent: CursorBench 4.0 **52.5 % medium · 56.0 %
  high/xhigh · 57.8 % max** (Cursor); FrontierSWE v2 62.3 %, behind GPT-6 Astra (Proximal);
  GDPval-AA 1846 Elo (Artificial Analysis). **[bench]**
- ⚠️ **Weak at** — can state an unverified inference as fact, drop its own doubts, or make a narrow
  change without asking whether the design is right (its own system card). More likely than
  earlier models to act on malicious instructions pasted into the prompt and to accept unverifiable
  claims of authorization. Frontend work with no design direction falls back on a few stock
  styles; «avoid a generic look» swaps one default for another — name the patterns to avoid.
  **[vendor]**
- **Pick it for** — every coder by default at `medium`; `high` for scaffolding, migrations and
  cross-cutting refactors; the verifier at `high`.

## fable-5.1 — `claude-fable-5-1` · the escalation

Launched 2026-09-01, successor to fable-5 at the same **$10/$50**, cache reads **$0.25** (a
quarter of input). 1M / 128K. Mythos 5.1 is the same model for Project Glasswing only.

- Effort defaults to `high`; thinking is always on; single turns on hard tasks can run many
  minutes; **prompts written for older models are often too prescriptive and lower its output
  quality**. **[vendor]**
- **Best at** — the hardest long-horizon work, multistep research, and work that ends as a
  document, spreadsheet or deck. ARC-AGI-1 **97.5 %**, ARC-AGI-2 **90 %** at max (ARC Prize
  Foundation, verified); first on the Vals Index 67.87 % (Vals AI). **[bench]**
- On the coding and terminal lines opus-5.5 now scores higher: SWE-bench Pro 81.2 % vs 89.9 %,
  Terminal-Bench 4.0 55.8 % vs 66.4 %, CursorBench 4.0 51.8 % at max vs 57.8 % (Anthropic / Cursor).
  **[bench]**
- 2.5× opus-5.5's per-token price, and slower. The vendor's own routing: reach for it when opus at
  a tested higher effort still falls short. **[vendor]**
- One user report: fresh frontend designs strong, adapting an existing design system weaker.
  **[community]** — one anecdote.
- **Dima's reads of fable-5 carry forward** until he says otherwise: all-round writing, PM and
  coordination; «opus picks pragmatically, fable = flavour». **[dima]**
- **Pick it for** — anything Dima reads where flavour matters, verdict-shaped deliverables, and the
  job opus-5.5 measurably missed. Never spawned without his word.

## opus-5 — `claude-opus-5` · previous default, still served

Launched 2026-07-24. $5/$25, 1M / 128K, effort default `high`.

- **Best at** — under-the-hood engineering: features, CI, ssh debugging. **[dima]**
- SWE-bench Verified 96.0 %, SWE-bench Pro 79.2 %. **[bench]**
- ⚠️ **Weak at** — prose: overlong, over-clever, invents jargon, writes unasked docs, commits to
  assumptions instead of asking. **Not a PM.** **[dima]** **[community]** — said of opus-5; the
  card above tracks whether 5.5 kept it.

## fable-5 — `claude-fable-5` · superseded by 5.1

Launched 2026-06-09 (suspended 06-12, redeployed 07-01). $10/$50. SWE-bench Pro 80.0 %. **[bench]**
All-round work, codes no worse than opus, differently. **[dima]** Cyber / bio-chem /
distillation-flagged queries could route to Opus 4.8 mid-session; 30-day retention mandatory.
**[vendor]**

## sonnet-5 — `claude-sonnet-5`

Launched 2026-06-30. **$2/$10 — the introductory price was made permanent** (the planned
September rise to $3/$15 did not happen). 1M / 128K, effort default `high`.

- **Weaker fallback** — quota pressure or simple ops. **[dima]**
- The most agentic Sonnet: plans, uses browser and terminal, follows through; at higher effort
  matches Opus 4.8 on some tasks; `medium` ≈ Sonnet 4.6 at `high`. Its launch compared it to Opus
  4.8, not to the 5.5 generation. **[vendor]**
- SWE-bench Pro **63.2 %** (a secondary leaderboard snapshot, BenchLM) — **26 points under
  opus-5.5**. **[bench]**
- **Pick it for** — routine, well-specified coding and high-volume work. **Avoid** for hard
  multi-step engineering. Sonnet 5.5 is announced for «the coming weeks». **[vendor]**

## haiku-4.5 — `claude-haiku-4-5`

Launched 2025-10-15. $1/$5, **200K** context, 64K output, **no effort dial** (manual extended
thinking only). **[vendor]**

- SWE-bench Verified 73.3 % (Anthropic, 2025). **[bench]** 📌 a 4.x-era number — never compare it
  to the 5-generation lines above.
- **Pick it for** — subagents, classification, summarization, retrieval, bulk processing. Haiku 5.5
  is announced for «the coming weeks». **[vendor]**

## spawn defaults — set by Dima, binding on every surface that spawns

- **opus-5.5 · the default coder** · `--effort medium` standing default (dima's call 2026-09-25,
  backed by the migration guide) · `high` for large scaffolding, migrations and cross-cutting
  refactors · the **verifier** always opus-5.5 `high` · `xhigh`/`max` only after a measured gain
- **fable-5.1** · 🚫 never spawned unless Dima asks by name · then `low`, until he says otherwise
- **sonnet-5** · quota pressure, simple specified work · pass effort explicitly
- **haiku-4.5** · bulk, classification, retrieval · no effort flag exists

📌 **`--effort` is a flag on `claude --bg` and is honoured; it is never inherited** — pass it every
time. `--model opus` resolves to `claude-opus-5-5` (cc 2.1.280+, probed).

📌 the old «opus always `high`» line was opus-5 era: a full day of `high` raised weekly usage by only
~10 %, which killed the cost argument for `low`. On opus-5.5 the default moved to `medium` on the
vendor's migration evidence — revisit only with a measured miss, never a hunch.

## conv picks 2026-08-19 — task→model data (Dima's live calls, keep growing)

- overhaul-audits with taste (git, zsh configs): **fable** — «opus picks pragmatically, fable = flavour; i want best picks»
- public-facing pretty output (gh profile opener): **fable** — «opus prints pretty, fable prettier; must be even prettier»
- server/scripting builds with locked specs (mcp mvp, sync script): **opus** — self-descriptive lane
- research rounds + debugging investigations (skill-maintenance research, cloud-spawn bug): **opus** — bull food
- verdict-shaped deliverables (harness one-pager): opus researches upfront, **fable verdicts** — split the ticket's phases across models
- marker on the board: model labels (`fable 5`/`opus 5`) ARE the assignment mechanism — self-descriptive, no extra vocab
