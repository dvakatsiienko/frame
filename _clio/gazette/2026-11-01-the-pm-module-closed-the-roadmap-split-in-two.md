---
date: 2026-11-01
slug: the-pm-module-closed-the-roadmap-split-in-two
tickets: [FRM-419, FRM-460, FRM-481, FRM-482, FRM-443, FRM-483, FRM-484, FRM-480, BYT-94, BYT-106, BYT-129, BYT-128, FRM-360, FRM-387]
posted: {health: no}
---

# 🗞️ clio's gazette · the pm module closed, the roadmap split in two

## shipped
- the pm module closed after 8 review rounds, majors 14 → 0 ([FRM-419](https://linear.app/x-com/issue/FRM-419)); roadmap step 3 is done and step 4, speak v2, opened
- planning ([FRM-460](https://linear.app/x-com/issue/FRM-460)) split the roadmap into a main road (speak v2 → chords v2 → trophy-sys v2 → the cv) and a side-tracks queue (ci → cli, mods, toolchain); two new milestones, 🌞 chords v2 shipped and 🌞 trophy-sys v2 shipped; the boot prints both queues
- the side lanes are ready: ci's 4 chunks ([BYT-94](https://linear.app/x-com/issue/BYT-94) first, merge pre-approved), the cli's 13 from [FRM-480](https://linear.app/x-com/issue/FRM-480), x screens framed ([FRM-360](https://linear.app/x-com/issue/FRM-360)), and mods' 9 — all signed and passing a dry `x lane dispatch`
- shaped: the re-ask catcher ([FRM-443](https://linear.app/x-com/issue/FRM-443)) and its sibling, standing instructions ([FRM-482](https://linear.app/x-com/issue/FRM-482)); born: fleet privacy ([FRM-481](https://linear.app/x-com/issue/FRM-481)), hook speed ([FRM-483](https://linear.app/x-com/issue/FRM-483)), sixth sense on its own github app ([FRM-484](https://linear.app/x-com/issue/FRM-484))
- `evergreen-renovate.ts` prints one row per renovate pr; the renovate round merged frame#118 and bytes#136, all 6 bytes apps Ready
- the boot now flags a side track with unsigned next chunks and any sign dispatch would refuse; the n8n gh sweep moved to 23:00 Kyiv; a whole system checkup ran (hook speed red, 3 stray plugin caches trashed)
- the side channel set up the verifier's github app `x-sixth-sense-cc` with dima, and steamac (Windows games in a SteamOS vm)

## tricks gained
- a sign's body hash covers the blank line before `## signed`; a dry `x lane dispatch` is its proof (14 signs had drifted)
- a state move resets a ticket's `sortOrder`, so a sign rewrites the milestone order after
- linear stores `~` as `\~`; every homing compare reads through `normalize`
- the side channel's worktree guard checks the shell's cwd, not the target path

## state
- tomorrow: the shop-trip shift (PK-292) on a side lane dima picks; bytes#137 waits for renovate's rebase
- the cli review and the `x pocket` proposal wait for the next session

## trail
- shipped: the pm module closed; the roadmap split into a main road and side tracks; ci, cli and mods chunks signed and dispatch-ready
- open: the shop-trip shift, bytes#137, FRM-484's wiring and its identity watch, the cli review with x pocket
- state: step 4 speak v2 open; side lanes ci → cli and mods ready to dispatch after the 11-02 reset
