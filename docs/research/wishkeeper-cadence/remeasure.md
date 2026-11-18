# wishkeeper remeasure — the new card, one week on (researcher, 2026-11-18)

wish: FRM-491. the plan: `../wishkeeper-cadence.md` § the remeasure (lines 24–30). the change: `proposal.md` § final. the card: `_clio/.claude/agents/wishkeeper.md`, last changed in 29db59e4 (2026-11-11 22:49:53 +02:00, per `git log`). the same card is at HEAD today. the window: 2026-11-11T20:51:38Z to the last siesta run at 2026-11-18T13:31Z. the grades: `grades-2.md`. the baseline: `census.jsonl`, `census-summary.md`, `grades.md`.

## the call: kept

the new card stays as built. no rule is rolled back. three numbers decide it:

1. **highs real: 99 of 105 (94 %)**, against 33 of 42 (79 %) on the old card (`grades-2.md`, `grades.md`)
2. **caught findings a run: ≈2.9 at 105,845 tokens a run**, against ≈2.2 at 102,595–115,294 (modelled the same way on both sides, see below). about 37k tokens a catch against 52k
3. **the claims check made 47 of the window's 123 catches** (47 of its 51 graded findings caught). that is the rule behind the one regression miss (case 2). rolling it back to save one replay case would lose the check that catches the most. the kill rule wants two misses (`docs/test-drive/wishkeeper-cache/regression-set.md:3`), and case 2 has missed once.

## the 8 key lines

1. highs real: 99 of 105 (94 %) new; 33 of 42 (79 %) old
2. caught a run (modelled): ≈2.9 new; ≈2.2 old. tokens a catch: ≈37k new; ≈52k old
3. wishkeeper tokens a run: 105,845 new (86 siesta runs, median 99,310); 102,595 old (census.jsonl, 261 runs), or 115,294 (grades.md, 19.6 m over 170 siesta-mode runs)
4. highs a run: 1.22 new (105 over 86 reports); 1.64 old (census.jsonl, 429 over 262), or 1.72 (grades.md, 293 over 170)
5. lows listed: 0 in 86 reports new, with 269 counted on `lows: N` lines; 942 listed in 170 runs old (5.5 a run)
6. dropped: 14 of 159 graded (9 %; 17 % weighted) new; 30 of 90 (33 %; 52 % weighted) old
7. siestas a day: 13.3 new (93 over the 7 full days; 12.1 with the part day 11-11); 30.8 old (246 over the 8 active days 11-03 to 11-11). skips with a reason: 6 of 10 new; 3 of 57 old
8. regression set: 4 of 7 caught at their own spot and severity, 5 at their own spot, 6 graded leniently. case 2 (clio-revive's effort) missed once. no replay has run since 2026-11-11 23:35 local

## per run, against the baseline

| measure | new card (11-11 22:51 → 11-18) | old card (10-30 → 11-11) | source |
|---|---|---|---|
| wishkeeper tokens a run | 105,845 (9,102,699 over 86) | 102,595 (26,777,391 over 261); 115,294 siesta-mode only | new: task-notifications; old: census.jsonl, grades.md:14 |
| highs a run | 1.22 | 1.64 (census.jsonl); 1.72 (grades.md) | parse of each report; census.jsonl |
| highs real share | 94 % (99/105, every high) | 79 % (33/42, 7 a group sampled) | grades-2.md; grades.md:7 |
| mediums caught share | 44 % (24/54) | 21 % (5/24) | grades-2.md; grades.md per-finding list |
| caught a run (modelled) | ≈2.9 | ≈2.2 (grades.md gives ≈2.5–3.2 per trigger, 0.6 for pre-merge) | caught highs + medium rate × mediums, lows 0 |
| lows listed | 0 (86 of 86 give a count line) | 942 in 170 runs | report parse; grades.md:14 |
| dropped share | 9 % raw, 17 % weighted | 33 % raw, 52 % weighted | grades-2.md; grades.md:8,19 |
| siestas a day | 13.3 full days; main 9.1 | 30.8 (11-03 to 11-11); main 18.0 | census-2.jsonl, census.jsonl; census-2-summary.md:8 |
| wishkeeper skipped | 10 of 97 (10 %) | 57 of 252 (23 %) | census-2.jsonl, census.jsonl |
| skips with a reason | 6 of 10 | 3 of 57 | census-2-summary.md:59, census-summary.md:68 |
| runs with no report | 1 of 87 | 31 of 263 | grades-2.md; census-summary.md:10 |
| cosmetic share | 0 of 159 | 12 % weighted | grades-2.md; grades.md:8 |

- census-2-summary.md gives 1.35 highs a run and 106,419 tokens a run (its lines 14 and 13). those figures cover its 96 runs with a report, the 7 regression replays and the 3 land reads included. the 1.22 and 105,845 here are the 87 siesta runs alone.
- inference: fewer highs a run (1.22 against 1.64) with a higher real share reads as the «never a finding» and «counterexample and consequence» rules (`wishkeeper.md:62,65`) cutting weak highs. it is not a sign of lost catches: catches a run went up.

## the regression set

the cases are `regression-set.md:9-15`. 1–5 are grades.md § the 5 best catches. 6 and 7 are the two 11-11 highs. reading cases 6 and 7 as the plan's «crow-wake» and «no check» highs is an inference: case 6 is the crow wake fix on the wrong path, case 7 is «all four worked» relayed with the fling unrun. the replay ran the new card (29db59e4), one blind run per case, on 2026-11-11 at 21:34–21:35Z, in transcript 6664e8d8. its results, read from those runs' task-notifications, match `regression-set.md:19-28`.

| case | the old catch | the new card's rule that should catch it | replay, 11-11 | status |
|---|---|---|---|---|
| 1 · #69 | merge gate reruns /security-review against his grill 2 Q6 | his words: a chunk's base..head against its W-lines (`wishkeeper.md:39`). the no-second-read rule spares a big chunk whose signed W-lines sixth sense never quoted (`:34`) | caught, high, `merge_auto.go:1297-1313` | kept |
| 2 · #84 | clio-revive reads no thread's effort while dima was told it did | claims, at HEAD on the exact path (`:38`) | **missed**: it named an alias-born main gap and a signed plan line instead | **one miss** |
| 3 · #72 | his reuse clauses cut to fit a size cap, reported as in | his words (`:39`); a cut in clio's edits (`:40`) | caught as a **medium**, `craft-fleet-flow.md:49` | caught, a severity lower |
| 4 · #47 | PK-328's lines moved into Done FRM-521, W35 ❓ unanswered | a close that dropped an ask (`:39`) | caught, high, same spot | kept |
| 5 · #3 | signed FRM-471 folded into the lane with no re-sign | a signed ticket edited without its `## signed` line (`:39`, `:23`) | caught on its sibling FRM-472, not at FRM-471 | a miss at its own spot (strict) |
| 6 · crow wake | 148aa078 fixed `wake.ts`, the empty packet came from `decision.ts` | claims at the exact path (`:38`) | caught, high, same spot | kept |
| 7 · «all four worked» | a member's claim relayed as done with the fling unrun | relayed member claims (`:38`, added in 29db59e4) | caught, high, same spot | kept |

- strict count: 4 of 7 (1, 4, 6, 7). same spot, any severity: 5 of 7 (adds 3). lenient: 6 of 7 (adds 5). the strict rule is the one `regression-set.md:28` now uses.
- a miss is a loss: case 2 is a loss, and case 5 is one under the strict rule. no rule in the new card drops what either needs. the claims rule is the rule case 2 rests on, and it caught 47 claims in the window (R5.2 «verified» on the wrong repo, R4.2 a proof on an older head, R52.1 a hook proven on a test home and not the real store), the exact shape case 2 has. inference: the miss is that run's, not the rule's. a second replay of case 2 is what settles it.
- the 2026-11-18 replay that `regression-set.md:3` asks for has not run: no «Regression replay» call exists in any transcript after 2026-11-11T21:35:07Z.

## what the change did, rule by rule (proposal.md § final)

- lows as one count line (§ final 7, `wishkeeper.md:64`): held in 86 of 86 reports.
- zero findings is valid (§ final 7): 1 of 86 reports is clean.
- claims first, judged by state (§ final 5): the strongest check, 47 of 51 caught.
- loose ends cut (§ final 6): the card has three checks and no loose-ends one (`wishkeeper.md:36-40`). each graded finding here fits one of the three. the old card's loose ends caught 0 of 12 (grades.md:43).
- crow's notes in the brief (§ final 9): 2 of 159 graded findings were someone else's first (crow once, the card's own open finding once). old card: 6 % weighted, a floor.
- the checks output is «already checked» (`wishkeeper.md:32`): broken 5 times, all mediums (R1.4, R1.5, R14.6, R14.7, R64.10). this is where 5 of the 7 duplicates and 3 of the 14 drops come from.
- the cadence floor (§ final 1): skips fell from 23 % to 10 %. 4 of the 10 skips carry no reason (census-2-summary.md:64-69), so the «logged with its reason» receipt is not yet airtight.
- cadence: siestas a day fell by more than half (30.8 to 13.3 on full days). the census holds gate opens only (0 agent-only or skill-only rows, census-2-summary.md:21). whether a due siesta ever went unopened is not in this data «?».

## the next steps this suggests (inference, not part of the call)

- run the 11-18 replay of all 7 cases against 29db59e4, case 2 first. a second miss on case 2 is the only thing that would make «claims at HEAD on the exact path» a revert candidate under the kill rule.
- one card line: a red the checks output printed is never a finding (5 duplicates, 3 drops).
- the gate: a skip with no reason should be refused (4 of 10).

## what i could not verify

- grader drift: the baseline and this pass were graded by different runs, and every high is graded here against 7 per group there «?».
- the 11-18 regression replay: not run, so the regression line rests on the 11-11 replay alone.
- whether the cached-prefix rule (§ final 8) saved tokens: tokens a run did not fall (105,845 against 102,595–115,294). its own one-run before/after measure was not looked for «?».
- the output budget (§ final 8, ≤2k tokens out): not measured.
- the token sum differs from census-2-summary.md by 2,358 over the same 87 runs (9,102,699 against 9,105,057) «?».

<!-- end -->
