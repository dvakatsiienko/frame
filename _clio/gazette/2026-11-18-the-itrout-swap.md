---
date: 2026-11-18
slug: the-itrout-swap
tickets: [FRM-638, FRM-633, FRM-555, FRM-649, FRM-645, FRM-654, FRM-655, FRM-656, FRM-657, FRM-658, FRM-659, FRM-608, FRM-590]
posted: {health: yes}
---

# 🗞️ clio's gazette · the iTrout swap

## shipped

- 🐟 herdr's new chat replaced the zoo chat, and egg-basket became **iTrout**; zoo is off his mac; dev containers left the status bar: [FRM-638](https://linear.app/x-com/issue/FRM-638)
- 🧪 the stash mod's tests no longer rerun on a timeout, idle jobs tick every 30 s, two misses named (390 user-s, idle cpu −7 %): [FRM-555](https://linear.app/x-com/issue/FRM-555)
- 🛼 one fleet-wide ask counter and glide cards drawn from the lane record: [FRM-649](https://linear.app/x-com/issue/FRM-649)
- 🧹 the groom check traces an inbox fold to its prep by its words: 45 → 0 reds
- 📮 the per-test mod reload is upstream now, a comment with a bare repro on [claude-code#106740](https://github.com/anthropics/claude-code/issues/106740)

## tricks gained

- `claude plugin test` loads a mod from scratch per test: ~200 of 390 user-s; a built `.js` saves only 8 %
- a slower poll in tests trades coverage for −10 %: 202 rows went red, dropped
- the round counter keys chunks by the thread's ticket, so three clean chunks read «round 6»: [FRM-656](https://linear.app/x-com/issue/FRM-656)

## state

- tomorrow herdr opens on the split of chat's `main.js` (4,381 lines), shared types and shelf contracts: [FRM-659](https://linear.app/x-com/issue/FRM-659); mods opens on FRM-656, then the lost hand-offs: [FRM-657](https://linear.app/x-com/issue/FRM-657)
- FRM-645 re-signed in a quick grill, its herdr half split out: [FRM-654](https://linear.app/x-com/issue/FRM-654); blocked herdr wishes have one home: [FRM-655](https://linear.app/x-com/issue/FRM-655)
- every lane and wing 1 stopped at the halt

## trail

- shipped: the iTrout swap and the new chat live, FRM-555 and FRM-649 closed, groom check green, the reload bug upstream
- open: FRM-659 opens herdr, FRM-656 opens mods, FRM-629 regrill (stop the mess), branch clutter ask
- state: all lanes stopped; mods tests at 390 user-s waiting on #106740
