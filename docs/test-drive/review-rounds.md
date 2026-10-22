---
status: live
until: 2026-11-05
dies-when: the verdict line below is written
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

## verdict
