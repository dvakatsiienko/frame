---
name: lanes-checkup
description: >-
  load when dima asks where a set of lanes stands — «checkup where we at», «lanes checkup», «what's left
  for cli / mods / herdr», «map the lanes», «inventory», «where are we with <lane>» — main or a wing,
  over the lanes he names or every running one.
---

# /clio:lanes-checkup — where each lane stands, one map

dima, 2026-11-12 17:35 (PK-380:W42): «i often ask stuff like this, e.g. «checkup where we are at», over a selected set of lanes.» the map answers three things: what each lane finished, what is left in its signed chunks, and the order the lanes run next. one short line per chunk (PK-380:W41).

## the scope

- his words name the lanes (`cli`, `mods`, `herdr`, an app); none named → every lane `node ~/frame/_clio/script/clio-lanes-radar.ts` shows running
- a lane's chunks are its area's milestones in linear, in their `blocks` order (`craft-fleet-flow` § lane init); read live, never from memory

## the reads, one pass per lane, in parallel where they don't depend

1. `node ~/frame/_clio/script/clio-lanes-radar.ts` — every clio lane, its coordinator, its members
2. linear: `x linear list --team FRM --label <area>` and the lane's milestones, state per ticket; a ticket named by a member's last `[done]` is checked against its state
3. the lane's plan: `~/.local/state/x/lanes/<lane>/lane-plan.md` and its spec under `.scratch/`, the step it is on
4. prs: `gh pr list --repo dvakatsiienko/frame --state open --json number,title,headRefName,mergeStateStatus`
5. members: `ListAgents` for who is busy, idle or gone; a codie's context share from the deck
6. the clio flyways: lines that name this lane

a read that cannot run prints `not read: <why>` on its line; a state with no command behind it is labelled `not checked`.

## the map

written to `~/frame/_clio/.scratch/lanes-checkup/<YYYY-MM-DD>-<HHMM>.md`, printed in the reply when it fits the reply budget, else linked with its top lines printed:

- per lane, a bold header with its coordinator and members (`🌗 🔧 cli | FRM-N`), then one line per chunk, newest state first:
  - `✅ [FRM-N](link): <what it gave him> — landed <date>`
  - `🟡 [FRM-N](link): <what> — <the step it is on>`
  - `⬜ [FRM-N](link): <what> — signed, next` or `unsigned: needs a grill`
  - `💤 [FRM-N](link): <what> — <what it waits on>`
- a chunk's line is one short sentence in his words, never the ticket title pasted
- per lane, a `left:` line: the count of open chunks and the one that unblocks the most

## the plan

- one execution order across the named lanes: which chunk runs next per lane, which run in parallel, which wait on another lane (a shared file, a merge, his hand)
- the shared-tree check: two lanes that edit the same files never run in the same checkout at once; one moves to a worktree
- what needs dima, each as one orbit ask with its pick; the order itself is one ask he ticks
- a lane with nothing signed left gets one line: close its glide card, or shape its next chunk

## completion criterion

the map file exists with a line per chunk of every named lane, every state line carries its source (a command run or `not checked`), the plan's order is an orbit ask, and the reply names the file.
