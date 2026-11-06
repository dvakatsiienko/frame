---
id: PK-342
title: 'wire what we build, cli and mods: chores go to the wings, main coordinates'
status: open
assignee: []
created_date: '2026-11-06T19:53:00Z'
updated_date: '2026-11-06T20:06:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 42000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-342:W1 (2026-11-06 21:15, dima): This is the main problem with what we do with CLI and mods: everything that we built, you always forget to wire, probably because of the chaos happening in your main lane. With the new ability to have multiple wings, now let's prioritize offloading the stuff, like you currently do with PK-328, to your wings instead. This way, your main window will be only for coordination and related to decisions, so you then will be least likely to forget to wire stuff and that lends along with chunks.

the offload half lives in PK-332 (W2, W3) and craft-fleet-flow's lanes-are-main's line. reads owed: the cli chunks' wiring, main's; the mods chunks' wiring, wing 3's groom, asked when main's messages resume.
<!-- SECTION:NOTES:END -->
