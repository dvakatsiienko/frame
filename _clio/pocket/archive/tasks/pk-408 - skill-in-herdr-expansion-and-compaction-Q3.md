---
id: PK-408
title: '/skill in herdr: expansion and compaction (Q3)'
status: done
assignee: []
created_date: '2026-11-15T12:26:00Z'
updated_date: '2026-11-15T12:59:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 53000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-408:W1 (2026-11-15 inbox, dima): in the c desktop app, a sent skill (highlighted in blue) reaches the agent in a special way: autoloaded into the message, so the agent does not need to read it.

PK-408:W2 (2026-11-15 inbox, dima): it also survives compaction: it re-attaches after compact.

PK-408:W3 (2026-11-15 inbox, dima): does a /skill written in herdr expand and load properly, and re-attach after compaction, the same way? ❓

raw drop (2026-11-15 inbox, dima): 3. ✅ herder/quill: when i write a `/skill` there - it expands and loads properly? for example in c desktop app a properly sent skill (that is highlighten in blue), it reaches you in a special way, like autoloaded into the message so you do not need to read yourself. plus it survives compact - re-attaches after compaction. are skills written in herdr works same way?

close: 14:55 answered in thread

close: 14:59 PK-408:W1–W3 done: answered in thread 13:4x–14:52
<!-- SECTION:NOTES:END -->
