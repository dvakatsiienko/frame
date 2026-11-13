---
name: lowtide-peek-lanes
description: >-
  lowtide: load when dima asks where lanes stand or how their chunk plan reads — «peek lanes», «checkup where we at»,
  «lanes checkup», «what's left
  for cli / mods / herdr», «map the lanes», «inventory», «where are we with <lane>», «the lanes roadmap»,
  «reorder the chunks», «optimize the order» — main or a wing, over the lanes he names or every running one.
---

# /clio:lowtide-peek-lanes — the lanes' chunk plan, clean, reorderable

dima, 2026-11-12 17:35 (PK-380:W42): «i often ask stuff like this, e.g. «checkup where we are at», over a selected set of lanes.» dima, PK-387 (2026-11-12): «when i ask for a checkup i want an easy-to-read, clean report on a set of lanes i pick»; «to see the plan and potentially reorder it». the shapes live in [shapes.md](../lowtide/references/shapes.md), the reorder in [chunk-order.md](../lowtide/references/chunk-order.md).

## the reads, live, in parallel

1. the lanes: his words name them (`cli`, `mods`, `herdr`, an app); none named → every lane `node ~/frame/_clio/script/clio-lanes-radar.ts` shows
2. each lane's chunks: its area's milestones in linear, in their `blocks` order, through the filter of `shapes.md`
3. per chunk: state, size, the `## signed` lines (`x linear read <ids…>`); the running one's lane plan, `~/.local/state/x/lanes/<lane>/lane-plan.md`, for its ticks
4. a read that cannot run prints `not read: <why>` on its line

## the print — the reply is the report

- per lane: the lane header, then every pending chunk as a chunk line, in the order it stands
- done chunks only when he asks for them, as done lines; a number he names («next 3») prints just those
- the running chunk carries 🛼 and its time left
- the reply ends with the order as one orbit ask he ticks; «reorder», «prio X» or «optimize» runs `chunk-order.md`

## completion criterion

every pending chunk of every named lane has its chunk line with its size, the running one its 🛼 and estimate, nothing `someday` printed, and the order is an orbit ask.
