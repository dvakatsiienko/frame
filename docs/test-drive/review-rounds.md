---
status: live
until: 2026-11-07
dies-when: the verdict line below is written
fits: codie sixth-sense
---

# review rounds — 3 sixth sense rounds, a local review per round, one ci round

Ticket: FRM-72 (the pm story; dima's words: clio pocket PK-103, W99–W103)

born 2026-10-22 on dima's word (PK-103, the review-policy round): the round cap is the main lever on a lane's length, each fix round plus its review ~10–15 min; he wants the time and the attempt count logged, to retro in a week or two and decide whether 3 → 2 buys enough time for the defects it lets through.

**test card:** we believe one ci round at «final» plus a local review per sixth sense round keeps the defect catch and cuts the lane's wall clock · we test it by every codie pr that lands in bytes until 2026-11-05 (frame has no ci reviewer yet, FRM-411; a frame pr logs its local and sixth sense numbers only) · we measure per pr: sixth sense rounds used, local reviews run, ci rounds, minutes per round, minutes from «final» to merge, and the defects each round found · we're right if bytes lanes land faster than the 14-day baseline (`x fleet flow`: bytes pr median 36 min) with no defect reaching main that a 2nd ci round would have caught
**kill rule:** twice a defect reaches main that a 2nd ci round would have caught → back to 2 ci rounds. «would have caught» is judged by one probe: the ci reviewer re-run on the pr's merged diff (dima's label) flags the defect

## the setup

- `crew-codie` § 3: the local pair (matt's code-review ‖ coderabbit) runs before the first sixth sense round and on each fix diff after, 3 in all
- bytes `review.yml`: the ci reviewer caps at 1 round; a later head gets `review:clean` through clio's approval on dima's gh account (`review-approved.yml`), given only when sixth sense is clean on that head and checks are green
- the source of every number: sixth sense's verdict object (`round <n>`, `round time:`, `ci reviewer:`), codie's done report (`local reviews: <n>` and each review's graded line in this file), and the pr's «final» → merge times from `gh pr view`; clio appends the line at land (`craft-fleet-flow` stage 8)

## the round log — one line per landed pr, appended by clio at land

- date · repo#pr · lane · sixth sense rounds · local reviews · ci rounds · min per round · «final» → merge min · defects per round (sixth sense / local / ci)

## rounds

- 2026-10-22 · frame#95 · side lane (cli lane 1, FRM-401) · 2 verifier rounds · 1 local review (matt's code-review ×2 cards ‖ coderabbit) · 0 ci rounds (frame has none, FRM-411) · round 1 ~11 min, round 2 ~19 min with its fixes · clean 20:37 → merge 20:44 (7 min, his tick on a self-edit) · verifier 3 real / local 15 useful of 20 / ci — · the coder's red-proof run caught 18 of 19 mutations itself; the graded lines sit in its retro (`shelf/retros/2026-10-22-FRM-401-coder.md`)
- 2026-10-28 · frame#114 (FRM-465) · crew verifier (Opus 5.5) · 2 rounds before the ci reviewer's final: round 1 refuted (unasked digest-pin preset, found by a renovate dry run), round 2 clean so far ~8 min after the ping; the coder's coderabbit asked to re-add the pin, declined · useful

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

## verdict
