---
dies-when: folded into wishkeeper-cadence.md's verdict
---

Ticket: FRM-491

# wishkeeper cadence: the 2026-11-18 remeasure, graded

The remeasure that `docs/research/wishkeeper-cadence.md:24-30` specifies, run read-only on 2026-11-18 by a researcher card. The window opens at the landing commit a4bca116 (2026-11-11 22:49:04 +0200, `git show a4bca116`) and closes at 2026-11-18 11:25 +0200. Nothing from before the landing is counted (`wishkeeper-cadence.md:26`).

## the call: kept

- **kept.** No card rule shows a loss big enough to roll back. The card has not changed since the one that was replayed: `git log a4bca116^..HEAD -- _clio/.claude/agents/wishkeeper.md` shows only a4bca116 and 29db59e4 (2026-11-11 22:49:53).
- the three numbers that decide it:
  1. **highs real: 79 % → 96 %.** That is 33 of 42 in the baseline grade (`wishkeeper-cadence.md:18`) and 93 of 97 now, with every high graded. The other 4 are hygiene. None is false.
  2. **catches per run: about 2.2 → 2.9, at about 36k wishkeeper tokens a catch.** The baseline, modelled the same way over all 170 siesta reports, is 1.72 × 0.79 + 4.18 × 0.21 = 2.24. It was 2.5–3.2 per trigger and 0.6 for the pre-merge chunk reads (`grades.md:9,25-31`). Now it is 1.23 highs × 0.96 + 3.84 mediums × 0.45 = 2.91.
  3. **regression set: 5 of 7 caught at their own spot (6 of 7 counted leniently), on this same card.** Case 2 (the clio-revive effort claim) missed once. The kill rule needs two misses (`docs/test-drive/wishkeeper-cache/regression-set.md` § replays, 99e091aa, 2026-11-11 23:57).
- the cost of keeping it:
  - real highs per run fell a little, from 1.72 × 0.79 = 1.36 to 1.23 × 0.96 = 1.18. Mediums now carry more of the catches.
  - tokens per siesta run fell only 9 %.
- watch: the regression replay of case 2 (the «claims at HEAD on the exact path» rule) is owed. A second miss there rolls that rule back by the kill rule. Today it is not replayed (see § regression set).

## sources and method

- transcripts: `~/.claude/projects/-Users-dima-frame--clio/*.jsonl`, read 2026-11-18. In the window, 111 `Agent` calls have `subagent_type: "wishkeeper"`, in sessions 1e70bf35, 6664e8d8, 028a696e, 83c5325c, e293e197, 24041bcc, 71eef4ac, d5a522a8 and cad235d7.
  - records were deduped by uuid. f6de81e0 repeats 1e70bf35's rows.
  - each run's report and its `<subagent_tokens>` / `<duration_ms>` come from its task-notification, wherever it sits: a user row, a `queue-operation` enqueue, or a `queued_command` attachment.
  - 110 of 111 runs have a report. R41 (028a696e, 2026-11-12 20:56Z) never finished; its subagent file `agent-a2c05b909b756ef69.jsonl` stops mid-tool-call.
- modes, from each run's description and brief:
  - siesta 80
  - checkpoint or CST 15
  - regression replay 7
  - boot 5
  - pre-merge or land read 3
  - other 1 (R93, «borrow words lost?»)
- a census row is one successful `siesta-gate.ts open` Bash call, the same rule as the baseline (`census-summary.md:7`):
  - it joins every non-checkpoint, non-boot, non-replay wishkeeper call in the same session after the open, up to 120 min and before the next open
  - trigger: the last Stop-hook «siesta due: …» line in the session between the previous open and this one
  - thread: the session's `customTitle` («🦉🪽 clio: wing 1» means wing-1)
  - commits: per thread, from the `Agent:` trailer (`git log --all`)
  - skip reasons: `~/.local/state/clio/wishkeeper-skips.log` and `threads/wing-1/wishkeeper-skips.log`, written by the gate's `skip` verb (`_clio/script/siesta-gate.ts:672-683`)
- findings are the severity-led bullets of each report, cut off before its «open findings / prior mediums» section. Lows are the report's own `lows: N` line. The count matches the report's own count line on all but 5 runs (R14, R58, R75, R81, R107, all off by 1 or 2). On those the bullets were used.
- the grade follows the baseline's brief (`grades.md:17`), with the same five labels and the same acted-or-dropped column:
  - **every high** (97) was graded
  - **15 mediums per trigger group** were drawn at random with a fixed seed (20261118). There are 71, because two groups have fewer than 15
  - lows are never listed by the new card, so none could be drawn
  - each finding was graded on what clio did next in its transcript: the `siesta-gate.ts card` / `high <n> fixed|parked` calls, her card to dima, `x linear` writes and commits
- spot checks at the cited file or commit (`git -C ~/frame show/log/grep` at the sha or time named). All 15 came out as the finding said:
  - F272 (81e2364a dropped `$steps`; fixed in cc26ec0e, 2026-11-15 18:49)
  - F238 (58e4d965 is the 2026-10-01 «cli v0» commit; the right undo is 81c0a8c7)
  - F249 (`compact-carry.sh` at ee3ca937 runs `to_entries[]` on the top level; fixed in 8721ef6a)
  - F358 (`rows.js:182 fileLinks` exists at 2eece4c5)
  - F230 (no docs-only rule in `register.tsx` at 0069e69d)
  - F72 (5c5cd584 / 61fc7d28 / e89b5b8c, then the fix fab5549f at 17:38)
  - F16 (e5dc0a41 is wing 1's own plugin-x bump)
  - F182 (`craft-fleet-flow.md:40` and `craft-pm.md:51` still carried the pick; fixed in a1fff5ff)
  - F256 (no «print in full» line before 3d73a5c9)
  - F74 (the three commits not on origin then, on origin now)
  - F3 (`siesta/SKILL.md:43` at a4bca116; fixed in c54222f1)
  - F26 (no `--bump` in the clio skills at 01:45)
  - F160 (`shape-recipe/SKILL.md:17` has no opener)
  - F202 (`.gitignore:160` is `.scratch/`)
  - F227 (`memory-budgets.tsv:43` still names `lowtide-lanes-checkup`)
- scripts and intermediate files sit in `/private/tmp/claude-501/-Users-dima-frame--clio/cad235d7-e5fe-4977-a36b-95e7b8142e75/scratchpad/rm/`: `extract.py`, `census.py`, `findings.py`, `grades.py`, `bodies.txt`, `follow2.txt`.

## census (`census-2026-11-18.jsonl`, 90 rows)

- the census sits beside this run, at `/private/tmp/claude-501/-Users-dima-frame--clio/cad235d7-e5fe-4977-a36b-95e7b8142e75/scratchpad/census-2026-11-18.jsonl`. It has the baseline's fields, plus `lows_listed`, `session`, `runs` and `skip_logged`.
- rows by thread and by wishkeeper:
  - 90 siestas: main 66, wing-1 24
  - wishkeeper spawned on 80, none on 10
- siestas per local day:
  - 11-11: 4 (from 22:49 on)
  - 11-12: 24
  - 11-13: 33
  - 11-14: 1
  - 11-15: 7 (the weekly meter halt at 99 %, skip log 2026-11-15T19:42Z)
  - 11-16: 16
  - 11-17: 4 (after midnight)
  - 11-18: 1
- that is 13.8 a day over the 6.5-day window, and 24–33 on the two full work days. The baseline had 23–46 a day from 11-03 (`wishkeeper-cadence.md:14`).
- gap between siestas on one thread: median 37.7 min, p90 100 min, 1 under 3 min. The baseline was a median of 19.6 and a p90 of 107.2, with 15 under 3 min (`census-summary.md:49,54`).
- triggers. Each row's reason lists its parts; the new gate adds «ticket close(s) or sign(s)» (a4bca116):
  - close or sign alone: 54
  - files + memory: 14
  - files + memory + close: 10
  - files alone: 4
  - files + memory + close + ping: 3
  - ping alone: 2
  - files + close + ping: 1
  - unknown: 2
- a ticket close or sign is now the main driver, at 68 of 90 rows. On 2026-11-13 the gate stopped counting a lone close inside 30 min of the last siesta (614fb620 at 18:52, then 2a90802f at 19:35).
- runs and tokens:
  - 83 wishkeeper runs sit inside rows, with 8,435,710 tokens
  - 80 of them are siesta mode, with 79 reports and 8,256,895 tokens
  - all 111 wishkeeper calls in the window used 10,632,819 tokens
- the 10 rows with no siesta-mode run:
  - 6 carry a logged skip with a reason
  - 4 had only a checkpoint or boot-mode read inside them (2026-11-13 13:10Z and 17:42Z, 2026-11-16 16:42Z, 2026-11-18 09:21Z) and no skip. The gate's `card` accepts any wishkeeper spawn since the open (`siesta-gate.ts:685-695`).
- in all, 14 skip lines were logged in the window, every one with a reason (13 main, 1 wing-1).

## the grade (168 findings, 49 reports)

- highs (97):
  - caught 93, hygiene 4, cosmetic 0, false 0, duplicate 0
  - acted 95, dropped 0, unknown 2 (F50 and F51: R24's card was never printed and a skip went in its place at 13:40Z)
- mediums (71):
  - caught 32, hygiene 34, cosmetic 3, false 0, duplicate 2
  - acted 50, dropped 0 seen, unknown 21 (no action in the ~100 min after the report, and no mention)
- shares weighted by severity, over 97 highs and 303 mediums. Lows are not listed, so they cannot be graded:

| label | baseline (`wishkeeper-cadence.md:19`) | now |
|---|---|---|
| caught | 19 % | 57 % |
| hygiene | 58 % | 37 % |
| cosmetic | 12 % | 3 % |
| false | 5 % | 0 % |
| duplicate | 6 % | 2 % |

- the two shares are not like for like: the baseline's includes the lows, 48 % of its findings. Counting highs and mediums only, the baseline caught rate is (293 × 0.79 + 711 × 0.21) / 1004 = 38 %, against 57 % now.
- what the catches are:
  - claims to dima that were false at HEAD (F16, F22, F58, F74, F115, F169, F170, F208, F256, F272, F358, F366)
  - closes that dropped his asks (F21, F117, F132, F149, F200, F230)
  - his words with no home or bent (F6, F12, F30, F44, F79, F80, F87, F130, F266, F268, F303, F324, F337)
  - signed lines changed silently (F37, F86, F97, F181, F350)
- not seen in the sample: a loose-end-only finding, a style-only finding, or a high that clio checked and refuted.

### per trigger group

| group | rows | siesta runs | highs/run | graded highs caught | graded mediums caught | caught/run | tokens/catch |
|---|---|---|---|---|---|---|---|
| close or sign alone | 54 | 48 | 1.06 | 49/51 | 6/15 | 2.51 | 38k |
| memory + close (± files, ping) | 13 | 13 | 1.85 | 23/24 | 7/15 | 3.35 | 37k |
| files + memory | 14 | 12 | 1.08 | 12/13 | 8/15 | 3.40 | 32k |
| files | 4 | 3 | 1.00 | 3/3 | 8/13 | 3.67 | 31k |
| other (ping, unknown, files + close + ping) | 5 | 3 | 2.00 | 6/6 | 3/13 | 3.00 | 47k |

- caught/run is modelled as in the baseline (`grades.md:31`): each group's caught rate per severity, times its full severity counts. Groups with under 5 runs are ±1 or more.
- the close-only trigger is the cheapest per run but the thinnest: 17 of all 79 reports had no high, and close-only rows hold 10 of them.

## per-run numbers against the baseline

| measure | baseline (2026-10-30 → 11-11) | now (11-11 22:49 → 11-18 11:25) | source |
|---|---|---|---|
| wishkeeper tokens per run | 101.8k (26,777,391 / 263, census runs); 115k (19.6 m / 170, siesta reports) | 102.9k (8,435,710 / 82 census runs with tokens); 104.5k (8,256,895 / 79 siesta reports), −9 % like for like | `wishkeeper-cadence.md:15`, `grades.md:14`; census |
| highs per run | 1.72 (293 / 170) | 1.23 (97 / 79) | `wishkeeper-cadence.md:17` |
| highs real share | 79 % (33 / 42) | 96 % (93 / 97) | `grades.md:8`; § the grade |
| catches per run | 2.24 modelled overall; 2.5–3.2 per trigger, 0.6 pre-merge | 2.91 modelled; 2.5–3.7 per group | `grades.md:9,31` |
| lows listed (should be 0) | 942 of 1,946 (48 %) | **0 of 400**. Lows exist as one count line, 234 in all: 37 % of the 634 findings, never listed | `wishkeeper-cadence.md:17`; reports |
| dropped share | about half of all findings (52 %), 20 of 24 lows, 3 of 42 highs | 0 dropped seen; 23 of 168 graded (14 %) have no visible action. Upper bound 14 % | `grades.md:8,19` |
| siestas a day | 23–46 (11-03 → 11-11) | 13.8 over the window; 24–33 on full work days; median gap 19.6 → 37.7 min | `wishkeeper-cadence.md:14`, `census-summary.md:49` |
| skips logged with a reason | 3 of 57 | 14 of 14 logged lines have a reason; 4 rows had no siesta-mode run and no skip | `census-summary.md:68`; skip logs |

## the prior quick read, against this grade

- the quick read was made from self-logged rows in `docs/test-drive/pre-merge-siesta.md`, on n = 38 runs (`…/scratchpad/remeasure-verdicts.md` § 1):
  - highs/run 0.95
  - tokens −6 %
  - lows 36 %
  - 0 skips after 22:49
- this read, from the transcripts on n = 79 siesta reports:
  - **highs/run 1.23.** Those rows cover only about half the runs.
  - **tokens −9 %** like for like.
  - **lows listed 0.** The 36 % in the quick read is the `lows: N` count line, which the card allows (`wishkeeper.md` § output: «lows are one count line, `lows: N`, never listed»). The rule is met.
  - **14 skips logged after the landing,** every one with a reason (`~/.local/state/clio/wishkeeper-skips.log`, first line 2026-11-11T21:29:53Z).
- the quick read's verdict («KEEP, provisional») stands.

## regression set

- the set: seven cases in `docs/test-drive/wishkeeper-cache/regression-set.md` (894d7ecb, 2026-11-11 23:11):
  - cases 1–5 are `grades.md`'s five best catches (#69, #84, #72, #47, #3)
  - case 6 is the 11-11 crow-wake high
  - case 7 is the «all four worked» claim sent with no check
  - this is the set that `wishkeeper-cadence.md:29` names
- **not replayed today.** A replay spawns seven blind wishkeeper runs (about $3.27 each, $22.89 in all, `docs/test-drive/wishkeeper-cache.md` at 99e091aa). This card is read-only and cannot spawn agents, so the 11-18 rerun is still owed.
- **the one replay that exists falls in the window and ran on today's card.** It was 2026-11-11 23:45, card 29db59e4, Opus 5.5 medium, runs R6–R12 in 6664e8d8, 21:34–21:35Z (`regression-set.md` § replays, 99e091aa). Results:
  - caught at its own spot and severity: 4 of 7 (cases 1, 4, 6, 7)
  - case 3: caught as a medium, not a high
  - case 5: caught on its sibling FRM-472, not at the FRM-471 spot
  - case 2 missed: the clio-revive effort gap, which falls under the claims check
- losses, by the doc's rule («each one it misses is a loss»):
  - 1 strict loss (case 2)
  - 2 partial (cases 3 and 5)
- the kill rule rolls back the rule behind a case only after two misses. Case 2 has one, so no rule is rolled back today.

## what i could not verify

- the grade's caught calls on Linear-only spots rest on wishkeeper's report plus clio's read-back in the transcript, not on my own read. That covers the ticket bodies, W-lines and sort orders: F37, F86, F97, F117, F197, F303, F383, F387 and others. «?»
- «false 0 of 97» is likely too kind. Clio checked each high before acting and refuted none, but I re-checked only 15 findings by hand, all at git spots. «?»
- acted vs dropped is read from about 100 min of transcript after each report. A fix made later or in another thread reads as «acted «?»», so the 23 unknowns are an upper bound on dropped.
- 11-14 and 11-17 hold almost no siestas. The gap is in the transcripts: no clio session ran on 11-14, and the weekly meter halt fell on 11-15. So «siestas a day» mixes a quiet weekend with the gate change. «?»
- `commits_in_window` counts only commits carrying an `Agent: clio…` trailer. The baseline's method for that field is not written down, so the two may differ. «?»
- the cause of R24's missing card is not in the transcript. That siesta (2026-11-12 13:10Z, 3 highs) never printed a card: the 13:40Z skip says its findings «ride the 15:19 siesta read and the checkpoint CST check», and only 3 of its findings show in the flawlog at 13:20Z. «?»
- R41 (2026-11-12 20:56Z) has no report and no token count.

## per graded finding

format: F# · wishkeeper spawn time (utc) · run and session · group · severity · label · acted/dropped — the finding's headline, cut short

- F1 · 11-11 20:57z · R2 1e70bf35 · other · medium · duplicate · acted — a relayed «fixed» was proven at rest, but the complaint was about scrolling
- F2 · 11-11 20:57z · R2 1e70bf35 · other · medium · caught · acted — his «do now.» landed on the chat ticket, but it answered the autopilot interview ask
- F3 · 11-11 20:57z · R2 1e70bf35 · other · medium · hygiene · acted — the siesta skill still says crow owns claims, but the new card makes claims wishkeeper's first check
- F4 · 11-11 20:57z · R2 1e70bf35 · other · medium · hygiene · acted — FRM-570 is red in the close net with nothing done about it
- F5 · 11-11 20:57z · R2 1e70bf35 · other · medium · hygiene · acted — the crew-pm-flow board is stale after the siesta flow changed
- F6 · 11-11 20:57z · R3 6664e8d8 · other · high · caught · acted — four of dima's messages since the stamp have no groom and no home
- F7 · 11-11 20:57z · R3 6664e8d8 · other · high · caught · acted — dima ticked o62 «keep halt + second wind», but the halt has no wishkeeper read to keep
- F8 · 11-11 20:57z · R3 6664e8d8 · other · high · caught · acted — «FRM-491 is built» (22:48 reply, and the ticket comment «each new branch red-proven») skips § final items t…
- F9 · 11-11 20:57z · R3 6664e8d8 · other · medium · hygiene · acted «?» — FRM-491's body does not match the shape it was re-signed to at 22:39
- F10 · 11-11 20:57z · R3 6664e8d8 · other · medium · hygiene · acted — clio's promise to take over main's «siesta trigger reshaped» line was never kept
- F11 · 11-11 20:57z · R3 6664e8d8 · other · medium · hygiene · acted «?» — a second `x plugin bump --apply clio` ran after the land had already bumped (ee5d08f9, 0.3.504→0.3.505). `_…
- F12 · 11-11 21:18z · R5 1e70bf35 · close · high · caught · acted — his on-until-off want and its 2 h setting live only on a canceled ticket
- F14 · 11-11 21:18z · R5 1e70bf35 · close · medium · caught · acted — a flyway close moved four of his five 00:56 lines
- F15 · 11-11 22:27z · R14 6664e8d8 · memory+close · high · caught · acted — the thread-names rewrite never landed, but dima was told it was landing and the flyway line was cleared as…
- F16 · 11-11 22:27z · R14 6664e8d8 · memory+close · high · caught · acted — «not mine» about the staged plugin-x bump was false
- F20 · 11-11 22:27z · R14 6664e8d8 · memory+close · medium · caught · acted — FRM-570 comment «open, wing 1's call: a script run by path … passes the caller check as dima», the 00:18 re…
- F21 · 11-11 22:31z · R15 1e70bf35 · memory+close · high · caught · acted — the close of FRM-544 dropped three of his asks
- F22 · 11-11 22:31z · R15 1e70bf35 · memory+close · high · caught · acted — the «verified» claim that core 0.1.20 has no release notes is wrong, and tail 3 was called done
- F25 · 11-11 23:42z · R17 6664e8d8 · memory+close · high · caught · acted — a false «👀 look sent» stamp got two tickets past the gate and closed without dima's look
- F26 · 11-11 23:42z · R17 6664e8d8 · memory+close · medium · hygiene · acted — FRM-436 closed while its `🔌 fleet wired` line is false
- F29 · 11-11 23:42z · R17 6664e8d8 · memory+close · medium · caught · acted — a decision sixth sense left for dima never reached him
- F30 · 11-11 23:43z · R18 1e70bf35 · memory+close · high · caught · acted — dima's o142 tick was resolved «as ticked», but nothing carries the rider he ticked
- F32 · 11-11 23:43z · R18 1e70bf35 · memory+close · medium · hygiene · acted — both clio plugin bumps were never committed
- F34 · 11-12 00:55z · R19 1e70bf35 · close · high · caught · acted — his boot order says to start the mods lane at once, but the reminder and the handoff make it wait for FRM-5…
- F37 · 11-12 00:59z · R20 6664e8d8 · close · high · caught · acted — FRM-505's signed ticket was edited tonight with no line in its `## signed` block
- F44 · 11-12 12:42z · R23 028a696e · close · high · caught · acted — his ask for a compromise on forks was dropped, and the reply told him forks keep working
- F45 · 11-12 12:42z · R23 028a696e · close · high · caught · acted — the rename door is a new verb waiting on «dima's word», but no ask was put to him
- F49 · 11-12 12:42z · R23 028a696e · close · medium · caught · acted — `/Users/dima/.local/state/clio/grooms/wing-1/2026-11-12.no-wish.md` «14:22 — its wants folded by hand as FR…
- F50 · 11-12 13:10z · R24 83c5325c · other · high · caught · acted «?» — wishes from 14:38 to 15:07 have no home. clio said they ride in FRM-562 and FRM-563, but neither ticket hol…
- F51 · 11-12 13:10z · R24 83c5325c · other · high · caught · acted «?» — FRM-563:W5 as groomed bends his «you» into «codie».
- F52 · 11-12 13:10z · R24 83c5325c · other · high · caught · acted — the «W6 corrected to «cars»» claim is false where it matters, and his answer was never asked for.
- F53 · 11-12 13:10z · R24 83c5325c · other · medium · hygiene · acted — the five session rules (PK-380, o5) were broken in the replies after 14:25.
- F54 · 11-12 13:10z · R24 83c5325c · other · medium · caught · acted — the codeberg mirror is still red on `main` after the «fix».
- F55 · 11-12 13:10z · R24 83c5325c · other · medium · hygiene · acted — `_clio/memory/_reminders.md:74`: the empty-wakes re-count reminder still says «due: 2026-11-10». It wanted…
- F56 · 11-12 13:10z · R24 83c5325c · other · medium · hygiene · acted — PK-380:W4 ❓ «i also want to know how our silent comms works»: there is no answer in any reply since the sta…
- F57 · 11-12 13:10z · R24 83c5325c · other · medium · caught · acted «?» — `brief-pass-1.md:23`: «monochrome, colour only when a button is on» comes from grill 1's proposal #3, which…
- F58 · 11-12 14:14z · R26 028a696e · close · high · caught · acted — the «0 member turns» count only measured its own blind spot
- F59 · 11-12 14:14z · R26 028a696e · close · high · caught · acted — reverting slice 07 c) turns the start-door refusal back on as a hard refusal, against o18's «new refusals w…
- F66 · 11-12 14:23z · R27 83c5325c · close · high · caught · acted — FRM-581 sign write put the old body back, and the reply said crow's fixes were in
- F67 · 11-12 14:23z · R27 83c5325c · close · high · caught · acted — his «do not forget» reminder was dropped on a verdict its own data does not support
- F72 · 11-12 15:25z · R29 028a696e · close · high · caught · acted — the pocket-check fix lets a W-line be dropped without his verdict when the drop sits in parentheses
- F73 · 11-12 15:25z · R29 028a696e · close · high · caught · acted — «make flyways pretty» (dima 16:19) was dropped, and the prompt was groomed as no-wish
- F74 · 11-12 15:25z · R29 028a696e · close · high · hygiene · acted — «Landing now» (17:15, 17:24) is false. Every land after 5c5cd584 was rejected
- F75 · 11-12 15:25z · R29 028a696e · close · medium · hygiene · acted «?» — «I checked every other line [of main's flyway] against its ticket or lane, and none was finished» (17:24) h…
- F79 · 11-12 15:25z · R28 83c5325c · files · high · caught · acted — his 16:51 and 16:58 words have no home: both were filed as "no wish", and the 16:58 one under the wrong reason
- F80 · 11-12 15:25z · R28 83c5325c · files · high · caught · acted — FRM-581's re-shape and its build spec skip the wishes the re-shape settles
- F81 · 11-12 15:25z · R28 83c5325c · files · medium · hygiene · acted — W5 and W11–W18 now live in two homes
- F82 · 11-12 15:25z · R28 83c5325c · files · medium · caught · acted — FRM-579's signed decided line no longer holds, and there is no `changed` line
- F83 · 11-12 15:25z · R28 83c5325c · files · medium · cosmetic · acted — FRM-581's title still describes the dropped shape
- F84 · 11-12 15:25z · R28 83c5325c · files · medium · hygiene · acted — close net 🔴 FRM-576 is still red after the 16:24 due comment (the comment's form isn't read as a reason to…
- F85 · 11-12 15:25z · R28 83c5325c · files · medium · hygiene · acted — blueprint drift 🟡 on the crew-pm board v18: `halt/main.md` and `pocket-check.ts` changed after it
- F86 · 11-12 16:42z · R32 83c5325c · memory+close · high · caught · acted — FRM-572 chunk 2 was re-signed, but the ticket body was never changed, and a scope from FRM-505 was moved in…
- F87 · 11-12 16:42z · R32 83c5325c · memory+close · high · caught · acted — his «no bot protection wanted» on FRM-490 was dropped
- F88 · 11-12 16:42z · R32 83c5325c · memory+close · medium · hygiene · acted — the lowtide rename leaves the old skill paths in the memory budgets, and the 7 new files have no rows
- F89 · 11-12 16:42z · R32 83c5325c · memory+close · medium · caught · acted — FRM-505 was reported to him as «unsigned», with no read behind it
- F91 · 11-12 16:42z · R32 83c5325c · memory+close · medium · cosmetic · acted — checkup runs at 18:34 and 18:38 printed the lane header as three bullet lines, while `lowtide/references/sh…
- F92 · 11-12 17:23z · R33 028a696e · memory+close · high · caught · acted — PK-362 now has two live homes, and the one in wing 1's flyway ignores his pause
- F96 · 11-12 17:57z · R35 83c5325c · memory+close · high · caught · acted — you were told FRM-490 is parked as `someday`, but it is still open and next in line, and your steer is miss…
- F97 · 11-12 17:57z · R35 83c5325c · memory+close · high · caught · acted — FRM-504 was re-signed as «warn, never block», but its done test and title still call for a refusal
- F101 · 11-12 17:57z · R35 83c5325c · memory+close · medium · hygiene · acted — the main flyway (`/Users/dima/frame/_clio/pocket/tasks/pk-349 - flyway-main.md`, after 520dcf40) still list…
- F102 · 11-12 18:39z · R36 028a696e · memory · medium · hygiene · acted — FRM-566's W-lines were rewritten while main was grilling it, and no one told her
- F103 · 11-12 18:39z · R36 028a696e · memory · medium · caught · acted — six groom files were copied from the folded ticket text, not from his raw prompts
- F104 · 11-12 18:39z · R36 028a696e · memory · medium · caught · acted — the «let's try» half of o45 has no home
- F106 · 11-12 19:15z · R38 83c5325c · close · high · caught · acted — FRM-564:W22, the single source of truth for slipstream message states, was dropped from the split.
- F114 · 11-12 19:15z · R39 028a696e · close · high · caught · acted — the FRM-538 close left three folded retro findings with nowhere to go
- F115 · 11-12 20:32z · R40 83c5325c · memory+close · high · caught · acted — clio told dima the second-wind ping test had not run, which is false, and he ticked o171 on that claim
- F116 · 11-12 20:32z · R40 83c5325c · memory+close · high · caught · acted — the herdr blocks in Linear contradict his switch rule
- F117 · 11-12 20:32z · R40 83c5325c · memory+close · high · caught · acted — FRM-562 closed Done while his ❓ W14 had no verdict and no new home
- F118 · 11-12 20:32z · R40 83c5325c · memory+close · high · caught · acted — W17 went to FRM-580, which cannot settle it
- F119 · 11-12 20:32z · R40 83c5325c · memory+close · high · caught · acted — his «auto-second-wind work proof tomorrow too» (20:21:34Z) has no home
- F120 · 11-12 20:32z · R40 83c5325c · memory+close · medium · caught · acted «?» — `home/.config/herdr-app/mods/AGENTS.md:37` still has codies measure speed on the Metal HUD, against his «dr…
- F121 · 11-12 20:32z · R40 83c5325c · memory+close · medium · hygiene · acted «?» — `_reminders.md:60` (keep-hot habits once `mods:set hot` lands) and `:65` (sync the habits once FRM-501 and…
- F123 · 11-12 20:32z · R40 83c5325c · memory+close · medium · hygiene · acted «?» — `clio:remind` SKILL.md:29 and `_reminders.md:3` let a reminder die unasked, but several lines hold his own…
- F126 · 11-13 11:51z · R43 24041bcc · close · medium · hygiene · acted — the `wc` figures in the reply were misread from the command's output
- F130 · 11-13 12:00z · R45 e293e197 · memory+close · high · caught · acted — dima's 13:47 words on the lost message never reached FRM-597, and its signed W1 is not his wording
- F131 · 11-13 12:00z · R45 e293e197 · memory+close · high · caught · acted — the claim «the ticket's done test covers that direction too» (11:52Z) is false
- F132 · 11-13 12:00z · R45 e293e197 · memory+close · high · caught · acted — PK-389 was closed (13:51) without its 13:47 naming asks
- F133 · 11-13 12:00z · R45 e293e197 · memory+close · medium · caught · acted «?» — six chunks re-signed (11:42) before he saw what changed
- F135 · 11-13 12:00z · R45 e293e197 · memory+close · medium · hygiene · acted «?» — `pk-390` is still an empty body and his 13:33 annotator words are not in it
- F137 · 11-13 12:55z · R46 e293e197 · close · high · caught · acted — FRM-597's outbound case can still close unbuilt.
- F142 · 11-13 13:18z · R48 24041bcc · close · high · caught · acted — Clio closed FRM-598 on a nearby case, and its own done test (the ticket's 🎯 checklist) fails on the case it…
- F143 · 11-13 13:18z · R48 24041bcc · close · high · caught · acted — Clio re-sealed FRM-600's spec and the strays codie is building from it, but it skips almost all of dima's W…
- F149 · 11-13 13:41z · R49 e293e197 · close · high · caught · acted — FRM-597 is Done, but the exact failure dima reported has never been proven fixed, and that gap has no home.
- F154 · 11-13 14:00z · R50 e293e197 · close · medium · caught · acted — dima's failed hover look on FRM-594 isn't recorded on the ticket, and the lane plan still says it closed.
- F155 · 11-13 14:00z · R50 e293e197 · close · medium · hygiene · acted — FRM-590 was re-signed again with five unanswered ❓ lines. Last card's medium was the same pattern.
- F159 · 11-13 14:24z · R51 e293e197 · memory · high · caught · acted — the revamp grill ran without `clio:shape-idea`, 17 minutes after he asked whether we skip it
- F160 · 11-13 14:24z · R51 e293e197 · memory · medium · hygiene · acted «?» — the commit says «every grill skill points at it», but two grill skills don't
- F162 · 11-13 14:27z · R52 24041bcc · close · medium · caught · acted — the reopened FRM-600 still says it is closed, and calls W1–W16 met while the wing start was never built
- F165 · 11-13 14:54z · R53 e293e197 · memory+close · high · caught · acted — his rule to grill through shape-idea exists only in a message to wing 1 and a flyway log line, and memory s…
- F168 · 11-13 14:54z · R53 e293e197 · memory+close · medium · caught · acted — FRM-594's contract no longer matches what is being built
- F169 · 11-13 15:02z · R54 24041bcc · memory · high · caught · acted — clio told dima naming works on every surface. Nothing has proven the mobile app, and the ticket still waits…
- F170 · 11-13 15:02z · R54 24041bcc · memory · high · caught · acted — «Wing start, done» says the claude apps read the right name, but the only proof was fake `x` and `hc` build…
- F175 · 11-13 15:18z · R56 24041bcc · close · high · caught · acted — the Rockstar advice is built on an old reading of [FRM-506](https://linear.app/x-com/issue/FRM-506), and it…
- F176 · 11-13 15:18z · R56 24041bcc · close · high · caught · acted — the name drift at dispatch breaks a signed FRM-600 line. The fix went to an unsigned queue candidate instea…
- F180 · 11-13 15:34z · R57 e293e197 · memory+close · high · caught · acted — FRM-594's W5 drops part of his 17:16 line, and his ❓ was settled by codie's build instead of by him
- F181 · 11-13 15:34z · R57 e293e197 · memory+close · high · caught · acted — FRM-594's 🎯 done test still describes the shape he rejected at 17:16
- F182 · 11-13 15:34z · R57 e293e197 · memory+close · high · hygiene · acted — The retired «shape-idea is a pick» rule still stands two lines from its replacement
- F185 · 11-13 15:50z · R58 e293e197 · close · high · caught · acted — the deck assumption contradicts what dima said
- F189 · 11-13 15:52z · R59 24041bcc · close · high · caught · acted — clio told dima his look was "the last check FRM-600 needed", but the ticket's own reopen still lists sugges…
- F193 · 11-13 15:52z · R59 24041bcc · close · medium · hygiene · acted «?» — clio's 17:52 description of the FRM-605 fix restates a rule that has already shipped, and the actual cause…
- F197 · 11-13 16:25z · R61 24041bcc · close · high · caught · acted — clio told dima at 18:10 that no ticket holds his wireframe wish, but FRM-611 already holds it.
- F198 · 11-13 16:25z · R61 24041bcc · close · high · caught · acted — FRM-603 was closed Done, and dima told «a new ticket's first sign now reads match», on a proof from a diffe…
- F200 · 11-13 16:36z · R62 24041bcc · close · high · caught · acted — when PK-403 closed, his pick (o27) and the answers to his questions didn't move to FRM-611.
- F202 · 11-13 16:50z · R63 e293e197 · close · high · caught · acted — the two FRM-584 P2s are now live in his send button, and their only home is a gitignored scratch file
- F206 · 11-13 17:29z · R64 e293e197 · close · high · caught · acted — his 19:14 and 19:20 FRM-564 lines are not in any home
- F207 · 11-13 17:29z · R64 e293e197 · close · high · caught · acted — FRM-564's sealed exit lines now go against his newer wish lines
- F208 · 11-13 17:29z · R64 e293e197 · close · high · caught · acted — clio told him the magic send «works live» when the transcript shows otherwise
- F219 · 11-13 18:22z · R68 e293e197 · close · high · hygiene · acted — FRM-504's title half was moved to FRM-617 in only one of its homes. FRM-504 still asks for it, and nothing…
- F222 · 11-13 18:22z · R68 e293e197 · close · medium · hygiene · acted — The fleet-hazards rule ties the risk to the commit, but its own story says a saved edit is already live.
- F225 · 11-13 18:22z · R68 e293e197 · close · medium · cosmetic · acted — the checks' red: in `/Users/dima/frame/_clio/pocket`, PK-388's joined emoji (🐦‍🔥) breaks the Backlog board…
- F226 · 11-13 18:48z · R69 e293e197 · memory · high · caught · acted — FRM-626's park wiring was never built, so the peek and its gate don't run when a lane moves on to its next…
- F227 · 11-13 18:48z · R69 e293e197 · memory · medium · hygiene · acted «?» — FRM-626's rename done test fails as written, and clio's claim about it leaves out one hit.
- F230 · 11-13 19:20z · R70 e293e197 · close · high · caught · acted — FRM-504 was closed Done with dima's o7 tick never built. A round that touches only docs is still counted to…
- F231 · 11-13 19:20z · R70 e293e197 · close · high · caught · acted — the closing word's «a new chunk reads round 1» fails live on the herdr lane at HEAD.
- F236 · 11-13 19:20z · R70 e293e197 · close · medium · hygiene · acted «?» — siesta-checks blueprint drift red: `excalidraw/crew-pm-flow/board.excalidraw` is stale after ebf3e452 chang…
- F238 · 11-13 19:23z · R71 24041bcc · close · high · caught · acted — the rollback for FRM-624 would wipe six weeks of `x`
- F249 · 11-13 20:02z · R73 e293e197 · close · high · caught · acted — the compact hook's claim fails on the real store, so it still drops capped lanes
- F252 · 11-13 20:33z · R74 e293e197 · memory+close · high · caught · acted — you told him to "take care of this now", and the reply said "I'll handle it on Monday"
- F255 · 11-13 21:24z · R75 e293e197 · memory · medium · hygiene · acted — FRM-627's stray data still says there were 2 code misses, but crow corrected it to 3, and you passed the 3…
- F256 · 11-13 21:55z · R76 e293e197 · close · high · caught · acted — clio said the quiet-replies trial now carries a new rule, but the rule is not written anywhere.
- F258 · 11-13 22:22z · R77 e293e197 · close · high · caught · acted — I told dima the mods queue was nearly finished, and it isn't. His question «only 7 chunks pending… no more…
- F261 · 11-15 12:16z · R78 71eef4ac · files · medium · caught · acted — the new CST gate fights the halt's own phase 5 order
- F262 · 11-15 12:16z · R78 71eef4ac · files · medium · caught · acted — a himalaya entry he asked removed still stands
- F263 · 11-15 13:37z · R80 71eef4ac · memory · medium · caught · acted — the Linear roadmap was not changed when dima ticked chords as parked.
- F266 · 11-15 14:11z · R81 71eef4ac · memory · high · caught · acted — dima's 16:01 guard wish was never saved as a wish line, and PK-417 closed anyway
- F267 · 11-15 14:11z · R81 71eef4ac · memory · high · caught · acted — the claim «including "your words always override it"» is not what the doc says
- F268 · 11-15 14:11z · R81 71eef4ac · memory · high · caught · acted — the 15:46 wishes went missing
- F272 · 11-15 16:44z · R83 71eef4ac · close · high · caught · acted — the roadmap boot board breaks on every boot and compaction, and the 17:44 claim about it is false
- F277 · 11-15 17:20z · R84 71eef4ac · close · high · caught · acted — FRM-618's scope now says "no script", but his 19:08 words ask for one, and the reply calling the plan nonex…
- F278 · 11-15 17:20z · R84 71eef4ac · close · high · caught · acted — FRM-629 bends W12: his mod-only traps were supposed to become a leaf in guide-code, but the ticket keeps th…
- F286 · 11-15 17:34z · R85 71eef4ac · close · high · caught · acted — FRM-629 was signed at o84 without the fields a sign needs
- F290 · 11-15 18:01z · R86 71eef4ac · memory · high · caught · acted — FRM-627 still describes the separate skill that his o90 replaced, and none of his 19:43 or 19:52 words are…
- F291 · 11-15 18:01z · R86 71eef4ac · memory · high · caught · acted — nothing in the fleet would ever switch on stray mode, so Monday's stray would run as a lane codie.
- F292 · 11-15 18:01z · R86 71eef4ac · memory · medium · caught · acted — the «stray context waste under 2 %» claim left out lane-only text a stray still loads, and its 100k+ sessio…
- F293 · 11-15 18:01z · R86 71eef4ac · memory · medium · caught · acted — the batch has not landed, and dima still has the 20:01 «the batch is landing now».
- F296 · 11-15 18:01z · R86 71eef4ac · memory · medium · hygiene · acted «?» — o94 «a 'contract' miss column in stray-lane.md»: `docs/test-drive/stray-lane.md` is untouched (mtime 14:19)…
- F299 · 11-15 18:01z · R86 71eef4ac · memory · medium · caught · acted «?» — FRM-611:W47: the 18:02 write was refused («FRM-611 is signed … gained no line»), and `x linear read FRM-611…
- F303 · 11-16 12:18z · R88 d5a522a8 · memory · high · caught · acted — dima's only PK-428 words were dropped. The pocket item was then closed and archived as moved.
- F304 · 11-16 12:18z · R88 d5a522a8 · memory · high · caught · acted — his 20:43 fable-weeks steer exists only in uncommitted files. The copy that is committed says the opposite.
- F305 · 11-16 12:18z · R88 d5a522a8 · memory · medium · caught · acted — the FRM-632 spec's exit lines contradict each other, and clio moved the proof's baseline to after his layou…
- F314 · 11-16 12:52z · R89 d5a522a8 · close · high · caught · acted — the live handoff is stale, and most of the 14:46 prompt has no home yet
- F317 · 11-16 12:52z · R89 d5a522a8 · close · medium · hygiene · acted «?» — the Monday measure date has no live home
- F324 · 11-16 14:51z · R92 d5a522a8 · close · high · caught · acted — his 16:49 model-picker ask has no home, and the reply bent it
- F325 · 11-16 14:51z · R92 d5a522a8 · close · medium · duplicate · acted — PK-444 W-lines reworded in the proposal
- F327 · 11-16 15:28z · R95 d5a522a8 · close · high · caught · acted — FRM-600 was closed on a steer that reported misses, and the report says those misses are fixed. They are st…
- F330 · 11-16 15:41z · R96 d5a522a8 · files · high · caught · acted — the open high («FRM-600 closed while names still drift») is still open
- F331 · 11-16 15:41z · R96 d5a522a8 · files · medium · caught · acted «?» — his stats-counter order is held for a word he already gave
- F332 · 11-16 15:41z · R96 d5a522a8 · files · medium · caught · acted — the 🎨 designer interview's trigger has no home
- F333 · 11-16 15:41z · R96 d5a522a8 · files · medium · caught · acted — something said «I will not commit without your word» was committed without it
- F334 · 11-16 15:41z · R96 d5a522a8 · files · medium · caught · acted — the empty-wakes «good or not» answer rests on a comparison the log rules out
- F335 · 11-16 15:41z · R96 d5a522a8 · files · medium · caught · acted «?» — the wish-loss answer at 17:38 («Solved now: the stray is teaching…»; «you hear about it only on a real red»)
- F336 · 11-16 15:41z · R96 d5a522a8 · files · medium · hygiene · acted — PK-444:W118 «(A/B screenshots of the look, asked of the herdr lane)» misreads «AB SS for your look»: he gav…
- F337 · 11-16 16:18z · R97 d5a522a8 · close · high · caught · acted — dima's 17:43 herdr message and his 17:53 «see far» vote were never filed. Neither has a raw file, a groomed…
- F340 · 11-16 16:18z · R97 d5a522a8 · close · medium · caught · acted — some W-lines file clio's words as his, or bend his.
- F343 · 11-16 17:17z · R99 d5a522a8 · close · high · caught · acted — his "make sure it is planned" got a plan that exists nowhere
- F345 · 11-16 17:17z · R99 d5a522a8 · close · medium · caught · acted — a claim with no command behind it, contradicted 6 minutes later
- F350 · 11-16 17:33z · R100 d5a522a8 · memory · high · hygiene · acted — FRM-629 is a signed ticket, and this commit's skill rewrite contradicts its decided lines with no `changed`…
- F352 · 11-16 17:33z · R100 d5a522a8 · memory · medium · hygiene · acted — the card's "this card wins" rule silently drops wisphunter's read of the code rules.
- F355 · 11-16 19:21z · R102 d5a522a8 · memory+close · medium · caught · acted «?» — a promise in a reply was not kept
- F358 · 11-16 20:17z · R103 d5a522a8 · close · high · caught · acted — FRM-638 now says one-click opening of links and shot paths was never built in the old chat. The old chat do…
- F366 · 11-16 20:46z · R104 d5a522a8 · close · high · caught · acted — FRM-582 is missing his fold-in of PK-405, and the 22:29 claim that it was done is false
- F380 · 11-16 21:53z · R106 d5a522a8 · close · high · caught · acted — clio closed o149 without his tick and told him his look passed, which the look's own files don't show
- F383 · 11-16 22:19z · R107 d5a522a8 · close · high · caught · acted — merge 2 rests on a false premise and bends FRM-590's wish
- F387 · 11-16 22:53z · R108 d5a522a8 · close · high · caught · acted — FRM-643 sits first in the mods lane, ahead of FRM-602, which breaks his order and his tick
- F388 · 11-16 22:53z · R108 d5a522a8 · close · high · caught · acted — the new glide card reads `slices.md`, but nobody told the herdr codie
- F394 · 11-16 23:16z · R109 d5a522a8 · memory · high · caught · acted — his 21:54 yes to the egg-basket layout save was written back into the ticket as settled, but nothing schedu…
- F395 · 11-16 23:16z · R109 d5a522a8 · memory · medium · hygiene · acted «?» — the «look-asks carry steps» rule (o183) landed only where grills read it, so it misses most of the cases it…
- F399 · 11-16 23:16z · R109 d5a522a8 · memory · medium · caught · acted «?» — FRM-645:W1 is clio's own orbit pick text labelled «(dima, o186 tick)»

<!-- end -->
