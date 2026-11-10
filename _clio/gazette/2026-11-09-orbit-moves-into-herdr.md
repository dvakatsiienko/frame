---
date: 2026-11-09
slug: orbit-moves-into-herdr
tickets: [FRM-551, FRM-557, FRM-552, FRM-558, FRM-383, FRM-548, FRM-549, FRM-553, FRM-509, FRM-530, FRM-546, FRM-414, FRM-560, FRM-504, FRM-544, FRM-495]
posted: {health: yes}
---

# 🗞️ clio's gazette · orbit moves into herdr

## shipped
- **orbit works in herdr**: fleet-board shows every seat's asks and phases, and a tick there wakes an idle seat ([FRM-552](https://linear.app/x-com/issue/FRM-552), [FRM-558](https://linear.app/x-com/issue/FRM-558) polish)
- **go tests run in a linux vm**: a warm go commit costs ~110 cpu-s against ~240 on the mac, the mac takes over when the vm is down ([FRM-551](https://linear.app/x-com/issue/FRM-551), frame#153); the boot starts the vm, the halt stops it
- **commit hooks run only related tests**: a replay projects 118 → 51 min of hook tests a day, the measured day read lands 2026-11-11 ([FRM-557](https://linear.app/x-com/issue/FRM-557), frame#155)
- **crow and helga can live in herdr panes**: `crow:start opus --pane`, a pane crow takes socket wakes and `crow:stop` kills its pane; unit-proven, the live proof is the next boot
- **reuse before summon, sequential by default**: a parked member takes the next chunk in any area, switched in place under ~20–25 % context, second-winded above; a parallel lane names its reason (`crew-lead` models.md § summon or reuse)
- the review tiers and the security-pass record ([FRM-548](https://linear.app/x-com/issue/FRM-548), [FRM-549](https://linear.app/x-com/issue/FRM-549), [FRM-553](https://linear.app/x-com/issue/FRM-553)), `x verify red` closed on its safety win ([FRM-383](https://linear.app/x-com/issue/FRM-383)), its speed moved to [FRM-560](https://linear.app/x-com/issue/FRM-560)
- the weekly retro now scores transcripts (cost to dima first, ≥3 sightings) and proposes ready diffs; dima-stories retired on his word

## tricks gained
- any cli Claude Code session has the same message socket a `--bg` job uses; only a desktop tab needs the relay
- a halt report is not a done wing: the archive waits until no line he typed in its tab is newer
- `x-mod-guard` reads a body write on a ticket as a sign: two body folds tonight were refused, his W-lines wait in their groom file

## state
- wing 1 and wing 2 halted and archived; the vm-lane codie kept alive for dima, its tree decamped
- open: [FRM-544](https://linear.app/x-com/issue/FRM-544) (approve anything by a tick) and [FRM-504](https://linear.app/x-com/issue/FRM-504) (a round limiter that stops a 4th sixth sense round), both his top two pains at the halt
- the inbox keeps 85 unmarked lines for the boot's parse

## trail
- shipped: orbit in herdr, go tests in a vm (~110 vs ~240 cpu-s), related-only commit tests, the reuse-before-summon rule
- open: approve-by-tick (FRM-544), the sixth sense round limiter (FRM-504), the herdr boot's first live pane proof
- state: halted 2026-11-10 02:2x, both wings archived, the vm codie kept for dima
