---
researched: 2026-10-15
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

- **price**: $4 in / $20 out, cache reads $0.20 (0.05×), writes $5 (5m) / $8 (1h); fast mode $8/$40 (API). 1M / 128K. **[vendor]**
- **effort**: `medium` default and our baseline; `high` for scaffolding, migrations, cross-cutting refactors; `xhigh`/`max` only after a measured gain. medium matches opus 5 at high **[vendor]**; on the 5.5 charts high buys +3.5 to +6.7 points for ~35 % more cost **[bench]**.
- **pick for**: every codie, sixth sense, research synthesis, the lead over a crew.
- **never**: an unchecked inference stated as fact — it drops its own doubts **[vendor]**; a frontend with no design direction falls back on stock styles **[vendor]**.
- **numbers**: CursorBench 4.0 52.5 % medium · 57.8 % max (Cursor) **[bench]**; AA index 51 medium, 85 tok/s **[bench]**; 16 of 18 research reports passed a sourcing grade **[vendor]**.

## fable-5.1 — `claude-fable-5-1` · the escalation

- **price**: $10 / $50, cache reads $0.25 (0.025×). 1M / 128K. 2.5× opus per token, and slower. **[vendor]**
- **effort**: `high` API default; for design «not lower than medium, maybe high» **[dima]**.
- **pick for**: what Dima reads where flavour matters, verdict-shaped deliverables, design spreads, a job opus measurably missed. «opus picks pragmatically, fable = flavour» **[dima]**. never spawned without his word.
- **never**: coding or terminal work — opus 5.5 now scores higher (SWE-bench Pro 89.9 % vs 81.2 %) **[bench]**; prompts written for older models make it worse **[vendor]**.
- **numbers**: a design spread $13.44 at medium against opus's $4.35, and Dima judged fable's drawing better (`docs/test-drive/design-run.md`) **[measured]**.

## sonnet-5.5 — `claude-sonnet-5-5` · the mid tier

- **price**: $2 / $10, cache reads $0.10 (0.05×, cut from $0.20 on 2026-10-07), writes $2.50 (5m). 1M / 128K. **[vendor]**
- **effort**: `medium` in Claude Code, `high` on the API; never `low` for code (skips verification **[vendor]**), never `xhigh`/`max` (~193K tokens a task, dearer than opus max **[bench]**).
- **pick for**: `helper`, `scout`, retrieval lanes under an opus lead.
- **never**: the main codie of a side lane, the sole sixth sense, design work.
- **numbers**: below opus at every matched effort — AA 41 vs 51 at medium **[bench]**; opus low (87.4 %) matched sonnet high (87.6 %) at +7 % cost per solved task **[vendor]**; review catch 6/13 vs opus 8/13 (CodeRabbit) **[bench]**.

## haiku-5.5 — `claude-haiku-5-5` · the worker

- **price**: ≤100K prompts $0.10 / $0.50, cache reads $0.01, writes $0.125 (5m) / $0.20 (1h); over 100K **×5 on every line**, output included — cache reads and writes count toward the 100K, the tier is set per request. **[vendor]**
- **the cliff**: a Haiku session compacts at ~967K by default, so a long run pays ×5 on most requests (Theo: 47 of 51) **[community]**; `helper-lite` sets `autoCompactWindow: 100000` (frontmatter, cc 2.1.296+). where in the window compaction fires is undocumented **[?]**.
- **effort**: `medium` baseline — at `low` on long prompts it skips searches and checks, and low → medium halved early stops **[vendor]**. curve (AA index · cost a task): low 29 $0.02 · medium 34 $0.05 · high 38 $0.08 · xhigh 41 $0.12 **[bench]**.
- **pick for**: `helper-lite` — extraction, transcripts, screenshot transcription, a crew of workers under an opus lead (Opus + 10 Haiku: 1.5× faster and cheaper on real code, same recall, a little less consistent — PostHog) **[community]**; a classifier through the api with a strict schema and thinking on **[vendor]**.
- **never**: judgment or verifying (it took github's «clean» as «merge ready»), a wait or a loop against an outside api (it burned the github quota and armed no wake-up) **[community]**; research synthesis (AA-Omniscience 40 % hallucination **[bench]**); complex agentic coding (Terminal-Bench 39.2 % vs sonnet 70.6 %) **[vendor]**.
- **numbers**: images vs opus — transcription 93–95 % vs ~96 %, **a single value 45–47 % vs 68–70 %** (Roboflow, 2026-10-13) **[bench]**; our first image rounds: 38 of 39 numbers, 0 misreads; 150 video values, 0 mismatches on the spot-check **[measured]**.

## across the line

- **cache reads are where agents spend**: an agent re-sends its context every turn; at 0.05× input a 50-turn run re-reading 100k tokens costs ~$1 on opus against $20 uncached. sonnet's $0.10 read makes a long sonnet loop cheap on re-reads too. **[vendor]**
- **effort mid-session keeps the cache** on all four models on a subscription or api key, never on bedrock, vertex, a gateway or HIPAA; `/model` re-reads the history uncached **[verified 2026-10-12]**.
- **bounded vs unbounded**: past a point more intelligence adds nothing to a bounded task, so a cheaper model fits; an unbounded one keeps paying for it **[vendor]**. writing the code is cheap, gathering context and verifying is the cost — haiku takes the legwork, the strong model writes **[community]**.
## Dima's live calls — task → model, his words kept (keep growing) [dima]

- fable's line: all-round writing, PM and coordination — «opus picks pragmatically, fable = flavour; i want best picks»
- public-facing pretty output (gh profile opener): **fable** — «opus prints pretty, fable prettier; must be even prettier»
- overhaul-audits with taste (git, zsh configs): **fable**
- server and scripting builds with locked specs: **opus**; research rounds and debugging investigations: **opus**
- verdict-shaped deliverables: opus researches upfront, **fable verdicts** — split the ticket's phases across models
- haiku 5.5 over 4.5 everywhere (2026-10-08)
- his idea, open: «fable as an adviser in shape-idea» (the vendor's architect split, fable with opus, is the same shape)
- model labels (`fable 5`, `opus 5`) ARE the assignment mechanism — self-descriptive, no extra vocab
- opus 5.5's clearer prose is **[?]** until Dima reads a week of it
