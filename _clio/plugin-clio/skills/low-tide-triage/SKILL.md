---
name: low-tide-triage
description: load when dima says «low tide triage», «triage», «re-triage», «hoist», «seed the plans», or `clio:low-tide` finds no seeded plan — split the piled-up chores across the open clio lanes, one scope per lane. main or any wing runs it.
---

# 🌘 low tide triage — one scope per clio lane

dima, 2026-11-07, folded: «hoisting selects the scope each clio lane will execute: the main lane has one set of stuff to do, and the same for wing 1 and wing 2.» one clio runs it, any clio can. the solving after it is `clio:low-tide`.

## the steps, in order

1. **the marker**: read every open day plan (`backlog task list --plain --search "day plan"`, then each one's notes). another clio's `hoist MM-DD: proposing` → one line to dima, stop, unless he asked for this re-triage. else append `hoist MM-DD: proposing, <your lane>` to your own day plan.
2. **the pile**: the inbox's leftovers land in the pocket first (`clio:boot`'s parse). then the open pocket items, and linear `--team FRM` and `--team BYT` in Triage, Todo and Backlog (`clio:pm`), through a `helper-lite` card when the list is long. an area word in his ask narrows it. off the pile: a running lane's chunk, and anything blocked, which gets its `**waiting for:**` line or lane note and leaves the hunt.
3. **ask**: `ListAgents` names the active clios, `🦉 clio` and each `🦉🪽 clio: wing <N>`. one `SendMessage` each, led by `[ask]`: what fits you in this pile, what do you hold in hand? what a clio holds in hand leaves the pile. a reply wakes you; after 10 min a silent clio keeps your proposed share, marked unconfirmed.
4. **think**: run the freebie test (`craft-pm`) on each item, then split:
   - group by area and similarity; a parent and its child, and items on the same files, stay in one lane
   - an item sits in one plan only
   - chores prefer wings; main can take them too, its lanes come first
   - a wing that owns an area keeps it
5. **order each lane's list**: freebies and almost-freebies on top even when less wanted, then by how much he wants it, big stuff last unless he asks to prioritize it.
6. **confirm**: send each clio the groomed split, one `SendMessage`. a disagreement gets one more round, then goes to dima as it stands.
7. **propose to dima**: print the split per lane, with each line's verdict, any disagreement and any unconfirmed share, and put his accept in orbit. settling is his: nothing is written before his yes. it settles without him only when he asked for that in words, this run.
8. **seed, on his yes**: per lane, its day plan gets one `--ac` per line (none yet: `node script/pocket-add.ts "day plan MM-DD: <lane>" --priority next --top`, with `--wing <N>` or the label `main-lane`). each pocket item takes that lane's label, each ticket `wing-<N>` when a wing holds it. append `hoist MM-DD: done` to your day plan, and send each clio one line: your plan is seeded.

## a re-triage

his ask reruns it from step 1: unticked lines rejoin the pile, ticked ones stay.

**done**: `hoist MM-DD: done` is written, and every open clio's day plan holds its lines, with no id in two plans.
