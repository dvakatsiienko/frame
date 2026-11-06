---
status: live
until: 2026-11-19
dies-when: the verdict line below is written
fits: codie sixth-sense
---

# review rounds — 3 sixth sense rounds, a local review per round, one ci round

Ticket: FRM-72 (the pm story; dima's words: clio pocket PK-103, W99–W103)

born 2026-10-22 on dima's word (PK-103, the review-policy round): the round cap is the main lever on a lane's length, each fix round plus its review ~10–15 min; he wants the time and the attempt count logged, to retro in a week or two and decide whether 3 → 2 buys enough time for the defects it lets through.

**test card:** we believe one ci round at «final» plus a local review per sixth sense round keeps the defect catch and cuts the lane's wall clock · we test it by every codie pr that lands in bytes until 2026-11-05 (frame has no ci reviewer yet, FRM-411; a frame pr logs its local and sixth sense numbers only) · we measure per pr: sixth sense rounds used, local reviews run, ci rounds, minutes per round, minutes from «final» to merge, and the defects each round found · we're right if bytes lanes land faster than the 14-day baseline (`x fleet flow`: bytes pr median 36 min) with no defect reaching main that a 2nd ci round would have caught
**kill rule:** twice a defect reaches main that a 2nd ci round would have caught → back to 2 ci rounds. «would have caught» is judged by one probe: the ci reviewer re-run on the pr's merged diff (dima's label) flags the defect

## the setup

- `crew-codie`: one of each local review per chunk, started together in the background, coderabbit a free extra nothing waits on; no review rerun after a sixth sense round (the arm moved 2026-11-05)
- bytes `review.yml`: the ci reviewer caps at 1 round; a later head gets `review:clean` through clio's approval on dima's gh account (`review-approved.yml`), given only when sixth sense is clean on that head and checks are green
- the source of every number: sixth sense's verdict object (`round <n>`, `round time:`, `ci reviewer:`), codie's done report (`local reviews: <n>` and each review's graded line in this file), and the pr's «final» → merge times from `gh pr view`; clio appends the line at land (`craft-fleet-flow` stage 8)

## the round log — one line per landed pr, appended by clio at land

- date · repo#pr · lane · sixth sense rounds · local reviews · ci rounds · min per round · «final» → merge min · defects per round (sixth sense / local / ci)

## rounds

- 2026-10-22 · frame#95 · side lane (cli lane 1, FRM-401) · 2 verifier rounds · 1 local review (matt's code-review ×2 cards ‖ coderabbit) · 0 ci rounds (frame has none, FRM-411) · round 1 ~11 min, round 2 ~19 min with its fixes · clean 20:37 → merge 20:44 (7 min, his tick on a self-edit) · verifier 3 real / local 15 useful of 20 / ci — · the coder's red-proof run caught 18 of 19 mutations itself; the graded lines sit in its retro (`shelf/retros/2026-10-22-FRM-401-coder.md`)
- 2026-10-28 · frame#114 (FRM-465) · crew verifier (Opus 5.5) · 2 rounds before the ci reviewer's final: round 1 refuted (unasked digest-pin preset, found by a renovate dry run), round 2 clean so far ~8 min after the ping; the coder's coderabbit asked to re-add the pin, declined · useful
- 2026-11-05 · frame#125 (FRM-470) · side lane (cli lane 4) · 3 sixth sense rounds, clean on c1d930a5 · 3 local reviews · 1 ci review · merge 20:26 on his tick, the guard's newest-tick gap cost a second ask · sixth sense found what no local review did: a broken dev copy read green, a hint obeyed by the probe's model
- 2026-11-06 · frm-514 codie · 3 rounds, the first the only one that moved design
- 2026-11-06 · frm-517 codie · fine
- 2026-11-06 · frm-514 sixth sense · 11, 4, 3 min of its own wall clock; no reviewer lane, so no other read here · keep, no new read

- 2026-11-06 · BYT-130 ci made boring · codie · 4 sixth sense rounds, 2 of them on steers; local reviews 4
- 2026-11-06 · BYT-130 ci made boring · sixth sense · r1 14 min, r2 13 min (10 of it CI), r3 19 min (14 in the gate queue), r4 3 min; 4 rounds, all P2 or text, none counted to the cap; scope grew by dima's fix word · keep
- 2026-11-06 · cli lane 6 · codie · local reviews 4 (built-in, two wisphunter cards, coderabbit); sixth sense rounds 2 so far, the ci reviewer's one spent
- 2026-11-06 · lane retros (FRM-474, FRM-521) · FRM-474: 5 local reviews, 5 sixth sense rounds, most wall clock on queue waits; the ci reviewer's one round never read the redesign. FRM-521: 2 sixth sense rounds, 44 min first verdict to second head, the ci reviewer at final caught what two rounds did not
## graded lines — one per local review, from codie's done report, copied by clio at land

- 2026-10-22 · frame#95 · matt's code-review, spec card (Opus 5.5) · 4 useful, 3 noise · useful
- 2026-10-22 · frame#95 · matt's code-review, standards card (Opus 5.5) · 9 useful, 2 kept by choice · useful
- 2026-10-22 · frame#95 · coderabbit · 2 of 2 useful (a graphql error read as 0 open threads, fail-open) · useful
- 2026-10-23 · frame#104 · crew verifier (Opus 5.5) · 2 rounds, 1 of 1 useful (the built-out count padded 185 vs 160 run, caught by a `-json` recount); a round 4 min against 13 before, the gate ~49 s · useful
- 2026-10-25 · bytes#130, bytes#132, frame#110 (FRM-411) · crew verifier (Opus 5.5) + the shared ci reviewer · 1 round each, all clean; 3 P2 notes useful (exit line 8 wording vs atelier, an unasked stryker rider, `x lane review` naming review-approved.yml on frame); the ci reviewer's first frame round clean on the new shared key · useful

- 2026-10-29 · frame 74994434..cfb2fe36 + bytes 0c8ceeab..3b7add0d (the rename sweep, dima-mode codie on main) · built-in /code-review, codie's 8 angles, round 1 · 2 findings (fleet_ops title word bounds, reply-check crow substring), both fixed · useful
- 2026-10-29 · the rename sweep · 🐆 wisphunter paired beside the built-in, round 1 · 7: 5 real bugs fixed, 1 by-design, 1 nit fixed · useful
- 2026-10-29 · the rename sweep · matt's code-review, standards card (wisphunter), round 2 · 9: 7 fixed, 1 declined (a hidden constraint), 1 nit · useful
- 2026-10-29 · the rename sweep · matt's code-review, spec card (wisphunter), round 2 · 3 + 1 question, all real, all fixed — the only catches nothing else made (the profile redraw never run, 43 live card heads, the github-contrib o67 line) · useful
- 2026-10-29 · the rename sweep · 13 intermediate wisphunter runs per slice, 1–3 min each · caught what the final rounds would have, earlier · useful
- 2026-10-30 · the rename sweep post-run, wave 1 (clio) · matt's code-review, standards card (wisphunter) · 8 + 1 question: drifted read-both lists missing `cclio` in 3 readers, a narrowed dir match, a half-renamed comment, 2 smells, 2 nits · useful
- 2026-10-30 · the rename sweep post-run, wave 1 (clio) · matt's code-review, spec card (wisphunter) · 8: the guard's exceptions wider than the spec, an open pocket item missed, live state outside git (desktop presets, a state-file key, token caches), 2 spec lines half-done, `pnpm check` missing from exit 3's evidence · useful
- 2026-10-30 · FRM-467 mods quick lane 3 (codie + sixth sense) · 2 rounds: round 1 refuted on c1174fe5 (27 escapes from the job-tmp lift, one proven on disk), round 2 clean on bd686083 · codie's local review: 3 wisphunter cards, 28 items, the bug card's 5 holes the best · useful
- 2026-10-30 · FRM-458 cli lane 3, #120 (codie + sixth sense; joiners FRM-432, FRM-475, FRM-476) · sixth sense rounds 1–3 on the new scope, clean on b43acd61 (22/22), after rounds 0–3 on slices 01–06; pm review rounds 3 and 4 found 6 + 3 highs in the verbs, all fixed before the merge · codie's 9 local reviews: wisphunter 8 useful (one P1 sixth sense missed, one fix inverted by clio), coderabbit 1 useful + 1 noise · merged by merge-auto --dima-ok (self-edit), no merged-by-x label

- 2026-11-02 · mods quick lane 4 (one Opus 5.5 codie + one sixth sense, main:<base> + final: <sha> per chunk) · FRM-478 clean at R3 (the Opus grade of lane 3's Sonnet chunks; its 60 leftover rows went to FRM-472 and FRM-489) · FRM-479 clean · FRM-486 clean · riders 11-02 + FRM-477: round 1 refuted on riders exit 5 (two store keys left), round 2 clean on 68aeae19; riders exit 2 failed live at the 21:30 cap and moved to FRM-488 · FRM-487: round 1 refuted on exit 3b (a bare backticked name cleared a claim), round 2 clean on aab77705 · FRM-488: round 1 clean on e338dc27, exit 3 waits on the next real cap · crow caught two spec holes before the build (FRM-487's clears, FRM-488's unread row came from codie)

- 2026-11-05 · 📌 the arm moved: dima's new base is one of each review per chunk, no rerun per sixth sense round; rounds from today read against that
- 2026-11-05 · extended once to 2026-11-19 on dima's tick: the arm moved and his pr model is adopted (`docs/research/review-model.md`); old arm's numbers: frame median 44 min over 18 prs, bytes 1,196 min over 6 prs
- 2026-11-05 · frame#123 (FRM-507, mods lane 5 layer 1, no sixth sense) · 0 sixth sense rounds · 5 local reviews, 6 graded · 1 ci round, 1 m 43 s against ~13 min before, clean, its one note the ✅ all-asks tick (FRM-510) · fix round 41 min · «final» 18:21 → merge 18:39, 18 min · my two reads: 2 high, 1 high; local 28 findings, 1 noise; ci 1 note
- 2026-11-05 · frame#123 · matt's standards axis, wisphunter · 8, 6 fixed · useful
- 2026-11-05 · frame#123 · matt's spec axis, wisphunter · 5 · useful
- 2026-11-05 · frame#123 · matt's both axes on the fix diff, wisphunter · 6, the lockJoined race and a failed untick · useful
- 2026-11-05 · frame#123 · built-in /code-review on the fix diff · 4, 1 fixed · useful
- 2026-11-05 · frame#123 · plain wisphunter, whole layer · 4, 2 bugs fixed, both rows red on a mutation · useful
- 2026-11-05 · frame#123 · coderabbit, whole layer · 1 minor, already fixed · noise
- 2026-11-05 · frame#125 · matt's standards axis, wisphunter · 11 findings · useful
- 2026-11-05 · frame#125 · matt's spec axis, wisphunter · 8 findings · useful
- 2026-11-05 · frame#125 · built-in /code-review · 10 findings · useful
- 2026-11-05 · frame#125 · coderabbit · 0 findings · noise
- 2026-11-05 · frame#125 · ci review · clean, 4 notes, 1 useful · useful
- 2026-11-05 · frame#126 (FRM-480, cli lane 4 layer 2) · 4 sixth sense rounds, about 40 min final to clean, one round caused by a re-sign mid-verify, o62 · 15 of 15 exit lines · merged at 2cf38e8c
- 2026-11-05 · frame#126 · matt's standards and spec axes, wisphunter · 8 and 6 findings · useful
- 2026-11-05 · frame#126 · built-in /code-review · 9 findings · useful
- 2026-11-05 · frame#126 · sixth sense's wisphunter · 7 claims, 2 reproduced as real, 2 set aside · useful
- 2026-11-05 · frame#124 (FRM-501, mods lane 5 layer 2, no sixth sense) · clio's 3 read rounds, wishkeeper and wisphunter over each head, each found real items: f1060d7d, ef4a3eb1 (2 highs that changed what he was told), 4b699bd2 nits only · his exit-notice tick came from a read, merged at b7a2e8af
- 2026-11-05 · frame#127 (FRM-434, cli lane 4 layer 3) · 3 sixth sense rounds, 9 and 7 min after round 1, 14 of 14 exit lines · its second read found all 4 of round 1's breaks, each invisible to green rows; a scoped reviewer's one-line fix caused round 2's two regressions, which codie's own scoped read missed
- 2026-11-05 · frame#126 · a miss of every round above: its merge removed a clean tree with cli codie live inside, whose session started elsewhere and entered by `cd`; nothing lost, read from the merge's own log · the fix is FRM-434's exit 11, on frame#127
- 2026-11-06 · frame#128 (FRM-473, cli lane 4 layer 4) · 2 sixth sense rounds, 7 and 0 findings, 10 of 10 exit lines · 5 local reviews · 1 ci round, 1 blocking, useful · merged at 887fce1a · wishkeeper's high on its read caught a done test unmet on the real hook, which led to his fix; 14 min clean → merge, three merge asks
- 2026-11-06 · FRM-513 (mods lane 5, main, no pr, no sixth sense) · 0 sixth sense rounds, 6 local review rounds · no ci round · clio's reads: wishkeeper 3, wisphunter 3 by seam and delta, found 1 high and 3 real bugs after two local rounds · closed on his tick, 02:41
- 2026-11-06 · frame#128 · matt's standards · 14 findings, 12 useful, 2 noise · useful
- 2026-11-06 · frame#128 · matt's spec · 6 findings, 5 useful · useful
- 2026-11-06 · frame#128 · plain wisphunter · 9 findings, 9 useful, it found the save-mid-test race · useful
- 2026-11-06 · frame#128 · built-in /code-review · 8 findings, 8 useful · useful
- 2026-11-06 · frame#128 · coderabbit · 0 findings · noise
- 2026-11-06 · FRM-514 quick lane · matt spec card · 2 findings, 2 useful · useful
- 2026-11-06 · FRM-514 quick lane · matt standards card · 6 findings, 3 useful, the `.py` port declined, the spec names it · useful
- 2026-11-06 · FRM-514 quick lane · built-in /code-review · 10 findings, 3 fixed, the rest named · useful
- 2026-11-06 · FRM-514 quick lane · plain wisphunter · 5 findings, 2 useful, it found the compaction bug the built-in missed · useful
- 2026-11-06 · FRM-514 quick lane · coderabbit · 0 findings · noise
- 2026-11-06 · FRM-514 quick lane · sixth sense · 3 rounds, round 1 the only one that moved the design: a batched sibling edit landed unguided · useful
- 2026-11-06 · FRM-504 mods lane 5 · wishkeeper + wisphunter · 3 and 4 highs after codie's first done, round 2 fixed all 6 · useful
- 2026-11-06 · BYT-130 ci made boring · sixth sense + wisphunter · 4 rounds; wisphunter found the rev hole, his fix ask added a round, a 4th limit came from the fix itself · useful
- 2026-11-06 · BYT-94 ci made boring, codie · 3 local reviews on both prs, 1 ci round each · each local review found something the others missed
- 2026-11-06 · FRM-511 cli lane 5, sixth sense · 2 rounds, the second only the refuted lines plus mutants, graded lines in the done comment · helped, keep
- 2026-11-06 · FRM-509 cli lane 5, sixth sense · 2 rounds, round 1 refuted: a branch mid-rebase in another tree was deleted; 14 of 14 mutants red on head; wishkeeper then caught decamp unwired in the wing landing and the halt · useful
- 2026-11-06 · a trial from the next side lane, dima's tick: sixth sense summoned at codie's «final», not at its first commit · measure: watch and deadline pings spared, a miss an early plan read would have caught

## verdict
