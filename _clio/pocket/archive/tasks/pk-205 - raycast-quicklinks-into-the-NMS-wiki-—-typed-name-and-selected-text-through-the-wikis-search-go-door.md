---
id: PK-205
title: >-
  raycast quicklinks into the NMS wiki — typed name and selected text, through
  the wiki's search-go door
status: done
assignee: []
created_date: '2026-10-19 15:57'
updated_date: '2026-10-19 16:46'
due_date: '2026-10-21'
labels:
  - xs
dependencies: []
priority: next
type: wish
ordinal: 10960
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** dima sets the nms wiki hotkey in Raycast and tries typed + selected (o81).
dima, 2026-10-19 18:53 (folded): side wish — a Raycast quicklink that opens things right in the NMS wiki: select it in the Raycast menu, Tab, type «ion battery» → it opens https://nomanssky.miraheze.org/wiki/Ion_Battery; and a hotkey: select the text «ion battery», press the quicklink hotkey → it opens. or is it tricky because wiki pages can't always map to words?

answered 18:58: the wiki's search-go door maps it (probed: «ion battery» → 302 to Ion_Battery, a partial word → the results page): https://nomanssky.miraheze.org/w/index.php?title=Special:Search&go=Go&search={argument}, and a {selection} twin with a hotkey. not built — his hands in Raycast's Create Quicklink, or a script command if quicklinks refuse {selection} (unchecked).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
19:03 built as one script command on dima's steer («a single command that works in all modes»): import/raycast/script-commands/nms-wiki.sh — typed name, or the selection when empty (cmd+c, clipboard restored), through the search-go door; url probed: «ion battery» → 302 Ion_Battery. left: dima assigns its hotkey in Raycast and tries both modes; unchecked: whether a hotkey on a command with an optional argument opens the prompt first (then Enter on empty takes the selection).

19:40 dima's test (19:32): the script command's hotkey over a selection opened the raycast form, never the page — a script command with an argument always prompts. rebuilt as an x-ray extension command, nms-wiki (src/nms-wiki.tsx): on launch it reads getSelectedText, opens the page and closes at once; nothing selected → a search bar. typecheck green; registered through one ray develop. left: dima binds the hotkey to «nms wiki» (x-ray) and tries both; then the old script-commands/nms-wiki.sh goes (trash, on his word).

19:46 done: dima «it worked» (o97) — the x-ray command nms-wiki opens the selection on the hotkey, typed name otherwise; the old script command trashed.
<!-- SECTION:NOTES:END -->
