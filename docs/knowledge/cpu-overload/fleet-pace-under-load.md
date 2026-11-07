---
fed-by: incidents
---
Ticket: FRM-521

# fleet pace under load

All times are local (EET), read 2026-11-07 02:05 to 02:25. Everything here is a correlation from one unplanned window, never a planned dose. Tags: [m] measured, [i] inference. A pair like 37/41 is p50/p90 in seconds.

## verdict

- **Headline: a lane ran about 1.8× slower at 4-5 lanes than at 2.** Coder tool calls per lane-hour 121 → 71 (×0.58), commits 3.9 → 2.2 (×0.55), same week. [m] n=18 and 50 coder session-hours. Sources: T, R
- A separate read agrees: same-size chunks (median churn 507 and 515 lines) took 0.9 h at about 1 lane and 1.5 h at 3.5+ lanes, ×1.7. [m] n=23 and 11. Source: P
- **The cpu's own slowdown of the same command is small: about ×1.15 at the median, about ×1.75 at p90, ×2 only at load 60+.** Raw days read ×3.7, but most of that is the test suite growing. [m] n=102 and 83. Sources: C, S
- **Total output: 4-5 lanes did about what 2 lanes did per hour.** Against the same week's 2 lanes: fleet commits −4 %, code commits −1 %, code churn −12 %, coder commits +24 %, chunks 0.64 against 0.67 per hour. Against 1 lane, about ×2. [m] 11 and 9 hours. Sources: T, G, P
- **Knee in output: between 2 and 4 lanes.** 1 → 2 lanes gains ×2.2, 2 → 4-5 gains −12 % to +24 %. Three lanes has 0 hours since 10-19. [m]
- **Knee in run time: load 30-40, steep at 60+. Lane count has no knee of its own.** At 4-5 lanes before 19:25, commit and push steps sat 11-29 % above 1 lane. [m] Sources: S, T
- **Recommendation: 2 lanes as the default. Run 3 only as a measured ramp step.** [i] Past 2 lanes the extra lanes bought almost no hourly output on the one window there is. The caveat is below: 11-06 as a whole day did beat other days.
- What explains the lost pace is mostly not cpu run time. [i] Queue wait is the main measured suspect, but it has no logged baseline, and work shape changed on the same days.

## sources

- T: `~/.local/state/x/traces/*.jsonl`, x's own spans with step timings, from 10-09
- R: `~/.claude/projects/**/*.jsonl` since 09-26, 3,225 files, top-level and subagent
- Q: `~/.local/state/x/gate-queue.log`, 452 rows, from 11-06 19:39
- S: `~/.local/state/x/gate-steps.log`, from 11-06 21:01
- C: `~/.local/state/x/test-commit.log`, from 11-06 20:07
- M: `~/.local/state/x/mods-test.log`, from 11-05
- G: `git log --all --no-merges` for frame and bytes, read 11-07
- P: `gh pr list` and `pulls/N/commits` for frame and bytes; bot prs dropped; 80 chunks merged since 09-26
- W1: `cpu-load.md`, `cases.md` beside this file, `~/frame/docs/test-drive/gate-speed/proposal-superseded.md`

## what changed the work, not the load

- Test files: 26 on 10-01, 140 on 10-25, 186 on 11-04, 199 on 11-07. Go `func Test`: 368 on 10-25, 415 on 11-01, 534 on 11-06 12:00, 703 on 11-07 02:00. [m] G, at the sha before each date
- Mods tests passed in a typical run: 902 (10-19 to 10-31), 1,210 (11-01 to 11-05), 3,430 on 11-07. [m] n=21, 17, 1. R, M
- Same zero-lane hours, 10-19 to 10-31 against 11-01 to 11-05: commit step 8.0 → 12.7, push step 22.8 → 28.7. So ×1.6 and ×1.26 is workload, with no lane running. [m] n=311 and 125; n=161 and 69. T. Commit figures are from the no-mods probe, with tiny steps kept
- **11-06 19:25, `4739e4ed`: commit step jumps from about 15 s to about 27 s.** It adds `gate-queue.test.ts` with 6 `sleep` matches and sets vitest's timeout to 30 s. [m] the jump, T, per-commit rows. [i] the cause
- Proof it is not load: test step at load under 16 still takes 28/33, n=14, and 26-28 at load 7-11. [m] C, 11-06 22:12 to 22:37. A bench about 19:00, before the change, took vitest 14.7 s at load 20-37, one run. [m] W1 `proposal-superseded.md`; the time is from its first mention in R, session `2e3b8126`, 11-06 19:00
- **This disagrees with W1:** `cases.md` (11-07) reads a commit's test step as 13 s alone, 35 s at load, about 2.5×. My read: most of that gap is the 19:25 change, and the load share is about ×1.15 [i]
- Other gate changes: 11-06 20:35 `cc5a87ca` a push tests what it pushes; 21:01 `c002618c` a codie branch commits with related tests only; 22:02 `566ec310` biome reads `.mjs`. [m] G
- Marks: frame#132 merged 11-07 00:13. Leaked hooks ran to 01:40 per the coordinator's note and W1. frame#139 was still open at 02:06, so **no after-#139 number exists**. [m] `gh pr view`
- On purpose tonight: a 16-run go protocol, mutant rounds, sixth sense proofs. Coordinator note, 11-07, not checked separately?

## vector 1: same command

Windows: A 10-19 to 10-31, B 11-01 to 11-05, C 11-06 00:00 to 14:00, D 14:00 to 19:39, E 19:39 to 00:13, F 00:13 to 01:40, G 01:40 on. A and B never had more than 2 busy coder lanes. [m] R

From traces, exit 0 (the best unit, because the sample stays large):

- `x lane commit` total, called by a session: A 9.1/35.3 (n=763), B to 14:00 15.3/70.2 (581), 14:00-19:25 18.4/129.4 (98), 19:25-00:13 31.4/83.5 (114), after 00:13 75.9/233.9 (32). The last one holds the queue turn inside it since #132. [m] T
- Commit step, no mods: A 8.3/11.2 (709), B 13.2/19.9 (603), 11-06 to 19:39 15.6/26.6 (167), E 31/41.4 (110), F 27.7/41.8 (24), G 36.9/45.1 (4). [m] T. Raw E over A is ×3.7, nearly all workload
- Push step: A 22.8/25.7 (429), B 28.3/36.4 (342), to 19:39 31/42 (85), E 46.1/70.2 (87), F 79/257.5 (17), G 55.2/59.5 (4). [m] T. F has no separate turn step in the trace, so it likely holds queue wait [i]
- Control, a step the cpu barely touches: push `plan` step 1.8/1.9 in every window. [m] T, n=429, 342, 85, 87, 17, 4

From transcripts (tool_use to tool_result, wait included):

- `x lane commit`: A 16.8/41.1 (344), B 40.9/76.6 (336), C 47.7/72.7 (19), D 16.8/80.9 (6), E 30.5/32.2 (3), F 125.7 (1). [m] R
- `x lane push`: A 27.9/36.9 (125), B 33.6/47.6 (94), C 33.7/36.4 (2), E 105.6/202.6 (10), F 113.1 (1). [m] R
- `go test` with `-run`: A 5.3/19.1 (144), B 6.5/19.9 (24), D 10.5/57.6 (39), E 31.7/62.3 (7), F 38.2/71.4 (5). [m] R. Different tests per call, so a direction only
- `go test` whole, 10 s or more: A 32.2/52.9 (26), B 27.6 (1), D 106.8/149.4 (2), E 106.3/110.3 (2), F 91.5 (1). [m] R
- `pnpm x-go:gate`: A 134/179 (3), B 89.9/100 (4), D 65.7/75.8 (2). [m] R. Too thin to read
- `pnpm test` whole: A 8.4/40.9 (4), D 34.6/39.5 (3). [m] R. Too thin, and the matcher catches chained commands
- `pnpm mods:test` whole: A 27.1/69.6 (19), B 78.7/253.2 (16), C 77.9/195.4 (4). [m] R. Mostly suite growth
- Hot-hour transcripts are thin: commit is n=3 in E against 110 trace rows. Queue rows show runs moved into wrapper scripts. [m] Q. [i] why

Corrected to the same workload:

- Test step, whole suite, after 19:25: load under 16 28/33 (14), load 16+ 32/47.3 (88). **×1.14 p50, ×1.43 p90.** [m] C
- Test twin: quiet 37/39.4 (load under 20, n=10). To 00:13 41/72.3 (60), ×1.11 and ×1.83. All rows 43/64.8 (83), ×1.16 and ×1.64. [m] S
- Push step: quiet about 42 (twin 37 plus git) against E 46. About ×1.1. [i] S, T
- Go whole, queue rows: to 00:13 96.5/136 (16), to 01:40 72/84 (19), after 59/75 (13). [m] Q. Per 100 go test funcs: usual about 8.3 s, to 00:13 about 16, after 01:40 about 8.4. So ×1.9, then ×1.0. [i] funcs are not equal work, and #132, the freed leak and fewer lanes all fall in the same hours
- Mods, seconds per 1,000 tests: A 19.8/46.2 (21), B 31.3/51.9 (17), then single rows at 101 and 36.7. By load: 17 (1), 30.2 (5), 41.7 (4), 24.3 (4), 14.9 (1). [m] R, Q, M. No clear dose. Files differ per mod
- Commits by what they hold, time-joined to git, 47 % joined (1,271 of 2,706), so thin: pocket-only 11.7/14.6 (143, to 11-06 14:00) → 32/39.1 (7, 19:25-00:13); no-code 11.1/14.6 (162) → 14.8/30.1 (6); code 10.8/14.6 (161) → 5.1/34.3 (24). [m] T, G. The code drop is the related-only cut, not a speedup from load

## vector 2: the dose

Lanes are coder-role sessions with 5+ tool calls that hour. Sessions drop probes. Wing 1's point holds: heavy runs load the cpu, idle sessions do not. W1 `cases.md`, 11-07: with a go run, git took 3.6 cores; with none, 0.3 cpu-s in 10 s; a mods suite took 8.7 cores; about 15 sessions, the app and the os about 4. Two 10 s windows, one each. W1 `cpu-load.md`, 11-06: load 51 with only a go run (n=24), 21 with nothing queued (n=8).

Hour by hour, commit step p50 (no mods), push step p50, load p50:

- 11-05 22: 2 lanes, 17 sessions, heavy 0.1, 16.4, 32, no log
- 11-06 00: 2 lanes, 9 sessions, heavy 0.3, 15, 29, no log
- 11-06 15: 4 lanes, 17 sessions, heavy 0.1, 15.3, 29.3, no log
- 11-06 16: 4 lanes, 15 sessions, heavy 0.1, 16.7, 32.7, no log
- 11-06 17: 5 lanes, 13 sessions, heavy 0, 15.3, 31.6, no log
- 11-06 18: 4 lanes, 12 sessions, heavy 0.1, 15.6, 32.3, no log
- 11-06 19: 4 lanes, 13 sessions, heavy 0.4, 22, 34, load 18
- 11-06 20: 4 lanes, 24 sessions, heavy 1.5, 30.7, 48.7, load 35.9
- 11-06 21: 5 lanes, 25 sessions, heavy 0.8, 31.2, 45.1, load 30.4
- 11-06 22: 5 lanes, 16 sessions, heavy 0.7, 32.5, 46, load 32.2
- 11-06 23: 5 lanes, 22 sessions, heavy 0.9, 30, 56.6, load 34.7
- 11-07 00: 5 lanes, 14 sessions, heavy 1, 37.7, 103.7, load 37.3
- 11-07 01: 5 lanes, 17 sessions, heavy 0.7, 13.1, 60.2, load 35.8
- [m] T, R, Q. Heavy = go and mods suites in flight, averaged over the hour. Heavy before 19:39 undercounts, because wrapped scripts leave no row then

Duration against dose, same workload only:

- Commit step by lanes, 11-01 to 19:25: 0 lanes 13/15.5 (140), 1 lane 12.7/18.8 (261), 2 lanes 14.6/23.9 (268), 4 lanes 16.4/43 (69), 5 lanes 16.1/26.4 (11). [m] T, R
- Push step by lanes, same span: 0 lanes 29.1/34.2 (65), 1 lane 29.1/34.9 (121), 2 lanes 31/42.9 (119), 4 lanes 33.2/41.9 (26), 5 lanes 32.4/53.7 (7). [m] T, R
- Commit step by sessions in 10 min, same span: 1-6 13.6/20 (592), 7-9 14.6/24.2 (119), 10-12 16.3/33.6 (38). After 19:25: 7-9 34.9/39.8 (18), 10-12 31.1/45.9 (61), 13-15 33.2/46 (36). [m] T, R
- Test twin by load, to 00:13: under 20 37/39.4 (10), 20-30 37/41 (11), **30-40 41.5/60.1 (18), 40-60 50.5/62.9 (12), 60+ 75/103 (9)**. [m] S
- Test twin by sessions, all rows: 1-6 38.5 (2), 7-9 43/54.1 (20), 10-12 41/64.1 (34), 13-15 42.5/72 (24). [m] S, R
- Test twin by heavy runs in flight, to 00:13: none 36/62.6 (9), under 1 43/79.4 (19), 1-2 41.5/71.3 (32). [m] S. About ×1.15 for overlap
- Commit step after 19:25 by heavy: none 29.2/38.3 (29), 1-2 33.4/44.6 (64). [m] T
- Typecheck by load: 2 at 10-30, 3 at 30-60, 4 at 60+, p90 3.2 → 10.8. [m] S, n=133
- Load seen by queue rows: p50 32.7, p90 60, 31 % at 40+, 10 % at 60+, n=452. [m] Q
- Load by sessions: 1-6 15 (8), 7-9 33.7 (123), 10-12 32.4 (214), 13-15 34.6 (102). By heavy: none 29.6 (158), 1-2 34.4 (242), 2+ 38.2 (39). [m] Q, R. Thin at the low end; no load exists before 19:39

Reading: the median slows from load 30-40, and the tail from the same point. **No lane or session count marks that line by itself.** 4-5 lanes with few visible heavy runs sat on the 2-lane numbers. [i]

## vector 3: lane pace

Chunks are merged prs, first commit to merge. Commits and churn are not equal work. Lanes that land straight on main without a pr are not in this list; their `final` has no usable timestamp.

- By merge window: 09-26 to 10-18 0.5/1.8 h (n=50), median churn 468, 1,036 lines/h. 10-19 to 10-31 0.9/2.3 h (17), 507, 817 lines/h. 11-01 to 11-06 14:00 1.7/4.4 h (6), 1,587, 834 lines/h. After 14:00 2/8 h (7), 1,212, 347 lines/h. [m] P
- By mean busy lanes over its span: under 1.5 lanes 0.9/2.2 h (23), churn 507, 8.7 commits/h. 1.5-2.5 lanes 0.6/2.3 h (41), churn 789, 11.9 commits/h. 2.5-3.5 lanes 0.6/3 h (5), churn 956, 7.6 commits/h. 3.5+ lanes 1.5/7.8 h (11), churn 515, 4.4 commits/h. [m] P, R
- Tangle: these prs also carry new review rounds and flow gates (frame#129 took 8.2 h, #130 7.8 h). [m] P. Their share of the wall is not separable [i]

Per coder session-hour, by cohort (tool calls, commits; model %, bash %, background wait %, idle %):

- 1 lane, 10-19 to 11-05: 150.6, 4.5; 36, 32, 9, 22. n=53
- 2 lanes, 10-19 to 11-05: 149.6, 4.9; 33, 20, 21, 26. n=36
- 2 lanes, 11-05 18:00 to 11-06 03:00: 121, 3.9; 24, 9, 37, 30. n=18
- 4-5 lanes, 11-06 15:00 to 20:00: 66.9, 2.3; 17, 7, 41, 35. n=21
- 5 lanes hot, 11-06 20:00 to 00:00: 71.1, 2.2; 12, 7, 62, 18. n=19
- 5 lanes, 11-07 00:00 to 02:00: 77, 1.8; 14, 4, 52, 31. n=10
- [m] all, R, T. Split rule: model = result to next assistant record; bash = tool_use to result; background wait = no tool pending, a background task open; idle = neither. Gaps over 30 min dropped

What this says:

- **Heat barely moved a lane: calm and hot 4-5 lanes read the same, 67 and 71 calls, 2.3 and 2.2 commits.** The drop comes with the lane count. [m] But "calm" has no load or queue log, and heavy undercounts there
- Model time is not slowed by load: span p50 A 4.1 (10,066), B 4.6 (6,977), 11-06 14:00-19:39 2.7 (2,065), E 2.6 (2,218), F 2.4 (754). [m] R, coder and reviewer. A mixes in 19 % sonnet
- The most the cpu can touch is bash plus background wait: 41 %, 41 %, 46 %, 48 %, 69 %, 56 % above. [m] Background wait also holds queue wait, long proofs and non-cpu waits, so this is a ceiling
- Cpu's own share: 46 % × 0.15 is about +7 % wall at the median, 46 % × 0.75 about +35 % at p90, against +80 % lost pace. [i]
- Failure rate does not track heat: `x lane commit` nonzero 19.5 % (948), 28.5 % (814), 27.2 % (158), 22.4 % (125), 13.2 % (38). Test step 1 of 137, twin 3 of 84. Mods "timed-out files ran again" 19 of 80 on 11-05, 31 of 195 on 11-06. [m] T, C, S, M. Exits mix refusals with test reds

## vector 4: total output

Per hour, same cohorts, frame plus bytes:

- 0 lanes, 10-19 to 11-05, 87 hours, 3.2 sessions: 5.0 commits, 2.5 code commits, 154 churn
- 1 lane, 53 hours, 6.2 sessions: 12.6 commits, coder 4.5, 7 code commits, 1,066 churn
- 2 lanes, 18 hours, 9.3 sessions: 24.7 commits, coder 9.8, 15.3 code commits, 2,308 churn
- 2 lanes, 11-05 18:00 to 11-06 03:00, 9 hours, 10 sessions: 24.9 commits, coder 7.9, clio 17, 14.7 code commits, 2,838 churn, 6 prs (0.67/h)
- 4-5 lanes, 11-06 15:00 to 11-07 02:00, 11 hours, 4.5 lanes, 17 sessions: 23.8 commits, coder 9.8, clio 8.1, wing 5.8, 14.6 code commits, 2,504 churn, 7 prs (0.64/h)
- [m] T, G, P, R. Commits = `lane commit` exit 0. Churn = code files, pocket and locks out. Squashed branches that were deleted are lost to G, not to T

**Net:**

- 4-5 lanes against 1 lane: ×1.9 commits, ×2.1 code commits, ×2.3 churn. [m]
- 4-5 lanes against 2 lanes: −4 % commits, −1 % code commits, −12 % churn, +24 % coder commits (0 % against the longer 2-lane set), 2.25× the lanes, 1.7× the sessions. [m]
- Clio's commits halved at 4-5 lanes (17 → 8.1/h) while wings rose. [m] T. Whether she was busier steering is unmeasured

Per day (lane-hours, session-hours, commits, code commits, churn, prs):

- 10-23: 9, 78, 127, 75, 15,155, 9
- 10-28: 6, 41, 131, 94, 9,258, 2
- 10-30: 7, 41, 122, 68, 9,797, 1
- 11-02: 11, 59, 144, 74, 8,790, 0
- 11-03: 14, 98, 184, 74, 7,837, 0
- 11-04: 7, 84, 169, 70, 7,758, 0
- 11-05: 13, 86, 182, 103, 16,721, 4
- 11-06: 48, 198, 315, 182, 31,066, 4
- 11-07 to 02:20: 11, 38, 41, 27, 8,020, 5
- [m] G, R, P

**Two sources disagree, both reported:**

- By the hour, 4-5 lanes equal 2 lanes.
- By the day, 11-06 beat the 11-02 to 11-05 mean: ×1.85 commits, ×2.3 code commits, ×3 churn, for ×4.3 lane-hours and ×2.4 session-hours. [m]
- [i] The fleet held about 24 commits/h for about 13 hours on 11-06, where it usually holds it for 6 or fewer. More lanes may keep the top rate alive longer, or Dima simply ran longer. One day cannot say. Tiny commits count too: 69 pocket-only on 11-06

## vector 5: queue waits

Log starts 11-06 19:39, so there is **no logged usual-days baseline**.

- Commits, wait: to 00:13 11/341.6, max 989, 122 min total, 25 of 69 over 60 s. 00:13 to 01:40 35/193.9, max 476, 32 rows. After 01:40 0/0, 12 rows. [m] Q
- Commit wait plus run: 67/371.6 (69), 122/479.2 (32), 39/101.7 (12). [m] Q
- Against a usual call of 40.9/76.6 (B, transcripts, wait unknown): ×1.6 at p50, ×4.8 at p90 for to 00:13. About ×1.3 at p50 once the 12 s suite jump is out. [i] Classes differ
- Trace turn step, 00:13 to 01:40: 77.6/289.3 (27), after 01:40 0.1/1.1 (10). [m] T. It disagrees with Q's 35/193.9 for the same window; both given
- Push wait: to 00:13 22/255.2 (37), to 01:40 38/185.7 (22), after 0/0 (7). [m] Q
- Go wait: 88/393 (41), 200.5/318.4 (28), 164/330.2 (15). [m] Q
- Mods wait: 240/598 (17), 100/283.6 (7), 2 (1). [m] Q
- All rows: 892 min waited against 605 min run in 6.6 h, about **2.25 sessions stuck at any moment**. [m] Q. If it all fell on 4.5 lanes, up to 30 min per lane-hour, the same size as the lost pace. [i] An upper bound: wings and wrapped proofs share it
- Before the log, "calm" 11-06 hours already had long waits: clio 1,116, 1,084 and about 690 s, lane 6 874 s, ci 948 s, lane 5 268 and 248 s, wing 1 1,500 s; a holder was usually a mutant round. W1 `proposal-superseded.md`, 11-06. Single cases, not a rate. This may explain why calm and hot 4-5 lanes read alike [i]
- W1's 20:00 to 22:05 budget agrees in shape: commits ran 16 min, waited 76 min, n=34. W1 `cpu-load.md`, 11-06
- The zero waits after 01:40 fall with the leak's end and the lanes finishing, so the cause is not separable. Hour 02 had 1 busy lane. [m] R

## what would make this causal

A planned ramp, after #139 merges:

- Doses 1, 2, 3, 4, 8 lanes, in shuffled order, 60 minutes each or until the set is done; 3 is the missing dose
- The same work: a fixed set of replayed chunks from one sha, scored by chunks finished and median chunk wall, not commits
- Wings, mutant rounds and bench runs off; reviewers paired as usual; clio's steering scripted so her attention is not the limit
- Each step logs load and top every 10 s, every go and mods run with its cpu-seconds, queue wait, and the trace steps
- Two passes per dose at least. The A/B already listed in W1 `cases.md` (the same go run with all sessions stopped) settles the suite's own cost

## what could not be measured

- Load before 11-06 19:39, and queue wait as a rate before it. So "calm" 15:00-19:00 is inferred from flat steps and few visible heavy runs
- Any hour at exactly 3 lanes since 10-19
- The same chunk run at two doses; chunk size is only churn
- Anything after frame#139
- Why tool calls per lane-hour fell at 4-5 lanes before the heat: queue wait, longer proofs, new flow gates, or clio's attention. All fall together
- Chunks without a pr, and a clean mods dose response
- Thermal throttling; W1 notes `pmset` reports nothing at 106 °C?
- Background wait split into queue, cpu and other; the transcripts do not separate them

Scripts and intermediate rows, scratch only: `/private/tmp/claude-501/-Users-dima-frame--clio/89a213e9-b64e-4fdc-b88d-0cce686988a7/scratchpad/`

<!-- end -->
