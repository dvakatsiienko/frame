---
id: PK-147
title: '✨ band wisp: a finished background agent still shows as running'
status: waiting
assignee: []
created_date: '2026-10-15 16:07'
updated_date: '2026-10-25T10:30:00Z'
due_date: '2026-10-26'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the mods lane (PK-120) — it opens after the memory sweep
dima, 2026-10-15 19:01: my band mod still showed the opus researcher researching after it had finished — its task-notification landed at 19:00 and ListAgents said completed. the band should read the agent's done notice. owner: the mods lane (PK-120). repro: cclio's session cf0b9766, the researcher «Research: cheap executor + arXiv», done 19:00.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-426
re-dated 2026-10-25 from 2026-10-24: no activity on 10-24; the pocket/linear grill (FRM-419 step 2) decides its home today
<!-- SECTION:NOTES:END -->
