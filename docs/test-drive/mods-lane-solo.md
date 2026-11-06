---
status: dropped
until: 2026-11-19
dies-when: the verdict line below is written
fits: clio
---

# mods-lane-solo — a mods lane with codie alone against codie plus sixth sense: speed gained, quality lost

Ticket: none

dima, 2026-11-05 17:05: «i spotted from the recent few lanes that, for a mods lane, coder plus verifier takes a lot of time for each chunk; last session's side lane was able to implement only four chunks or so, if i recall correctly. today i test coder alone without verifier to see a speed boost, because mods are not so sophisticated, and i assume the verifier can be redundant. i want to know the comparison of coder plus verifier and coder alone in terms of speed gains and quality losses.»

**test card:** we believe a mods chunk lands much faster with no sixth sense, and a coordinator read catches what matters · we test it by mods lane 5 (FRM-507, FRM-501, FRM-505, FRM-504, FRM-491), five layers, against mods lane 4's chunks · we measure, per chunk: minutes from start to `[done]` and to green, rounds, tokens per seat, findings by severity and who found them, the same chunk's reds after merge · we're right if chunks per hour rise by at least half, and the blind read below finds no high that wishkeeper and wisphunter missed
📌 a same-day control arm: cli lane 4 runs codie plus sixth sense under the same PR model.
**kill rule:** a high reaches main that this lane's reads missed, or a coordinator read takes as long as the sixth sense rounds it replaced.

📌 this arm is codie plus clio's reads (wishkeeper, wisphunter, `pnpm mods:test` run by clio), not codie with nobody looking. held stacked prs and worktrees add their own hand steps, so the stack's minutes are counted apart (`docs/test-drive/stacked-prs.md`).

## stress list

- speed — each layer's `[done]` and green timestamps — minutes per chunk, chunks per hour, against mods lane 4's median
- rounds — fixes sent back per chunk — count, against sixth sense's rounds
- quality, found — every wishkeeper and wisphunter finding — severity, real or noise, fixed or not
- quality, missed — one blind read over the whole stack before the merge, its brief knowing no finding (his tick o8) — highs the reads missed
- quality, after — reds and wisps on these chunks for 14 days after the land — count
- cost — tokens per seat for the lane, clio's reads included — against lane 4's codie plus sixth sense

## baseline — mods lane 4, codie plus sixth sense (a helper card's read of the transcripts, 2026-11-05, not re-run by clio)

- 12 chunks over 3 codie sessions: 6 on 11-02, 4 on 11-03, 2 on 11-04. dima's «four or so» is the middle day and the average
- chunks per active hour: 0.96, 0.53, 0.39. median per chunk, start to clean: 88 min wall, 57 min working plus waiting
- rounds per chunk: 1–5; the heavy ones FRM-472 (5), FRM-492 (4), FRM-478, FRM-501, FRM-500 (3 each)
- P-tag mentions across rounds, not de-duplicated: P0 1, P1 25, P2 41, P3 1; four chunks raised none
- 📌 read the speed gain against the same chunk shape: a chunk's size moves these more than the verifier may, FRM-498 took 16 min and FRM-472 4 h 42 m

## rounds

- 2026-11-05 · FRM-507, size S, layer 1 · greenlight 17:07 → `[done]` 17:30, 23 min, on top of 17:03 → 17:07 slicing the whole lane; 1 pr, 2 local reviews, 0 fix rounds so far · read 1: 2 high, 4 real bugs, from wishkeeper and wisphunter · fix round 17:40 → 18:21, 41 min, 5 local reviews, 2 riders of dima's in it; so 64 min build to second `[done]`, against lane 4's 88 median; read 2, 7 min: 1 high (no live frame at head), 2 medium; a CI round joined at 18:27, 1 m 43 s, clean; merged 18:39: greenlight 17:07 → merge 18:39, 92 min, with 2 riders in it. lane 4's 88 min median ends at clean, not at merge: this lane's end point for that compare is my second read's green, about 18:29, 82 min. first layer, not a pattern yet

## verdict

dropped 2026-11-06 — a sixth sense is back on the mods lane from FRM-510, dima's word 23:05 and his tick: too few chunks to compare, the numbers stand as measured: 7.91 active min per 100 lines solo (n=3), 3.75 with one (n=13), no quality read.
