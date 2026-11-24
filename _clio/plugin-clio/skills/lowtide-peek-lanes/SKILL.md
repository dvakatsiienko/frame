---
name: lowtide-peek-lanes
description: >-
  lowtide: load when dima asks where lanes stand or how their chunk plan reads — «peek lanes», «checkup where we at»,
  «lanes checkup», «what's left
  for cli / mods / herdr», «map the lanes», «inventory», «where are we with <lane>», «the lanes roadmap»,
  «reorder the chunks», «optimize the order» — main or a wing, over the lanes he names or every running one. «ready», «healthcheck», «are the lanes ready for tomorrow».
---

# /clio:lowtide-peek-lanes — the lanes' chunk plan, clean, reorderable

dima, PK-387 (2026-11-12): «when i ask for a checkup i want an easy-to-read, clean report on a set of lanes i pick»; «to see the plan and potentially reorder it». the shapes live in [shapes.md](../lowtide/references/shapes.md), the reorder in [chunk-order.md](../lowtide/references/chunk-order.md).

## the reads, live, in parallel

1. the lanes: his words name them (`cli`, `mods`, `herdr`, an app); none named → every lane `node ~/frame/_clio/script/clio-lanes-radar.ts` shows
2. each lane's chunks: its area's milestones in linear, in their `blocks` order, through the filter of `shapes.md`
3. per chunk: state, size, the `## signed` lines (`x linear read <ids…>`); the running one's lane plan, `~/.local/state/x/lanes/<lane>/lane-plan.md`, for its ticks
4. a read that cannot run prints `not read: <why>` on its line
5. a parked lane's tail is its lane plan's unticked lines, never its handoff: a handoff is as old as its park

## solve, then print — every peek

the reply goes out with my moves already done (dima, 2026-11-24 19:33: «whenever you're printing me the peak lanes, you should automatically solve this before listing me an answer»): every chunk listed, not only the first two slots. «ready» is the same run. `node ~/frame/_clio/script/sealed-ahead.ts --lanes <names> --json` gives each lane one verdict and its owed moves.

1. hold the reply until this list is empty; a draft or a critic still running is waited for, up to ~15 min, then printed as such
2. a chunk whose scope only his grill can settle joins an open or parked wing's flyway that turn, at its place in the order
3. walk the 🔴 moves in slot order, mine without asking: `seal (clio)` → `clio:shape-lane-dispatch` § 2–4 on that chunk (the draft to an Opus card, the critic, the preflight); `unblock (clio)` → read the blocker: done → the relation goes; real → the queue is reordered by `chunk-order.md` so the blocker runs first; `queue one (clio)` → the area's next signed chunk joins the chain
4. a sign or re-sign is mine, done silently (PK-468); a chunk he postpones leaves the lane's first two slots
5. re-run the script: every named lane 🟢, or its red is his

## the print — the reply is the report

- per lane: the lane header carrying its ready verdict (🟢 or 🔴), then every pending chunk as a chunk line, in the order it stands, with no red detail on it
- **the reds print apart, after all lanes** (dima, 2026-11-23: «for all red items you should propose me them into separate easy to read list that goes after all healthy chunks; its hard to find unhealthy ones in a big list»): one `🔴 what needs a move` list, one line a chunk: the chunk, what is missing in plain words, what it waits on: his grill, his hand, or another lane's chunk, never a move of mine; no reds → «🟢 nothing red»
- every chunk of the lane's project is listed, read per project from linear (`x linear list --team FRM --project <name> --state Todo`, then `In Progress`), never from the script's two slots alone
- done chunks only when he asks for them, as done lines; a number he names («next 3») prints just those
- the running chunk carries 🛼 and its time left
- the reply ends with the order as one orbit ask he ticks; «reorder», «prio X» or «optimize» runs `chunk-order.md`

## completion criterion

every pending chunk of every named lane has its chunk line with its size, the running one its 🛼 and estimate, nothing `someday` or `snoozed` printed, no move of mine left in the reds, and the order is an orbit ask.
