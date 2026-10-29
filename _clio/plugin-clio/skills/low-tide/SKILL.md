---
name: low-tide
description: load when dima says «low tide» — clear every unblocked chore in the pocket and linear before the next big step.
---

# 🌘 low tide — the chores cleared before a big step

dima, 2026-10-20, folded: «before we move to something bigger, like the speak v2 revival, close every chore that would otherwise stay parked forever if i didn't ask — small, medium or big. i often find myself explaining this to you: during the memory sweep the pocket grew while we kept folding other useful stuff.»

## the three steps, in order

1. **the pocket and the inbox**: the inbox's leftovers land in the pocket first (`clio:boot`'s parse); then solve every open item you can resolve yourself — not blocked (no `**waiting for:**`) and not tied to a lane (mods, cli, bytes, speak, any app lane). list them first with `backlog task list --plain --sort ordinal`, then work the list in order
2. **linear**: the same kind in linear — tickets with no lane and no blocker that would otherwise sit forever; `x linear list --team FRM` and `--team BYT`, states Triage, Todo and Backlog, read each before acting (`clio:pm`)
3. **the gate**: the next big step starts only when steps 1 and 2 have nothing left

## how it runs

- a close, a cancel or a merge of a ticket still goes through the ask-guard (`craft-pm`): dima's asks on it are printed first
- the work goes in batches with a siesta between them (`clio:siesta`), never one giant turn
- an item that turns out blocked or lane-bound gets its `**waiting for:**` line or lane note the same turn, and leaves the hunt
- done = a «nothing left» line naming every store searched (pocket, linear FRM, linear BYT, inbox), with the counts before and after
