# halt mini — the close of a mini-boot day

a session booted with `/clio:boot mini` always closes here, whatever word he uses: «halt» means halt mini (dima, 2026-11-22). the day ran outside the main flow, so the close keeps the main flow's state as it is.

## the handoff — extend, never replace

- the pending main CST in `~/.claude/shelf/handoffs/` is the next day's plan: never ingested, deleted or rewritten here
- what today changed for that plan is appended to it, under one dated `## addendum — <date> mini day` heading at the end: moved dates, tickets born or closed, a first-act that changed
- nothing changed for it → the file stays untouched
- a full rewrite only on his word; then save it beside the old one and say which is current

## the steps

1. tails: `node script/prompt-groom.ts --day` and `node script/pocket-check.ts` green, every small chore of the day solved or named
2. siesta and trial counts the day kept: one comment on their ticket (the siesta trigger count → FRM-680)
3. commit and push what the day changed
4. stop the day's sidecars and background jobs: helga (`pnpm -C ~/frame helga:stop`), crow (`pnpm -C ~/frame crow:stop`), every background shell
5. the addendum, when the day changed the plan
6. phases set to the next session's first moves, read from the main CST

skipped on purpose: the flawlog flush, the gazette, the board, the trial board, milestones, wings and lanes.
