---
name: low-tide-triage
description: load when dima says «low tide triage», «triage», «re-triage», «hoist», «seed the flyways», or `clio:low-tide` finds no seeded plan — split the piled-up chores across the open clio lanes, one scope per lane. main or any wing runs it.
---

# 🌘 low tide triage — one scope per clio lane

dima, 2026-11-07, folded: «hoisting selects the scope each clio lane will execute: the main lane has one set of stuff to do, and the same for wing 1 and wing 2.» one clio runs it, any clio can; it finds the work for every clio, main included. the solving after it is `clio:low-tide`.

## the steps, in order

1. **the marker**: read every flyway (`backlog task list --plain --search "flyway:"`, then each one's notes). another clio's `hoist MM-DD: proposing` → one line to dima, stop, unless he asked for this re-triage. else append `hoist MM-DD: proposing, <your lane>` to your own flyway.
2. **the pile**: the inbox's leftovers land in the pocket first (`clio:boot`'s parse). then the open pocket items, and linear `--team FRM` and `--team BYT` in Triage, Todo and Backlog (`clio:pm`), through a `helper-lite` card when the list is long. an area word in his ask narrows it. off the pile: a running lane's chunk, and anything blocked, which gets its `**waiting for:**` line or lane note and leaves the hunt.
3. **draft the split**: `ListAgents` names the active clios, `🦉 clio` and each `🦉🪽 clio: wing <N>`. run the freebie test (`craft-pm`) on each item, then:
   - group by area and similarity; a parent and its child, and items on the same files, stay in one lane
   - an item sits in one flyway only
   - chores prefer wings; main can take them too, its lanes come first
   - a wing that owns an area keeps it
   - each lane's list: freebies and almost-freebies on top even when less wanted, then by how much he wants it, big stuff last unless he asks to prioritize it
4. **consult**: send the draft to each clio, one `SendMessage` led by `[ask]`: steer it, what do you want to solve, what do you hold in hand? a reply wakes you; after 10 min a silent clio's share stands, marked unconfirmed.
5. **settle the proposal**: their reports come back to you, and yours is the final word. what a clio holds in hand leaves the pile.
6. **propose to dima**: print the split per lane, with each line's verdict, each clio's steer you turned down, and any unconfirmed share; his accept goes in orbit. nothing is written before his yes, unless he asked for auto-settle in words, this run.
7. **seed, on his yes**: per lane, its flyway gets one `node script/flyway-done.ts <PK> --add '<line>'` per line, each landing in its kind's place (none yet: `habit-shared-files` § the flyway). each pocket item takes that lane's label, each ticket `clio-wing-<N>` when a wing holds it. append `hoist MM-DD: done` to your flyway, and send each clio one line: your flyway is seeded.

## a re-triage

his ask reruns it from step 1: unticked lines rejoin the pile, ticked ones stay.

**done**: `hoist MM-DD: done` is written, and every open clio's flyway holds its lines, with no id in two flyways.
