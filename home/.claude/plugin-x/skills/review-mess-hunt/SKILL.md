---
name: review-mess-hunt
description: Load on «review-mess-hunt», «mess hunt», «hunt the mess», «review the codebase as it stands», and when a lane opens with a mess hunt — a parallel read of code as it is now that ends in one fix list dima ticks. Not for a diff or a pr (that is `/code-review`).
---

# review-mess-hunt — hunt the mess in code as it stands

a few readers read one area of code in parallel, read-only, each from its own angle; clio merges where they agree, triages, and dima ticks one fix list. it reads the code as it is now, never a delta: a diff stays `/code-review`'s, applying cleanups `/simplify`'s. the want and its decisions: [FRM-629](https://linear.app/x-com/issue/FRM-629).

what counts: real mess first (state with several owners, timers settling instead of answers, duplicated rules, silent catches, hollow tests, a file no one reads whole); where the code is a real mess, its cosmetics are fixed too (names, colocation, reuse), so it reads pristine to anyone. a nit for its own sake (moving code to move it) is never collected.

## the run

1. **pin the base.** record `git rev-parse HEAD` of the area's repo; every finding points at that sha. done: the sha is in the brief of every reader.
2. **name the area and the case.** the area is a folder or a set of files; the case is the pain that brought the hunt (the lane's tickets, the wisps, dima's words). done: one brief file holds both, read by every reader.
3. **pick the readers.** the baseline, each read-only:
   - three `messhunter` cards, one per angle, each brief naming the area, the case, the pinned sha, its angle and its findings file: **architect** (root-cause the case, then every place of the same shape), **tester** (every state, hostile order and hollow test), **bug hunter** (bugs with a failure scenario)
   - a parked member joins for a fuller picture, never instead of a card: the lane's codie as a second architect, its sixth sense as a second tester, the stray codie
   - past ~5,000 lines the area splits, one architect per part, one bug hunter over all, each at `effort: high`

   done: each reader named with its angle, and `x:crew-subagent` loaded before a card spawns.
4. **read.** every reader reads at the pinned sha in parallel and writes one file: findings as `path:line`, the failure scenario, a fix in one line, and a grade (fix now · ticket · drop); «not checked» names what it skipped. done: every reader's file exists.
5. **merge and triage — clio.** where readers agree is the root; a contradiction is settled by one probe before it reaches dima. each finding becomes fix (rides the lane), ticket (its milestone), or drop (with its why). done: one list, every finding placed.
6. **dima ticks.** the list goes to him, one line per item; his ticks are the scope. done: every line ticked or dropped by him.
7. **fold.** the ticked fixes ride the lane before its next chunk; a lesson that holds for any code joins `x:guide-code`'s [review-lessons.md](../guide-code/references/review-lessons.md); the fixes get architecture exit lines in the lane's spec, so a sixth sense grades the shape and not only the behaviour. done: the fixes are in the spec or a ticket, the lessons in guide-code.
8. **log the cost.** the run's token total (every reader plus the merge) goes to FRM-629 as one comment; ~250k a run is the first guess, the first runs measure it. done: the comment names the total and the reader count.

## when

on dima's word, or as a lane opener: everyone summoned fresh reads first, then the findings decide whether the mess is fixed before the first chunk or planned as chunks.
