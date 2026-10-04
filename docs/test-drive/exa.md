---
dies-when: exa is adopted as the research door (replacing or beside parallel) or dropped after the test-drive period
---

# exa — test drive (research door, parallel's challenger)

Ticket: none

**why:** dima 2026-09-29: «our second vet candidate for a research tool, possibly replacing parallel ai, so it has to be added to a vet list and be fully tested, same as parallel». the verdict is head-to-head with `parallel.md`, same asks, same grades.

**door:** REST through `op-run`, key `op://dev/exa-golden/credential` → `EXA_API_KEY` in `op.env`. no mcp (cli over mcp), no sdk install needed — `curl` + `jq`. the OpenAPI spec (`exa.ai/docs/exa-spec.yaml`) is the source of truth; the docs index is `docs.exa.ai/llms.txt`.

**price:** pay-as-you-go; free tier $10 a month, reset on the 1st, no card (+$10 one-time onboarding bonus). search from $4 / 1k · deep search $12–15 / 1k · contents $1 / 1k pages · answer $5 / 1k · monitors $15 / 1k · agent usage-based.

## day 0 — the full map (2026-09-29, two passes: docs + users)

### products

### search family — `POST /search`

- search `instant` · `type:"instant"` · real-time paths, autocomplete, voice, ~250 ms · $4/1k requests (≤10 results) · the cheapest door; openbenchmarks measured it ~4 points below `fast` on dev questions
- search `fast` · `type:"fast"` · latency-sensitive search, ~450 ms · $7/1k · artificial analysis: faster per call than `auto` but costs MORE per agent task (more searches, ~392k vs ~299k model tokens)
- search `auto` (default) · `type:"auto"` · best default quality/speed, ~1 s · $7/1k · the one to benchmark head-to-head with parallel search
- deep search `deep-lite` · `type:"deep-lite"` · light query expansion + synthesis, ~4 s · $12/1k · the nevermined page lists it at $10/1k, the pricing page and x402 at $12 — docs disagree
- deep search `deep` · `type:"deep"` · iterative multi-search + evidence check + synthesis, 4–15 s · $12/1k · 5 QPS, not 10
- deep search `deep-reasoning` · `type:"deep-reasoning"` · hardest research, 12–40 s · $15/1k · replaced the retired `/research` endpoint (2026-04); exa itself says «use Agent instead»
- extra results · `numResults` up to 100 (default 10) · wider recall · +$1/1k results above 10 · no pagination at all
- structured synthesis · `outputSchema` (`type:"text"` or `type:"object"`) · generated answer or json in `output.content` + field-level citations/confidence in `output.grounding` · no extra charge listed, +~2 s · object schema capped at **10 properties total, 2 nesting levels**, every array needs `items`, else 400; never add citation fields yourself (measured: a `source` field came back as prose, not a url — the urls live in `grounding`)
- `systemPrompt` · steers source preference, novelty, dedup in synthesis/deep · free
- `additionalQueries` · up to 10 extra query variants · deep types only
- `stream:true` · sse of the synthesis · only with `outputSchema`, else ignored
- `category` · `company` · `people` · `publication` · `news` · `personal site` · `financial report` · vertical-tuned retrieval · no surcharge · `company`/`people` reject `startPublishedDate`/`endPublishedDate`/`excludeDomains` with 400; `publication` replaced `research paper` (350M papers, 2026-07); `pdf`, `github`, `tweet` are deprecated; any other string is accepted as a soft hint
- filters · `includeDomains` / `excludeDomains` (≤1200 each, path prefixes like `anthropic.com/news`, `*.substack.com` wildcards) · `startPublishedDate` / `endPublishedDate` · hard constraints · free · narrow date windows silently return empty (user report); `includeText`/`excludeText` and `start/endCrawlDate` are deprecated (crawl dates silently ignored)
- `userLocation` · 2-letter country · localised ranking · free
- `moderation` · unsafe-content filter · free
- `compliance:"hipaa"` · enterprise-only, cache-only retrieval
- data verticals (no separate endpoint, reached through query wording + category): news (minutes-fresh), code & docs (repos, api docs, package registries «with precise version and release details», agent-skill directories), companies & people (1B+ profiles, fine-tuned company retrieval), financial markets (filings, earnings calls, CPI), research publications (papers, patents, grants, clinical trials), legal & public records (case law, sanctions, gov contracts), sports/weather/places, cybersecurity (CVE/GHSA, advisories, subprocessor lists)

### contents options — on `/search` inside `contents:{}`, on `/contents` at top level

- `highlights` · `true` or `{query, maxCharacters}` · query-focused extractive excerpts, exa's recommended default · free for the first 10 search results, else $1/1k pages · **measured: bare `highlights:true` on 10 `auto` results returned ~60k chars (~6k per page)** — «token-efficient» is relative; `maxCharacters:800` gave ~11 kB total
- dynamic highlights · `highlights:{dynamic:true, verbosity:low|medium|high}` · one shared budget across the whole result set · same price · research preview, needs header `Exa-Beta: dynamic-highlights-2026-08-28`, incompatible with `maxCharacters`
- `text` · `true` or `{maxCharacters, verbosity:compact|standard|full, includeSections, excludeSections, includeHtmlTags}` · clean markdown of the page · $1/1k pages per content type · default cap is huge (open-webui users hit 1M-char pages); always set `maxCharacters`
- `summary` · `{query, schema}` · an llm call per page, prose or json-string by schema · $1/1k pages on top · adds latency per result
- `extras` · `links`, `imageLinks`, `richImageLinks`, `richLinks`, `codeBlocks` counts · page links, images, code blocks · free
- `subpages` + `subpageTarget` · crawl N linked subpages, prioritised by terms like `["api","changelog"]` · billed per page
- freshness `maxAgeHours` · omit = cache then fetch · `0` = always live fetch · `N` = refetch if older than N h · `-1` = cache only · no surcharge listed · pair with `livecrawlTimeout` (ms, default 10000; 12–15 s for slow sites); `livecrawl` enum is deprecated, never send both
- snapshot · `snapshotAsOf` (iso date/datetime) · page as stored at a past instant, reproducible evals, «what did the pricing page say in july» · 10 QPS, rolling **5-month** window, **after 100 requests «talk to sales»** · auto/fast/instant only (no deep, no `category`); `maxAgeHours`/`livecrawl*`/`subpages` alongside it → `INVALID_REQUEST`; missing pages come back as `CONTENT_NOT_CACHED`
- `statuses[]` · per-url `success`/`error` + `source: cached|crawled` · lets a round record whether it was a live fetch

### contents — `POST /contents`

- contents · `{urls|ids, text|highlights|summary, …}` · extract known urls, js-rendered pages and pdfs handled · $1/1k pages **per content type** (text + highlights = 2) · no `contents` wrapper, no `stream`, no `useAutoprompt`; 100 QPS; measured 0.38 s for 3 cached urls

### answer — `POST /answer`

- answer · `{query, text, stream, model, systemPrompt, outputSchema, userLocation}` · search + llm answer with `citations` · $5/1k · `model` enum `exa` · `exa-pro` · `exa-research` · `exa-fast` — the pricing page gives one flat rate, per-model pricing is not documented (probe it); `outputSchema` here is json-schema draft-07, no 10-property cap mentioned

### findSimilar — `POST /findSimilar`

- findSimilar · `{url, …same filters/contents}` · «pages like this url» · priced as search · **deprecated in the spec** («prefer `/search` with a query describing the source»), gone from the docs index; still worth one probe since «find apps like X» is a real ask of ours

### agent — `POST /agent/runs` (+ `GET /agent/runs/{id}`, `GET /agent/runs`, `/cancel`, `/stop`, `DELETE`, `GET /{id}/events`)

- agent run · `{query, systemPrompt, effort, outputSchema, input:{data, exclusion}, previousRunId, metadata, dataSources, budget}` · async multi-step research, list building, enrichment; returns `output.text`, `output.structured`, `output.grounding`, `costDollars`, `stopReason` · price by effort below · 5 QPS starts (each start counts as 2 requests), **50 concurrent runs**, polling GETs are free of QPS
- effort `minimal` · $0.012 flat · 1–2-field lookups · measured: 40 s, 3 searches, 0 ACU, a good cited 10-item list
- effort `low` · $0.025 flat · simple lookups
- effort `medium` · $0.10 flat · «default starting point» for single-entity research
- effort `high` · $0.50 flat · harder research, more citations · vendor claim: BrowseComp 74 % at $0.50 vs parallel task ultra8x 58 % at $2.40 (not independently reproduced)
- effort `xhigh` · $1.00 flat · slowest fixed effort
- effort `auto` (the default!) · metered: $0.10/ACU + $0.005/search + $0.02/email + $0.07/phone, default cap **$5** · variable-scope lists · ⚠️ omitting `effort` means metered up to $5 — on a $10/month free tier one careless call can eat half the month
- effort `ultra` · metered, same rates, default cap **$20** · exhaustive lists, ~30 min typical, up to 3 h · a single default ultra run exceeds our whole free month; must carry `budget.maxCostDollars` ($1 minimum)
- `budget.maxCostDollars` · $1–$100 · **auto and ultra only**; a fixed effort + budget → 400 (measured by cclio today)
- `budget.maxDurationSeconds` · 300–10800 · **ultra only**; ends with `stopReason:"time_limit_reached"`
- stop · `POST /agent/runs/{id}/stop` · keep partial results, bill to the stop · ultra only; `/cancel` discards
- `stopReason` · `schema_satisfied` · `budget_reached` · `time_limit_reached` · `stopped` · `error` · `cancelled` · `schema_satisfied` still allows nulls in required fields — shape, not facts
- `outputSchema` · full json schema (draft-07 / 2019-09 / 2020-12) · structured rows · make unverifiable fields nullable and use a `cannot_verify` enum so the agent never fabricates; bound arrays with `maxItems`
- `input.data` / `input.exclusion` · enrich our rows / never return these · the exclusion is «not a strict identity guarantee»
- `previousRunId` · follow-up «10 more» / «narrow to X» without resending output · new run id each time; unavailable under ZDR
- events · `Accept: text/event-stream` on create for live sse (`agent_run.created|started|completed|failed|cancelled`, plus `source.added`, tool progress with `callId`); `GET /events` replays stored events (json or sse, `Last-Event-ID`) and closes, it does not follow a live run · `source.added` is a preview, `output.grounding` is authoritative
- measured quirk: `startedAt` came back `null` on a completed minimal run — time rounds from `createdAt`→`completedAt`
- agent via openai responses · `POST /responses`, `model:"exa-agent"`, `reasoning.effort`, `stream` / `background`, `GET /responses/{id}`, `/cancel`, `previous_response_id` · same prices · `high`/`xhigh`/`ultra` synchronous → 400; **no `budget` field**, so ultra here always runs to its $20 default cap

### exa connect — `dataSources:[{provider}]` on an agent run

- `fiber` · b2b companies, people, linkedin, contact reveal · $0.02/credit (search 2 + 1 per result, contact 2–5) · no-match calls free
- `similarweb` · traffic, rankings, competitors · $0.30/credit, 1–15 credits a call · pricey
- `baselayer` · us kyb, officers, liens, litigation, watchlists · $0.10–$4.00 per order
- `polymarket` · prediction-market odds, books, positions · free (agent cost only)
- `macrobond` · macro time series, release calendars · free
- `affiliate` · product catalogs across merchants · $0.015/call
- `particle` · **podcast transcripts**, 100k+ shows, speaker + timestamps · $0.015/call · the one that maps straight onto our «podcast mentions» ask
- `financial_datasets` · 27k us tickers, filings, fundamentals · $0.01/call
- `jinko` · flights and hotels, live prices · $0.005/call
- on request only: crunchbase, definitive healthcare, faraday, harmonic, intellizence, kernel, zoominfo
- gotcha: attaching a provider does not force a call — name the source in `query`/`outputSchema` («from Particle») or the agent may skip it; not available under ZDR; docs never say whether fixed efforts may use connect (probe)

### monitors v1 — `POST /monitors` (+ list, get, update, delete, `/trigger`, `/batch`, `/{id}/runs`, `/{id}/runs/{runId}`)

- monitor · `{name, search:{query, numResults, include/excludeDomains, contents}, trigger:{type:"interval", period:"1h|6h|1d|7d"}, outputSchema, metadata, webhook:{url, events}}` · recurring search, dedup against earlier runs, new results + synthesized `output.content` · **$15/1k runs** (+$1/1k extra results, +$1/1k summaries) · ⚠️ `webhook` is **required**, https, no localhost/private ip, no redirects; minimum interval 1 h, runs may slip 30 min, overlapping runs cancel the older; `webhookSecret` is shown once (hmac-sha256 over `t.body`, header `Exa-Signature`); omit `trigger` for a manual-only monitor
- trigger · `POST /monitors/{id}/trigger` · run now, works while paused · $0.015
- runs · `GET /monitors/{id}/runs` · poll output without a webhook receiver — the webhook url still has to exist at create time
- batch · `POST /monitors/batch` · delete/pause/unpause by filter · `dryRun` defaults to `true`

### websets — `/v0/websets/*` (searches, enrichments, items, preview, imports, monitors v0, webhooks, events, teams/me)

- webset · `POST /v0/websets` with `search:{query, count, criteria, entity}`, `enrichments[]`, `imports[]` · verified entity lists with per-criterion `satisfied: yes|no|unclear` · billed in **separate Websets credits on a paid Websets plan** (users cite $49/mo for 8k credits) · ⚠️ **not usable on our free API tier**; exa itself now says «new list-building work → Agent»
- preview · `POST /v0/websets/preview` · shows entity type, generated criteria, enrichment columns before spending · consumes credits too
- enrichments · formats `text|date|number|options|email|phone|url`
- imports · csv or another webset as the seed list; fails with `invalid_format|invalid_file_content|missing_identifier`
- websets monitors (v0) · `POST /v0/monitors`, `cadence:{cron, timezone}` at most **once per day**, behavior `search` (append/override) — a different api from v1 monitors
- webhooks + events · 19 event types (`webset.item.enriched`, `monitor.run.completed`, …), signed deliveries, attempt log, `GET /v0/events` pull
- `GET /v0/teams/me` · websets concurrency usage and limits

### batch — `POST /batches` (+ get, list, cancel, delete)

- batch · jsonl of `/search` and `/agent/runs` items with `customId`, results via short-lived `resultsUrl` · price = the items · **enterprise only**, beta header `Exa-Beta: batches-2026-06-06` · not reachable for us

### openai-compatible

- chat completions · `POST /chat/completions`, `model:"exa"` · routes to `/answer` · $5/1k · lets any openai-sdk tool use exa as a «model»
- responses · `POST /responses`, `model:"exa-agent"` · routes to agent (see above)

### keyless payments — `/search` and `/contents` only

- x402 · no key, pay per call in usdc on base or solana, `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` headers · same prices, but **capped at 10 results**
- world agentkit · human-backed agents get **100 free requests/month per verified human per endpoint**, then x402
- mpp (tempo) · usdc.e on tempo, `WWW-Authenticate: Payment` challenge
- nevermined · card delegation buys a normal api key in $7 steps via `admin-api.exa.ai/team-management/nevermined/purchase-key`
- any `x-api-key`/`Bearer` header bypasses all of these — irrelevant to us unless we want a keyless cloud-agent door

### team management — `https://admin-api.exa.ai/team-management` (separate spec)

- api keys · create / list / get / update (name, rate limit) / delete · per-key budgets (a key over budget returns 402)
- key usage · `GET …/api-keys/{id}/usage?start_date&end_date` · authoritative billed cost, 180-day lookback · **the clean way to settle a test drive's $ per round** — but the api is «enabled per team» with a service key; ask exa support or read the dashboard instead
- teams, invites, zdr (enterprise), hipaa (enterprise)

### limits and billing

- free tier · $10 credits, reset to $10 on the 1st (no rollover), plus a **one-time $10 onboarding bonus** that does not expire (check the dashboard: finish onboarding if not done)
- qps · `/search`, `/answer`, `/chat/completions` 10 · deep types 5 · `/contents` 100 · `/agent/runs` and `/responses` 5 + 50 active · `/websets/*` 20 · team-wide across keys
- errors · 402 out of credits or key budget · 429 with `Retry-After` · agent codes `CONCURRENCY_LIMIT_REACHED`, `PREVIOUS_RUN_NOT_COMPLETED`, `INVALID_OUTPUT_SCHEMA`, `INVALID_DATA_SOURCE`, `TIMEOUT`
- every response carries `costDollars` (search: `total` + `search.neural`; contents: per content type; agent: `agentCompute`, `search`, `emails`, `phoneNumbers`) and `requestId` — the per-round $ comes for free
- the hosted mcp (`mcp.exa.ai/mcp`, tools `web_search_exa`, `web_search_advanced_exa`, `web_fetch_exa`, `agent_run`) has a keyless tier of 3 QPS / 150 calls a day — we stay on rest, noted only as a fallback

### strong / weak

- 💪 factual lookup: exa `fast` 99.3 % vs parallel 93.3 % accuracy, answer recall@5 99.3 vs 92.0 — [openbenchmarks parallel vs exa](https://openbenchmarks.com/web-search/parallel-vs-exa)
- 💪 hard retrieval with search+fetch: exa `deep` 83.0 % and `auto` 81.7 % task completion vs parallel advanced 77.0 %; exa auto median task 23 s vs parallel 30 s — [openbenchmarks parallel vs exa](https://openbenchmarks.com/web-search/parallel-vs-exa)
- 💪 artificial analysis search index: exa auto 74 vs parallel advanced 75 (a tie), exa best on omniscience accuracy (70), and 26 s per task vs 36 s — [artificial analysis](https://artificialanalysis.ai/articles/search-api)
- 🩹 same index: exa auto spends $65.57 search + $61.58 model per 1k tasks vs parallel advanced $47.93 + $35.58 — exa is ~50 % dearer per task, partly by feeding the model more tokens — [artificial analysis](https://artificialanalysis.ai/articles/search-api)
- 🩹 multi-hop: parallel basic F1 46.5 vs exa deep 45.4, and parallel's median agent run is cheaper ($0.42 vs $0.65) — [openbenchmarks deep research](https://openbenchmarks.com/web-search/best-web-search-api-for-ai-agents-for-deep-research)
- 🩹 list price per plain search: parallel $1/1k (turbo/fast) vs exa $7/1k — [openbenchmarks parallel vs exa](https://openbenchmarks.com/web-search/parallel-vs-exa)
- 🩹 dev questions: exa fast 66.3 % vs perplexity 77.3 %, and exa returns ~22k tokens per task vs ~12k for parallel fast — [openbenchmarks developers](https://openbenchmarks.com/web-search/best-web-search-api-for-developers)
- 💪 semantic discovery: finds obscure repos and «things like X» from vague descriptions; Cursor and AWS run it as their default search backend — [buildfastwithai review](https://www.buildfastwithai.com/ai-tools/exa)
- 🩹 freshness: FreshQA 24 % on time-sensitive queries (vendor-comparison number from a competitor's table), a smaller index than google, and users pair it with a separate scraper — [buildfastwithai review](https://www.buildfastwithai.com/ai-tools/exa)
- 🩹 fetch currency: the same url returned different postgresql versions from exa contents and parallel extract, both «successful» — [capability matrix, artificial curiosity labs](https://artificialcuriositylabs.ai/posts/2026-09-12-capability-matrix-for-agent-search-apis/)
- 🩹 context blow-up: one three-result mcp advanced search returned 143,378 chars; open-webui mapped full text and hit 1M-char pages — [capability matrix](https://artificialcuriositylabs.ai/posts/2026-09-12-capability-matrix-for-agent-search-apis/), [open-webui #23900](https://github.com/open-webui/open-webui/discussions/23900)
- 💪 agent ultra claims 81.4 % on WANDR vs opus 5.5 72.3 %, at $18.53 median per task — vendor numbers, not reproduced — [exa agent ultra blog](https://exa.ai/blog/exa-agent-ultra), [eesel review](https://www.eesel.ai/blog/exa-agent-ultra)
- 💪 positioning by a rival: «exa is search-centred, parallel is workflow-centred» — exa for finding sources fast, parallel for structured cited outputs — [tavily: exa vs parallel](https://www.tavily.com/blog/exa-vs-parallel-benchmarking-retrieval-apis-for-ai-agents-in-2026)
- 🩹 hosted mcp: timeouts and cloudflare 520s while the rest api worked; clients with a 5 s timeout fail — [opencode #6878](https://github.com/anomalyco/opencode/issues/6878) — one more reason we stay on rest
- 🩹 narrow date windows return empty with no error; `company`/`people` + date filter is a 400 — [exa-known-pitfalls skill](https://github.com/jeremylongshore/claude-code-plugins-plus-skills/blob/main/plugins/saas-packs/exa-pack/skills/exa-known-pitfalls/SKILL.md)
- 🩹 burst calls: an agent harness had to add a 1 s pacing throttle between exa requests — [oh-my-pi #3272](https://github.com/can1357/oh-my-pi/pull/3272)
- 🩹 consumption pricing is hard to forecast at agent volume — [product hunt reviews](https://www.producthunt.com/products/exa-ai/reviews)

### stress list

one real ask per feature, widest over deepest. «records» = the fields of the measurement protocol below, plus the extras named.

- **search `auto` + highlights**
  - twin: `parallel-cli search` (advanced)
  - ask: «what changed in the latest pnpm major — breaking changes» (a dependency changelog)
  - records: s, $, chars, hit, grade, and whether the changelog page itself is in the top 3
- **search `instant` / `fast`**
  - twin: `parallel-cli search` (turbo/fast)
  - ask: the same pnpm query, three tiers back to back
  - records: s per tier, chars, grade drop vs `auto`
- **`numResults:25` + dynamic highlights (beta header)**
  - twin: none (parallel has an excerpt cap only)
  - ask: «vendor pick: hosted tts apis with a free tier» (the speak lane's live question)
  - records: chars vs plain highlights on the same query, grade, $ above 10 results
- **`category:"publication"`**
  - twin: `parallel-cli search` with an academic objective
  - ask: «papers on llm agents supervising stronger agents / scalable oversight» (an architecture choice)
  - records: hit = ≥3 real papers with arxiv ids, s, $
- **`category:"company"` / `"people"`**
  - twin: `parallel-cli findall` (entity search)
  - ask: «who maintains jotai-devtools and what company backs it» / «companies building hosted agent browsers»
  - records: hit, grade, 400s hit while probing filters
- **code & docs vertical (plain query)**
  - twin: `parallel-cli search`
  - ask: «vite 8 migration guide: removed config options»
  - records: does a docs page or a registry page rank first, chars
- **`outputSchema` on `auto` (≤10 props)**
  - twin: `parallel-cli research run --processor core` (structured output)
  - ask: «pricing of parallel.ai vs exa vs tavily as json: product, unit, price, free tier»
  - records: s, $, schema valid y/n, grounding urls per field
- **deep `deep-lite` / `deep` / `deep-reasoning`**
  - twin: `parallel-cli research run --processor core`
  - ask: «build-or-buy for a local tts engine: kokoro vs piper vs say on macos» (a tool pick), same prompt on all three
  - records: s, $, grade per tier, the tier where grade stops rising
- **`additionalQueries` + `systemPrompt`**
  - twin: none
  - ask: the deep tts query with 3 distinct angles («latency benchmark», «voice quality reviews», «apple silicon support»)
  - records: grade delta vs the same deep call without them
- **contents `text` on a js-rendered docs page**
  - twin: `parallel-cli extract`
  - ask: one spa docs page we actually read (a linear or raycast api reference page)
  - records: s, $, chars, is the main body present (y/n), `statuses[].source`
- **contents `maxAgeHours:0` + `livecrawlTimeout`**
  - twin: `parallel-cli extract` (fresh fetch)
  - ask: a github release page published today, cached vs `0`
  - records: s both ways, `source: cached|crawled`, did the fresh one show the newest version
- **contents `subpages` + `subpageTarget:["changelog","release"]`**
  - twin: none
  - ask: a tool's docs root → find its changelog page (e.g. jotai-devtools)
  - records: pages billed, $, did it reach the changelog
- **contents `summary` with `schema`**
  - twin: `parallel-cli extract` + an objective
  - ask: pull `{version, date, breaking[]}` out of one release-notes url
  - records: s, $, json valid, accuracy vs the page
- **`extras.links` / `codeBlocks`**
  - twin: none
  - ask: a readme with install snippets — get the code blocks only
  - records: chars saved vs full text
- **snapshot `snapshotAsOf`**
  - twin: none
  - ask: «what did exa's own pricing page say on 2026-07-01» vs today
  - records: hit, `CONTENT_NOT_CACHED` rate; 📌 a 100-request trial cap, spend ≤3
- **answer `/answer` (models `exa`, `exa-fast`, `exa-pro`, `exa-research`)**
  - twin: none in our cli (parallel has a chat api we do not use)
  - ask: «does the linear cli support `issue comment add`, and since which version» (a factual lookup)
  - records: s, $ per model (the pricing page shows one rate — confirm), citations present, grade
- **findSimilar (deprecated)**
  - twin: none
  - ask: «apps like raycast» from `https://raycast.com`
  - records: hit, $ — and vs the same ask as a `/search` query, since exa says that replaces it
- **agent `minimal` / `low` / `medium`**
  - twin: `parallel-cli research run --processor core`
  - ask: «vendor pick: exa vs parallel pricing and limits for a solo dev» (cheap, verifiable)
  - records: s (created→completed), $ (flat), searches, grade
- **agent `high` / `xhigh`**
  - twin: `parallel-cli research run --processor ultra`
  - ask: one real architecture research, e.g. «prior art for a jev-style skill router: small classifiers gating tool loading»
  - records: s, $, citations count, grade; 📌 $0.50 / $1.00 each — one of each at most
- **agent `auto` with `budget.maxCostDollars:1`**
  - twin: `parallel-cli findall`
  - ask: «list 20 macos menu-bar apps like x-ray / raycast extensions for launchd» (list building)
  - records: s, $ actual vs cap, `stopReason`, rows returned, rows valid
- **agent `outputSchema` + `input.data` enrichment**
  - twin: `parallel-cli research run` with input rows
  - ask: our 10 live test-drive tools as rows → add `{pricing_url, free_tier, latest_version}`
  - records: fill rate, nulls, wrong cells, $
- **agent `input.exclusion` + `previousRunId`**
  - twin: none
  - ask: «10 more» on the list-building run, excluding the first 20
  - records: dupes returned, $, s
- **agent sse events + replay**
  - twin: none
  - ask: any medium run streamed, then `GET /events` replayed
  - records: time to first event, whether `callId` groups make a readable trace
- **agent ultra with `budget:{maxCostDollars:1, maxDurationSeconds:300}` + `/stop`**
  - twin: `parallel-cli research run --processor ultra`
  - ask: «every open-source tts engine that runs on apple silicon» (exhaustive list)
  - records: $, s, `stopReason`, rows; 📌 hard $1 cap, one run only
- **connect `particle`**
  - twin: none
  - ask: «podcast mentions of Claude Code or cclio-style agent fleets in 2026» (podcast mentions)
  - records: particle calls billed, mentions with timestamps, $
- **connect `fiber` / `financial_datasets` / `polymarket` (one each, free or cents)**
  - twin: none
  - ask: a people lookup (fiber), a public company's last earnings (financial datasets), odds on a tech event (polymarket)
  - records: did the provider fire (visible in events), $, grade
- **monitors v1**
  - twin: `parallel-cli monitor`
  - ask: «new comments or state change on claude-code #95589» (watching a github issue) — needs a public https webhook; create with a throwaway receiver or a dummy url and read `GET /runs`, `trigger` manually
  - records: first-run latency, dedup correct across 2 triggers, $ per run ($0.015)
- **openai `/chat/completions` (`exa`) and `/responses` (`exa-agent`, `background:true`)**
  - twin: none
  - ask: the same factual question through both, vs native `/answer` and `/agent/runs`
  - records: parity y/n, s, $
- **cost ledger via team-management usage api**
  - twin: parallel's balance delta
  - ask: settle the week's $ per round
  - records: whether the api is enabled for us; else the dashboard number
- **not testable on our plan (named, not skipped silently):** batch (enterprise), websets (paid Websets plan), zdr/hipaa (enterprise), x402/mpp/agentkit/nevermined (need a wallet or card delegation — out of scope unless a keyless cloud-agent door becomes a want)

### measurement protocol

one line per round in `docs/test-drive/exa.md`, the same fields `docs/test-drive/parallel.md` uses, so the two logs diff cleanly.

- **same ask, both doors, same turn** — exa call and its parallel twin fired back to back with the ask text verbatim; order alternates round to round
- **seconds** — wall clock of the http call (`curl -w %{time_total}`); agent and research runs: `createdAt`→`completedAt` from the run object (exa's `startedAt` can be null), plus our own wall clock including polling
- **$** — exa: `costDollars.total` from the response, exact per call; parallel: the balance delta before/after, settled later; both marked «list» or «billed»
- **chars in context** — the bytes that would enter the model: `jq` the excerpts/highlights/text/output only, not the whole json envelope; record the raw response size beside it
- **hit** — y/n: did the answer to the ask appear with a working source url
- **grade 1–5** — one read by the session that asked, blind where cheap (label outputs a/b before reading):
  - 5 — correct, complete, primary sources, usable as-is
  - 4 — correct, one gap or one secondary source
  - 3 — partly right, needs a follow-up call
  - 2 — mostly noise, one useful lead
  - 1 — wrong or nothing
- **extras when the feature has them** — `stopReason`, rows returned / valid, schema valid y/n, `source: cached|crawled`, provider fired y/n
- **tie-breaks** — equal grades → the cheaper $; equal $ → the smaller chars; always name the dimension that decided
- **budget guard** — every agent call carries an explicit `effort`; metered efforts always carry `budget.maxCostDollars:1`; the log keeps a running exa total against the $10 month (plus the one-time $10 bonus if claimed)
- 📌 a live vendor figure is a measurement of that day — the log line carries its date, the verdict carries the totals

📌 day-0 gotcha (measured): `budget.maxCostDollars` works only for metered efforts and `maxDurationSeconds` only for `ultra` — a medium run with a budget is a 400. every agent call sets `effort` explicitly: no effort = metered `auto` with a $5 cap.

## log — one line per round

date · feature · ask · hit · seconds · chars · $ · vs parallel / opus

- 2026-09-28 · search round 0 · «claude code cloud sessions setup script docs» · hit #1 code.claude.com/docs/en/cloud-environments · http 200 · $ not read (also logged in `parallel.md`)
- 2026-09-29 · agent run (effort medium) · readaloud round 2 (tech-text normalization per engine, gemini/elevenlabs gaps, kokoro latency, uk/ru, playback) · 5/5 on the load-bearing asks: elevenlabs 402 `insufficient_credits` vs 429 body shape, the websocket's [120,160,250,290] char schedule and no-v3, gemini 3.8 8k-token input + wav default + 30 voices, fluidaudio's own bench (241 ms p50, 31×, not streaming), apple's [[char LTRL]] / [[slnc]], kokoro has no uk/ru, lesya/milena system voices, NLLanguageRecognizer · every claim grounded per field, unverifieds labelled (v4 api, gemini rpd, mlx ttfa) · 93 s · 20.4k chars · $0.10 (agentCompute 0.04 + search 0.06) · vs parallel core 4/5 (319 s, 18.2k chars, ¢ not read — added v4 rides the text-to-dialogue api and v4 lists uk+ru, but a vague quota error shape) and opus 5/5 (297 s, ran misaki + avspeech ssml + NLLanguageRecognizer locally; found v4 on the free plan) · exa: fastest, cheapest, readable $; missed v4-on-free and uk absent from gemini (said «likely») · day-0 gotcha: `budget` 400s on medium effort
- 2026-09-29 · answer · fish audio s2.1-pro-free terms (cap, card, training, streaming, uk/ru, post-promo price) · hit, 6/6 sub-questions answered with 8 citations (fish blog + docs + a docs commit) · 2 s · ~0.8k chars · $0.005 · no parallel twin; one call replaced a research lane
- 2026-09-29 · day-0 wide pass (fresh opus agent: 125 docs pages + the spec + users) · 5 exa calls dogfooded · $0.041 · 610 s · 29-feature stress list; closed to the free tier: websets, batch, snapshot past 100 requests; monitors need a public https webhook
- 2026-09-29 · agent run (effort medium) · design process, 12 vectors (vs parallel core, an opus source lane, neuroarxiv, advise-project-approach) · 4/5: broad and well-linked (Stitch 1–5 variants skill, v0 design systems, NN/g, candycode stylescapes, a 12-direction map + galleries, the ten moves); shallower than the source lane (no leaked-prompt quotes, no npm versions) · $0.10 · 14.5k chars · converged on 4 takes with every other lane
- 2026-09-29 · agent run · Claude Design in Cowork vs Claude Code, sources dated ≥ 09-01 · 5/5: dated every source (09-16 announcement, the 09-23 Design guide, 09-24 artifacts guide, the admin guide), same verdict as parallel, and it added the hands-on caveat (the earlier CC preview's weaker canvas) · 140 s · $0.10 · vs parallel 4/5 (found the cc changelog v2.1.283/284 entries exa missed; corrected «designers migrated» to design-system migration)
- 2026-09-29 · agent run · the design drift research (4 lanes) · hit — the sharpest cost table (4 policies × spreads, window %, designer time) and the «when to spawn» list · 78 s · 16.5k chars · $0.10 · 4/5 (no dated primary sources on the tools)
- 2026-09-30 · agent run (effort medium) · svg: official logo sources for the fleet + svg in react (3 lanes) · 3/5: good structure and the `<img>` default argued well, but versions stale («accessed 2026-06-09», simple-icons 16.28 vs live 16.33), svgl coverage of the 10 names left unverified · 93 s · 14.1k chars · $0.10 · vs the opus source lane 5/5 (probed the API: 10/10 hits, found cv `ViteSVG` stale and the `logos:vitejs` old-logo trap)
- 2026-09-30 · agent run · word highlight while reading aloud on macOS (3 lanes) · 4/5: the clearest build order (pill karaoke first on a monotonic audio clock, AX overlay after), aeneas + AXObserver details; no probes, missed that kokoro already computes timestamps · 109 s · 15.9k chars · $0.10 · vs the opus source lane 5/5
- 2026-10-01 · agent run (effort medium) · why the jev skill router fails + how to route skills (3 lanes) · 4/5: the broadest prior art (ToolRet, SkillRouter body-aware rerank, semantic-router thresholds, sample-size math ≥300), a clean two-stage build; never saw our logs, so no miss taxonomy · 62 s · 6.9k chars · $0.10 · vs the opus source lane 5/5 (classified all 25 misses, found fixtures unlike real prompts, 53 % multi-load, the hook at user scope)
- 2026-10-01 · agent run (effort medium) · agent-first cli with a charm-grade look (3 lanes) · 4/5: the most named prior art (agcli next_actions envelope, the agent-help standard, amplitude wizard dual-mode, the agent-knowledge bm25 vs hybrid benchmark: +1.6 pt R@5 for ~500× runtime), a phased «steroids» plan; no probes, took opentui compile from docs · 92 s · 16.3k chars · $0.10 · vs the opus source lane 5/5 (compiled 4 binaries, measured size + startup, found opentui escape soup in pipes and ink EPIPE)
- 2026-10-01 · agent run (effort medium) · a plan adviser model (4 lanes) · 4/5: the clearest rollout plan and trigger tiers, a usable adviser contract; missed the native `--advisor` door the source lane found · 108 s · 17.9k chars · $0.10 · vs the opus source lane 5/5 (found the native advisor and its encrypted output, the omc template reversal, Anthropic's +1.7 pt number)
- 2026-10-01 · agent run · design review comms for an agent ↔ human (2 lanes) · 4/5: the clearest «decision object» spec and the keyboard model (Enter = recommended, S = skip) · 63 s · 13.9k chars · $0.10
- 2026-10-02 · agent run · design-ballot prior art, agent → human pinned asks (3 lanes) · 4/5: the widest failure list (stale anchors, notification races, duplicate asks, outcome labels over approve/reject), cited real issues · 94 s · 16.6k chars · $0.10 · vs the opus source lane 5/5 (read Agentation and react-zoom-pan-pinch from the tarballs: no create tool in the MCP, zoomToElement cannot see into iframes, the tldraw iframe recipe)
- 2026-10-02 · agent run · speak pre-build libs, 4 vectors (3 lanes) · 3.5/5: wide lib list with maturity, the SpeechTimeline schema idea; but proposed libs the daemon already replaced by hand (KeyboardShortcuts, Hummingbird against ADR 0001) — it could not see the code · 109 s · 15.4k chars · $0.10 · vs the opus source lane 5/5 (read the daemon: no SwiftPM build, willSpeakWord dropped after word 1, kokoro timestamps computed then dropped by the server, AXWebConstants text markers)
- 2026-10-02 · agent run · richer motion-broll videos (3 lanes) · 3.5/5: the widest technique list, a diversity-research cite, Clipkit as prior art; doubted HyperFrames as «unverified» — the opus lane opened it (Apache-2.0, 55k★, beginFrame renderer) · 108 s · 17.7k chars · $0.10 · vs the opus source lane 5/5 (read the engine, found the skill bans gradients/glow itself, probed Openverse: 240 CC0 whooshes, confirmed GSAP free)
- 2026-10-04 · answer · «context7 still a good pick + alternatives» · partial hit: docs7 = a doc host and key = rate limits were right, but it described ctx7 as a docs.json previewer (that is docs7-cli), wrong · 3 s · ~1.9k chars · $0.005
- 2026-10-04 · research lanes · «claude code mods: prior art, the four liked mods, stash/afk/redactor feasibility» · broad, found 11 repos incl. 2 the opus lane missed (privacy-guard, tmux-hop); no api-level depth · grade 3/5 vs opus 5/5
- 2026-10-04 · research lanes · «holds: per-file write locks between concurrent agents» · hit: 2 enforcing PreToolUse deny hooks (agent-coord, claude-code-file-lock, both opened: real, deny) the opus lane missed, 4 cc collision issues, the synthetic git-index lock idea · 94 s · 13.0k chars · $0.10 · grade 4/5 vs opus 4/5
