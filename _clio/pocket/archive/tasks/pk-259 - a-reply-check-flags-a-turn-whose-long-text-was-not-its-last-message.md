---
id: PK-259
title: a reply check flags a turn whose long text was not its last message
status: done
assignee: []
created_date: '2026-10-22T18:57:00Z'
updated_date: '2026-10-25T11:44:00Z'
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
parked: a hook change (reply-check), more than 5 tool calls. flush 2026-10-22, a repeat (3rd sighting): the pm review's issue list went out before an orbit call, dima saw only counts and asked «why didn't you print them». habit-dima-comms already holds the rule, so the fix is a guard: at Stop, a turn whose longest text block sits before a tool call while its last message is short gets a nudge.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: moved — FRM-429 carries this item (its body lists «pocket PK-259») (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
