---
id: PK-35
title: spec-pipeline run 3 on Backlog — to-tickets writes SP tasks in .backlog/
status: waiting
assignee: []
created_date: '2026-10-09 11:45'
updated_date: '2026-10-10 07:55'
labels:
  - m
dependencies: []
priority: next
type: test-drive
ordinal: 10500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the next to-spec run on a ticket
dima, 2026-10-09: «let's try» the pk + matt chain; asked «how to have it as a habit, so this part is not missed?»
- the habit is the file: docs/agents/issue-tracker.md now says Backlog, and every matt skill in frame (to-spec, to-tickets, implement-spec, triage, wayfinder) reads it before publishing or fetching — no memory needed
- frame: .backlog/ (prefix SP, gitignored, the pocket's statuses + sizes + the triage roles as labels)
- left: bytes has no .scratch and no tracker file yet — it gets the same file at its first spec run
- done when: the first to-tickets run lands SP tasks with --ac exit lines and a coder claims and closes one through the cli
<!-- SECTION:DESCRIPTION:END -->
