---
dies-when: browserbase is adopted as a door or dropped at the vet verdict (2026-10-05)
---

# browserbase — cloud browsers for agents, on vet

Ticket: none

**what:** managed headless chrome (sessions over CDP) + contexts, live view, replay, functions, search/fetch, managed agents. free plan, key `op://dev/browserbase-golden/credential` → `BROWSERBASE_API_KEY` in `op.env`, run through `script/op-run.sh`.
**doors:** `bb` 0.5.7 (`@browserbasehq/cli`: sessions, contexts, functions, fetch, search, extensions, `bb browse` passthrough) · `agent-browser -p browserbase` (our headless tool, same verbs) · `browse` 0.11 (the newer unified cli from the stagehand repo — not installed). 🚫 the hosted mcp: cli over mcp.
**window:** 2026-09-28 → 2026-10-05. the day-0 research: `cclio/shifts/2026-09-28-research/browserbase-deep.md` (parallel core, 09-28).

## the free plan — the budget every round spends

1 browser hour a month · 3 concurrent · **15 min max per session** · 1-minute minimum billing per session · 5 creates a minute · 7-day retention · 3 agent runs · 1,000 search + 1,000 fetch · functions free (15 min, TypeScript, us-west-2) · no proxies, no captcha, no verified. log the minutes per round; stop before the hour.

## strong and weak — day 0

- strong: contexts (a login persists, encrypted, until deleted) · live view (a human takes over a live session for a login or 2FA, the agent continues) · replay + network/console inspector per session · CDP-standard, so `agent-browser` drives it with no new verbs
- weak: the free hour is tiny against a 1-minute minimum · fetch runs no JS · functions have no secrets store and no cron · protected sites stay protected on free · real-user signal is thin (flaky on heavy SPAs, cost at scale)
- 🚫 proxies, captcha solving and stealth against a site that blocks us are routing around a block — out for cclio whatever the plan

## stress list — one real fleet ask per feature

1. **`agent-browser -p browserbase` from the mac** — the essentials on a bytes app at 390 / 1280; compare minutes, latency, parity with local
2. **a cloud cc session drives it** — `claude --cloud` on bytes (no git-crypt there), key through the pro/max credential proxy, not an env var; the cloud VM has no full browser, so this is the pairing the vet exists to prove
3. **context + live view** — dima logs in once by hand to a site he owns an account on, the session closes with `persist: true`, a later session reuses it; measure how long the login survives
4. **replay as visibility** — a verifier round in a browserbase session, dima watches the replay link instead of reading the report
5. **fetch / search vs `parallel-cli` / WebFetch** — the same 5 lookups through each, one of them a JS shell page
6. **one function** — a tiny TypeScript probe deployed with `bb functions`, invoked over http; note what the missing secrets store costs
7. **the 3 agent runs** — one extraction, one multi-step with a human checkpoint, one research; each beside the same task done by a cc session
8. **`browse` vs `bb browse`** — which one the fleet keeps, if either

## rounds

<!-- date · feature # · ask · minutes spent · worked? · note -->
