---
id: PK-455
title: 'herdr: the very top tabs draggable, so dima reorders them'
status: open
assignee: []
created_date: '2026-11-19T12:13:00Z'
updated_date: '2026-11-19T12:22:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PK-455:W1 (2026-11-19 14:12, dima): ask herdr codie: make very top tabs draggable so i can reorder them.
PK-455:W2 (2026-11-19 14:21, dima, o7 steer): We actually planned the drag-and-drop support somewhere, maybe in part of the antenna. For example drag-and-drop currently works in my agents list but it's clunky and doesn't work very well. The visual feedback of the dragging process is very basic and for example when I start drag-and-drop, there is no visual indication that an item is being dragged. I've already described this clunky behavior somewhere.
PK-455:W3 (2026-11-19 14:21, dima): Dragging is possible in Herdr. It is verified because I already had this feature at some other parts that we deleted, but it currently works not in the greatest way. At some point it is needed to be researched to verify if Herdr has drag-and-drop limitations and whether the clunky drag and drop is Herdr's fault or codie does something wrong with the implementation.
PK-455:W4 (2026-11-19 14:21, dima): I vote for research now: ask the stray to research Herdr drag-and-drop functionality, how to properly implement it, its limitations, and issues on GitHub related to drag and drop. Maybe someone already reported clunky drag-and-drop behavior.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
14:13 PK-455:W1 (2026-11-19 14:12, dima): ask herdr codie: make very top tabs draggable so i can reorder them. — kept here, not FRM-591 (a design ticket): a small behaviour ask, today's herdr lane; feasibility asked of the herdr codie

14:19 herdr codie: possible, not upstream-blocked — tab.move {id?, index | by} exists (herdr.d.ts:59); no on_drag event, so a hand-rolled drag on mouse down/move/up in x-herdr-tabs, then tab.move by index. size: S with no drag ghost (~80 lines), M with a ghost and a drop marker
<!-- SECTION:NOTES:END -->
