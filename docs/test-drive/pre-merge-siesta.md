---
status: live
until: 2026-11-17
dies-when: the verdict line below is written
fits: clio
---

# pre-merge siesta — a siesta and a wishkeeper read over each chunk before its merge

Ticket: none

**test card:** we believe a wishkeeper read of a finished chunk against dima's W-lines and clio's promises catches what sixth sense's exit-line grade misses, cheaper before the merge than after · we test it by running `clio:siesta` with a wishkeeper over every lane chunk the moment codie's «final» lands, before sixth sense's verdict turns into a merge; its retros fold in the same siesta · we measure per chunk: wishkeeper findings by severity, highs that were real (checked at the cited spot), the extra lane round each high cost in minutes, and highs found after the merge on chunks that skipped it · we're right if over 2 weeks at least 1 in 3 chunks gets a real high fixed before merge, and the extra round averages ≤ 20 min
**kill rule:** 5 chunks in a row with no real high, or one extra round over 45 min without a real high behind it; if it fires, FRM-503's tick on wishkeeper before a merge comes back to dima, it does not lapse
**the rules:** a real high buys the lane one more fix round; the ci code review stays at one round; retros of the chunk fold at this siesta, never piled to the lane's end (dima, 2026-11-03 13:10)

## stress list
- a mods quick-lane chunk (mods lane 4, FRM-472 first) — wishkeeper over the base..final range — findings, minutes
- a chunk whose rider clio built herself (FRM-472 07c (b), fork-guard) — does the read cover clio's own commits
- a side-lane pr chunk (the next cli or bytes lane) — the same read over a pr diff
- the retro fold per chunk — retros folded at the siesta, lines moved, minutes

## rounds
- 2026-11-03 · FRM-472 (mods quick lane, 50c3f7db → ff02e946, after sixth sense's clean on round 5) · wishkeeper 13 min, 12 findings: 2 high real (o83 only partly met, 6 unwarned variants with no fixing ticket → pk-309; fork-guard's pocket pass let a tab split a non-pocket path → fixed 052c6e0e, red-proven), 5 medium (the done test says «refused» while the code warns; a stale replay count; an exponential `$((` cost) · hit: both highs were invisible to sixth sense's exit-line grade, one was in clio's own rider
- 2026-11-03 · FRM-496 (clio-lean quick lane, 1a92c8cd → 3e532a0b, after sixth sense's round 1) · the first siesta behind `siesta-checks.ts` (5 sections pre-run, 4 green, blueprint drift known) · wishkeeper 5 min, 119,951 tokens, 33 tool calls, 13 findings: 1 high real (FRM-499 left an idle member cold) → already fixed by the 19:25 re-sign (o102); 5 medium, 7 low · no earlier round carries a token count, so this is the baseline, not a saving
- 2026-11-04 · boot batch (evergreen, memory pass, FRM-501's spec section; no diff of a lane) · second siesta behind `siesta-checks.ts` · wishkeeper 3 min, 124k tokens, 8 findings: 1 high real (exit 3 against his signed «her question's reply is never held»), 1 medium rejected (an `apply` borrow), the rest fixed
- 2026-11-04 · FRM-502 (main lane, uncommitted diff, after wisphunter's 7) · wishkeeper 9 min, 177k tokens, 18 findings: 4 high real (a live hold never got crow's note, the claim gate 0 of 4 slips, first-acts off the plan, the measuring read with no caller); none wisphunter had found
- 2026-11-04 · FRM-500 re-sign, the ladder, crow's gate (main lane) · wishkeeper 7 min, 179k tokens, 19 findings: 2 high real (stale decided lines codie would build from, my note dump broke wish-cover)
- 2026-11-04 · tails, closes, FRM-505's sign, plus the CST check · wishkeeper 9 min, 243k tokens, 19 findings: 3 high real (a superseded closing word, two false closes)
- 2026-11-04 · the second wind's batch and its handoff (no lane diff) · wishkeeper 7 min, 168k tokens, 16 findings: 2 high real (his 15:22 misread as parking FRM-499 and FRM-501, a fixed row still carried as open)
- 2026-11-04 · FRM-500, FRM-501 closes, after the close, not before: the miss he named (W222) · wishkeeper 8 min, 222k tokens, 21 findings: 3 high real and 2 partly (closes before the read, a report's double count, ticked habit lines; one high missed his 16:34 «solve», one is a plan item, not his word) · FRM-501 reopened by the read
- 2026-11-05 · FRM-507, mods lane 5 layer 1, no sixth sense · wishkeeper 8 min, 192k tokens, 17 findings: 2 high real (live store keys, `mods:live` never run), wisphunter beside it 4, real, one shared · both opened at their spots before the fix batch
- 2026-11-05 · planning batch, no diff of a lane · wishkeeper 5 min, 131k tokens, 12 findings: 4 high real (two of them false claims of mine to dima)
- 2026-11-05 · FRM-507 second read, on the fix round · wishkeeper 7 min, 123k tokens, 5 findings: 1 high real (no live frame at head), 2 medium · blocked a pre-approved merge
- 2026-11-05 · the 18:28 batch, FRM-507 merged in it, a siesta read · wishkeeper 8 min, 193k tokens, 20 findings: 3 high real (his 18:35 order no-wished, a promised ticket unborn, the ✅ all-asks bug untold) · each opened at its spot, fixed or parked; the row above ended as a door limit, `pr-watch.sh --verified`, now `--by clio`
- 2026-11-05 · the 20:21 batch, frame#125 merged in it, a siesta read · wishkeeper 8 min, 178k tokens, 15 findings: 4 high real (a double run with no home, two of o42's three parts unbuilt, a crew line past his tick, a close ask overclaiming); after the merge, so it changed the close, not the merge
- 2026-11-05 · the 20:34 batch, the side channel's merge in it, a siesta read · wishkeeper 9 min, 267k tokens, 19 findings: 1 high real (a failed Linear write i never read, carried as fixed), 4 medium real
- 2026-11-05 · the 21:30 batch, frame#126 read in it, a siesta read · wishkeeper 11 min, 277k tokens, 21 findings: 3 high real (a `to-spec` i told him ran and hadn't, a hash off, a rename grep that could not fail), 5 medium, 13 low · caught all three before the merge
- 2026-11-05 · frame#124's layer, R2 and R3, a chunk read · wishkeeper 7 min, 103k tokens, 10 findings: 1 high real (a third lone-note shape), and wisphunter's 5 found the silent-end gap · both held the merge he had approved, he re-signed on o70
- 2026-11-05 · the batch since 21:30, a siesta read · wishkeeper 8 min, 217k tokens, 18 findings: 1 high real (a scope widened past his sign as «tiny»), to-spec's string swaps among the mediums
- 2026-11-05 · frame#124 at f1060d7d, a chunk read beside wisphunter · wishkeeper 10 min, 172k tokens, 11 findings: 2 high real (the read didn't cover the merge head, its ship mode had no word of his), wisphunter's 2 fixes in the same round
- 2026-11-05 · the batch since 22:42, right after a second wind, a siesta read · wishkeeper 6 min, 190k tokens, 21 findings: 4 high real (a quote trailer with the line shown only mid-turn, a cancel on a false line, the ask-guard skipped, a habit bent in its regroom) · each opened, fixed or asked
- 2026-11-05 · frame#124 at ef4a3eb1, a chunk read beside wisphunter · wishkeeper 6 min, 164k tokens, 12 findings: 2 high real (a no-warn-only ship credited to a tick that never named it, an exit notice held at his keyboard), wisphunter 3 · both held the merge ask for a round
- 2026-11-05 · frame#127 at 81904683, after sixth sense's clean · wishkeeper 8 min, 174k tokens, 12 findings: 3 high real (the audit verb missed codies opened by a Skill call, a limit his tick never covered, a new refusal named only in a comment) · it held the merge ask; sixth sense's next round then refuted its own clean
- 2026-11-05 · frame#124 at 4b699bd2, its last delta · wishkeeper 4 min, 69k tokens, 6 findings: 0 high, what the ask must say; wisphunter nits · merged on his tick at b7a2e8af
- 2026-11-06 · frame#127 at 9a6a1cf9, the last delta after sixth sense's clean, and the batch since the second wind · wishkeeper 11 min, 202k tokens, 17 findings: 3 high real (a pocket list i cut under a false pointer, `--since` blind to compaction re-reads, a behaviour change living only in a spec), wisphunter 9 on the audit's parser · each opened; it shaped the merge ask's limits and a rider
- 2026-11-06 · the batch since 00:02, frame#127's land and two closes, a siesta read · wishkeeper 7 min, 216k tokens, 15 findings: 3 high real (a scripted close line, a false pointer on a ticked home, a row told as in while out) · each opened, PK-308 reopened
- 2026-11-06 · frame#128 at 67eaf128, a chunk read beside wisphunter, before sixth sense's verdict · wishkeeper 9 min, 215k tokens, 19 findings: 1 high real (the done test's unused-variable clause unmet on the real hook, after his merge tick), wisphunter 5 · it held the merge ask, a new one names the gap
- 2026-11-06 · FRM-513 at 154af0f3 and today's whole mods range, no sixth sense on this lane · wishkeeper 8 min, 183k tokens, 11 findings: 1 high real (a late fix narrowed his W2 back), two wisphunter cards by seam 317k tokens, 12 findings, 2 guard and 1 stash bugs real · its first full-scope read: all of them after two rounds of local reviews, so the seam pass earned its cost
- 2026-11-06 · frame#128 at ab9b9aa7, its last delta · wishkeeper 9 min, 138k tokens, 10 findings: 0 high, wisphunter 3 · merged after a fresh ask
- 2026-11-06 · FRM-513 at bc4bb6b6, its last delta · wishkeeper 7 min, 147k tokens, 12 findings: 1 high real (the live proof owed, then run), wisphunter 6 · held the close
- 2026-11-06 · the closing batch, no code · wishkeeper 5 min, 144k tokens, 12 findings: 0 high, 5 medium real (a close without `x lane landed`, his 02:38 words homeless, a stale spec hash)

## verdict
