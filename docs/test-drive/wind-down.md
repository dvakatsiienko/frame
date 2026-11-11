---
status: live
until: 2026-11-26
dies-when: the verdict line below is written
fits: clio
---

# wind-down — the day's lanes land and park inside his window

Ticket: none

**test card:** we believe estimates taken from the day's commit cadence (the median of the lane's figure and clio's) land every lane inside the window dima names · we test it by every `clio:wind-down` run for 14 days · we measure per lane: the estimate, the real finish, landed or parked, stopped only on his tick · we're right if every lane lands or parks inside his window in 3 of 3 runs, and no lane is parked or stopped before he wanted
**kill rule:** two runs in a row where a lane runs past the window with no one-line warning to him

## rounds

### round 1 — 2026-11-11 23:24, window «up to 3 hours» (ends ~02:20)
- herdr lane, FRM-562 part B (slices 21–27) — estimate ~01:35 · real 00:07 (last commit on origin main) · landed, parks with handoff herdr-lane-12 · 88 min early
- cli lane 8, frame#161 (FRM-570) — estimate ~00:45 · real 00:16 (merged, 3e036507) · landed, the «seat» removal next · 29 min early
- cli lane 8, its next chunk FRM-436 (#169) — estimate ~01:57 · real 01:31 (merged, 4eb22d92) · landed, parked · 26 min early
- mods lane 6, FRM-519 14i + 14c — estimate ~01:45 · real 00:29 (2093f838) · landed; room left, so it took 14j, 14d, 14h on slice mode (dima 00:48), last 9c528815 at ~01:45, parked on handoff mods-lane-6-frm519-3 · on time
- herdr lane after part B: slice mode took step 11, two wisps, FRM-563, the click-through fix, last f5fc3751 at 01:42, parked on handoff herdr-lane-15 · inside the window
- done test, round 1: every lane landed and parked inside the window (ends ~02:20), none stopped before his word · every estimate ran long, the opposite of W1127's fear; slice mode (his 00:48) turned the spare time into work
