---
researched: 2026-11-19
refresh-when: a new model ships, a benchmark lands, Dima's read changes — and a scheduled re-run ~2026-12-24 (sonnet 5.5 data thin at launch)
ticket: DOT-130
---

# Models — the cards behind the picks

**Read when a model or effort pick is in question.** The contract is `crew-lead/models.md`; this file is
the evidence behind it, kept by `recipes/refresh-crew-coordinator/recipe.md`.

📌 **what a card holds, and nothing else**: price · effort · pick for · never · the ≤3 numbers that decide a
pick, each tagged and sourced. a benchmark list, a launch note, an anecdote or a webinar summary stays in the
recipe's `last/` and dies with the next run. the file stays under 8 KB (`script/lib/model-cards-cap.test.ts`).

Claim tags: **[dima]** his call, assert it · **[bench]** a third party measured it · **[vendor]** Anthropic says
so · **[community]** a practitioner pattern · **[measured]** we ran it · **[?]** no evidence.

📌 A session knows its model from startup and **cannot detect a mid-thread switch.**

## opus-5.5 — `claude-opus-5-5` · the default

- **price**: $4 in / $20 out, cache reads $0.20, writes $5 (5m) / $8 (1h); fast $8/$40. 1M / 128K. **[vendor]**
- **effort**: `medium` default (API and Claude Code) and our baseline; `high` for bug fixes in existing code and edge cases; `xhigh` for the hardest coding, where it matches fable high for 62 % of the cost **[bench]**; never `low` for code (TB4.0 31.3 vs 52.5 at medium) **[bench]**.
- **pick for**: every codie, sixth sense, research synthesis, long-context single runs, security review (fable's safeguards block it).
- **never**: an unchecked inference stated as fact **[vendor]**; a frontend with no design direction (stock styles) **[vendor]**.
- **numbers**: CursorBench 4.1 medium 50.0 % · high 54.5 % · max 58.1 % **[bench]**; AA v5.0.1 medium 48.2 · xhigh 57.4 **[bench]**; ProgramBench 91.2 vs fable 5.2 85.6 **[vendor]**.

## fable-5.2 — `claude-fable-5-2` · the escalation

- **fable weeks** (dima, 2026-11-15, three promo resets): codies and the designer run fable 5.2, sixth sense stays opus 5.5 for model mixing; the live rule is `_clio/memory/_reminders.md`.
- 5.1 stays on the API to 2027-09-01; cc maps saved 5.1 picks to `fable` **[vendor]**.
- **price**: $8 / $40, cache reads $0.20 (0.025×), writes $10 (5m) / $16 (1h); fast mode $16/$80. 1M / 128K. 2× opus per token, 20 % under 5.1 on every line. **[vendor]**
- **effort**: `medium` is the cc default and our baseline (`high` on the API); `high` for long unattended runs, hard coding and deliverables; `xhigh` only after a measured gain; never `max` — below xhigh on FrontierCode at 3.2× the cost, below high on ARC-AGI-3 **[vendor]**. at medium on agentic work, add the vendor's «finish the whole task» line **[vendor]**. design «not lower than medium, maybe high» **[dima]**.
- **pick for**: what Dima reads where flavour matters, verdict-shaped deliverables, design spreads, long autonomous builds, the orchestrator over a crew. «opus picks pragmatically, fable = flavour» **[dima]**. never spawned without his word.
- **never**: coding in the fleet — capable, but opus ships more per window **[dima]**; security work (safeguards block it); context-filling runs (out of context on 68 % of ProgramBench); a switch to opus mid-thread, which drops its thinking; hard style caps, read literally **[vendor]**.
- **numbers**: AA medium 56.4 for $3.80 a task in 6.5 min vs opus 48.2, $2.45, 7.0 min; 32 % cheaper a task than 5.1 **[bench]**; CursorBench 4.1 fable high 56.5 % for $10.51 vs opus xhigh 56.7 % for $6.54 **[bench]**; SWE-bench Pro 93.0 vs opus 89.9 **[vendor]**. a design spread $13.44 at medium vs opus $4.35, Dima judged fable's better (`docs/test-drive/design-run.md`) **[measured]**. ours, 16–18 Nov: a codie lane cost about the same on fable as on opus at 5.1 prices (2 sessions each), ~20 % less at 5.2's, thin **[measured]**.

## sonnet-5.5 — `claude-sonnet-5-5` · the mid tier

- **price**: $2 / $10, cache reads $0.10 (0.05×), writes $2.50 (5m) / $4 (1h). 1M / 128K. **[vendor]**
- **effort**: `medium` in Claude Code, `high` on the API; in our crew set `high` or `xhigh` explicitly — at medium it loses to haiku xhigh for more money **[bench]**; never `low` for code (skips verification) **[vendor]**. a subagent on another model runs at that model's default unless its card sets `effort` (cc 2.1.317) **[vendor]**.
- **pick for**: `helper` and `fresh-eyes` at high, `scout` at medium **[dima]**, retrieval under an opus lead.
- **never**: left at the cc default for real work; the main codie or the sole sixth sense; design.
- **numbers**: CursorBench 4.1 medium 34.3 % for $0.63 vs haiku xhigh 45.2 % for $0.56 **[bench]**; high 43.8 % ≈ opus low 42.7 % at the same ~$1.4 **[bench]**. **[bench]**

## haiku-5.5 — `claude-haiku-5-5` · the worker

- **price**: ≤100K prompts $0.10 / $0.50, cache reads $0.01, writes $0.125 (5m) / $0.20 (1h); over 100K **×5 on every line**, cache included, set per request. **[vendor]**
- **the cliff**: a Haiku session compacts at ~967K, so a long run pays ×5 **[community]**; `helper-lite` sets `autoCompactWindow: 100000`.
- **effort**: `medium` baseline; `xhigh` is the value pick for small coding-shaped worker edits (Cursor 45.2 % for $0.56) **[bench]**; `low` only for chat and short tool calls — on long prompts it skips searches and checks **[vendor]**.
- **pick for**: `helper-lite` — extraction, transcripts, screenshot transcription, a crew of workers under an opus lead **[community]**; a classifier through the api with a strict schema **[vendor]**.
- **never**: judgment or verifying (it took github's «clean» as «merge ready»), a wait or a loop against an outside api **[community]**; research synthesis (AA-Omniscience 40 % hallucination) **[bench]**; a whole agentic coding job (Terminal-Bench 39.2 vs sonnet 70.6) **[vendor]**.
- **numbers**: AA v5.0.1 low 18.6 · medium 24.6 · high 29.9 · xhigh 34.6 **[bench]**; images vs opus: **a single value 45–47 % vs 68–70 %** (Roboflow) **[bench]**; ours: 38 of 39 numbers read **[measured]**.

## across the line

- **effort mid-session keeps the cache** on all four models on a subscription or api key, never on bedrock, vertex, a gateway or HIPAA; `/model` re-reads the history uncached **[verified 2026-10-12]**.
- **bounded vs unbounded**: more intelligence adds nothing to a bounded task, so a cheaper model fits **[vendor]**; haiku takes the legwork, the strong model writes **[community]**.
## Dima's live calls — task → model, his words kept (keep growing) [dima]

- fable 5.2 never codes in the fleet (2026-11-19): «Fable 5.2 is too expensive … I would rather be more economic and use Opus 5.5 for all the tasks to ship more»
- fable 5.2 feels ~2.5× opus: Monday's all-fable day spent the whole fable share (2026-11-19)
- the designer stays on fable 5.2: «opus 5.5 draws very good too. its a hard choice for me. lets go with fable 5.2» (2026-11-19)
- fable's line: all-round writing, PM and coordination — «opus picks pragmatically, fable = flavour; i want best picks»
- public-facing pretty output (gh profile opener): **fable** — «opus prints pretty, fable prettier; must be even prettier»
- overhaul-audits with taste (git, zsh configs): **fable**
- server and scripting builds with locked specs: **opus**; research rounds and debugging investigations: **opus**
- verdict-shaped deliverables: opus researches upfront, **fable verdicts** — split the ticket's phases across models
- haiku 5.5 over 4.5 everywhere (2026-10-08)
- with more usage (2026-11-19, thoughts, no action): fable 5.2 medium for clio and the wings; codies, verifiers and crow on opus, for a second model's opinion
- his idea, open: «fable as an adviser in shape-idea» (the vendor's architect split, fable with opus, is the same shape)
- opus 5.5's clearer prose is **[?]** until Dima reads a week of it
