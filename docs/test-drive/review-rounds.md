---
status: live
until: 2026-11-07
dies-when: the verdict line below is written
fits: coder verifier
---

# review rounds — 3 verifier rounds, a local review per round, one ci round

Ticket: FRM-72 (the pm story; dima's words: cclio pocket PK-103, W99–W103)

born 2026-10-22 on dima's word (PK-103, the review-policy round): the round cap is the main lever on a lane's length, each fix round plus its review ~10–15 min; he wants the time and the attempt count logged, to retro in a week or two and decide whether 3 → 2 buys enough time for the defects it lets through.

**test card:** we believe one ci round at «final» plus a local review per verifier round keeps the defect catch and cuts the lane's wall clock · we test it by every coder pr that lands in bytes until 2026-11-05 (frame has no ci reviewer yet, FRM-411; a frame pr logs its local and verifier numbers only) · we measure per pr: verifier rounds used, local reviews run, ci rounds, minutes per round, minutes from «final» to merge, and the defects each round found · we're right if bytes lanes land faster than the 14-day baseline (`x fleet flow`: bytes pr median 36 min) with no defect reaching main that a 2nd ci round would have caught
**kill rule:** twice a defect reaches main that a 2nd ci round would have caught → back to 2 ci rounds. «would have caught» is judged by one probe: the ci reviewer re-run on the pr's merged diff (dima's label) flags the defect

## the setup

- `crew-coder` § 3: the local pair (matt's code-review ‖ coderabbit) runs before the first verifier round and on each fix diff after, 3 in all
- bytes `review.yml`: the ci reviewer caps at 1 round; a later head gets `review:clean` through cclio's approval on dima's gh account (`review-approved.yml`), given only when the verifier is clean on that head and checks are green
- the source of every number: the verifier's verdict object (`round <n>`, `round time:`, `ci reviewer:`), the coder's done report (`local reviews: <n>` and each review's graded line in this file), and the pr's «final» → merge times from `gh pr view`; cclio appends the line at land (`craft-fleet-flow` stage 8)

## the round log — one line per landed pr, appended by cclio at land

- date · repo#pr · lane · verifier rounds · local reviews · ci rounds · min per round · «final» → merge min · defects per round (verifier / local / ci)

## rounds

- 2026-10-22 · frame#95 · side lane (cli lane 1, FRM-401) · 2 verifier rounds · 1 local review (matt's code-review ×2 cards ‖ coderabbit) · 0 ci rounds (frame has none, FRM-411) · round 1 ~11 min, round 2 ~19 min with its fixes · clean 20:37 → merge 20:44 (7 min, his tick on a self-edit) · verifier 3 real / local 15 useful of 20 / ci — · the coder's red-proof run caught 18 of 19 mutations itself; the graded lines sit in its retro (`shelf/retros/2026-10-22-FRM-401-coder.md`)
- 2026-10-28 · frame#114 (FRM-465) · crew verifier (Opus 5.5) · 2 rounds before the ci reviewer's final: round 1 refuted (unasked digest-pin preset, found by a renovate dry run), round 2 clean so far ~8 min after the ping; the coder's coderabbit asked to re-add the pin, declined · useful

## graded lines — one per local review, from the coder's done report, copied by cclio at land

- 2026-10-22 · frame#95 · matt's code-review, spec card (Opus 5.5) · 4 useful, 3 noise · useful
- 2026-10-22 · frame#95 · matt's code-review, standards card (Opus 5.5) · 9 useful, 2 kept by choice · useful
- 2026-10-22 · frame#95 · coderabbit · 2 of 2 useful (a graphql error read as 0 open threads, fail-open) · useful
- 2026-10-23 · frame#104 · crew verifier (Opus 5.5) · 2 rounds, 1 of 1 useful (the built-out count padded 185 vs 160 run, caught by a `-json` recount); a round 4 min against 13 before, the gate ~49 s · useful
- 2026-10-25 · bytes#130, bytes#132, frame#110 (FRM-411) · crew verifier (Opus 5.5) + the shared ci reviewer · 1 round each, all clean; 3 P2 notes useful (exit line 8 wording vs atelier, an unasked stryker rider, `x lane review` naming review-approved.yml on frame); the ci reviewer's first frame round clean on the new shared key · useful

## verdict
