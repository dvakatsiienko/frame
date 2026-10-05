# jev — the fleet's classifier, and how it stays sharp

`jev` (typesafe.ai) answers typed questions about a `state`: no tools, no memory, no generation.
we pull, it judges, we write back. two lanes live, both from 2026-09-19:

- **inbox lanes** — the boot digest prints every inbox item with a lane (ticket · fold · flowlog ·
  answer · drop) and a `needsVerdict` band. it pre-sorts; the flowlog parse is still mine.
- **skill router** — a `UserPromptSubmit` hook at user scope (`home/.claude/settings.json`), so it runs in every fleet session, coders included prints `skills (jev router):
  x:pm 0.81, …` for every skill ≥ 0.6, score included. the built-in router still runs; jev stops
  the misses. 📌 the hook is synchronous — every prompt in cclio waits for it (~0.8–1.8 s measured
  2026-09-22). log: `~/.claude/shelf/jev/route.log` (time · top pick · loads · prompt · ms). kill
  switch: `pnpm jev:router off|on|status` (a flag file, `router.off`); the digest and `jev:report`
  print `router: OFF` or `router: on · avg · p95`.

**the rules that came out of the first day**
- the criteria ARE the prompt. jev knows no fleet word we do not define; `null` criteria gave
  73 % ticket, defined ones 89 % flowlog on the same line. a skill's description is its routability.
- every rubric lives in `script/lib/jev-questions.ts`, model pinned to `jev-1.13.0`. sharpening
  is a commit with a diff, never an inline edit in a caller.
- low confidence is the feature: a three-way split (hkeys, conf 25) is the item to hand dima, not
  to decide. the 0.30–0.70 band on `needsVerdict` is the ⏳ detector.
- prove a wording with `RUNS=3`: ±3 points across repeats is the measured wobble; a threshold
  tuned on one run is a guess.

**the docs' shape for our router** (read 2026-09-28, docs.typesafe.ai + the day's research):
- one condition per noul, combined in code — the gates `_ack` / `_later` in `skill-route.ts` came
  from this (fixtures 17–18 → 20 of 23, RUNS=3)
- the target shape is the «skill suggestion» cookbook: one Choice over the roster with a `none`
  option + a «needs a skill at all» noul, then the top 3 re-checked against fuller text (their
  182-skill test: wrong loads 16.8 % → 7.3 %, needless 9.8 % → 4.0 %). our router is still
  per-skill nouls — the next sharpening, not a tweak
- a jev criterion wants capability + boundaries (what it is NOT for); our descriptions are keyword
  triggers written for cc's router — one text serving two readers is why `x:notes` fires on «vault»
- 23 fixtures is small; the docs suggest 50–100 labelled prompts before trusting a threshold

**the vet — a flow earns trust** (dima's model, 2026-09-20)
- every flow sits in `shelf/jev/vet.json`: `vetting` until 14 clean days, then `green`; a miss
  restarts the window from that day, and a green flow that misses drops back. verdicts are
  `pnpm jev:vet ok|miss <flow> [lane=<x>] [spot] <note>` (a lane tag credits that lane's precision; `spot` stamps a weekly spot-check on a green flow, the boot says when one is due), logged per flow in `shelf/jev/<flow>.log`; the boot
  digest prints every streak. three flows today: `inbox-lanes`, `skill-router`, `flawlog-lanes`
  (`pnpm jev:flawlog`, lanes a flawlog before the flush).
- **dima's policy (2026-09-20): a vetting flow is observed, never trusted — every answer gets my
  read. a green flow is trusted: acted on without a second read, and I stop observing it; the
  fixture suite (`pnpm jev:test`) and a weekly spot-check are what keep it honest.** a miss is
  never just recorded — the criterion is reworded in the same halt. 🚨 **a miss is sharpened in the halt that finds it, never deferred** (dima, 2026-09-24): a halt report that says «reword tomorrow» is the miss repeated.

🔒 **a green skill-router never auto-trusts a side-effect skill** (dima, 2026-09-25) — `cclio:halt`,
`x:cmt`, `x:handoff`, `cclio:evergreen`'s merge hand: a load of one always waits for my read of dima's
actual words. the case: «that's it for now from my side» scored `cclio:halt` 0.60 while it closed a
tweak batch mid-session — trusted, it would have opened the halt early. **at the router's green lift,
re-check this list first**; the hook already tags these picks «⚠ read first».

**the sharpening loop, run at every halt**
1. inbox: compare the boot's jev lanes with the lanes i actually gave at the parse. a
   disagreement is either my miss (say so) or a criterion to reword; reword in the same halt.
2. router: `grep -c` the flawlog's «skill not loaded» lines vs `route.log`'s picks for the day.
   a skill that never routes gets its description sharpened («magic keywords»), not the threshold.
   `pnpm jev:route --from-log` replays the day's near-misses (0.30–0.70) with the description each
   low pick carries — the rewrite candidates. then read the router latency off `jev:report`'s health
   line: a rising avg or a p95 over 2 s is a finding, not noise — it is dima's typing that waits.
3. flawlog: `pnpm jev:flawlog` on the day's flawlog vs where the flush actually placed each line.
4. any change → `RUNS=3` on the live input, then commit with the numbers in the body.

keys and the call path: `x-fleet` service account → vault `dev` → `script/op-run.sh`, no touch id.

💸 **jev runs on the free tier only** (dima, 2026-10-05: «i use jev only via free tier»). the router v2 replays spent $4.43 / 106M input tokens / ~19.5k requests in one day (read off the coder's raws; the console showed less, its stats lag) and took the balance to −$0.25 (402 on every call). **one full 4-arm router replay = ~5,060 requests, 27M tokens, $1.13.** the free allowance is a **$5 monthly credit** (billing page: granted Sep 18, expires Oct 18 — so the cycle likely turns on the 18th, an inference until the next grant shows); jev is frozen until it refills. a replay or bulk run states its cost (requests, tokens, $) before it starts and fits the month's free allowance; a coder brief that may run jev says so. graceful today: the router hook is fail-soft, jev compaction falls back to the built-in summary; the inbox and flawlog lanes are not proven to — a budget gate is the open fix.
