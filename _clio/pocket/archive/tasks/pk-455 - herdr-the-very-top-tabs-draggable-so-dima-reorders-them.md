---
id: PK-455
title: 'herdr: the very top tabs draggable, so dima reorders them'
status: done
assignee: []
created_date: '2026-11-19T12:13:00Z'
updated_date: '2026-11-19T12:40:00Z'
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
PK-455:W4 (2026-11-19 14:21, dima): I vote for research now. You can ask Trey to go and research Herdr drag-and-drop functionality, how to properly implement it, the limitations about it, and issues on GitHub related to drag and drop. Maybe someone already reported clunky drag-and-drop behavior.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
14:13 PK-455:W1 (2026-11-19 14:12, dima): ask herdr codie: make very top tabs draggable so i can reorder them. — kept here, not FRM-591 (a design ticket): a small behaviour ask, today's herdr lane; feasibility asked of the herdr codie

14:19 herdr codie: possible, not upstream-blocked — tab.move {id?, index | by} exists (herdr.d.ts:59); no on_drag event, so a hand-rolled drag on mouse down/move/up in x-herdr-tabs, then tab.move by index. size: S with no drag ghost (~80 lines), M with a ghost and a drop marker

14:31 stray research a2d0e354 (docs/research/herdr-drag-and-drop.md): the clunk is mostly ours (no lift on press, no ghost, no threshold); herdr's limit is narrow (no drag api for mods, mouse-move only over the element); a 9-step recipe fixes it today; upstream herdr-app#769 adds pointer capture; the top tabs (x-herdr-tab-pills) have no drag at all. FRM-618's «drag is whatever the native list brings» rests on a premise the doc mostly refutes: re-grill

14:40 ticket: FRM-664 — close: folded into FRM-664 (W1–W3 moved, signed on his o4 tick)
<!-- SECTION:NOTES:END -->
