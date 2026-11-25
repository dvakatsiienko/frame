---
id: PK-471
title: 'probe: does /clear bust a thread''s cache'
status: done
assignee: []
created_date: '2026-11-25T10:37:16Z'
updated_date: '2026-11-25T11:08:47Z'
labels:
  - xs
dependencies: []
priority: now
type: task
ordinal: 4100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
PK-471:W1 (2026-11-25 inbox, dima) probe if /clear busts thread's cache.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
raw drop (2026-11-25 inbox, dima): probe if /clear busts thread's cache.

12:59 probe done (haiku, one thread, cwd ~/.local/state/helga): turn 1 read 41,526 / wrote 41,248; turn 2 read 67,915 / wrote 14,979; after /clear (a new session id) read 41,526 / wrote 41,372. so /clear drops the conversation's cache and the memory part is written again, the tools and system prompt part is read from cache, exactly like a fresh thread's first request. transcripts 99a4d1c7, 2c727fc0

close: PK-471:W1 done (the probe ran, numbers in the note above)

13:08 correction: the probe ran in helga's folder; which part of the 41.4k was written after /clear is an inference (the totals are read, the layers are not)
<!-- SECTION:NOTES:END -->
