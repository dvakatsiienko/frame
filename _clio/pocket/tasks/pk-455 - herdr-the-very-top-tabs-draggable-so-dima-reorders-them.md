---
id: PK-455
title: 'herdr: the very top tabs draggable, so dima reorders them'
status: open
assignee: []
created_date: '2026-11-19T12:13:00Z'
updated_date: '2026-11-19T12:19:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 73000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
14:13 PK-455:W1 (2026-11-19 14:12, dima): ask herdr codie: make very top tabs draggable so i can reorder them. — kept here, not FRM-591 (a design ticket): a small behaviour ask, today's herdr lane; feasibility asked of the herdr codie

14:19 herdr codie: possible, not upstream-blocked — tab.move {id?, index | by} exists (herdr.d.ts:59); no on_drag event, so a hand-rolled drag on mouse down/move/up in x-herdr-tabs, then tab.move by index. size: S with no drag ghost (~80 lines), M with a ghost and a drop marker
<!-- SECTION:NOTES:END -->
