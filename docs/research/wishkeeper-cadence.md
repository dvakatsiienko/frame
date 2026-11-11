---
dies-when: the 2026-11-18 remeasure lands its verdict (kept, partly reverted or reverted) in FRM-491 and the card's new rules are proven or rolled back
---

# wishkeeper cadence — the baseline, and the remeasure a week after the change

Ticket: FRM-491

the raw data sits beside this file in `wishkeeper-cadence/`: `census.jsonl` (one row per siesta), `census-summary.md`, `grades.md` (90 findings graded), `proposal.md` (the change, § final), and the three web lanes (`web-exa.md`, `web-parallel.md`, `web-source-lane.md`).

## the baseline — old wishkeeper, 2026-10-30 → 2026-11-11

- window: the first transcript holding a wishkeeper report (2026-10-30) to the change's landing (2026-11-11, the commit that lands the new card and gate; its sha goes into FRM-491's signed block)
- 252 siestas, 23–46 a day since 11-03; main 198, wing 1 28, wing 2 16, wing 3 8
- 195 wishkeeper runs spawned, 57 skipped; 26,777,391 wishkeeper tokens over 263 runs (31 runs with no report, their tokens unknown)
- triggers: one memory/rule/skill file 95, member done pings 89, unknown 33 (big batches, ~18 commits each), memory + pings 20, files + memory 8, files + memory + pings 3, dima 4
- 170 siesta-mode reports, 1,946 findings: 293 high, 711 medium, 942 low
- graded sample (90 findings, 61 runs): highs real 33 of 42; lows caught 0 of 24
- weighted shares: caught 19 %, hygiene 58 %, cosmetic 12 %, false 5 %, duplicate 6 %
- clio acted on every catch and dropped about half of all findings (20 of 24 lows, 19 of 38 hygiene)
- catches per run: ~2.5–3.2 for every trigger; the chunk re-read 0.6, ~177k tokens a catch
- surfaces: wishes, edits, tracker and claims catch; loose ends caught nothing

## the remeasure — on 2026-11-18, the new card only

- the window opens at the landing commit's time, never earlier: a siesta or a wishkeeper run before it belongs to the old card and is left out, so the two never overlap
- the same two cards as the baseline, same briefs: a helper census of the window (`census.jsonl` shape), a researcher grading every high plus up to 15 medium/low per trigger, the same five labels and the acted-or-dropped column
- read against the baseline, per run: wishkeeper tokens, highs per run, highs real share, catches per run, lows listed (should be 0), dropped share, siestas a day, skips logged with a reason
- the regression set: tonight's real highs (grades.md § the 5 best catches, and the 11-11 crow-wake and «no check» highs) replayed through the new card; each one it misses is a loss
- the call: kept, partly reverted (one rule rolled back, named), or reverted to the card at the landing commit's parent
