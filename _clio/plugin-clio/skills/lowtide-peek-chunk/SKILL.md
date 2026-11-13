---
name: lowtide-peek-chunk
description: >-
  lowtide: load when dima says «peek», «peek chunk», «peek FRM-N», «what's next for the <lane> lane»,
  «what's the next chunk», and in `clio:shape-lane-dispatch` § 1 before an offer, and at a member's park
  before its next chunk — a lane's current and next chunk, slightly unfolded.
---

# /clio:lowtide-peek-chunk — a lane's current and next chunk, a peek inside

dima, 2026-11-13 (FRM-626:W10–W15): his day is messy, he loses track of what each lane runs next, and the guard day showed a plan read loosely costs more than a slow build. `lowtide-peek-lanes` prints every chunk in one line; this prints two per lane, slightly unfolded, so he sees inside them without tech detail.

## the reads, live

1. the lanes: his words name them, or the ticket he names; none named → every lane `node ~/frame/_clio/script/clio-lanes-radar.ts` shows; called by dispatch or a park → that lane
2. per lane, two chunks: the running one (its 🛼 glide step, or the lane plan's open step at `~/.local/state/x/lanes/<lane>/lane-plan.md`) and the next in its `blocks` order (`lowtide-peek-lanes`' order); a chunk he names replaces the next
3. per chunk: `x linear read <ids…> --relations` for the wish, why, done test, worth-it and `## signed` block; its slice tickets from the lane plan's steps when `to-tickets` ran, else the spec's section headings
4. a read that cannot run prints `not read: <why>` on its line

## the print — per lane, per chunk

the lane as a bold header, then each chunk:

- **<ticket link>: <title in plain words>** — 🛼 running (step N of M) or ⏭️ next, its size
- the four opener lines, each on its own line: what it is, why we have it, what we want out of it, what it buys
- what lies inside: 2–4 lines naming its parts in his words, never a file, a function or a flag unless he asks
- its tickets: the root and each slice, one line each, ✅ done or ⬜ open
- 🎯 its done test, one line, in his words
- ⚖️ worth it re-read now: «holds» or one 🧐 line naming the doubt
- ✍️ signed <age>; a ✏️ when the body moved after the last sign line

## the gate — a dispatch caller only

- a chunk sized M or bigger, or with a 🧐 doubt, waits: one orbit ask per chunk, «go, postpone or drop», pick named
- an S chunk with no doubt goes on; a shift never waits on it (FRM-626 decided, o120)
- called on his «peek», it is a read: no ask unless the worth-it re-read finds a doubt

## completion criterion

every named lane prints its current and next chunk, each with the four lines, what lies inside, every ticket, the done test, a worth-it verdict and its sign age; a gated chunk has its orbit ask.
