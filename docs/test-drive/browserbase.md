---
dies-when: browserbase is adopted as a door or dropped at the test-drive verdict (2026-10-14, extended by dima on 10-06)
---

# browserbase — cloud browsers for agents, on a test drive

Ticket: none

**what:** managed headless chrome (sessions over CDP) + contexts, live view, replay, functions, search/fetch, managed agents. free plan, key `op://dev/browserbase-golden/credential` → `BROWSERBASE_API_KEY` in `op.env`, run through `script/op-run.sh`.
**doors:** `bb` 0.5.7 (`@browserbasehq/cli`: sessions, contexts, functions, fetch, search, extensions, `bb browse` passthrough) · `agent-browser -p browserbase` (our headless tool, same verbs) · `browse` 0.11 (the newer unified cli from the stagehand repo — not installed). 🚫 the hosted mcp: cli over mcp.
**window:** 2026-09-28 → 2026-10-14 (extended on 10-06). the day-0 research: `docs/research/browserbase.md` (parallel core, 09-28).

## the free plan — the budget every round spends

1 browser hour a month · 3 concurrent · **15 min max per session** · 1-minute minimum billing per session · 5 creates a minute · 7-day retention · 3 agent runs · 1,000 search + 1,000 fetch · functions free (15 min, TypeScript, us-west-2) · no proxies, no captcha, no verified. log the minutes per round; stop before the hour.

## strong and weak — day 0

- strong: contexts (a login persists, encrypted, until deleted) · live view (a human takes over a live session for a login or 2FA, the agent continues) · replay + network/console inspector per session · CDP-standard, so `agent-browser` drives it with no new verbs
- weak: the free hour is tiny against a 1-minute minimum · fetch runs no JS · functions have no secrets store and no cron · protected sites stay protected on free · real-user signal is thin (flaky on heavy SPAs, cost at scale)
- 🚫 proxies, captcha solving and stealth against a site that blocks us are routing around a block — out for cclio whatever the plan

## stress list — one real fleet ask per feature

1. **`agent-browser -p browserbase` from the mac** — the essentials on a bytes app at 390 / 1280; compare minutes, latency, parity with local
2. **a cloud cc session drives it** — `claude --cloud` on bytes (no git-crypt there), key through the pro/max credential proxy, not an env var; the cloud VM has no full browser, so this is the pairing the test drive exists to prove
3. **context + live view** — dima logs in once by hand to a site he owns an account on, the session closes with `persist: true`, a later session reuses it; measure how long the login survives
4. **replay as visibility** — a verifier round in a browserbase session, dima watches the replay link instead of reading the report
5. **fetch / search vs `parallel-cli` / WebFetch** — the same 5 lookups through each, one of them a JS shell page
6. **one function** — a tiny TypeScript probe deployed with `bb functions`, invoked over http; note what the missing secrets store costs
7. **the 3 agent runs** — one extraction, one multi-step with a human checkpoint, one research; each beside the same task done by a cc session
8. **`browse` vs `bb browse`** — which one the fleet keeps, if either

## rounds

<!-- date · feature # · ask · minutes spent · worked? · note -->

**the meter:** `script/op-run.sh bb projects usage b9372196-f2f5-404f-9adf-ec8f57bd8b86` → `browserMinutes`, `proxyBytes` (0 / 0 at 2026-09-28 04:40).

- 2026-09-28 · #2 key · probe 3a (session_01TDmUoRP4fksNjcUggEG48Y): the key in environment «cloud base»'s api credentials (host `api.browserbase.com`, header `X-BB-API-Key`) → a bare `curl …/v1/projects` from the VM answered **200** · 0 min · the one matching variable is `CCR_AUTO_MODE_ALLOW` (the auto-mode allow list naming the host), not the key (probe 3b)
- 2026-09-28 · #2 half · a `claude --cloud` probe on bytes (session_014QV6GViG5BzJYugdtrZuzw), read back with `claude -p … --teleport <id>` in a scratch clone · 0 min · cloud VM: node 24.21, pnpm 12.3.4, **no browser**; `api.browserbase.com` → 401 (reachable on the default network, no key), no browserbase env · the other half is BLOCKED on dima: the key into the cloud environment's credential proxy for `api.browserbase.com`
- 2026-09-28 · round 2 · a ☁️ cloud verifier + Browserbase checks trophy-sys prod read-only (journal rows, now-playing, header, 12 loads at 390/1280 × L/D) · ✅ all clean, 0 console errors · 1 session, 0.74 min · 📌 node fetch needs `NODE_USE_ENV_PROXY=1` through the cloud proxy (401 otherwise) · default session timeout 300 s (asked 900) · the vm cannot reach vercel.app directly, so all app data is read inside the remote browser · x:browser-headless's essentials/tab-walk were not run (the brief asked for playwright) — the next round runs them
