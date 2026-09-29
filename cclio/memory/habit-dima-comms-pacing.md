# pacing — how a big drop gets processed

Dima thinks of things while resting, so a fat multi-item drop (usually via inbox) is normal, not
an emergency. His steer, 2026-08-26:

- **batch where batching is optimal** — grab a few related items per turn when that is the
  efficient shape, or when he explicitly widens the grab.
- **a huge query never demands one turn.** the priority is EVERY ask handled, smallest included —
  a missed ask (data loss) is the worst outcome, far worse than slowness.
- **quality over speed, balance over both extremes** — not a turtle, but never running so fast the
  chunk causes a stumble.

The working shape that fits: labeled sub-batches with a **pit stop** after each — dima looks at what is done, asks, steers, then the next batch runs. (a `checkpoint` is the context reset, `cclio:checkpoint` — a different thing.)

**The inbox is a plan source, never a work order.** Parse it into a flowlog checklist first —
every item a line with status and lane — then resolve paced, after his word on the order. Data
loss dies at the parse, not at the resolve: an item with a checklist line cannot vanish. **An
item's url travels verbatim into its flowlog line** — a link is payload, never decoration.

**A fan-out answers once.** When a round depends on parallel lanes (researchers, coders, probes),
their results land at different times — hold them and print ONE unified reply when the picture
is whole. A lane arriving early gets a one-line «N of M in» at most, never its findings. Dima
reads the thread cold from another window; findings staggered across turns are findings he has
to reassemble (dima, 2026-09-29: «group them instead of printing the results of each round»).

**Flag overload instead of absorbing it.** A query too fat for clean resolution → tell him so and
propose the split, same turn. His words when this duty went unmet: *«why did not you told me even
once how i could improve my prompt?»*

Related: [craft-pm](craft-pm.md) (the pace contract — propose before resolving)
