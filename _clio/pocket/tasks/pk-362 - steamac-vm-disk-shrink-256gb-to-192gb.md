---
id: PK-362
title: 'steamac vm disk: shrink 256gb to 192gb'
status: open
assignee: []
created_date: '2026-11-09T12:38:00Z'
updated_date: '2026-11-09T12:38:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 50000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-362:W1 (2026-11-09 inbox, dima): i grew the vm's allocated space to 256gb with «grow disk», but i want 192gb

PK-362:W2 (2026-11-09 inbox, dima): «grow disk» only increases the allocated space; it cannot decrease it

raw drop (2026-11-09 inbox, dima): **clio main (when have a free spot)**: my steam fx launcher — i extended vm allocated space to 256gb via «grow disk» feature but no want set it to 192gb. although «grow disk» only allows to increase allocated space not decrease. how to decrease it?
<!-- SECTION:NOTES:END -->
