# siesta census, 2026-10-21 to 2026-11-11 (clio, main and wings)

every number below was computed by a script over census.jsonl (python3 over the extracts; the raw rows are in the same folder). days and weeks are local time, utc+2 (the gate stamp 21:51:25 matches the transcript open at 19:51:24z).

## what a row is

- a row is one siesta: a run of `siesta-gate.ts open` in a clio session (the first step of clio:siesta), joined with a clio:siesta Skill call within 30 min of it, and with every wishkeeper Agent call in the same session after it, up to 120 min, whose description is not a checkpoint, CST, handoff, boot or retro check
- a row with no gate open still counts when it is a clio:siesta Skill call (the siestas before the gate existed, 2026-11-03) or a wishkeeper run described as a siesta with no open before it
- 252 rows: 250 from transcripts, 2 from the rounds doc only (no transcript row matched them); rows with several wishkeeper runs sum tokens and findings, and carry an extra field wishkeeper_runs
- wishkeeper spawned on 195 rows, skipped on 57; 263 wishkeeper runs in all (261 from transcripts, 2 from the doc-only rows), 26,777,391 tokens (31 transcript runs have no notification in any transcript, so no tokens or findings)
- 369 wishkeeper Agent calls exist in the transcripts; 108 of them sit outside any siesta row (checkpoint, handoff, boot and cst checks, or pre-merge and chunk reads with no open before them)

## siestas per day, per thread

- 2026-10-30: 2 total; main 2
- 2026-11-01: 1 total; main 1
- 2026-11-02: 3 total; main 3
- 2026-11-03: 23 total; main 23
- 2026-11-04: 23 total; main 23
- 2026-11-05: 26 total; main 26
- 2026-11-06: 38 total; main 35, wing-1 2, wing-2 1
- 2026-11-07: 21 total; main 17, wing-1 1, wing-2 3
- 2026-11-09: 46 total; main 18, wing-1 8, wing-2 12, wing-3 8
- 2026-11-10: 33 total; main 24, wing-1 9
- 2026-11-11: 34 total; main 26, wing-1 8
- 2026-11-03: the rounds doc holds 1 row(s) with no matched transcript row, thread read from its text
- 2026-11-06: the rounds doc holds 1 row(s) with no matched transcript row, thread read from its text
- no siesta rows exist for 2026-10-21 to 2026-10-29: the earliest transcript line is 2026-10-30

## per trigger reason

the gate writes three reason parts, alone or joined: «N files of clio's», «a memory, rule or skill file of clio's», «N member done ping(s)». a row takes the first Stop-hook line «siesta due: …» in its session between the previous row and itself; with none it is «dima» when a typed prompt of his mentioning siesta came up to 30 min before, else «unknown» (the rounds-doc rows carry no trigger).

- a memory, rule or skill file: 95 rows; wishkeeper spawned 69, skipped 26; tokens 8,662,669; findings high 137, medium 317, low 401, total 892; highs per run 2.01 over 68 runs with findings known
- member done ping(s): 89 rows; wishkeeper spawned 67, skipped 22; tokens 7,632,998; findings high 115, medium 274, low 340, total 733; highs per run 1.72 over 67 runs with findings known
- unknown: 33 rows; wishkeeper spawned 30, skipped 3; tokens 6,237,525; findings high 105, medium 222, low 291, total 632; highs per run 3.50 over 30 runs with findings known
- a memory, rule or skill file + member done ping(s): 20 rows; wishkeeper spawned 16, skipped 4; tokens 1,726,973; findings high 30, medium 60, low 82, total 174; highs per run 1.88 over 16 runs with findings known
- N files of clio's + a memory, rule or skill file: 8 rows; wishkeeper spawned 7, skipped 1; tokens 1,255,615; findings high 18, medium 41, low 57, total 119; highs per run 2.57 over 7 runs with findings known
- dima: 4 rows; wishkeeper spawned 3, skipped 1; tokens 721,238; findings high 15, medium 20, low 25, total 62; highs per run 5.00 over 3 runs with findings known
- N files of clio's + a memory, rule or skill file + member done ping(s): 3 rows; wishkeeper spawned 3, skipped 0; tokens 540,373; findings high 9, medium 13, low 17, total 40; highs per run 3.00 over 3 runs with findings known

## gap between siestas, same thread, per week

weeks start monday; a gap belongs to the week of the later siesta; minutes.

- week of 2026-10-26: 2 gaps, median 1477.1, p90 2521.5
- week of 2026-11-02: 132 gaps, median 17.1, p90 98.6
- week of 2026-11-09: 112 gaps, median 30.3, p90 108.2
- all weeks: 246 gaps, median 19.6, p90 107.2 (p90 by linear interpolation)
- thread main: 197 gaps, median 17.3, p90 82.2
- thread wing-1: 27 gaps, median 73.4, p90 813.4
- thread wing-2: 15 gaps, median 43.4, p90 940.0
- thread wing-3: 7 gaps, median 18.1, p90 62.0
- gaps under 3 min (re-opens of the gate right after another open, same session): 15

## busiest 2-hour windows

a window starts at a siesta and spans 120 min; the three highest counts, no overlap between them.

- 2026-11-09 19:00 to 21:00 local: 14 siestas; wishkeeper spawned on 13; threads wing-1 1, main 4, wing-3 5, wing-2 4; triggers a memory, rule or skill file 7; member done ping(s) 5; unknown 2
- 2026-11-06 22:22 to 00:22 local: 13 siestas; wishkeeper spawned on 9; threads main 13; triggers member done ping(s) 7; a memory, rule or skill file 4; a memory, rule or skill file + member done ping(s) 1; unknown 1
- 2026-11-03 19:01 to 21:01 local: 12 siestas; wishkeeper spawned on 5; threads main 12; triggers member done ping(s) 6; a memory, rule or skill file 3; unknown 2; a memory, rule or skill file + member done ping(s) 1

## what i could not find

- no transcript, and so no siesta row, before 2026-10-30; the git log has 454 commits (all branches) on 2026-10-22 to 2026-10-29 with no siesta record beside them
- the rounds doc holds 67 dated lines (69 wishkeeper runs, two lines carry two runs), not about 100; none says «wishkeeper not spawned»; none carries a time of day or a trigger; the doc starts on 2026-11-03
- skipped wishkeeper runs have no recorded reason except a few Skill-call args: skip_reason is filled on 3 of 57 skipped rows, null on the rest
- the state dir keeps only the last siesta of each thread (siesta-last, siesta.json), no history; wing-9 has a siesta.json with epoch 0 and never opened, and its three transcripts hold no siesta call
- the prompt-path due line «siesta due — load clio:siesta» (no reason text) rides dima's prompts through hook context, not through the transcript text i read; only Stop-hook lines carry reasons, so 33 rows have trigger unknown (rows with no Stop-hook line between the previous siesta and itself, and no typed prompt of his about siesta)
- 31 wishkeeper runs inside rows have no task-notification in any transcript (tokens, minutes and findings null for them)
- finding severities: 34 runs state «(N high, N medium, N low)» themselves; 196 have only a total line or none, so their severities are my count of lines that open with high, medium or low, which misses or double counts when the report is shaped differently; 31 have no report at all. treat per-severity sums as approximate; totals and tokens are exact where present
- the siesta-gate.ts state files hold no reason string per siesta; the reasons come only from the Stop-hook lines in the transcripts

## where two sources disagreed

- clio:siesta Skill calls: 85 in the transcripts; gate opens: 238; session a741b7d8 alone holds 23 gate opens and 1 Skill call, so Skill calls undercount siestas. this census counts the gate opens, joined to a Skill call when one sits within 30 min
- Stop-hook «siesta due» lines: 233 distinct in the transcripts, against 186 due epochs in the main siesta.json; the hook nags again each hour an epoch is ignored, so lines are not siestas
- epochs in the state files against rows here: main epoch 186 (198 main rows), wing-1 26 (28), wing-2 14 (16), wing-3 8 (8); the gate counts an epoch only when a thread turns due, and a siesta opened with nothing due (dima asked, or a re-open) is no epoch
- the last opened_at in each state file matches the last gate open in the transcripts within 1 s for main, wing-1, wing-2 and wing-3 (the stamps in the siesta-last files are the same instant in local time)
- rounds doc against transcripts, matched on tokens within 1k and the same or the next day: 67 of 69 doc runs matched a transcript run; 2 did not (they sit as doc-only rows)
- among the matches that needed the loose rule (tokens only), the doc and the transcript disagree 24 times: high count (doc counts real highs) 8, findings total 15, minutes 1; the doc's highs are the ones it marks «real», the transcript's are the auditor's own count. each one:
  - 2026-11-04T14:37: high count (doc counts real highs), transcript 5, doc 3
  - 2026-11-06T23:35: high count (doc counts real highs), transcript 0, doc 1
  - 2026-11-09T15:09: high count (doc counts real highs), transcript 3, doc 1
  - 2026-11-10T20:16: high count (doc counts real highs), transcript 3, doc 2
  - 2026-11-03T12:06: findings total, transcript 19, doc 8
  - 2026-11-03T12:06: minutes, transcript 6.4, doc 3
  - 2026-11-03T12:06: high count (doc counts real highs), transcript 4, doc 1
  - 2026-11-04T12:47: findings total, transcript 22, doc 19
  - 2026-11-04T13:09: findings total, transcript 21, doc 19
  - 2026-11-04T13:09: high count (doc counts real highs), transcript 4, doc 3
  - 2026-11-05T16:03: findings total, transcript 4, doc 5
  - 2026-11-05T16:50: findings total, transcript 17, doc 20
  - 2026-11-05T20:11: findings total, transcript 17, doc 18
  - 2026-11-05T21:01: findings total, transcript 10, doc 12
  - 2026-11-05T21:51: findings total, transcript 26, doc 17
  - 2026-11-05T21:51: high count (doc counts real highs), transcript 7, doc 3
  - 2026-11-05T23:11: findings total, transcript 9, doc 10
  - 2026-11-05T23:11: findings total, transcript 11, doc 12
  - 2026-11-06T12:30: findings total, transcript 23, doc 20
  - 2026-11-06T16:17: findings total, transcript 3, doc 13
  - 2026-11-06T16:17: high count (doc counts real highs), transcript 3, doc 1
  - 2026-11-06T18:42: findings total, transcript 29, doc 27
  - 2026-11-06T23:07: findings total, transcript 12, doc 17
  - 2026-11-09T14:23: findings total, transcript 6, doc 7