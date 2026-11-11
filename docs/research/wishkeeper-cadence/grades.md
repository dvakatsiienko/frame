# wishkeeper's findings, graded (🐝 researcher, 2026-11-11)

read-only grade of wishkeeper's siesta findings. sources: clio's transcripts in `~/.claude/projects/-Users-dima-frame--clio/*.jsonl` (wishkeeper task-notifications, the clio turns after them), `docs/test-drive/pre-merge-siesta.md` § rounds, `_clio/.claude/agents/wishkeeper.md`, and the census at `.scratch/siesta-cadence/census.jsonl` (written 22:10, 252 rows). all dates 2026-11-11 unless noted.

## the verdict

- not cosmetic: when wishkeeper says **high**, it is a real catch about 4 times in 5 (33 of 42 graded highs). most of those would have reached dima wrong: a bent or dropped wish, a close that dropped an ask, a signed pick quietly changed, a false «done» told to him.
- most of its volume is hygiene, though. reweighted to the real severity mix, about 19 % of all findings are caught, 58 % hygiene, 12 % cosmetic, 5 % false and 6 % duplicate. about half of all findings (52 %, mostly lows) are never acted on. lows caught nothing in the sample (0 of 24).
- the triggers barely differ. every clio-batch trigger yields about 2.5–3.2 caught findings per run. the outlier is the pre-merge chunk read, at about 0.6 caught per run and about 177k tokens per catch. its strong catches come from big chunks where sixth sense's clean missed a signed line.

## how many exist, and how they were sampled

- window: the transcripts on disk start 2026-10-30, so 10-21 to 10-29 has no wishkeeper notification to read. the graded window is in practice 10-30 to 11-11.
- 286 wishkeeper notifications across 23 transcripts (main, wings, side channel); 40 are re-notifications of the same result, so 246 unique runs. modes: 196 read as siesta, 64 checkpoint, 20 boot, 6 other. i dropped the pm-module review rounds (round 4/5/7 «not a siesta») and graded only siesta mode: **170 runs, 1,946 findings (293 high, 711 medium, 942 low), 19.6 m wishkeeper tokens**. the counts come from splitting bullets that lead with a severity, cross-checked against the 9 runs that print a «N findings (h, m, l)» line; 8 of the 9 matched or were within 3.
- trigger per run: the last «🌤️ siesta due: <reason>» Stop-hook line before the spawn, grouped as memory (a memory/rule/skill file), ping (member done pings), memory+ping, files (N files of clio's, any combo), none (no due line: dima's word or a hand-run siesta), and **premerge**: the 31 chunk reads of the pre-merge trial, split out by their brief whatever their due line said, because they are a separate decision.
- sample: in each of the 6 groups, 7 highs, 4 mediums and 4 lows, drawn at random (seed fixed): **90 findings from 61 runs**. i did not grade every high: there are 293, and the ~80 budget can't hold them. highs are over-weighted in the sample (47 % against 15 % of the population), so the overall shares above are reweighted by severity. the raw sample shares are caught 42 %, hygiene 42 %, cosmetic 7 %, false 6 %, duplicate 3 %.
- grading: each finding was graded on what clio did next in the transcript (fix, ticket, orbit ask, correction told to dima, or nothing), plus a spot check where the transcript left doubt (PK-346's line, the BYT-94 reopen ask, the 10-30 fork-archive line). «acted» means fixed, ticketed, put to dima or parked with a reason. «dropped» means no action and no mention.

- dropped per label (crow's ask): caught 0 of 38, hygiene 19 of 38, cosmetic 5 of 6, false 3 of 5, duplicate 3 of 3; by severity, high 3 of 42, medium 7 of 24, low 20 of 24. clio acts on every catch and drops most lows, so a low is close to a no-op today.

## per trigger reason

census (all siestas, spawned or skipped): memory 95 (69 with wishkeeper), ping 89 (67), unknown 33 (30), memory+ping 20 (16), files 11 (10), dima 4 (3); 57 of 252 skipped wishkeeper. my run counts below are wishkeeper runs from the transcripts, so they differ a little from the census (it merges runs per siesta and tags no premerge).

- **memory** (a memory, rule or skill file): 53 runs, 5.8 m tokens, 15 sampled. caught 47 %, hygiene 40 %, cosmetic 7 %, false 7 %, duplicate 0 %; 6 of 15 dropped. ≈2.5 caught per run, ≈44k tokens per catch. caught a later read would have missed: 6 of 7.
- **ping** (member done pings): 40 runs, 4.3 m tokens, 15 sampled. caught 47 %, hygiene 33 %, cosmetic 20 %, false 0 %, duplicate 0 %; 7 dropped. ≈2.5 per run, ≈43k per catch. missed later: 6 of 7.
- **memory+ping**: 17 runs, 2.0 m tokens, 15 sampled. caught 53 %, hygiene 33 %, cosmetic 7 %, false 0 %, duplicate 7 %; 4 dropped. ≈3.2 per run, ≈36k per catch (the best). missed later: 8 of 8.
- **files** (N files of clio's, with or without memory): 16 runs, 2.3 m tokens, 15 sampled. caught 40 %, hygiene 47 %, cosmetic 0 %, false 7 %, duplicate 7 %; 4 dropped. ≈2.9 per run, ≈50k per catch. missed later: 5 of 6.
- **none** (no due line; dima's word or a hand-run siesta): 13 runs, 1.8 m tokens, 15 sampled. caught 40 %, hygiene 40 %, cosmetic 7 %, false 13 %, duplicate 0 %; 6 dropped. ≈2.9 per run, ≈48k per catch. missed later: 6 of 6.
- **premerge** (the chunk reads of the pre-merge trial): 31 runs, 3.4 m tokens, 15 sampled. caught 27 %, hygiene 60 %, cosmetic 0 %, false 7 %, duplicate 7 %; 3 dropped. ≈0.6 per run, ≈177k per catch (the worst). missed later: 3 of 4. 0 of 4 sampled mediums were caught, and 13 of its 31 runs found no high at all.
- «per run» and «per catch» are modelled: each group's caught rate per severity in the sample, times that group's full severity counts. with 7 highs per group they are rough, about ±1 per run. the ordering memory+ping > files ≈ none > memory ≈ ping ≫ premerge is the part to trust, not the decimals.
- batch size of the 38 catches (from the brief and the due line's file count): 5 small (≤3 files or «small batch»: #16, #18, #51, #86, and #21's rule fix), about 25 big, 8 unclear. small batches do catch: #18 and #21 were 1-commit reads. most catches still come from big batches.

## per wishkeeper surface

from the card's six siesta surfaces (`_clio/.claude/agents/wishkeeper.md:16-21`), each sampled finding assigned to the one it came from:

- **wishes** (21): caught 52 %, hygiene 24 %, cosmetic 5 %, false 19 %, duplicate 0 %; 6 dropped. the richest surface, and also where all its false highs sit (an ask already done, or dima's own click).
- **clio's own edits** (14): caught 57 %, hygiene 36 %, cosmetic 7 %; 2 dropped. a wish narrowed or cut while grooming a rule to fit a byte budget is the most common catch (#21, #52, #72, #75).
- **tracker** (27): caught 44 %, hygiene 48 %, cosmetic 4 %, duplicate 4 %; 6 dropped. the catches are closes and signs (a close past its done test, a re-sign that differs from the tick). the hygiene is stale marks and lines.
- **promises** (6): caught 33 %, hygiene 67 %; 4 dropped. small, and mostly carried notes.
- **claims** (10): caught 50 %, hygiene 30 %, duplicate 20 %; 4 dropped. the catches are «done/everywhere/all worked» told to dima or a peer. crow or codie had said 2 of them first.
- **loose ends** (12): caught 0 %, hygiene 67 %, cosmetic 25 %, false 8 %; 8 dropped. this surface produced no catch, and two thirds of its findings were never acted on.

## the 5 best catches

- **#69 · 2026-11-09 · wing 2, frame#152 chunk read · high**: «a risky pr needs a new `/security-review` after every push that changes code, which goes against **🙋‍♂️ dima**'s grill 2 Q6 tick». spot: `x/go/merge_auto.go:1310` against `.scratch/pk-348/grill-2-proposal.md:37-38`. prevented: shipping a merge gate that broke his signed pick, which sixth sense's clean had passed. clio: «Wishkeeper found 2 high issues that sixth sense's clean missed».
- **#84 · 2026-11-11 · wing 1 · high**: «`clio-revive` never reads a thread's effort, so every revive comes back on `--effort medium`». spot: `_clio/script/clio-revive.sh:25-27`; replies at 18:06:31Z and 18:11:52Z had told dima it read effort. prevented: a silent bug, plus a false claim to dima. fixed in 37aad6bc.
- **#72 · 2026-11-09 · main · high**: «dima's 00:01 and 00:07 wants are only partly carried, in clio's own wording». spot: `_clio/memory/craft-fleet-flow.md:49` against `prompts/2026-11-10.md:8,23`. four of his clauses had been cut to fit a size cap and then reported as in. prevented: a reuse rule missing «prefer batching» and «when i ask».
- **#47 · 2026-11-07 · wing 1 · high**: «PK-328's 28 lines moved verbatim into a Done ticket, with no accounting and one question unanswered». spot: the FRM-521 closing word, W35 ❓. prevented: a close that dropped his question and called his lines met.
- **#3 · 2026-11-02 · main · high**: «clio's steer to the lane changed dima's order». spot: lane-plan «slices 06 and 08 folded in», a42e81e4. prevented: a signed chunk (FRM-471) built folded in with no re-sign; it was re-signed on his tick.
- runners-up: #21 (his «never skip wishkeeper» narrowed to the pace case), #75 (his no-lockout rule missing where the guard is built), #90 (a merge-unlock hole that lived only in a peer message).

## the 5 worst runs (most tokens per caught finding)

modelled as run tokens ÷ (highs × 0.79 + mediums × 0.21), using the sample's caught rate per severity; runs with no high get a floor of 0.2:

- 2026-11-06 23:53 · 89a213e9 · premerge «Pre-merge read of frame#138» · 112k tokens · 7 lows · ≈0 caught
- 2026-11-07 00:12 · 2e3b8126 · premerge «Pre-merge read of FRM-521 pr 2» · 91k · 1 medium, 4 lows · ≈0.2 caught
- 2026-11-09 15:13 · 2c65b605 · premerge «Gate lane 1 chunk read before land» · 55k · 6 lows · ≈0 caught
- 2026-11-05 18:22 · 9939ff19 · premerge «Pre-merge read of FRM-470's layer» · 164k · 3 mediums, 11 lows · ≈0.6 caught
- 2026-11-09 13:46 · 58db26e0 · memory «Wishkeeper siesta-mode review 3» · 52k · 1 medium, 3 lows · ≈0.2 caught
- 4 of the 5 are pre-merge re-reads of a chunk wishkeeper had already read once (a «pr 2», a fix-round delta). one more, 2026-11-06 21:07 2e3b8126 «Read pr 132» (105k), printed no severity-led bullets my split could read, so it is left out «?».

## clio's self-report against the grade

- the rounds rows in `pre-merge-siesta.md` call almost every high «real». my grade agrees for 33 of 42 sampled highs. clio herself flagged 2 of the 3 false highs as stale at the time (#5, #71). the overclaim is small, and it sits in the «hit» notes rather than the counts.

## per graded finding

format: # · time (utc) · transcript · trigger · severity · label · acted/dropped · surface — why · (for caught) whether a later read would have caught it

- #1 · 2026-10-30 13:33z · c439fc78 · none · high · false · dropped · wishes — the archive was dima's own click («→ yours»), not clio's
- #2 · 2026-11-01 13:16z · f0e0062c · files · high · caught · acted · wishes — 15 planning lines of 10-30 had no home before planning; filed to FRM-460 (prompt-groom --day was already red, so a later check would flag it) · later read: likely caught anyway
- #3 · 2026-11-02 11:32z · e1ac9b71 · files · high · caught · acted · wishes — a signed chunk (FRM-471) folded into the lane with no re-sign; re-signed · later read: would have reached dima wrong
- #4 · 2026-11-02 11:32z · e1ac9b71 · files · medium · hygiene · acted · claims — «logged as a habit miss» with nothing logged; flawlog written
- #5 · 2026-11-02 12:27z · e1ac9b71 · files · high · false · acted · wishes — the 14:11 wish was already groomed when raised (clio: «three are already done»)
- #6 · 2026-11-02 12:27z · e1ac9b71 · files · low · hygiene · acted · loose ends — untracked flawlog and uncommitted roadmap counts; parked to the halt
- #7 · 2026-11-02 16:30z · e1ac9b71 · files · high · caught · acted · wishes — FRM-479 flipped to blocking against the trial model dima agreed to, he was never told; put to him · later read: would have reached dima wrong
- #8 · 2026-11-02 16:30z · e1ac9b71 · files · high · hygiene · acted · wishes — PK-298 description stale while its notes held the facts; rewritten
- #9 · 2026-11-03 11:09z · 668daff8 · files · medium · caught · acted · claims — his ❓ «cadence based on measurements» got an unmeasured cadence; labelled · later read: would have reached dima wrong
- #10 · 2026-11-03 11:09z · 668daff8 · files · low · hygiene · dropped · claims — two counts in replies disagree (6/16 vs 12); no fix seen
- #11 · 2026-11-03 12:13z · 668daff8 · premerge · high · hygiene · acted · tracker — sign hash drifted; x lane dispatch already refuses it; clio built sign-hash.ts
- #12 · 2026-11-03 12:13z · 668daff8 · premerge · low · duplicate · dropped · claims — crow had caught the waker claim and it was corrected at 12:04
- #13 · 2026-11-03 12:59z · 668daff8 · files · high · caught · acted · edits — the hot-cache beat could never meet his «no stale over 1 h»; skill fixed · later read: would have reached dima wrong
- #14 · 2026-11-03 12:59z · 668daff8 · files · medium · hygiene · dropped · promises — checkup not rerun, start message fields missing; not acted
- #15 · 2026-11-03 13:23z · 668daff8 · premerge · high · caught · acted · wishes — o83 only partly met, 6 escape holes with no fixing ticket; pk-309 (sixth sense's clean missed it) · later read: would have reached dima wrong
- #16 · 2026-11-03 18:50z · 668daff8 · ping · high · caught · acted · edits — the park rule let a chunk finish against his W11 «do not let anyone finish»; habit groomed · later read: would have reached dima wrong
- #17 · 2026-11-03 18:50z · 668daff8 · ping · medium · hygiene · dropped · loose ends — stop hook re-fired 8 times while a grill was open; not fixed in that turn
- #18 · 2026-11-04 08:51z · 96392cd0 · memory · high · caught · acted · tracker — FRM-478 closing word stated a Sonnet verdict dima had refused; correction comment · later read: would have reached dima wrong
- #19 · 2026-11-04 09:39z · 96392cd0 · memory · high · caught · acted · tracker — FRM-459 close orphaned his two riders; reopened · later read: would have reached dima wrong
- #20 · 2026-11-04 10:43z · 96392cd0 · premerge · medium · hygiene · acted · loose ends — one note form slips the quiet gate's regex; went to codie's fix list «?»
- #21 · 2026-11-04 11:04z · 96392cd0 · memory+ping · high · caught · acted · edits — his «never skip wishkeeper» narrowed to the pace case; small-batch exit cut · later read: would have reached dima wrong
- #22 · 2026-11-04 11:04z · 96392cd0 · memory+ping · low · hygiene · dropped · promises — a promise carried only by a day-plan note
- #23 · 2026-11-04 12:54z · 96392cd0 · memory · medium · hygiene · dropped · wishes — tool-call caps in briefs after «he is a prio»; caps are still in today's briefs
- #24 · 2026-11-04 14:45z · 96392cd0 · memory · high · caught · acted · tracker — FRM-500 closed with two habit lines ticked but undone; unticked, FRM-501 reopened · later read: would have reached dima wrong
- #25 · 2026-11-04 14:45z · 96392cd0 · memory · low · hygiene · dropped · wishes — ❓ lines with no answer seen, marked «?» by wishkeeper itself
- #26 · 2026-11-04 15:13z · 96392cd0 · ping · high · hygiene · dropped · wishes — o78 steer paraphrased to a peer; not in the card «?»
- #27 · 2026-11-05 15:39z · 9939ff19 · none · low · hygiene · acted · tracker — «layer 6» vs «layer 4» between a ✏️ line and the spec
- #28 · 2026-11-05 18:58z · 9939ff19 · memory+ping · medium · caught · acted · tracker — scope grew on 3 signed tickets under «no re-sign: tiny»; re-signs put to dima · later read: would have reached dima wrong
- #29 · 2026-11-05 18:58z · 9939ff19 · memory+ping · low · cosmetic · acted · tracker — a link written in the wrong form
- #30 · 2026-11-05 22:02z · 9939ff19 · memory+ping · high · caught · acted · tracker — a signed done-test line proven on a fixture only, before the merge ask; put to dima · later read: would have reached dima wrong
- #31 · 2026-11-05 22:02z · 9939ff19 · memory+ping · medium · hygiene · acted · loose ends — frame#127 leaves a tree with an empty .scratch; noted in the card
- #32 · 2026-11-05 22:02z · 9939ff19 · memory+ping · low · hygiene · dropped · promises — a planned command never run
- #33 · 2026-11-05 22:02z · 9939ff19 · memory+ping · low · duplicate · dropped · claims — codie's own report had already said «not checked»
- #34 · 2026-11-06 00:38z · 9939ff19 · ping · medium · hygiene · acted · tracker — missing met/answer marks on FRM-513 W-lines; marked at the close
- #35 · 2026-11-06 00:38z · 9939ff19 · ping · low · hygiene · dropped · tracker — a done comment names no commit
- #36 · 2026-11-06 14:38z · 2e3b8126 · none · medium · hygiene · dropped · loose ends — a spec archive skipped by x lane landed
- #37 · 2026-11-06 19:28z · f0ffdfb0 · none · low · cosmetic · dropped · edits — a dead sync comment in fleet-doors.md
- #38 · 2026-11-06 20:04z · 89a213e9 · ping · high · caught · acted · wishes — clio's words filed as dima's in PK-328:W22 and FRM-521:W8; refolded · later read: would have reached dima wrong
- #39 · 2026-11-06 20:30z · f0ffdfb0 · none · high · hygiene · acted · tracker — PK-327's wing label disagreed with its note
- #40 · 2026-11-06 20:30z · f0ffdfb0 · none · high · caught · acted · edits — his «try it on the next side lane» tick widened into an unscoped rule; scoped back · later read: would have reached dima wrong
- #41 · 2026-11-06 20:30z · f0ffdfb0 · none · high · caught · acted · claims — «quotes: shown» attested on a commit whose quotes were never shown; shown after · later read: would have reached dima wrong
- #42 · 2026-11-06 20:30z · f0ffdfb0 · none · low · hygiene · dropped · loose ends — no wing-5 label
- #43 · 2026-11-06 20:30z · f0ffdfb0 · none · low · hygiene · dropped · edits — a retro line lost from a trial file
- #44 · 2026-11-06 20:30z · 89a213e9 · premerge · low · hygiene · dropped · tracker — a mutant count on FRM-511 with no source
- #45 · 2026-11-06 22:21z · 89a213e9 · ping · low · hygiene · dropped · loose ends — a design note whose fix is «accept»
- #46 · 2026-11-07 13:32z · 2e688648 · none · medium · false · dropped · wishes — a note on what wishkeeper itself did not read, not a defect
- #47 · 2026-11-07 13:58z · 483eb11c · none · high · caught · acted · tracker — FRM-521's close left 28 of his lines unaccounted and his W35 ❓ unanswered (wisphunter found the go number too); answered · later read: would have reached dima wrong
- #48 · 2026-11-07 13:58z · 483eb11c · none · medium · hygiene · acted · wishes — the W22 attribution copied back in, its correction already on PK-328
- #49 · 2026-11-07 19:07z · 2e688648 · none · high · caught · acted · wishes — his W63 had no home in the plan · later read: would have reached dima wrong
- #50 · 2026-11-07 19:07z · 2e688648 · none · medium · caught · acted · wishes — his nine wing-close steps (W41) missing from the plan · later read: would have reached dima wrong
- #51 · 2026-11-07 19:24z · 2e688648 · none · high · caught · acted · edits — «close related linear tickets» became «bring them up to date»; fixed · later read: would have reached dima wrong
- #52 · 2026-11-09 12:50z · b33a2902 · memory · medium · hygiene · acted · edits — a habit line narrowed «or i say otherwise»; restored
- #53 · 2026-11-09 12:55z · 58db26e0 · files · low · hygiene · dropped · claims — «wing 1 is told» while the message was only queued
- #54 · 2026-11-09 13:36z · 58db26e0 · files · medium · hygiene · acted · edits — helga's passport had no boot step
- #55 · 2026-11-09 13:44z · b33a2902 · memory · high · caught · acted · tracker — PK-351's close called PK-332:W5 landed while it was open · later read: would have reached dima wrong
- #56 · 2026-11-09 14:31z · 2c65b605 · premerge · high · caught · acted · tracker — FRM-534's due date fell before its own done test could run (close-net would likely red it) · later read: likely caught anyway
- #57 · 2026-11-09 14:45z · 58db26e0 · memory · high · caught · acted · claims — «🔎 everywhere» told to dima while the mods still print 🔦 (his own screenshots showed it) · later read: likely caught anyway
- #58 · 2026-11-09 14:45z · 58db26e0 · memory · medium · caught · acted · wishes — clio's own clause stamped into his 16:01 wish line · later read: would have reached dima wrong
- #59 · 2026-11-09 15:35z · 2c65b605 · ping · medium · caught · acted · tracker — the flyway would start FRM-384 at the next boot against his o34 handover · later read: would have reached dima wrong
- #60 · 2026-11-09 17:36z · b33a2902 · premerge · medium · hygiene · acted · tracker — done flyway lines left unticked
- #61 · 2026-11-09 17:36z · b33a2902 · premerge · medium · hygiene · acted · tracker — FRM-554's queue spot and a false re-sign wording
- #62 · 2026-11-09 17:51z · 58db26e0 · ping · low · cosmetic · dropped · wishes — W-lines sit raw
- #63 · 2026-11-09 18:18z · b33a2902 · premerge · high · hygiene · acted · tracker — FRM-547 closed with «not met» disclosed in its comment; reopened, dima closed it anyway
- #64 · 2026-11-09 18:18z · b33a2902 · premerge · medium · hygiene · acted · tracker — two re-signed riders missing from a done test (the spec carried them)
- #65 · 2026-11-09 18:18z · b33a2902 · premerge · low · hygiene · dropped · tracker — a quick-lane ticket closed by hand
- #66 · 2026-11-09 18:37z · 0a6f3d06 · memory · medium · hygiene · acted · edits — a park wording drift, handed to main
- #67 · 2026-11-09 19:17z · 58db26e0 · memory+ping · high · caught · acted · tracker — FRM-495's signed body differs from the 7+2 pick he ticked and drops his 20:14 case · later read: would have reached dima wrong
- #68 · 2026-11-09 19:17z · 58db26e0 · memory+ping · high · caught · acted · promises — herdr polish shipped with no ticket and «everything solvable is done» was false · later read: would have reached dima wrong
- #69 · 2026-11-09 19:31z · b33a2902 · premerge · high · caught · acted · wishes — merge-auto forced a security rerun against his grill Q6 «never rerun»; sixth sense's clean missed it · later read: would have reached dima wrong
- #70 · 2026-11-09 19:45z · 58db26e0 · ping · medium · cosmetic · dropped · loose ends — grill question numbering off by one
- #71 · 2026-11-09 20:41z · b33a2902 · premerge · high · false · acted · wishes — the FRM-414 answer was already in that turn's text (clio: «partly stale»)
- #72 · 2026-11-09 22:25z · 58db26e0 · premerge · high · caught · acted · edits — his reuse clauses cut to fit a byte cap, then reported as landed · later read: would have reached dima wrong
- #73 · 2026-11-09 23:24z · 2c65b605 · memory · low · cosmetic · dropped · loose ends — the brief's two-dot vs three-dot diff range
- #74 · 2026-11-09 23:45z · 2c65b605 · memory · low · false · dropped · loose ends — a «fixed» status line, not a finding
- #75 · 2026-11-10 14:35z · a741b7d8 · ping · high · caught · acted · edits — his no-lockout rule lived only in the herdr file, not where the guard is built · later read: would have reached dima wrong
- #76 · 2026-11-10 17:52z · a7d4dfcb · memory · low · hygiene · dropped · tracker — a stale rider line on FRM-384
- #77 · 2026-11-10 18:46z · a7d4dfcb · premerge · low · hygiene · acted · loose ends — wrapped pnpm installs slip the allowlist; kept as a written limit
- #78 · 2026-11-10 19:04z · a7d4dfcb · memory+ping · high · caught · acted · edits — crew-lead still called --bg the default after his «herdr first» · later read: would have reached dima wrong
- #79 · 2026-11-11 14:34z · 1e70bf35 · memory+ping · high · caught · acted · tracker — FRM-573/574 closes counted unchecked wins as done · later read: would have reached dima wrong
- #80 · 2026-11-11 15:51z · 6664e8d8 · memory · high · hygiene · dropped · tracker — o22's resolution wording, the reply already corrected
- #81 · 2026-11-11 17:11z · 6664e8d8 · memory+ping · high · caught · acted · tracker — BYT-94 closed without his verdict on W12–W14, W6 judged met on a loose reading; reopen ask in orbit · later read: would have reached dima wrong
- #82 · 2026-11-11 17:11z · 6664e8d8 · memory+ping · medium · hygiene · dropped · promises — a promise with no wisp or ticket
- #83 · 2026-11-11 18:10z · 1e70bf35 · memory+ping · medium · hygiene · acted · edits — a rule contradicting a live glide feature; settled by his o67
- #84 · 2026-11-11 18:31z · 6664e8d8 · files · high · caught · acted · claims — clio-revive read a dead field so every revive came back on medium, while clio told dima it read effort · later read: would have reached dima wrong
- #85 · 2026-11-11 18:31z · 6664e8d8 · files · low · duplicate · dropped · tracker — close-net had already red FRM-570
- #86 · 2026-11-11 19:11z · 1e70bf35 · ping · high · caught · acted · wishes — his emoji wish listed as «skipped» in the borrow plan he was about to read · later read: likely caught anyway
- #87 · 2026-11-11 19:11z · 1e70bf35 · ping · low · cosmetic · dropped · loose ends — a stray blank line
- #88 · 2026-11-11 19:50z · 6664e8d8 · memory · high · caught · acted · wishes — the flyway still planned the «seat» check he turned down; line rewritten · later read: would have reached dima wrong
- #89 · 2026-11-11 19:55z · 1e70bf35 · ping · high · caught · acted · claims — «all four worked» told to codie, words dima never said · later read: would have reached dima wrong
- #90 · 2026-11-11 19:55z · 1e70bf35 · ping · high · caught · acted · promises — a P1 merge-unlock hole lived only in a peer message while the reply said it was being fixed · later read: would have reached dima wrong

## what i could not verify

- 10-21 to 10-29: no transcript on disk holds a wishkeeper notification before 10-30, so that stretch is ungraded «?». the rounds doc has a few rows for it that i did not grade.
- «would a later read catch it» is my judgment from the transcript (is a gate, the halt's day check or dima's own screen in its path), not a replay.
- the batch size of a catch is read from the brief and the due line; 8 of 38 are unclear «?».
- duplicate is under-counted: i saw crow's and sixth sense's notes only where clio's turns name them, and I did not read crow's note store. the 3 % raw (6 % reweighted) is a floor.
- acted vs dropped is read from up to ~500 transcript records after each notification. a fix landed later in another thread or after a compaction reads as dropped, so the dropped share is an upper bound. #20, #26 and #36 are marked «?» in their why.
- per-trigger yields rest on 7 highs per group, so they are ±1 caught per run. the census tags no premerge, so its trigger counts and mine differ.
- one run (2026-11-06 21:07, 105k tokens) was left out: no finding format my split could read.

<!-- end -->
