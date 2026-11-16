---
id: PK-429
title: >-
  herdr chat: a multi-line message with a /skill expands like a typed one (type
  it, never paste)
status: done
assignee: []
created_date: '2026-11-15T14:17:00Z'
updated_date: '2026-11-15T19:37:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 74000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-429:W1 (2026-11-15 15:46, dima): i want skills to expand properly; a skill that doesn't expand when sent from herdr is really not good.

PK-429:W2 (2026-11-15 15:46, dima): the fact that skills don't expand the same way in the plain cc terminal prompt box: how to solve? ❓

found (probe 14:13, transcript 6e98ac29): a one-line /skill sent by hc send expands; a multi-line message arrives as pasted text and never expands. fix to try: the chat types it key by key, shift+enter between lines

ticket: FRM-628
close: 21:37 — PK-429:W1 PK-429:W2 moved to FRM-628's wish block (his o119/o120)
<!-- SECTION:NOTES:END -->
