---
id: PK-451
title: >-
  herdr state machines: one standard pattern across herdr, cc mods after a mess
  hunt
status: open
assignee: []
created_date: '2026-11-18T11:17:00Z'
updated_date: '2026-11-18T11:18:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 73000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-451:W1 (2026-11-18 12:44, dima): recall the state-machine fix proposed in the last messhunt round for herdr scope (done days ago, zoo era)

PK-451:W2 (2026-11-18 12:56, dima): herdr state library: a vendored file is not a clear official install; with no update channel the lib rots, unlike a pnpm upgrade; want a clear, official install

PK-451:W3 (2026-11-18 12:56, dima): standardize the state-machine approach (lib or hand-written), apply best practices as one pattern across the whole herdr system at scale, not one-off stray fixes while the rest rots; codie's pick was to keep the hand-written machines for now, dima leans to a standard approach either way

13:17 input to a shape-idea round after FRM-582's emoji grill (his o22 tick); the cc mods join after a mods mess hunt (o22 follow, ticked); FRM-647 waits on it
<!-- SECTION:NOTES:END -->
