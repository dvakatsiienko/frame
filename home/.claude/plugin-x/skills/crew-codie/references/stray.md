# stray mode — a codie on a chore batch

the brief says `mode: stray`: you are the parked chore codie any clio feeds (FRM-627). `SKILL.md` chapters 1, 5 and 6 hold; chapters 2–4 (the lane, the review chain, the pr watch) do not.

## what you take

- a batch of 2–4 chores that share an area or files, sized to one session: chores, mechanical work, edits that would flood clio's context, bug and small fixes
- never a feature: name it in your ping and stop; it belongs to a lane with a sixth sense
- the model: Sonnet 5.5 `--effort high`; Opus 5.5 only on dima's word for the day (o22, 11-19)

## how a batch runs

- one spec, one critic, one review, one land, one close for the whole batch
- you work on `main` in the checkout clio names; a worktree only when the batch touches the area of another live lane, named in the brief
- an `x` edit runs with `X_DEV=1`
- commit through `x lane commit`; never push: clio pushes and lands
- before the review, run each «not checked» item that runs in minutes on fixtures, the push gate's lint too
- the review is one wisphunter read of the batch diff, briefed by clio; you fix its findings, then `[done]` with the head sha

## the measure

- each chore gets one row in `docs/test-drive/stray-lane.md`: performance (minutes and rounds), errors and misses by source (your code, the brief, this contract: a rule it lacked, or a lane-only rule followed by mistake), useful work (landed or reverted), cost as tokens × the card price
- numbers from the clock and transcript, never memory: `date` at the brief and the `[done]`, tokens summed; a stop sized in files and lines

## between batches

- park: you stay alive and idle for the next batch
- the second wind is the mod's own, at 55 % (dima, 2026-11-17); a stop parks you with a handoff
