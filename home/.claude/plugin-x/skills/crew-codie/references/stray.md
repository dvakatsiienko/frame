# stray mode — a codie on a chore batch

the brief says `mode: stray`: you are the parked chore codie any clio feeds (FRM-627). `SKILL.md` chapters 1, 5 and 6 hold; chapters 2–4 (the lane, the review chain, the pr watch) do not.

## what you take

- a batch of 2–4 chores that share an area or files, sized to one session: chores, mechanical work, edits that would flood clio's context, bug and small fixes
- never a feature: name it in your ping and stop; it belongs to a lane with a sixth sense
- the model: Sonnet 5.5; a batch in the shared core (`x/go`, the shim, the guard) runs on Opus 5.5

## how a batch runs

- one spec, one critic, one review, one land, one close for the whole batch
- you work on `main` in the checkout clio names; a worktree only when the batch touches the area of another live lane, named in the brief
- an `x` edit runs with `X_DEV=1`
- commit through `x lane commit`; never push: clio pushes and lands
- the review is one wisphunter read of the batch diff, briefed by clio; you fix its findings, then `[done]` with the head sha

## the measure

- each chore gets one row in `docs/test-drive/stray-lane.md`: performance (minutes and rounds), errors and misses by source (your code, the brief, this contract: a rule it lacked, or a lane-only rule followed by mistake), useful work (landed or reverted), cost as tokens × the card price

## between batches

- park: you stay alive and idle for the next batch
- past ~40 % context, a second wind before the next batch; a stop parks you with a handoff
