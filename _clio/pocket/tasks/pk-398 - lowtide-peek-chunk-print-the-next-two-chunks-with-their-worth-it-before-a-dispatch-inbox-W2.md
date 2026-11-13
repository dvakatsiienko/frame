---
id: PK-398
title: >-
  lowtide-peek-chunk: print the next two chunks with their worth-it before a
  dispatch (inbox W2)
status: open
assignee: []
created_date: '2026-11-13T11:38:00Z'
updated_date: '2026-11-13T11:41:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 70000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-398:W1 (2026-11-13 inbox, dima): because of yesterday's guard issue/discovery, i now think planning out the scope of work weighs more than implementation. i will now verify the build plans in linear more thoroughly. let's shape a new habit and maybe a new small lowtide skill.
PK-398:W2 (2026-11-13 inbox, dima): it should run when we are about to dispatch the next chunk.
PK-398:W3 (2026-11-13 inbox, dima): it prints info about one or two upcoming chunks, similar to lowtide:lane-checkup, but slightly more detailed and focused specifically on this chunk.
PK-398:W4 (2026-11-13 inbox, dima): if a chunk consists of multiple tickets, print them all: the root chunk ticket and all the slice tickets.
PK-398:W5 (2026-11-13 inbox, dima): say what the chunk is about, why we have it, what we want out of it, and what it buys; recheck worth-it each time.
PK-398:W6 (2026-11-13 inbox, dima): idea: print two chunks each time, the current and the next one in the queue (or any other on my ask), so if we discard or postpone a chunk, we see other candidates right away.
PK-398:W7 (2026-11-13 inbox, dima): ❓ name: lowtide-peek-chunk? ❓ rename lowtide-lanes-checkup → lowtide-peek-lanes? top7 names to have everything consistent (other skills are allowed to be renamed). #wing-1 #grill
PK-398:W8 (2026-11-13 inbox, dima): wing 1: lowtide-peek-chunk idea, shape-idea with me.
<!-- SECTION:NOTES:END -->
