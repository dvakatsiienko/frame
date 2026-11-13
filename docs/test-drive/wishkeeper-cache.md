---
status: live
until: 2026-11-25
dies-when: the verdict line below is written
---

# wishkeeper-cache — the FRM-491 card and cadence, and a 1 h cache tried against 5 min

Ticket: FRM-491

**test card:** we believe the new card (delta read, claims at HEAD, three checks, highs and mediums only) keeps the old card's real highs for fewer tokens, and that a 1 h cache on its fixed prefix may cut its cold starts · we test it by every siesta's wishkeeper run from the landing (origin/main `ee5d08f9`, 2026-11-11 22:51) on, the cache tried as two arms of 7 days each · we measure per run, with `node docs/test-drive/wishkeeper-cache/measure.ts <since>`: cost at opus 5.5 prices, cache reads, 5 min and 1 h writes, output, the first request's warm share; per siesta, from `docs/test-drive/pre-merge-siesta.md` § rounds: highs, highs real y/n, acted or dropped · we're right if the new card's highs real stay ≥ 4 in 5 (the baseline's 33 of 42) with the cost per run down ≥ 25 %, and the 1 h arm's cost per run is lower than the 5 min arm's at an equal or higher first-request warm share
**kill rule:** a high the regression set holds goes missed twice → that rule of the card is reverted at once; the 1 h arm's cost per run above the 5 min arm's after 10 runs → back to 5 min early

## the baseline, the old card, 2026-11-04 → 2026-11-11 22:51

raw: `wishkeeper-cache/baseline-2026-11-11.jsonl` (one row per run, the script's own output); the findings side: `docs/research/wishkeeper-cadence.md`

- 279 runs, $934.47 at api prices, $3.35 a run on average, $2.65 the median
- tokens: 791.4M cache reads ($158), 85.4M 5 min cache writes ($427), 17.5M output ($349); 1 h writes 0
- the first request was cold (under half its input read from cache) in 160 of 279 runs; the median warm share 0
- 📌 writes are the biggest cost: a 1 h ttl prices every write 1.6×, so it only wins if it cuts writes by more than that, through warm starts

the regression set: `wishkeeper-cache/regression-set.md`, seven real highs, replayed at every card change and at the remeasure.

## the two arms, kept apart

- each run's arm is read off its own cache writes, never off a date: `measure.ts` tags a run `5m` (only 5 min writes), `1h` (only 1 h writes) or `mixed`, and prints one summary line per arm
- 5 min arm: the new card from `ee5d08f9` (2026-11-11 22:51) until the commit that sets `experimental: cacheTtl: 1h`
- 1 h arm: from that commit (planned 2026-11-18), its sha written here when it lands
- the old card's runs (before `ee5d08f9`) are the baseline only, never part of either arm: pass `<since>` = the arm's first commit time
- a `mixed` run (both writes) is set aside and named in its round, never averaged into either arm

## stress list

- the delta read — a siesta after a batch the last run already read — the run's reads and writes against the baseline median
- claims at HEAD — a «fixed» told to dima where the proof touched another path (the 11-11 crow wake shape) — caught y/n
- a relayed member claim — «the codie is adding X» said as fact — caught y/n
- lows as a count — any run — lows listed should be 0
- the logged skip — a window with no reply to dima and no commit — a `wishkeeper-skips.log` line, no run
- the weighted trigger — a skill's code file alone — no siesta due
- the 5 min arm (from 2026-11-11 22:51) — every run — cost per run, first-request warm share
- the 1 h arm (from 2026-11-18, `experimental: cacheTtl: 1h` in the card, its commit noted here) — every run — the same numbers, read against the 5 min arm

## rounds

- 2026-11-11 23:45 · the regression set's first replay, 7 blind runs on the new card (29db59e4), not siesta runs, so kept out of both arms' averages · caught 6/7, case 2 missed (`regression-set.md` § replays) · $3.27 a run (7 runs, $22.89), 5 min writes only, first-request warm share median 0.69 against the baseline's 0 · `measure.ts 2026-11-11T21:33:00Z`
- 2026-11-13 19:06 · today's siesta runs, all threads, 5 min arm (wing 1, dima's ask: «is 5 min ok on today's load») · 22 runs, $46.64 ($2.12 a run), 3.55M 5 min writes, 71.8M reads; first request warm in 6 of 22 · gaps between runs: median 14 min, 3 within 5 min, 21 within 60 min · a 1 h ttl would warm the ~12k shared opening on ~15 more runs, ~$0.86 saved, and price all 3.55M writes 1.6×, ~$10.65 more: 1 h loses ~12× on today's load (inference from the measured tokens and the model-card prices) · `measure.ts 2026-11-12T22:00:00Z`

## verdict
