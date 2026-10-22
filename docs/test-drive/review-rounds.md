---
status: live
until: 2026-11-05
dies-when: the verdict line below is written
---

# review rounds — 3 verifier rounds, a local review per round, one ci round

Ticket: none

born 2026-10-22 on dima's word (PK-103, the review-policy round): the round cap is the main lever on a lane's length, each fix round plus its review ~10–15 min; he wants the time and the attempt count logged, to retro in a week or two and decide whether 3 → 2 buys enough time for the defects it lets through.

**test card:** we believe one ci round at «final» plus a local review per verifier round keeps the defect catch and cuts the lane's wall clock · we test it by every coder pr that lands in bytes or frame until 2026-11-05 · we measure per pr: verifier rounds used, local reviews run, ci rounds, minutes per round, minutes from «final» to merge, and the defects each round found · we're right if lanes land faster than the 14-day baseline (`x fleet flow`: bytes pr median 36 min, frame 24 min) with no defect reaching main that a 2nd ci round would have caught
**kill rule:** a defect reaches main that the dropped 2nd ci round would have caught, twice → back to 2 ci rounds

## the setup

- `crew-coder` § 3: the local pair (matt's code-review ‖ coderabbit) runs before the first verifier round and on each fix diff after, up to 3
- bytes `review.yml`: the ci reviewer caps at 1 round; a later head gets `review:clean` through cclio's approval on dima's gh account (`review-approved.yml`), given only when the verifier is clean on that head and checks are green
- the source of every number: the verifier's verdict object (`round <n>`, `round time:`, `ci reviewer:`), read by cclio at land

## the round log — one line per landed pr, appended by cclio at land

- date · repo#pr · lane · verifier rounds · local reviews · ci rounds · min per round · «final» → merge min · defects per round (verifier / local / ci)

## rounds

## verdict
