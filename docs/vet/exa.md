---
dies-when: exa is adopted as the research door (replacing or beside parallel) or dropped after the vet period
---

# exa — vet (research door, parallel's challenger)

Ticket: none

**why:** dima 2026-09-29: «our second vet candidate for a research tool, possibly replacing parallel ai, so it has to be added to a vet list and be fully tested, same as parallel». the verdict is head-to-head with `parallel.md`, same asks, same grades.

**door:** REST through `op-run`, key `op://dev/exa-golden/credential` → `EXA_API_KEY` in `op.env`. no mcp (cli over mcp), no sdk install needed — `curl` + `jq`. the OpenAPI spec (`exa.ai/docs/exa-spec.yaml`) is the source of truth; the docs index is `docs.exa.ai/llms.txt`.

**price:** pay-as-you-go; free tier $10 a month, reset on the 1st, no card (+$10 one-time onboarding bonus). search from $4 / 1k · deep search $12–15 / 1k · contents $1 / 1k pages · answer $5 / 1k · monitors $15 / 1k · agent usage-based.

## stress list — day 0, from the docs (2026-09-29)

each feature is paired with its parallel twin and a real fleet ask it will be tried on. widest over deepest: one real try per line before the verdict.

- **agent run** (`POST /agent/runs`, async, effort `minimal|low|medium|…|ultra`, `outputSchema`, `previousRunId` follow-ups) ↔ parallel `research run --processor core` · every «research X» · first try: readaloud round 2 (below)
- **deep search** (`/search` with `type: deep-lite|deep|deep-reasoning`, `outputSchema` → `output.grounding` field citations) ↔ parallel `search --mode advanced` + core · a structured lookup: «which versions / which limits» asks, e.g. a dependency's breaking changes for evergreen
- **search** (`/search`, `type: auto|fast|instant`, highlights, domain + date filters) ↔ parallel `search` / WebSearch · the next lookup WebSearch misses
- **contents** (`/contents`, text / highlights / summary, `livecrawl`) ↔ parallel `extract` · the next js-rendered page that returns a shell
- **answer** (`/answer`, cited llm answer) ↔ nothing in parallel · a one-line factual ask («what is the free tier of X»)
- **findSimilar** (`/findSimilar`, pages like a url) ↔ nothing in parallel · «find tools like X» (e.g. apps like speak11)
- **agent list-building / websets** (`/v0/websets`, enrichments) ↔ parallel `findall` · the next list-shaped ask
- **monitors** (`/monitors`, scheduled search, webhook) ↔ parallel `monitor` · one github-issue reminder watch, graded against its parallel twin
- **batch** (`/batches`, async bulk) ↔ nothing · a bulk lookup (renovate changelogs)
- **snapshot** (pin a page to a datetime) ↔ nothing · niche; try once or name it untried

📌 day-0 gotcha: `budget.maxCostDollars` works only for metered efforts and `maxDurationSeconds` only for `ultra` — a medium run with a budget is a 400 (2026-09-29).

## log — one line per round

date · feature · ask · hit · seconds · chars · $ · vs parallel / opus

- 2026-09-28 · search round 0 · «claude code cloud sessions setup script docs» · hit #1 code.claude.com/docs/en/cloud-environments · http 200 · $ not read (also logged in `parallel.md`)
- 2026-09-29 · agent run (effort medium) · readaloud round 2 (tech-text normalization per engine, gemini/elevenlabs gaps, kokoro latency, uk/ru, playback) · 5/5 on the load-bearing asks: elevenlabs 402 `insufficient_credits` vs 429 body shape, the websocket's [120,160,250,290] char schedule and no-v3, gemini 3.8 8k-token input + wav default + 30 voices, fluidaudio's own bench (241 ms p50, 31×, not streaming), apple's [[char LTRL]] / [[slnc]], kokoro has no uk/ru, lesya/milena system voices, NLLanguageRecognizer · every claim grounded per field, unverifieds labelled (v4 api, gemini rpd, mlx ttfa) · 93 s · 20.4k chars · $0.10 (agentCompute 0.04 + search 0.06) · vs parallel core 4/5 (319 s, 18.2k chars, ¢ not read — added v4 rides the text-to-dialogue api and v4 lists uk+ru, but a vague quota error shape) and opus 5/5 (297 s, ran misaki + avspeech ssml + NLLanguageRecognizer locally; found v4 on the free plan) · exa: fastest, cheapest, readable $; missed v4-on-free and uk absent from gemini (said «likely») · day-0 gotcha: `budget` 400s on medium effort
