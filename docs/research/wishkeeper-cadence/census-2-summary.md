# siesta census 2, 2026-11-11T22:51:38+02:00 to 2026-11-18 13:46Z (clio, main and wings)

every number below was computed by a script over census-2.jsonl (python3 over the transcripts, scripts kept in the session scratchpad, not in this folder); the baseline column is computed the same way over census.jsonl, or read from census-summary.md where the jsonl cannot give it (marked «summary»). days are local time, utc+2. «new» is this window, «base» is census-summary.md (2026-10-21 to 2026-11-11).

## key lines

1. rows: new 97, base 252 (window of 8 active days against 11 active days)
2. siestas a day per active day, main: new 9.1 over 8 days, base 18.0 over 11 days (22.7 on 11-09 to 11-11)
3. siestas a day per active day, wing-1: new 8.0 over 3 days, base 5.6 (8.3 on 11-09 to 11-11); wings 2 and 3: new none, base wing-2 5.3, wing-3 8.0
4. wishkeeper spawned on 87 rows (90%), skipped on 10 (10%); base 195 (77%) and 57 (23%)
5. skip reason recorded on 6 of 10 skipped rows; base 3 of 57
6. wishkeeper runs: new 97 (of 119 wishkeeper Agent calls, 22 outside any row); base 263 runs (summary), 108 of 369 calls outside any row (summary)
7. wishkeeper tokens: new 10,216,247 total, 106,419 a run; base 26,777,391 total (26,777,391 summary), 102,595 a run
8. per run highs 1.35, mediums 3.75, lows 3.11; base highs 1.64, mediums 3.63, lows 4.67
9. runs with no report: new 1 of 97 (1%); base 31 of 263 (12%) (summary)
10. triggers: new top «ticket close(s) or sign(s)» 61 of 97 rows (63%), unknown 2; base top «a memory, rule or skill file» 95 of 252, unknown 33

## what a row is (as built)

- the baseline definition, reproduced: a row is one `siesta-gate.ts open` call in a clio transcript, joined with a clio:siesta Skill call within 30 min of it, and with every wishkeeper Agent call of the same thread after it, up to 120 min, whose description is not a checkpoint, CST, handoff, boot or retro check (a call after several opens goes to the latest open); a Skill call with no open within 30 min, or a wishkeeper run described as a siesta with no open before it, is a row of its own
- 97 rows, all from transcripts; 33 joined with a Skill call, 0 agent-only rows, 0 skill-only rows; base had 252 rows (62 touching the rounds doc, which is not read here)
- sources: 119 wishkeeper Agent calls after dedup; a fork copies its parent's lines, so tool-call ids are the key; threads read from the session's custom title (clio = main, clio: wing N = wing-N); no `-Users-dima-projects-bytes--claude-worktrees-clio-wing-*` project exists, and the other `-Users-dima-frame--clio*` project dirs hold no session in the window
- wishkeeper runs per row take tokens and minutes from the `<usage>` of the last task-notification of the run (the same run can notify twice; the later one is cumulative); severities from the «N high, N medium, N low» tail line when stated (a count/findings line, or `highs:`/`mediums:` lines), else a count of lines opening with high, medium or low; `lows: N` lines read as stated. 92 runs stated their counts, 4 were counted, no report for 1. treat severity sums as approximate, as in the baseline
- the literal rule lets 10 runs whose description does not say siesta into rows (7 «Regression replay case N» runs of 2026-11-11 23:34 to 23:35 local, 2 «Land read of pr», 1 other), 1,111,190 tokens; without them: 87 runs and 9,105,057 tokens
- 14 `siesta-gate.ts skip` calls and 13 lines in wishkeeper-skips.log from the window (the log line and the call match by time, 60 s); a skip reason is kept on a row only when the row has no wishkeeper run; 8 skip calls landed on rows that did have a run (the skip was filed after, or for, a window the run read) and are not counted as reasons; skip calls with no open before them: 0
- commits_in_window counts `git log` commits of ~/frame between the previous siesta of the same thread and this one (the first siesta of each thread in the window has null, gap null too: nothing before the window counts); checked against the baseline rows (63 and 22 commits reproduce)

## siestas per day, per thread

new:
- 2026-11-11: 4 total; main 3, wing-1 1
- 2026-11-12: 24 total; main 13, wing-1 11
- 2026-11-13: 33 total; main 21, wing-1 12
- 2026-11-14: 1 total; main 1
- 2026-11-15: 7 total; main 7
- 2026-11-16: 16 total; main 16
- 2026-11-17: 4 total; main 4
- 2026-11-18: 8 total; main 8

base (same function over census.jsonl, last days):
- 2026-11-05: 26 total; main 26
- 2026-11-06: 39 total; main 35, unknown 1, wing-1 2, wing-2 1
- 2026-11-07: 21 total; main 17, wing-1 1, wing-2 3
- 2026-11-09: 46 total; main 18, wing-1 8, wing-2 12, wing-3 8
- 2026-11-10: 33 total; main 24, wing-1 9
- 2026-11-11: 34 total; main 26, wing-1 8

mean a day on the days a thread had any siesta (days in brackets):
- main: new 9.1 (8); base 18.0 (11); base 11-09 to 11-11 22.7 (3)
- unknown: new none (0); base 1.0 (2); base 11-09 to 11-11 None (0)
- wing-1: new 8.0 (3); base 5.6 (5); base 11-09 to 11-11 8.3 (3)
- wing-2: new none (0); base 5.3 (3); base 11-09 to 11-11 12.0 (1)
- wing-3: new none (0); base 8.0 (1); base 11-09 to 11-11 8.0 (1)
- the first day, 2026-11-11, is a part day (from 22:51 local); days with no siesta are not listed or counted

## spawned and skipped

- new: spawned 87, skipped 10; base: spawned 195, skipped 57
- new skipped rows with a reason: 6 of 10; base: 3 of 57
  - 2026-11-11T21:29 main: the 23:28 card read this same window; the two pings are wing 1 flyway syncs, no new work of mine since
  - 2026-11-11T23:43 main: wishkeeper ran from 01:42 to 01:53; a second open at 01:42 restamped the window after its spawn
  - 2026-11-12T11:36 main: mid-boot: no reply to dima and no commit of this thread yet; the boot wishkeeper reads the window at step 8
  - 2026-11-12T13:40 main: the FRM-566 sign at 15:32 rides the 15:19 siesta read and the checkpoint CST check at 15:39 (wishkeeper, 7 mediums folded); a second wind is compacting now
  - 2026-11-13T13:10 main: no reason recorded
  - 2026-11-13T17:42 main: no reason recorded
  - 2026-11-16T16:42 main: no reason recorded
  - 2026-11-16T18:20 main: two signs on his typed word and one re-sign, no close; wishkeeper read 19:17–19:38 twice already, the next read rides the herdr move audit
  - 2026-11-16T22:09 main: second wind running this turn: wishkeeper read 23:29–23:54 at 23:59; since then only four signs and FRM-641 closed on his ticks, read first after the wind
  - 2026-11-18T09:21 main: no reason recorded
- base reasons:
  - 2026-11-03T14:32 main: light: the batch is the 16:25 siesta's own fixes
  - 2026-11-06T18:59 main: FRM-511's done pings; the open siesta's wishkeeper already holds that chunk
  - 2026-11-06T21:20 main: BYT-94's frame#131 clean, the batch since the second wind

## tokens and findings

- wishkeeper tokens, total: new 10,216,247; base 26,777,391 over rows (26,777,391 in the summary)
- per run (rows with the value known, divided by the runs in those rows; the same rule on both sides): new 106,419 tokens over 96 runs; base 102,595 over 261 runs
- new per run, exact from the run list: tokens median 99,388, minutes median 5.6
- highs per run: new 1.35 over 96 runs (sum 130); base 1.64 over 262 runs (sum 429)
- mediums per run: new 3.75 over 96 runs (sum 360); base 3.63 over 261 runs (sum 947)
- lows per run: new 3.11 over 96 runs (sum 299); base 4.67 over 260 runs (sum 1213)
- findings total: new 789; base 2652
- runs with no report: new 1 of 97; base 31 of 263 (summary)
- new runs whose notification status is not completed: 0

## per trigger reason

the gate writes its reason parts alone or joined; counts are of the part list (numbers dropped), so «3 memory, rule or skill text files» and the baseline «a memory, rule or skill file» are one part. the new window adds a part, «N ticket close(s) or sign(s)». a row takes the first Stop-hook line «siesta due: …» of its thread between the previous row and itself; with none it is «dima» when a typed prompt of his mentioning siesta came up to 30 min before, else «unknown».

- ticket close(s) or sign(s): new 61 rows; spawned 55, skipped 6; tokens 5,667,556; highs 71, mediums 210, lows 169 | base none
- a memory, rule or skill file: new 14 rows; spawned 13, skipped 1; tokens 1,203,994; highs 13, mediums 51, lows 31 | base 95 rows; spawned 69, skipped 26; tokens 8,662,669; highs 137, mediums 317, lows 401
- N files of clio's + a memory, rule or skill file + ticket close(s) or sign(s): new 4 rows; spawned 4, skipped 0; tokens 506,259; highs 11, mediums 21, lows 17 | base none
- N files of clio's: new 4 rows; spawned 3, skipped 1; tokens 389,769; highs 3, mediums 16, lows 13 | base none
- a memory, rule or skill file + ticket close(s) or sign(s): new 4 rows; spawned 4, skipped 0; tokens 403,745; highs 5, mediums 11, lows 12 | base none
- member done ping(s): new 2 rows; spawned 1, skipped 1; tokens 116,055; highs 0, mediums 5, lows 4 | base 89 rows; spawned 67, skipped 22; tokens 7,632,998; highs 115, mediums 274, lows 340
- a memory, rule or skill file + member done ping(s) + ticket close(s) or sign(s): new 2 rows; spawned 2, skipped 0; tokens 321,375; highs 3, mediums 5, lows 10 | base none
- unknown: new 2 rows; spawned 1, skipped 1; tokens 113,380; highs 3, mediums 5, lows 4 | base 33 rows; spawned 30, skipped 3; tokens 6,237,525; highs 105, mediums 222, lows 291
- N files of clio's + a memory, rule or skill file: new 2 rows; spawned 2, skipped 0; tokens 228,685; highs 3, mediums 8, lows 5 | base 8 rows; spawned 7, skipped 1; tokens 1,255,615; highs 18, mediums 41, lows 57
- N files of clio's + member done ping(s) + ticket close(s) or sign(s): new 1 rows; spawned 1, skipped 0; tokens 1,124,967; highs 16, mediums 24, lows 30 | base none
- N files of clio's + a memory, rule or skill file + member done ping(s) + ticket close(s) or sign(s): new 1 rows; spawned 1, skipped 0; tokens 140,462; highs 2, mediums 4, lows 4 | base none
- a memory, rule or skill file + member done ping(s): new none | base 20 rows; spawned 16, skipped 4; tokens 1,726,973; highs 30, mediums 60, lows 82
- dima: new none | base 4 rows; spawned 3, skipped 1; tokens 721,238; highs 15, mediums 20, lows 25
- N files of clio's + a memory, rule or skill file + member done ping(s): new none | base 3 rows; spawned 3, skipped 0; tokens 540,373; highs 9, mediums 13, lows 17

## what i could not find

- 8 skip calls sit on rows that spawned; see «what a row is»
- findings severities: see the parse rule above; the rounds doc is not read in this census, so no doc-only rows and no doc cross-check
- runs with no task-notification in any transcript: 1
