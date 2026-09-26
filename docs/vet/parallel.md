---
dies-when: parallel is adopted as a door or dropped after the vet period
---

# parallel.ai vs built-in WebSearch — measured 2026-09-24

**verdict:** agentic search matched WebSearch on hit rate (9/10 each), fast search lagged (6/10). core research returned tight, sourced answers in 75–95 s for pennies, on par with or slightly better than a 3–5-call hand lane.
**cost:** the whole run (20 searches + 2 core tasks) moved the balance 499¢ → 493¢ settled + ~2–3¢ pending, so about **8–9¢ total**. billing lags: the balance did not move at all during the 20 searches, so a per-lane split is not measurable from balance reads.
**pick:** worth keeping as a second door for research-shaped questions (core); for plain lookups it does not beat WebSearch, it only adds raw excerpts (10–60k chars) that cost context tokens.

## part A — search

lanes: ws = built-in WebSearch · fast = `--mode fast` · agentic = `--mode agentic`. «y» = the expected page is in the top 3. WebSearch latency was not timed (the tool gives no timestamp); chars = summed excerpt length. ws returns a summary, not excerpts.

- q1 cc caching / effort on fable 5.1 — ws: y (code.claude.com prompt-caching #1) · fast: n 4.3s 18.7k (vals.ai, generic caching docs) · agentic: y 2.1s 12.1k
- q2 vhs #787 — ws: y (issue #1) · fast: n 5.1s 10.0k (repo files, no issue) · agentic: y 1.9s 2.9k
- q3 pnpm 12 overrides — ws: y (pnpm issues + docs) · fast: y 3.8s 18.2k (pnpm docs, a zh copy #1) · agentic: y 2.0s 14.7k (pnpm #14556, #11536, settings)
- q4 op item create --url — ws: y (developer.1password.com item-create) · fast: y 4.3s 25.8k · agentic: y 2.1s 17.5k
- q5 ray build + ts 7 — ws: n · fast: n 4.7s 12.5k · agentic: n 1.9s 8.3k (no source exists for this in any lane)
- q6 vercel canceled builds quota — ws: y (vercel monorepo/builds docs) · fast: y 4.1s 9.9k (vercel builds docs) · agentic: y 2.0s 10.2k (community thread + kb guide)
- q7 skipped required check — ws: y (gh docs + blog) · fast: y 5.0s 14.2k (docs #3; #2 was a raw ip mirror) · agentic: y 2.0s 14.4k (troubleshooting-required-status-checks #1)
- q8 next 16.3 agentRules — ws: y (nextjs ai-agents guide) · fast: y 5.1s 60.0k (hit the excerpt cap) · agentic: y 1.9s 16.6k
- q9 obsidian cli rename wikilinks — ws: y, weak (dev.to on the official cli; x-cmd third party #1) · fast: n 3.5s 13.2k (third-party clis only) · agentic: y 1.8s 9.5k (obsidian.md/help/cli #1)
- q10 biome negation + extends — ws: y (biome docs) · fast: y 4.5s 18.2k · agentic: y 1.9s 17.8k

- hit rate: ws 9/10 · fast 6/10 · agentic 9/10
- latency: fast avg **4.4s**, agentic avg **2.0s** (agentic was faster every time; fast ran first, so a cold start may be part of it)
- errors: none. every agentic call warns: `--mode agentic is a Beta value and will stop working after the Beta API sunset (June 2026). Use --mode advanced instead.` the sunset date is already past; it still works on cli 0.9.3
- balance after lane 2 (fast): 499¢ → 499¢ (delta **0¢** read)
- balance after lane 3 (agentic): 499¢ → 499¢ (delta **0¢** read)
- 📌 both zero deltas are billing lag, not free calls: the debit showed up later as settled + pending

## part B — research

- q1 em dashes as an ai tell
  - parallel core — 95 s, 4 sources (arxiv 2608.05889 congress releases, arxiv 2606.29540 medrxiv preprints, nyt magazine, ecology-abstracts blog), grade **4/5**: three corpora with hard numbers (medrxiv discussion sections 4.23% → 11.58%, congress 0.10–0.12 → 0.217 per 1k chars, ecology abstracts >2×), careful about causation; weak on the *why* (no training-data / old-books hypothesis, no per-model rates)
  - hand lane (ws + webfetch, 5 calls) — ~26 s of tool time, grade **4/5**: got the congress numbers, gpt-4.1 at 3.3× the human rate, goedecke's digitised-old-books hypothesis with numbers, the markdown-training paper; missed the medrxiv study. one pdf fetch failed (binary), recovered through the abs page
- q2 self-scheduled wake-up in a cc session
  - parallel core — 75 s, 2 sources (code.claude.com scheduled-tasks + tools-reference), grade **5/5**: ScheduleWakeup (loop-only, 1 min–1 h, 20-min fallback, not restored on resume), Monitor as a one-off timer (5 min default, 30 max, 10 in `-p`), why bash `sleep` is not a wake-up
  - hand lane (3 calls) — ~23 s of tool time, grade **4/5**: same ScheduleWakeup limits plus cron jitter / 7-day expiry / 50-task cap, and the live bug where ScheduleWakeup outside `/loop` reports success and never fires (#82633); did not spell out Monitor's limits
- balance: 499¢ before → 493¢ settled + 2–3¢ pending after (the pending line prints `$0.03 (2¢)`)
- hand-lane cost: agent tokens, roughly 10–15k input per question (the scheduled-tasks page alone is ~6k); not measured precisely

## cost per call

- 📌 not separable from balance reads: debits settle minutes after the call, and all 22 calls landed in one ~8–9¢ bucket
- upper bound if search were free: core ≈ **4¢ per task**
- upper bound if core were free: search ≈ **0.4¢ per call**
- the json reports `usage: sku_search count 1` per search, so the dashboard's usage page is the place to get exact per-sku prices

## what parallel did better / worse

- better: agentic search found the exact primary page where fast missed (issue #787, obsidian's own help page), in ~2 s
- better: core research gives a finished, sourced answer with no agent context spent; the q2 answer beat my own on Monitor limits
- better: domain filters, date filters and `--json` make it scriptable from a hook or a cron job
- worse: fast mode is not reliably better than WebSearch (6/10) and ships the most text
- worse: raw excerpts are big (avg ~16k chars per call); piping them into an agent costs more context than WebSearch's summary
- worse: core misses what is not in docs (the #82633 silent-success bug); the hand lane found it through issue search
- worse: `agentic` is deprecated in favour of `advanced`, and billing lag makes cost hard to watch per call

## open questions

- exact per-sku prices: read the parallel usage page or wait for all debits to settle and re-read the balance
- does `--mode advanced` (the non-deprecated name) behave the same as agentic
- would `--max-results 3` or `--excerpt-max-chars-total` keep the context cost near WebSearch's
- is fast slower only because it ran first (a cold start)? re-run the order reversed
- core vs `core-fast` / `pro-fast` (the default) on the same two questions

## vet log — one line per round, to 2026-10-01

- 2026-09-24 · search fast+advanced · 10 fleet lookups · 6/10 + 9/10 hits (websearch 9/10) · 4.4 s / 2.0 s · 3–60k chars per call · ~6¢ settled for 22 calls
- 2026-09-24 · research core · em-dash + self-wake questions · 4/5 + 5/5 · 95 s / 75 s · one answer each, ~4k chars · ~4¢ each (upper bound)
- 2026-09-24 · monitor create ×2 (lite, 1d) · cc #95589 + vhs #787 state · first events pending · balance 493¢ → 488¢ + 1¢ pending around the creates (search pending debits settled in the same window, so ≤5¢ for both)
- 2026-09-24 · search advanced ×2 inside the profile research · found 3 animated-banner projects websearch missed (ryme.md, GitBanner, svg-hero-prompt) · noise on the trophy/streak query · websearch stronger on specific facts (#4431, camo cache) · ≤1¢
- 2026-09-24 · monitor · vhs #787 closed 09:15Z, monitor created ~13:00 · hit: 1 event «closed as completed» on the first daily pass · pull-only: nothing notified cclio, the event surfaced only on `monitor events` at 23:20 · wiring needed: boot prefetch reads events, or a webhook (unprobed)
- 2026-09-25 · research core · art-studio tooling vs an opus agent · parallel 275 s, one report ~16k chars, 7/10 picks shared · opus 124 s, found 5 picks parallel missed (@thi.ng/geom, AccumulativeShadows, n8ao, custom-shader-material, the r3f react<19.4 peer) and dropped roughjs · opus wins on depth, parallel on cost · ¢ unsettled
- 2026-09-25 · research core #2 · art without an image model + three.js alternatives + zoom/pan · parallel 274 s, two versions stale (vgpu 0.3.1, rzpp 4.0.4 — npm says 0.5.0, 4.2.0), called the MiaAI showcase unverified · opus 127 s opened 8 showcase pages and found they use no library (the recipe is the look) · opus wins again on depth and currency · ¢ unsettled
- 2026-09-25 · research core #3 · zoom/pan ux for an image viewer · parallel 320 s, 8 kB, generic guidance, 2 hits on the load-bearing specifics (deltaMode, passive listeners), 0 on the library's additive zoom · opus 122 s read rzpp 4.2.0's own source and found the additive wheel + ignored deltaMode — the finding the brief turned on · opus again on depth; parallel adds nothing a brief used · ¢ unsettled
- 2026-09-26 · research core · product docs model (impeccable + spec tools + drift) · 3/5 (right at surface: init is an interview, surface briefs; found impeccable v4.4.0; no source-level facts, missed the hand-edit ban) vs opus 5/5 source read · 183 s · 7.8k chars · ~4¢ (upper bound)
- 2026-09-26 · research core · /verify in practice (uses, recipe lifecycle, cost, browser tools) · 5/5 (named the recipe-edit rule, v2.1.200/205, /run-skill-generator, anthropic's 07-22 workflow — all confirmed on the skills page) vs claude-code-guide 3/5 (missed the skills section) · 183 s · 8.2k chars · ~4¢ (upper bound)
- 2026-09-26 · research core · ui verify checks + tab navigation (q1) · 4/5 (axe 4.13.0 with target-size forced on, pa11y/lhci/unlighthouse versions, splitter is a tab stop per apg; no library source, generic tab walk) vs opus 5/5 (rrp 4.13.3 source: tabIndex spread after props, only `disabled` removes it; base-ui 1.8 composites already rove) · ~5 min · 14.5k chars · ¢ unsettled
- 2026-09-26 · research core · cursor pointer + error boundaries (q2) · 3/5 (added the thumb → grab nuance opus missed; no versions, a playwright snippet despite «decided against») vs opus 4/5 (tailwind 4.3.3 guide + restore snippet, react-error-boundary 6.1.6 d.ts, react 19 root options) · ~3 min · 10.4k chars · ¢ unsettled
