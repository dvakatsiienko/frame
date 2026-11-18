# wishkeeper's findings under the new card, graded (researcher, 2026-11-18)

read-only grade of wishkeeper's siesta findings after the card change. sources: clio's transcripts in `~/.claude/projects/-Users-dima-frame--clio/*.jsonl` (the wishkeeper Agent calls after 2026-11-11T20:51:38Z, their task-notifications, the clio turns after them), the card at `_clio/.claude/agents/wishkeeper.md` (last changed in 29db59e4, 2026-11-11 22:49:53 +02:00, per `git log`), `census-2.jsonl`, and `grades.md` for the labels. times are utc unless marked local.

## the verdict

- the highs are real: **99 of 105 highs caught a real defect (94 %)**. old card: 33 of 42 (79 %, grades.md). 2 were false, 2 hygiene, 2 duplicates.
- the mediums got better too: 24 of 54 graded mediums caught a real defect (44 %). old card: 5 of 24 (21 %).
- no lows were listed: 0 of 86 reports list a low. all 86 give a `lows: N` count line, 269 lows in all. old card: 942 lows listed over 170 runs.
- no cosmetic finding in the sample (0 of 159). old card: 12 % weighted.
- clio acted on 145 of 159 graded findings and dropped 14 (9 %). old card: 30 of 90 dropped (33 %).
- weighted to the listed mix (all 105 highs, the 333 mediums scaled from the 54 graded): caught 56 %, hygiene 36 %, cosmetic 0 %, false 0.5 %, duplicate 7.5 %; dropped 17 %. old card: caught 19 %, hygiene 58 %, cosmetic 12 %, false 5 %, duplicate 6 %; dropped 52 %.
- the new duplicates come from one habit: 5 of the 7 restate a red that `siesta-checks.ts`'s output already printed (close net, blueprint drift). the card says those reds are already checked (`wishkeeper.md:32`).

## how many exist, and how they were sampled

- 119 wishkeeper Agent calls after the cut, deduplicated by tool-call id (a fork copies its parent's lines). by description: 87 siesta, 16 checkpoint/CST/handoff, 7 «Regression replay case N», 5 boot, 3 land/chunk reads, 1 other («Wishkeeper: borrow words lost?»). only the 87 siesta runs are graded. this matches census-2-summary.md's 97 rows minus its 10 non-siesta runs.
- 86 of 87 runs have a report and a token count. one (2026-11-12 20:56z, 028a696e, «Siesta read of wing 1's batch») has no task-notification in any transcript.
- findings: bullets at the top level that lead with a severity. 444 parsed. 6 of those were count or open-finding status lines («- high 1», «- high 2: fixed …»), not findings, and are dropped (R60.6, R60.7, R65.7, R65.8, R86.5, R86.6). **that leaves 105 highs and 333 mediums.** checked by eye against each run's own count line.
- the sample: every high (105), plus mediums drawn at random (python `random.seed(491)`) up to 15 per trigger group. the groups come from census-2's trigger text: ticket (a ticket close or sign only, 55 runs), memory (a memory, rule or skill text file, no «files» part, 19 runs), files (any trigger with «N files of clio's», 11 runs), ping (1 run), unknown (1 run). mediums graded: ticket 15, memory 14, files 15, ping 5, unknown 5 (all there were) = **54. 159 findings graded.** no lows exist to sample.
- grading: the labels are grades.md's. caught = a real defect that would have reached dima wrong (a bent or dropped wish, a false «done» told to him or a peer, a signed pick changed). hygiene = real but housekeeping. cosmetic = wording or format only. false = not a defect. duplicate = someone else had already said it (crow, close net, the checks output, or the card's own open findings). acted = clio changed a file, ticket, message or reply because of it, in the same turn or the next one (up to the second typed prompt of dima's after the notification). dropped = anything else. a finding clio checked and named «not real», with nothing changed, counts as dropped.
- trigger groups for the baseline differ (memory, ping, memory+ping, files, none, premerge). the new gate adds «ticket close(s) or sign(s)», which is the top trigger now, so the per-trigger rows below are not one-to-one with grades.md.

## per trigger group

catches per run = the group's caught highs (exact) plus its graded-medium caught rate times all its mediums. lows count 0, since none are listed. the medium half is modelled.

- **ticket** (55 runs, 5.53 m tokens): highs 61, 56 caught; mediums 206, 9 of 15 graded caught. ≈3.3 caught a run, ≈31k tokens a catch.
- **memory** (19 runs, 1.93 m tokens): highs 21, 21 caught; mediums 68, 5 of 14 caught. ≈2.4 a run, ≈43k a catch.
- **files** (11 runs, 1.41 m tokens): highs 20, 19 caught; mediums 49, 8 of 15 caught. ≈4.1 a run, ≈31k a catch.
- **ping** (1 run, 116k): 0 highs; 5 mediums, 0 caught.
- **unknown** (1 run, 113k): highs 3, 3 caught; mediums 5, 2 caught.
- all 87 runs: ≈2.9 caught a run, ≈37k tokens a catch. old card, computed the same way from grades.md's rates and counts (293 highs, 711 mediums, 942 lows, 170 runs, 19.6 m tokens): ≈2.2 a run, ≈52k a catch.

## per check (the card's three)

- **claims** (51): caught 47, hygiene 2, duplicate 1, false 1. the old card's claims surface: 5 of 10 caught.
- **his words** (85): caught 70, hygiene 13, duplicate 1, false 1.
- **rule breaks in clio's edits** (23): caught 6, hygiene 12, duplicate 5. the weakest check; it holds every duplicate from the checks output.

## dropped

- by label: caught 5, hygiene 4, duplicate 3, false 2. by severity: high 2 of 105, medium 12 of 54. old card: high 3 of 42, medium 7 of 24, low 20 of 24.
- the 5 caught but dropped: R11.8 (an unpicked proposal put in a codie brief), R23.6 (a Metal HUD line against his «drop it»), R23.8 (his retro reminder dropped on a false premise), R27.4 (six re-signs before he saw the changes), R85.4 (his date rule narrowed unasked). each is a medium, and each sits in a run with a high clio fixed first.

## per graded finding

format: id (R<run>.<finding>) · notification time (utc) · transcript · thread · trigger group · severity · label · acted/dropped · check — why

- R1.1 · 2026-11-11 21:06z · 1e70bf35 · main · ping · medium · hygiene · acted · claims — a member's «fixed» relayed on a rest reading; clio had already taken it back at 22:11, the card names the case now
- R1.2 · 2026-11-11 21:06z · 1e70bf35 · main · ping · medium · hygiene · acted · his words — «do now» filed on the chat ticket while it started the autopilot round; W57 annotated, no want lost
- R1.3 · 2026-11-11 21:06z · 1e70bf35 · main · ping · medium · hygiene · acted · edits — siesta SKILL.md:43 still gave claims to crow after the card change; handed to wing 1
- R1.4 · 2026-11-11 21:06z · 1e70bf35 · main · ping · medium · duplicate · acted · edits — FRM-570 red in the close net, which had already said so; handed to wing 1
- R1.5 · 2026-11-11 21:06z · 1e70bf35 · main · ping · medium · duplicate · acted · edits — the checks output already printed this blueprint-drift red; handed to wing 1
- R2.1 · 2026-11-11 21:07z · 6664e8d8 · wing-1 · files · high · caught · acted · his words — four of his messages (his revert ask among them) had no groom and no home; six groom chores sent
- R2.2 · 2026-11-11 21:07z · 6664e8d8 · wing-1 · files · high · caught · acted · claims — his o62 tick «keep halt + second wind» rested on a halt wishkeeper read that did not exist; halt/main.md edited
- R2.3 · 2026-11-11 21:07z · 6664e8d8 · wing-1 · files · high · caught · acted · claims — «FRM-491 is built» told while the § final regression set did not exist; the set was written
- R3.1 · 2026-11-11 21:28z · 1e70bf35 · main · ticket · high · caught · acted · his words — his on-until-off + 2 h want lived only on canceled FRM-578; moved to FRM-544:W15 with a changed line
- R3.2 · 2026-11-11 21:28z · 1e70bf35 · main · ticket · medium · caught · acted · his words — his autopilot Q2 pick was in no file the shaping reads; appended under § answers
- R4.1 · 2026-11-11 22:37z · 6664e8d8 · wing-1 · files · high · caught · acted · claims — the thread-names rewrite was told as landing while its commit failed; recommitted, proven on main
- R4.2 · 2026-11-11 22:37z · 6664e8d8 · wing-1 · files · high · caught · acted · claims — «that plugin bump isn't mine» proven on an older head; corrected to main
- R5.1 · 2026-11-11 22:41z · 1e70bf35 · main · memory · high · caught · acted · his words — FRM-544 closed «W1–W15 landed» while W12–W14 had no verdict; correction comment, new home in orbit
- R5.2 · 2026-11-11 22:41z · 1e70bf35 · main · memory · high · caught · acted · claims — «verified: no release notes» ran on the wrong repo; his tail 3 missed; notes read and told
- R6.1 · 2026-11-11 23:47z · 6664e8d8 · wing-1 · files · high · caught · acted · claims — a false «👀 look sent» stamp closed FRM-436 and FRM-424 without his look; both back to In Progress
- R6.5 · 2026-11-11 23:47z · 6664e8d8 · wing-1 · files · medium · caught · acted · his words — a decision sixth sense left for him never reached him; put on the board
- R7.1 · 2026-11-11 23:54z · 1e70bf35 · main · memory · high · caught · acted · his words — his o142 tick «a mods rider next session» resolved «as ticked» with no carrier; step 14k in the lane plan
- R7.4 · 2026-11-11 23:54z · 1e70bf35 · main · memory · medium · caught · acted · his words — his slice-mode wish (PK-363:W1153) not in the wind-down skill; step 5 written
- R8.1 · 2026-11-12 00:59z · 1e70bf35 · main · ticket · high · caught · acted · his words — his «start mods lane immediately» bent into a wait for FRM-579; reminder and handoff fixed
- R9.1 · 2026-11-12 01:05z · 6664e8d8 · wing-1 · ticket · high · caught · acted · his words — FRM-505 signed body got a done-test row with no signed-block line; re-signed
- R10.1 · 2026-11-12 12:46z · 028a696e · wing-1 · ticket · high · caught · acted · claims — «forks keep working as today» was false and he approved the reshape on it; his fork line put back, the compromise asked
- R10.2 · 2026-11-12 12:46z · 028a696e · wing-1 · ticket · high · duplicate · acted · his words — the rename verb had no ask; crow had caught it at 14:24 first; ask put in orbit
- R11.1 · 2026-11-12 13:19z · 83c5325c · main · unknown · high · caught · acted · claims — «they ride in FRM-562 and FRM-563» was false at HEAD; W60–W68 and W5 folded
- R11.2 · 2026-11-12 13:19z · 83c5325c · main · unknown · high · caught · acted · his words — the groom bent his «you» into «codie» on FRM-563:W5; regroomed from the raw text
- R11.3 · 2026-11-12 13:19z · 83c5325c · main · unknown · high · caught · acted · claims — «W6 corrected to cars» false where it is read, and clio settled his open question in a brief; asked, taste.md fixed
- R11.4 · 2026-11-12 13:19z · 83c5325c · main · unknown · medium · hygiene · acted · edits — his five session rules broken (7 of 15 replies over 600 chars, replies to member news); flawlog line
- R11.5 · 2026-11-12 13:19z · 83c5325c · main · unknown · medium · caught · acted · claims — «the codeberg mirror is fixed» from the push alone, the next main run red; flawlog line, mirror re-read
- R11.6 · 2026-11-12 13:19z · 83c5325c · main · unknown · medium · hygiene · dropped · edits — a reminder still due 11-10 after the round it waited for; no change in the turn
- R11.7 · 2026-11-12 13:19z · 83c5325c · main · unknown · medium · hygiene · dropped · his words — PK-380:W4 ❓ «how our silent comms works» unanswered; no answer in the turn
- R11.8 · 2026-11-12 13:19z · 83c5325c · main · unknown · medium · caught · dropped · his words — the brief carries «monochrome» from a grill-1 proposal he never picked; no change in the turn
- R12.1 · 2026-11-12 14:22z · 028a696e · wing-1 · ticket · high · caught · acted · claims — «0 member turns» came from a script that skipped every cross-session row; recount told, notes fixed
- R12.2 · 2026-11-12 14:22z · 028a696e · wing-1 · ticket · high · caught · acted · his words — reverting slice 07 c) turns a warn-only door back into a hard refusal, against his o18; codie steered
- R13.1 · 2026-11-12 14:34z · 83c5325c · main · ticket · high · hygiene · acted · claims — his FRM-581 sign briefly sat on a stale body, HEAD already fixed by the 16:31 re-shape; parked with the root fix
- R13.2 · 2026-11-12 14:34z · 83c5325c · main · ticket · high · caught · acted · his words — his «ok but do not forget!» reminder dropped on a verdict its data does not hold; reminder restored
- R14.1 · 2026-11-12 15:32z · 83c5325c · main · files · high · caught · acted · his words — his 16:51 and 16:58 words filed as no-wish while «everything filed» was told; now W28–W32
- R14.2 · 2026-11-12 15:32z · 83c5325c · main · files · high · caught · acted · his words — FRM-581's re-shape skipped W21–W24 («no lockout, or I delete it»); ticket and spec carry them
- R14.6 · 2026-11-12 15:32z · 83c5325c · main · files · medium · duplicate · dropped · edits — close net red on FRM-576, the checks output already said so; left
- R14.7 · 2026-11-12 15:32z · 83c5325c · main · files · medium · duplicate · dropped · edits — blueprint drift on the crew-pm board, the checks output already said so; left
- R15.1 · 2026-11-12 15:32z · 028a696e · wing-1 · ticket · high · caught · acted · edits — the pocket-check fix let a W-line drop silently inside parentheses; fixed with a red-proven test
- R15.2 · 2026-11-12 15:32z · 028a696e · wing-1 · ticket · high · caught · acted · his words — his «make flyways pretty» groomed as no-wish; groom chore sent
- R15.3 · 2026-11-12 15:32z · 028a696e · wing-1 · ticket · high · caught · acted · claims — «landing now» told twice while every land was rejected; push problem raised to main
- R16.1 · 2026-11-12 16:51z · 83c5325c · main · ticket · high · caught · acted · his words — FRM-572 chunk 2 re-signed with no body change, a scope moved in by message only; body fixed
- R16.2 · 2026-11-12 16:51z · 83c5325c · main · ticket · high · caught · acted · his words — his «no bot protection wanted» on FRM-490 dropped; cut ask raised
- R17.1 · 2026-11-12 17:30z · 028a696e · wing-1 · files · high · caught · acted · his words — PK-362 in two flyways, the wing 1 copy ignoring his pause; copy removed
- R18.1 · 2026-11-12 18:11z · 83c5325c · main · ticket · high · caught · acted · claims — «FRM-490 parked as someday» told while the label never landed; label read back, his steer in
- R18.2 · 2026-11-12 18:11z · 83c5325c · main · ticket · high · caught · acted · his words — FRM-504 re-signed «warn, never block» while its done test still refuses; rows struck, re-signed
- R19.3 · 2026-11-12 18:49z · 028a696e · wing-1 · files · medium · caught · acted · his words — his «let's try» on the flyway check had no dated verdict; 📅 line for 11-14
- R21.1 · 2026-11-12 19:30z · 83c5325c · main · ticket · high · caught · acted · his words — FRM-564:W22 (one source of truth for message kinds) lost its home in the split; ask in orbit
- R22.1 · 2026-11-12 19:18z · 028a696e · wing-1 · ticket · high · caught · acted · his words — the FRM-538 close orphaned three retro findings his «fold all retros» covered; closing word names them, handed to main
- R23.1 · 2026-11-12 20:41z · 83c5325c · main · files · high · caught · acted · claims — «the ping test hasn't run» told him while it had, and he ticked o171 on it; reminder rewritten
- R23.2 · 2026-11-12 20:41z · 83c5325c · main · files · high · caught · acted · his words — a Linear block kept slipstream behind tabs against his switch rule; block dropped
- R23.3 · 2026-11-12 20:41z · 83c5325c · main · files · high · caught · acted · his words — FRM-562 closed «all homed» while his ❓ W14 had no home; moved to FRM-594:W1
- R23.4 · 2026-11-12 20:41z · 83c5325c · main · files · high · caught · acted · his words — his W15 «remove system messages» homed in FRM-580, which cannot settle it; moved to FRM-595:W1
- R23.5 · 2026-11-12 20:41z · 83c5325c · main · files · high · caught · acted · his words — his «auto-second-wind proof tomorrow too» had no home; reminder line written
- R23.6 · 2026-11-12 20:41z · 83c5325c · main · files · medium · caught · dropped · edits — herdr mods AGENTS.md still has codies measure speed on the Metal HUD against his «drop it for all plans»; no change in the turn
- R23.8 · 2026-11-12 20:41z · 83c5325c · main · files · medium · caught · dropped · claims — his whole-day retro reminder dropped on «it runs at the halt», which has no retro step; no change in the turn
- R23.10 · 2026-11-12 20:41z · 83c5325c · main · files · medium · hygiene · dropped · edits — a reminder still plans a merge refusal a later commit ruled out; no change in the turn
- R27.1 · 2026-11-13 12:05z · e293e197 · main · files · high · caught · acted · his words — his 13:47 words never reached FRM-597 and its signed W1 was clio's rewrite; W3–W22 joined, re-signed
- R27.2 · 2026-11-13 12:05z · e293e197 · main · files · high · caught · acted · claims — «the done test covers that direction too» false, no outbound case; case added, codie steered
- R27.3 · 2026-11-13 12:05z · e293e197 · main · files · high · caught · acted · his words — PK-389 closed without his 13:47 naming asks while «folded» was told; lines into FRM-596
- R27.4 · 2026-11-13 12:05z · e293e197 · main · files · medium · caught · dropped · his words — six chunks re-signed before he saw each change, against his o2 pick «I print each change, you tick once»; not shown in the turn
- R27.6 · 2026-11-13 12:05z · e293e197 · main · files · medium · hygiene · acted · his words — pk-390 empty, his annotator words missing; notes appended
- R27.7 · 2026-11-13 12:05z · e293e197 · main · files · medium · hygiene · acted · edits — the herdr skill still put a first task on a wing's line against ca5b5d5e; skill edited
- R28.1 · 2026-11-13 13:01z · e293e197 · main · ticket · high · false · dropped · his words — «the outbound case can close unbuilt»: codie had probed exit 6 in its final, it passed; clio logged it fixed, nothing changed
- R29.1 · 2026-11-13 13:28z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — FRM-598 closed on a nearby case, its own done test fails; FRM-603 tracks it, told
- R29.2 · 2026-11-13 13:28z · 24041bcc · wing-1 · ticket · high · caught · acted · his words — FRM-600's re-sealed spec skipped most of his W-lines and reworded two; into the handoff, fixed first after the wind
- R30.1 · 2026-11-13 13:46z · e293e197 · main · ticket · high · caught · acted · claims — FRM-597 Done while the exact failure he reported was never proven; cases moved to FRM-583 exit 5a
- R31.2 · 2026-11-13 14:04z · e293e197 · main · ticket · medium · hygiene · acted · edits — a memory line restated his 15:49 words unquoted and added two terms; quoted in full now
- R31.6 · 2026-11-13 14:04z · e293e197 · main · ticket · medium · caught · acted · his words — clio's own list lines filed as his W-lines, with a ❓ he never typed; marked as clio's
- R32.1 · 2026-11-13 14:26z · e293e197 · main · memory · high · caught · acted · his words — the revamp grill ran without clio:shape-idea, 17 min after he asked about it; skill loaded, told
- R34.1 · 2026-11-13 15:02z · e293e197 · main · memory · high · caught · acted · his words — his «we grill with shape-idea» rule lived only in a message, memory said the opposite; put to him, then written
- R34.3 · 2026-11-13 15:02z · e293e197 · main · memory · medium · hygiene · acted · his words — his FRM-609 tweaks only in the gitignored spec, not the signed ticket; W3–W4 added
- R34.4 · 2026-11-13 15:02z · e293e197 · main · memory · medium · hygiene · acted · his words — FRM-594's done test still asked for a hover after his «sent | read» steer; re-signed
- R35.1 · 2026-11-13 15:06z · 24041bcc · wing-1 · memory · high · caught · acted · claims — «naming works on every surface» told while the mobile app was never read; corrected to him
- R35.2 · 2026-11-13 15:06z · 24041bcc · wing-1 · memory · high · caught · acted · claims — «wing start, done» proven only with fake x and hc; called an inference to him
- R35.6 · 2026-11-13 15:06z · 24041bcc · wing-1 · memory · medium · hygiene · acted · edits — clio-start.sh stripped HC_TERMINAL_ID, skipping a summon gate; check put back
- R36.1 · 2026-11-13 15:22z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — advice to him built on a stale FRM-506 read, its pick against his W1340–W1341; corrected to him
- R36.2 · 2026-11-13 15:22z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — «the FRM-600 fix working» told while dispatch broke a signed FRM-600 line; told, fix routed to FRM-600
- R37.1 · 2026-11-13 15:42z · e293e197 · main · memory · high · caught · acted · his words — FRM-594:W5 trimmed his 17:16 line and codie's build settled his ❓; restored, his tick settled it
- R37.2 · 2026-11-13 15:42z · e293e197 · main · memory · high · caught · acted · his words — FRM-594's done test still described the shape he rejected; rewritten, re-signed
- R37.3 · 2026-11-13 15:42z · e293e197 · main · memory · high · caught · acted · edits — the retired «shape-idea is a pick» rule still stood in two memory lines and a blueprint; fixed
- R38.1 · 2026-11-13 15:54z · e293e197 · main · ticket · high · caught · acted · his words — the deck assumption said orbit where his W79 said glide; withdrawn, asked
- R38.2 · 2026-11-13 15:54z · e293e197 · main · ticket · medium · caught · acted · claims — «codie can build a safe layout switch» told with no source, against codie's consult; corrected
- R39.1 · 2026-11-13 15:55z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — «your look is the last check FRM-600 needed» while suggestions-off was unproven; FRM-600 kept open
- R41.1 · 2026-11-13 16:29z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — «no ticket holds your wireframe wish» while FRM-611 held it; corrected, merge planned
- R41.2 · 2026-11-13 16:29z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — FRM-603 closed and «first sign reads match» told on a different case; reopened
- R42.1 · 2026-11-13 16:37z · 24041bcc · wing-1 · ticket · high · caught · acted · his words — the PK-403 fold left his o27 pick and the answers behind; sent to main
- R43.1 · 2026-11-13 16:57z · e293e197 · main · ticket · high · caught · acted · his words — two P2s live in his send button with a gitignored home only; ask in orbit, FRM-564 body
- R43.3 · 2026-11-13 16:57z · e293e197 · main · ticket · medium · caught · acted · his words — the dock-layout proposal for his «not sure how to layout» dropped from the plan; question 4 of the next round
- R43.4 · 2026-11-13 16:57z · e293e197 · main · ticket · medium · caught · acted · claims — the promised mods domain-model pass had no carrier; plan line added
- R44.1 · 2026-11-13 17:35z · e293e197 · main · ticket · high · caught · acted · his words — his 19:14 and 19:20 FRM-564 lines relayed as a slice order, never homed; W47–W48
- R44.2 · 2026-11-13 17:35z · e293e197 · main · ticket · high · caught · acted · his words — FRM-564's sealed exit lines contradicted his newer W44 and W46; re-sealed
- R44.3 · 2026-11-13 17:35z · e293e197 · main · ticket · high · caught · acted · claims — «the magic send works live on me» while the turn had ended; taken back
- R45.3 · 2026-11-13 17:34z · 24041bcc · wing-1 · ticket · medium · hygiene · acted · his words — his o30 «keep the trial, one more big measure» only in the orbit plan; written to the trial log
- R47.1 · 2026-11-13 18:28z · e293e197 · main · ticket · high · hygiene · acted · his words — FRM-504's title half moved to FRM-617 in one home only, signed done test unmarked; struck with a pointer
- R48.1 · 2026-11-13 18:54z · e293e197 · main · memory · high · caught · acted · his words — FRM-626's park wiring (his W2 «when we are about to dispatch the next chunk») never built; dispatch skill wired
- R49.1 · 2026-11-13 19:30z · e293e197 · main · ticket · high · caught · acted · his words — FRM-504 closed Done with his o7 tick never built; reopened
- R49.2 · 2026-11-13 19:30z · e293e197 · main · ticket · high · caught · acted · claims — the closing word's «a new chunk reads round 1» fails live on the herdr lane, a false past-cap ask was due; lane plan fixed
- R50.1 · 2026-11-13 19:26z · 24041bcc · wing-1 · ticket · high · caught · acted · claims — the rollback given to him would have restored x from 2026-10-01 over six weeks of work; sha fixed, told
- R52.1 · 2026-11-13 20:04z · e293e197 · main · ticket · high · caught · acted · claims — «✅ my compact hook … proven on a test home» fails on the real store's shape; hook fixed
- R53.1 · 2026-11-13 20:37z · e293e197 · main · memory · high · caught · acted · his words — his «take care of this now» put off to Monday with no objection; fixed at the root that turn
- R55.1 · 2026-11-13 21:56z · e293e197 · main · ticket · high · caught · acted · claims — «the quiet-replies trial now keeps that rule» with the rule written nowhere; written to memory
- R56.1 · 2026-11-13 22:24z · e293e197 · main · ticket · high · caught · acted · claims — «mods is nearly finished» told while 4 milestone tickets sat outside the order; told, asked
- R59.1 · 2026-11-15 14:17z · 71eef4ac · main · memory · high · caught · acted · his words — his 16:01 guard wish filed «answered», PK-417 closed anyway; W-lines added, PK-417 reopened
- R59.2 · 2026-11-15 14:17z · 71eef4ac · main · memory · high · caught · acted · claims — «including your words always override it» overstated the guard doc; doc marks it a want, ask on the board
- R59.3 · 2026-11-15 14:17z · 71eef4ac · main · memory · high · caught · acted · his words — three 15:46 wishes lived only as plan lines; filed to PK-426, PK-429 and the antenna item
- R60.1 · 2026-11-15 16:48z · 71eef4ac · main · ticket · high · caught · acted · claims — «the roadmap script knows them, committed and pushed» while the edit broke every boot board; restored
- R60.5 · 2026-11-15 16:48z · 71eef4ac · main · ticket · medium · hygiene · acted · his words — PK-417 archived with W15 still open, his brake word already on FRM-631; pointer added
- R61.1 · 2026-11-15 17:23z · 71eef4ac · main · ticket · high · caught · acted · his words — «no script» written into FRM-618's scope against his W4 and logged «tiny, no re-sign»; script back, re-sign asked
- R61.2 · 2026-11-15 17:23z · 71eef4ac · main · ticket · high · caught · acted · his words — FRM-629 kept mod-only traps in AGENTS.md against his W12 «a leaf inside guide-code»; fixed
- R61.7 · 2026-11-15 17:23z · 71eef4ac · main · ticket · medium · hygiene · acted · edits — flyway f18 held a mods order Linear had changed; replaced by a pointer
- R62.1 · 2026-11-15 17:37z · 71eef4ac · main · ticket · high · caught · acted · his words — he was asked to sign FRM-629 with no done test, worth-it or out; written, critic run, re-sign asked
- R63.1 · 2026-11-15 18:08z · 71eef4ac · main · memory · high · caught · acted · his words — FRM-627 still described the skill his o90 replaced, none of his 19:43 or 19:52 words in it; copied in, decision rewritten
- R63.2 · 2026-11-15 18:08z · 71eef4ac · main · memory · high · caught · acted · edits — crew-codie's ticket-id branch came first, so stray mode never switched on and his o90 trial would measure nothing; reordered
- R63.6 · 2026-11-15 18:08z · 71eef4ac · main · memory · medium · hygiene · acted · edits — the comms-log render lost its loader line and severity rules when the old file was trashed; a fork fixed it
- R63.7 · 2026-11-15 18:08z · 71eef4ac · main · memory · medium · caught · acted · his words — his o94 «a contract miss column» not in the trial card; a fork added it
- R63.12 · 2026-11-15 18:08z · 71eef4ac · main · memory · medium · hygiene · acted · his words — his «grilling on my CV» among his important topics while the plan kept it at «when you call it»; asked
- R64.1 · 2026-11-16 12:27z · d5a522a8 · main · files · high · caught · acted · his words — his only PK-428 words dropped when it folded into FRM-628; restored, changed line
- R64.2 · 2026-11-16 12:27z · d5a522a8 · main · files · high · caught · acted · claims — his «sixth sense stays on Opus 5.5» pick lived only in uncommitted files while «everything is saved» was told; committed
- R64.3 · 2026-11-16 12:27z · d5a522a8 · main · files · medium · caught · acted · his words — FRM-632's exit lines contradicted, the map shot rewrites his layout file; shots made without toggles
- R64.4 · 2026-11-16 12:27z · d5a522a8 · main · files · medium · caught · acted · his words — his «add it as a spec in each today chunk» reached 2 of 4 chunks; the other two carry it
- R64.5 · 2026-11-16 12:27z · d5a522a8 · main · files · medium · caught · acted · his words — two of his FRM-632 wants (W12, W3) had no line in the spec; lines 5d and 3c
- R64.8 · 2026-11-16 12:27z · d5a522a8 · main · files · medium · hygiene · acted · edits — 15 done items archived before the 11-15 gazette carried them; gazette put first in the plan
- R64.10 · 2026-11-16 12:27z · d5a522a8 · main · files · medium · duplicate · dropped · edits — blueprint drift, the checks output already said so; not acted
- R65.1 · 2026-11-16 12:58z · d5a522a8 · main · ticket · high · caught · acted · his words — the live handoff stale and most of his 14:46 prompt with no home; helga grooms, items filed
- R66.4 · 2026-11-16 14:15z · d5a522a8 · main · ticket · medium · hygiene · acted · edits — a finished tail still unticked on the list the halt reads; ticked
- R67.1 · 2026-11-16 14:53z · d5a522a8 · main · ticket · high · caught · acted · his words — his 16:49 model-picker ask had no home and the reply added «the star» he never said; corrected, groomed
- R68.1 · 2026-11-16 15:33z · d5a522a8 · main · ticket · high · caught · acted · claims — FRM-600 closed and «the misses are fixed» told while names still drifted; corrected, FRM-617 carries it
- R69.1 · 2026-11-16 15:45z · d5a522a8 · main · files · high · duplicate · acted · claims — the open high from the last card, re-reported as a new high; fixed through the record
- R70.1 · 2026-11-16 16:25z · d5a522a8 · main · ticket · high · caught · acted · his words — his 17:43 message and 17:53 vote never filed, the no-wish log called it «no wish»; groomed
- R71.1 · 2026-11-16 17:25z · d5a522a8 · main · ticket · high · caught · acted · claims — his «make sure it is planned» answered with a plan written nowhere; decided line in FRM-638
- R71.4 · 2026-11-16 17:25z · d5a522a8 · main · ticket · medium · hygiene · acted · his words — two of his wishes lived in two homes each with no moved note; one home each
- R72.1 · 2026-11-16 17:37z · d5a522a8 · main · memory · high · caught · acted · his words — the mess-hunt skill rewrite contradicted signed FRM-629 with no changed line and dropped his W19 escalation; changed line, W19 back
- R73.3 · 2026-11-16 19:25z · d5a522a8 · main · memory · medium · hygiene · dropped · his words — two PK-444 lines carry W181 and his drag-and-drop wish is filed twice; left as is (notes append-only)
- R74.1 · 2026-11-16 20:31z · d5a522a8 · main · ticket · high · caught · acted · claims — «one-click open was never built in the old chat» told and written into FRM-638 while rows.js has it; corrected
- R75.1 · 2026-11-16 20:57z · d5a522a8 · main · ticket · high · caught · acted · claims — «the 13 tips are folded into FRM-582» told while only W1 was; tips copied, told it was premature
- R75.9 · 2026-11-16 20:57z · d5a522a8 · main · ticket · medium · caught · acted · his words — the groomed PK-439:W15 inverts his FRM-640:W2 «don't want trashed»; noted on the line
- R76.1 · 2026-11-16 21:33z · d5a522a8 · main · memory · medium · caught · acted · his words — the speak v2 plan folded three of his orders into one and dropped «the lane starts from wisps»; asked
- R76.5 · 2026-11-16 21:33z · d5a522a8 · main · memory · medium · hygiene · acted · his words — FRM-281's Warp bug still open after his «warp is out»; struck, F4 checked in rex
- R77.1 · 2026-11-16 21:59z · d5a522a8 · main · ticket · high · caught · acted · claims — o149 resolved «as ticked» without his tick and «your look passed» relayed unchecked; reopened
- R78.1 · 2026-11-16 22:23z · d5a522a8 · main · ticket · high · caught · acted · claims — merge 2 rested on «both share orbit code», false, and he ticked it believing it; undo asked
- R79.1 · 2026-11-16 23:00z · d5a522a8 · main · ticket · high · caught · acted · his words — FRM-643 sat above FRM-602 against his order and o170 tick; resorted, read back
- R79.2 · 2026-11-16 23:00z · d5a522a8 · main · ticket · high · caught · acted · claims — «the herdr card now reads from my slices.md» while the codie was never told; told
- R80.1 · 2026-11-16 23:23z · d5a522a8 · main · memory · high · caught · acted · his words — his 21:54 yes to the layout save written as settled with no step anywhere; step in the handoff
- R80.3 · 2026-11-16 23:23z · d5a522a8 · main · memory · medium · caught · acted · edits — the mods rule edit cut the «stalls his chats, none for a probe while he types» clause without asking; restored
- R80.7 · 2026-11-16 23:23z · d5a522a8 · main · memory · medium · hygiene · acted · edits — reply-check's landed-claim pattern missed «are on main»; widened with a test row
- R81.1 · 2026-11-18 10:02z · cad235d7 · main · ticket · high · caught · acted · his words — BYT-134 duplicated BYT-109 and lost his «chords adopt the bytes kit» want; merged, closed as duplicate
- R81.2 · 2026-11-18 10:02z · cad235d7 · main · ticket · high · caught · acted · his words — his o9 «as printed» guide-code line landed cut, with rule text cut unasked; restored word for word
- R82.1 · 2026-11-18 10:49z · cad235d7 · main · ticket · high · caught · acted · claims — «the new test failed against the old code» told while sixth sense had just said the opposite; corrected to him
- R82.2 · 2026-11-18 10:49z · cad235d7 · main · ticket · high · false · dropped · claims — «you passed codie a check he never gave»: he had checked it at 12:34; clio named it not real, nothing changed
- R83.1 · 2026-11-18 11:16z · cad235d7 · main · ticket · high · caught · acted · claims — his 9 Nov herdr release-watcher ask dropped and «none need you» told unchecked; corrected, the update channel on his board
- R83.2 · 2026-11-18 11:16z · cad235d7 · main · ticket · medium · caught · acted · claims — «I triaged the ~45 unplaced lines» with nothing recording it; a verdict per line written
- R84.1 · 2026-11-18 12:03z · cad235d7 · main · ticket · medium · caught · acted · his words — FRM-638:W129 groomed backwards from his 13:42 words; re-groomed
- R85.1 · 2026-11-18 12:39z · cad235d7 · main · ticket · high · caught · acted · his words — about 20 of his asks moved into closed FRM-581 with no verdicts; move undone
- R85.4 · 2026-11-18 12:39z · cad235d7 · main · ticket · medium · caught · dropped · edits — his date rule narrowed to cc only and his quote cut, unasked; not acted in the turn
- R86.1 · 2026-11-18 13:16z · cad235d7 · main · memory · high · caught · acted · claims — the cloud chat cap raised past his own measured 32,768 paste limit, the ask hid it; ask now leads with his test
- R86.4 · 2026-11-18 13:16z · cad235d7 · main · memory · medium · caught · acted · his words — his image-app setting had no queue line while FRM-587's line read done; own line added
- R87.1 · 2026-11-18 13:39z · cad235d7 · main · memory · high · caught · acted · his words — FRM-649 greenlit with no wish block while codie was told to cite it; W-lines copied in
- R87.4 · 2026-11-18 13:39z · cad235d7 · main · memory · medium · hygiene · acted · his words — the held-store rekey queued in two chunks, a signed ticket grew with no changed line; one home

## what i could not verify

- one grader, me, and not the one who graded the baseline. every high here was graded, while the baseline drew 7 highs per group at random. a softer hand on «caught» would push the real share up, so read 94 % against 79 % with that in mind «?».
- acted and dropped come from the clio turns up to dima's second typed prompt after the notification. a fix made later, or by another thread (wing 1 handing an item to main), reads as dropped. so the dropped share is an upper bound, as in the baseline.
- «would it have reached dima wrong» is my judgment from the transcript, not a replay.
- token counts come from each run's last task-notification (`<subagent_tokens>`). they sum to 9,102,699 over 86 runs. census-2-summary.md gives 9,105,057 for the same 87 runs. the 2,358-token gap is not traced «?».
- the medium half of «catches per run» is modelled from 54 graded mediums: 5 of them per group in the two one-run groups, up to 15 in the others.

<!-- end -->
