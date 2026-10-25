---
id: PK-256
title: pr-watch stays armed and wakes cclio only on a state change
status: done
assignee: []
created_date: '2026-10-22T18:31:00Z'
updated_date: '2026-10-25T11:47:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 99999
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
parked: a script change to pr-watch.sh + watch-once.sh, more than 5 tool calls. ccrow's catch 21:31: the watch exits on every event and the re-arm loop woke cclio ~14 times since 20:07, half the replies were «no change» on a night dima said he's tired; a missed re-arm drops an event silently. want: the re-arm inside the script, a notice only on a new head, checks done or a verdict. an automation candidate (invariant 5).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-445
close: moved to FRM-445, its wish block carries them (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
