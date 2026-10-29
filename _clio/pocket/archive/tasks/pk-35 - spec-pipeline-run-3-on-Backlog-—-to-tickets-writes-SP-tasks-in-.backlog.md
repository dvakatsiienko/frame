---
id: PK-35
title: spec-pipeline run 3 on Backlog — to-tickets writes SP tasks in .backlog/
status: done
assignee: []
created_date: '2026-10-09 11:45'
updated_date: '2026-10-10 18:19'
due_date: '2026-10-12'
labels:
  - m
dependencies: []
priority: next
type: test-drive
ordinal: 10500
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the FRM-381 coder (orbit) to run `to-tickets` on `.scratch/orbit/spec.md` and claim + close its first SP task through the cli — the trigger fired 2026-10-10: orbit went through shape-lane 2.5; cclio's own SP draft was archived (the coder writes its tickets)
dima, 2026-10-09: «let's try» the pk + matt chain; asked «how to have it as a habit, so this part is not missed?»
- the habit is the file: docs/agents/issue-tracker.md now says Backlog, and every matt skill in frame (to-spec, to-tickets, implement-spec, triage, wayfinder) reads it before publishing or fetching — no memory needed
- frame: .backlog/ (prefix SP, gitignored, the pocket's statuses + sizes + the triage roles as labels)
- left: bytes has no .scratch and no tracker file yet — it gets the same file at its first spec run
- done when: the first to-tickets run lands SP tasks with --ac exit lines and a coder claims and closes one through the cli
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
FRM-381's coder ran to-tickets on .scratch/orbit/spec.md, landed SP-1 + SP-1.1–1.5 with --ac exit lines, and closed each through the backlog cli (2026-10-10)
<!-- SECTION:FINAL_SUMMARY:END -->
