---
dies-when: parallel is adopted as a door or dropped after the test-drive period
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

## day-0 re-read — 2026-09-28 (`habit-test-drive`: the untried features before the verdict)

source: `docs/research/parallel.md`. tried so far: search fast/advanced, research core, extract, monitor (pull). untried, one real ask each before 10-01:
- search `basic` (longer excerpts) and `turbo` (~200 ms) — the beta `agentic` we used maps to `advanced`
- the **Responses API** — the synchronous door for a question someone waits on (effort low/medium/high, $0.01–0.25)
- research `lite` / `base` on a simple lookup — core is 2.5–5× the price
- a follow-up with `--previous-interaction-id` instead of a fresh run
- **FindAll** on the next list-shaped ask
- monitor **webhooks** — ours are pull-only; a webhook is the wake-up the boot digest lacks
- source policy (`include_domains`, `after_date`) on a docs-only question
- the official `parallel-agent-skills` plugin vs our raw cli
- 📌 an independent coding-agent benchmark (docs-implementation tickets) put Exa Deep at 83 % vs Parallel advanced 77 % — a rival to name at the verdict

## the exa rival lane — dima's yes, 2026-09-28

source: `docs/research/exa.md`. key `op://dev/exa-golden/credential` → `EXA_API_KEY` in `op.env` (empty at 09-28 02:35 UTC — dima pastes it; a reminder holds it). free tier: $10 a month + a one-time $10 onboarding bonus; search $0.007, deep $0.012, answer $0.005.
- 🚫 no official exa cli; exa's claude route is a plugin over its mcp server — cli over mcp, so the door is the REST api through `op-run`:
  `script/op-run.sh sh -c 'curl -s https://api.exa.ai/search -H "x-api-key: $EXA_API_KEY" -H "Content-Type: application/json" -d "{\"query\":\"<q>\",\"type\":\"auto\",\"contents\":{\"highlights\":true}}"'`
- the round: the same 5 real lookups through exa (`auto` + highlights, then `deep` on a miss), parallel (`advanced` search / `extract`) and context7, before 10-01. log per lookup: hit (the page needed in the top 3) · seconds · chars in ctx · ¢
- the benchmark to beat, read in full: exa deep 83 % vs parallel advanced 77 % on search+fetch for docs tickets, but exa was slower (37 s vs 33 s) and dearer ($0.127 vs $0.096 per task); search-only, perplexity led and exa fast was 66 %. context7 was not in it
- exa `/context` (code snippets from repos and docs) is the one feature parallel has no answer to — one of the 5 lookups goes there

## test-drive log — one line per round, to 2026-10-01

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
- 2026-09-27 · research core · cc auto-compact + long-running harness state (vectors 1–2 of long-running-context) · 4/5 (vector 1 near-complete: 967k, hook fields, 5k skill cap, env vars, the task list persists; added the openai codex 25 h case; wrong that the docs define no «Compact Instructions» `CLAUDE.md` section; missed context anxiety, manus, all papers, every fleet fact) vs my own lane 5/5 (docs read raw via `.md` urls, a local `compact_boundary` tally, 5 papers) · 274 s · 9.9k chars · ~4¢ (upper bound)
- 2026-09-27 · research core · BYT-61 monorepo in the ai era for dima's setup · hit, 4/5 (sourced + dated, the right verdict and the one change; missed the fleet's own FRM-261 evidence, which cclio added) · 183 s · 9.8k chars · ¢ not read
- 2026-09-28 · research core ×2 · crew-designer prior research (designer-skill practices + designer tools) · landed, ungraded — grade at the 09-28 boot beside an opus lane · ~3–4 min each · 9.8k + 7.9k chars · ¢ not read
- 2026-09-28 · exa round 0 · search `auto` + highlights, «claude code cloud sessions setup script docs» · hit #1: code.claude.com/docs/en/cloud-environments — the page cclio found by hand earlier that night · http 200 · ¢ not read
- 2026-09-28 · extract · browserbase.com/pricing (a js marketing page) · hit: all four plans with limits · 2 s · excerpt truncated at ~300 chars by default, `--full-content --json` gave the whole page · ¢ not read
- 2026-09-29 · research core · readaloud tts (siri replacement: quality ranks, free tiers, mac local, raycast toggle) · 4/5 (the full AA table with elo, fish s2.1 free to 11-30, chirp 1M/azure 500k free, a correct pgid toggle recipe; missed speak11 — the exact elevenlabs→kokoro-on-429 app — and the live raycast elevenlabs extension) vs opus 5/5 (both found, plus mlx vs fluidaudio head-to-head) · 275 s · 10.9k chars · ¢ not read
- 2026-09-29 · research core #2 · readaloud tech-text normalization + engine gaps (vs exa agent + opus) · 4/5 (unique: eleven v4 rides the text-to-dialogue api, v4 lists uk + ru, gemini uk absent, gemini 3.8 flash-lite; weak: quota error given as «400/401», no local probe) vs exa 5/5 (93 s, $0.10) and opus 5/5 (local runs) · 319 s · 18.2k chars · ¢ not read
- 2026-09-29 · research core · design process, 12 vectors (vs exa agent + opus sources + neuroarxiv + advise) · 4/5: the most sceptical lane — flagged the candycode process claim and the Galileo→Stitch story as unverified, a clean 8-step brief order; no source quotes, no versions beyond culori/apca · 283 s · 11.9k chars · ¢ not read
- 2026-09-29 · research core · Claude Design in Cowork vs CC · 4/5: the one lane that read the claude code changelog (v2.1.283 artifact-design wording, v2.1.284 design plan on the page) and corrected the «beta designers migrated» premise to design-system migration; thinner on handoff detail than exa · 194 s · 6.0k chars · ¢ not read

## monitor round — 2026-09-27 (dima: «let's test at full scale and measure the costs»)

the question: do monitors catch the changes we care about — a github issue's state, a comment, a label, a commit message — or only headline news? 10 monitors on top of the 4 live watches; graded on 2026-10-01 against ground truth. balance before: 462¢; creating the ten: 3¢ pending.

- `N1-npm-cc` · 1d · `monitor_4c4fac3b600c48f09211dbbda335d804` · truth: a claude code release lands most days → should fire within 1–2 d
- `N2-next-release` · 1d · `monitor_2039edea86544b4db53f045da7a4edc2` · truth: next.js ships canaries near-daily → should fire
- `N3-anthropic-news` · 1d · `monitor_25a13688af674c1280cf49aa12ba6b8d` · truth: a news post most weeks → likely fires by 10-01
- `T1-issue-closed` · 6h · `monitor_d814884021fb479eb9bc70dfa0f540f0` · truth: frame#48 closes 09-28 → must fire; latency measured at 6h
- `T2-issue-comment` · 6h · `monitor_9bc8030386ed4fa8893986efc688a8c7` · truth: a comment on frame#48 on 09-28 → must fire
- `T3-issue-label` · 6h · `monitor_4ced6e48cd954abaab0325261ab5e511` · truth: a label added to frame#48 on 09-28 → must fire (the subtle one)
- `T4-commit-msg` · 1d · `monitor_1381a44796ca40f79e00275885ec0d72` · truth: the first frame commit on 09-28 carries canary-monitor-ping → must fire
- `T5-renovate-pr` · 1d · `monitor_882342a5e21645c8a18372ce525e40a7` · truth: bytes gets its monday minors pr 09-28 09–12 kyiv if minors are pending → check gh for truth
- `T6-semver` · 1d · `monitor_c0a2d27fc68343b7bd3689555380db03` · truth: true only if pnpm ≥ 12.4.0 ships; `npm view pnpm time` is the truth
- `T7-negative` · 1d · `monitor_001f089b8fbb4ada989f0a1062b99b80` · truth: never happens → any event is a false positive

grading: per monitor — fired (y/n), latency from the real event, false positives, and the balance delta over the window. a monitor that never fires on a real event is a miss, never «quiet».
- 2026-09-28 · monitor · claude-code#90751 auto-fix default · created `a7467339` (1d, event_stream) — the second github-issue watch after the canary set
- 2026-09-29 · research core · the design drift research (4 lanes) · hit — the best academic coverage (SpecifyUI, Design2Code, UI-Bench, SmartUI) and an explicit 10 %-trigger cost model, dates checked · 228 s · 14.9k chars · ¢ unsettled · 4/5 (slowest lane)
- 2026-09-30 · research core · svg: official logo sources + svg in react (3 lanes) · hit — resolved all 10 names on the svgl API (670 logos, 287 software), Lighthouse dom-size thresholds (800/1400), sceptical on versions (flagged the inconsistent npm pages instead of asserting one) · 228 s · 17.1k chars · ¢ unsettled · 4/5 (slowest; no probe of what each set serves)
- 2026-09-30 · monitor round preview (grade due 10-01) · 1 of 10 fired: N2 next.js release (09-29) · MISSED: T1 closed, T2 comment, T3 label on frame#48 (all true 09-28 11:51Z, 6h monitors ran through 09-30 11:03Z), T4 commit msg, N1 claude code npm release (ships near-daily), N3 anthropic news · T7 negative: 0 (correct) · read: event_stream monitors watch indexed web news; a low-traffic repo issue is invisible to them (the vhs #787 hit on 09-24 was a popular repo). github state watches belong on `gh api`, not a web monitor
- 2026-09-30 · research core · word highlight while reading aloud (3 lanes) · hit, but generic — same two-tier verdict as exa, no named repos or numbers · 455 s (slowest) · 12.0k chars · ¢ unsettled · 3/5 vs the opus source lane 5/5 (found kokoro computes and drops word timestamps, the normalize offset blocker, cotabby as the AX overlay reference)
- 2026-09-30 · monitor round **graded** (the canary) · real events 6, caught 1: N2 next.js release ✅ (6 events) · missed: N1 claude code npm (4 releases since 09-27), T1 closed + T2 comment + T3 label on frame#48, T4 commit message · N3 anthropic news: truth not checked · correct silences: T5 (no renovate pr 09-28), T7 negative · T6 not gradable (pnpm 12.4.0 shipped 09-08, before the monitor) · verdict: parallel monitors see indexed headline news only — a release page of a big project, never an npm version, a low-traffic repo's issue state or a commit. github targets moved to the boot's gh watch (09-30); npm versions belong on `npm view` in a watch script. all 10 canary monitors cancelled at the grade
- 2026-10-01 · research core · why the jev skill router fails (3 lanes) · hit, the most sceptical: a Wilson interval on 25/34, warns that router error and agent load error are mixed in one verdict, «label the minimum sufficient skill set», compare against a no-suggestion baseline · 138 s · 5.1k chars · ¢ unsettled · 4/5 vs the opus source lane 5/5
- 2026-10-01 · research core · agent-first cli with a charm-grade look (3 lanes) · hit, sceptical again: «no defensible measured win» for cli rag, the unique find = the opencode issue on an eager opentui import breaking headless commands (lazy-load the tui) · 228 s · 13.2k chars · ¢ unsettled · 3.5/5 vs the opus source lane 5/5
- 2026-10-01 · research core · a plan adviser model (4 lanes) · hit, sceptical: «ask a question rather than present the plan as settled» (assertion framing raises agreement), cost per useful finding as the metric · 229 s · 11.7k chars · ¢ unsettled · 4/5 vs the opus source lane 5/5
- 2026-10-01 · research core · design review comms (2 lanes) · hit, agreed with exa; added «defer» as always-available and same-scale alternatives · 138 s · 11.2k chars · ¢ unsettled · 4/5
- 2026-10-02 · research core · design-ballot prior art (3 lanes) · hit, sceptical: approval fatigue (93 % of prompts approved) as a warning on Enter = recommended, batch-then-notify from github reviews, Figma pins skip nested layers · 183 s · 11.2k chars · ¢ unsettled · 4/5 vs the opus source lane 5/5
- 2026-10-02 · research core · speak pre-build libs (3 lanes) · hit, sceptical: gemini alignment not to be assumed, permission loss across signing identities, motion never as the audio clock · 228 s · 11.4k chars · ¢ unsettled · 3.5/5 vs the opus source lane 5/5
- 2026-10-02 · research core · richer motion-broll (3 lanes) · hit: the clearest ranking (scene archetypes + real product evidence first, style frame before code), HyperFrames named the closest engine · 228 s · 15.2k chars · ¢ unsettled · 4/5 vs the opus source lane 5/5
- 2026-10-04 · research core · same mods brief · 16.8k chars, zero repo links, generic · grade 1/5 vs exa 3, opus 5
- 2026-10-04 · research core · same holds brief · hit: agent-coord as closest match with its exact TTLs and fail-open, Dibs (sqlite leases, pushed today), «SessionEnd is not cleanup» · 228 s · 13.0k chars · ¢ unsettled · grade 4/5 vs exa 4, opus 4 (opus: deepest api read, missed both deny hooks)
