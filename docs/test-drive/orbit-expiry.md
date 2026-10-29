---
status: dropped
until: 2026-10-21
---

Ticket: none · built c9533240 (mods lane l12)

# orbit ask expiry — does an ask that leaves on its own ever help dima?

dima, 2026-10-12 (o92): «I generally don't like orbit items to expire at all, because I can miss it for a few turns and it will vanish. I'd rather keep it sticky if I peek into a window later. let's have it for some time, and I'll test drive.»

## the use, during the drive

- cclio sets `dies` only on a next-move pick («next: siesta or the sweep?»), as `dies: 2`; a proposal, a decision or a grill question never expires
- each round: an ask that expired, whether dima later asked about it (a miss) or never did (a win)

## the verdict question

at `until`: count wins against misses. one miss he noticed → drop the feature (sticky by default is his lean).

## rounds

- 2026-10-12 21:52 · a miss by misuse: cclio set `dies: 3` on a real decision (o137, «checkpoint now?»); it left orbit unpicked while dima was busy with the coder refresh. the rule says decisions never expire — the slip is cclio's, the feature did what it was told. re-added sticky

## verdict

- 2026-10-19 · **dropped** (dima o91): 0 wins, 1 miss in 1 round (cclio set `dies: 3` on a real decision, o137); sticky by default stays. the code still carries the `dies` field: its removal rides the next mods lane (PK-207).
