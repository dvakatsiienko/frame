---
id: PK-73
title: "ccrow's \U0001F440 line shows in her row of the sessions card"
status: done
assignee: []
created_date: '2026-10-11 22:45'
updated_date: '2026-10-12 12:50'
due_date: '2026-10-14'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima 2026-10-12 01:42, relayed by ccrow on his word (01:45): «the mods view is already cramped, no space … your strip mvp printed numbers i was not interested in. but something from 👀 for you would be nice i think. a one-line (2 max) tip to help me improve my prompting, help me fix my own errors, or other suggestions, interesting findings, or proposals to consider an approach from another angle».
- want: no new strip; ccrow's row in the sessions card carries her latest 👀 line, 1–2 lines
- seen in code (read, not built): the row's status text is parsed from the 🔭 lines that end a session's last reply (`x-mod-stash/hooks/parse.ts:113`), so a parsed 👀 line on ccrow's row is a small parser addition, not a new card
- route: a rider on FRM-386 🐠 catch, the next mods coder, on dima's tick
parked: the mods queue, after FRM-386, on dima's word
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
dima's yes, o314 (01:49): rides FRM-386 🐠 catch with the next mods coder

parked: behind the 2026-10-12 drops — dima: «don't rush the memory sweep — solve everything new turn by turn, quality first, then plan the next moves from the new drops»

dima, 2026-10-12 14:16, relayed by ccrow from her window: «i'd like to see this note somewhere in a mod» — about her 👀 for-you line (1–2 tips for him); narrows his 01:42 «the mods view is already cramped»: the 👀 line only, no numbers

done: shipped by the mods coder, lane l8 (PK-73 a7844123, PK-77 bb26ee18); mods:test exit 0 on cclio's run 15:45
<!-- SECTION:NOTES:END -->
