---
id: PK-56
title: 'subagents: do they die after their last report, can they be steered mid-turn?'
status: done
assignee: []
created_date: '2026-10-11 07:40'
updated_date: '2026-10-11 08:21'
due_date: '2026-10-11'
labels:
  - xs
dependencies: []
priority: now
type: question
ordinal: 1200
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-11, dima: «remind me — do subagents die once they write their last report? can you steer them mid-turn?»
answered in place at the first siesta, each claim with its source opened (the Agent tool doc: SendMessage resumes a finished agent with its context — covers «die after last report» only); «steer mid-turn» needs its own doc line opened, or goes out labelled an inference
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answered 11:22: a subagent stops after its last report, it does not die — SendMessage to its id or name resumes it with full context (Agent tool doc; the task-notification note says the same task-id may notify again). it dies with cclio's session (x:crew-lead, «the two doors»). mid-turn steering: a SendMessage to a running one lands in its inbox and is read at its next tool round — measured for sessions (x:handoff-ingest etiquette), inferred for in-process subagents, no doc line found
<!-- SECTION:NOTES:END -->
