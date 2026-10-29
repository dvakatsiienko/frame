---
date: 2026-10-22
slug: the-pm-revamp
tickets: [FRM-72, FRM-401, FRM-403, FRM-412, FRM-413, FRM-414]
posted: {health: yes}
---

# 🗞️ cclio's gazette · the pm revamp

## shipped

- 🧭 the pm revamp ([FRM-72](https://linear.app/x-com/issue/FRM-72), PK-103 W1–W147): every first use of a wish copies its W-lines verbatim, and `wish-cover.ts` reads the words on every grill, proposal and spec write; the pocket became today-and-tomorrow work, the rest moves to linear by default
- 🎑 milestones first: one milestone queue in the roadmap initiative's body, project status follows it, the boot prints the roadmap board; 11 milestones renamed to kind emojis, two 🐋 milestones born
- 🛼 three kinds of work (freebie, quick lane, side lane), lane emojis 🌗 ⚡ 🌘, a shift driven by dima's afk switch
- 🔎 the review flow: the ci reviewer caps at one round, a local review per verifier round, a risky-path pr merges on the verifier's clean
- 🐉 cli lane 1, chunks 1–2 merged: `x lane merge-auto` ([FRM-401](https://linear.app/x-com/issue/FRM-401), #95) and `x lane rebase-main` + `x lane verify-tree` ([FRM-403](https://linear.app/x-com/issue/FRM-403), #96); round 2 of #96 caught a path that wiped a hand-resolved conflict, and it was cut
- 🧪 trials by a gate: a member spawn is refused until its brief names every fitting trial; a blind trial (delve) stays unnamed; every retro now carries a trials line
- 📥 `prompt-raw-save` keeps every prompt dima types, raw, outside the public repo
- 🐦‍⬛ ccrow's wake packet no longer replays a compaction's chain (PK-254)
- 🚂 the railway breach closed: the space-explorer key rotated (PK-248)
- 🩺 the pm final review: 103 of 128 W-lines settled, 5 high findings, all opened at their spot; one fixed the same night (the blind-trial gate)

## tricks gained

- a `--bg` sidecar booted before a plugin bump keeps its old skill text: `/reload-plugins`, then load the skill again
- `git status` escapes non-ASCII paths; a path list for a commit goes through `-z`
- the pr watch exits on every event, so a re-arm loop floods the thread (PK-256 parked)
- the halt sweep now trashes in 500-path batches: one argv of 23,834 paths dies with E2BIG

## state

- 10-23 opens with the second pm review: the lane-plan home and [FRM-266](https://linear.app/x-com/issue/FRM-266)'s close (both ticked), high 1 and 5, the mediums
- then the coordinator review from the crew-and-pm board, then the side-lane state and the planning
- cli lane 1 stops at 2 of 4; chunk 3 ([FRM-404](https://linear.app/x-com/issue/FRM-404)) waits for dima's word

## trail

- shipped: pm revamp (wishes copied, pocket today-and-tomorrow, milestones first), cli lane 1 chunks 1–2 merged, trial spawn gate
- open: second pm review on 10-23, then the coordinator review from the blueprint
- state: cli lane 1 at 2/4 and stopped; 5 high review findings, 1 fixed
