---
id: PK-421
title: arch review inside native cc mods + coder skill (W8)
status: done
assignee: []
created_date: '2026-11-15T12:27:00Z'
updated_date: '2026-11-15T19:20:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 66000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-421:W1 (2026-11-15 inbox, dima): do the same arch review as in herdr, but inside the native cc mods. i bet there is a lot to revamp there too.

PK-421:W2 (2026-11-15 inbox, dima): the herdr review uncovered a large amount of really bad antipatterns (you have the retro files and logged verdicts; i won't restate them).

PK-421:W3 (2026-11-15 inbox, dima): one lever to cut antipattern usage is the actual coder skill: either a dedicated skill, or a dedicated cc native mods + herdr native mods skill.

PK-421:W4 (2026-11-15 inbox, dima): for example: the top 7 most severe antipatterns and the overall implementation and architecture mistakes made in herdr mods, shaped into a skill.

PK-421:W5 (2026-11-15 inbox, dima): which most useful memory pieces from the retros should go into the skill? ❓

PK-421:W6 (2026-11-15 inbox, dima): should it extend x-crew-coder, or be a new skill specific to mods? ❓

raw drop (2026-11-15 inbox, dima): 8. ⏳ do the same arch review as we did in herdr but inside native cc mods. curious to know how stuff goes there. i bet there is lot to revamp there too.

raw drop (2026-11-15 inbox, dima): 1. also. what i was thinking about the herdr arch review. it uncovered a large amount of really bad antipatterns used (i wont restate, you have retro files and logged verdicts). i think one of the levers we have to reduce amount of antipattern usage - is actual coder skill. (or create a dedicated cc native mods + herdr native mods skills)

raw drop (2026-11-15 inbox, dima): 2. which most useful memory pieces to save in a skill, based on those retroes? for example: eval top7 most severe antipatterns and overall implementation and architecture mistakes made in herdr mods, based on review and shape them into a skill — x-crew-coder or create new skill, specific to mods?

ticket: FRM-629
close: 21:20 — W-lines copied verbatim into FRM-629's wish block (his 21:19: the inbox should read solved)

close: PK-421:W1 PK-421:W2 PK-421:W3 PK-421:W4 PK-421:W5 PK-421:W6 moved to FRM-629's wish block
<!-- SECTION:NOTES:END -->
