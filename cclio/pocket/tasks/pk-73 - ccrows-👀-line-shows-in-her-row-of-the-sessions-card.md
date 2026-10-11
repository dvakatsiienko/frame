---
id: PK-73
title: "ccrow's \U0001F440 line shows in her row of the sessions card"
status: open
assignee: []
created_date: '2026-10-11 22:45'
updated_date: '2026-10-11 22:50'
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
<!-- SECTION:NOTES:END -->
