---
name: lowtide-peek-lanes
description: >-
  lowtide: load when dima asks where lanes stand or how their chunk plan reads — «peek lanes», «checkup where we at»,
  «lanes checkup», «what's left
  for cli / mods / herdr», «map the lanes», «inventory», «where are we with <lane>», «the lanes roadmap»,
  «reorder the chunks», «optimize the order» — main or a wing, over the lanes he names or every running one. «ready», «healthcheck», «are the lanes ready for tomorrow» make them dispatchable, not only shown.
---

# /clio:lowtide-peek-lanes — the lanes' chunk plan, clean, reorderable

dima, 2026-11-12 17:35 (PK-380:W42): «i often ask stuff like this, e.g. «checkup where we are at», over a selected set of lanes.» dima, PK-387 (2026-11-12): «when i ask for a checkup i want an easy-to-read, clean report on a set of lanes i pick»; «to see the plan and potentially reorder it». the shapes live in [shapes.md](../lowtide/references/shapes.md), the reorder in [chunk-order.md](../lowtide/references/chunk-order.md).

## the reads, live, in parallel

1. the lanes: his words name them (`cli`, `mods`, `herdr`, an app); none named → every lane `node ~/frame/_clio/script/clio-lanes-radar.ts` shows
2. each lane's chunks: its area's milestones in linear, in their `blocks` order, through the filter of `shapes.md`
3. per chunk: state, size, the `## signed` lines (`x linear read <ids…>`); the running one's lane plan, `~/.local/state/x/lanes/<lane>/lane-plan.md`, for its ticks
4. a read that cannot run prints `not read: <why>` on its line

## «ready» — the health check, the lanes made dispatchable (dima, 2026-11-23)

his word «ready» or «healthcheck» after the lanes: peek shows, ready ensures. `node ~/frame/_clio/script/sealed-ahead.ts --lanes <names> --json` gives each lane one verdict and its owed moves; a 🟢 lane can be dispatched in one word any time after.

1. print each lane's verdict line as the script gives it
2. walk the 🔴 moves in slot order, mine without asking: `seal (clio)` → `clio:shape-lane-dispatch` § 2–4 on that chunk (the draft to an Opus card, the critic, the preflight); `unblock (clio)` → read the blocker: done → the relation goes; real → the queue is reordered by `chunk-order.md` so the blocker runs first; `queue one (clio)` → the area's next signed chunk joins the chain
3. his moves go to orbit, one ask each: `sign (dima)`, `re-sign (dima)`; a chunk he postpones leaves the lane's first two slots
4. re-run the script; done when every named lane is 🟢, or each red left names his open ask
- the halt runs the same script as its gate (`halt/main.md`), the boot reads its line per lane before the first dispatch

## the print — the reply is the report

- per lane: the lane header carrying its ready verdict (🟢 or 🔴 with the owed move), then every pending chunk as a chunk line, in the order it stands
- done chunks only when he asks for them, as done lines; a number he names («next 3») prints just those
- the running chunk carries 🛼 and its time left
- the reply ends with the order as one orbit ask he ticks; «reorder», «prio X» or «optimize» runs `chunk-order.md`

## completion criterion

every pending chunk of every named lane has its chunk line with its size, the running one its 🛼 and estimate, nothing `someday` or `snoozed` printed, and the order is an orbit ask.
