---
id: PK-98
title: >-
  re-probe: does cc 2.1.295's raw-prompt fix reach x-mod-redact's session.append
  rewrite
status: done
assignee: []
created_date: '2026-10-12 18:07'
updated_date: '2026-10-13 15:35'
due_date: '2026-10-17'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 114000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
moved out of mods/AGENTS.md at the r33 split (dima o93 ticked the move). cc 2.1.295 fixed a prompt a prompt.submit hook rewrote being saved raw; redact rewrites in session.append, so the fix may not reach the queued-prompt queue-operation record. one headless probe with a fake key, at the next refresh-cc-mods run.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: needs a prompt queued while a session is busy (a headless -p cannot queue); rides the next refresh-cc-mods run, its own words

18:30 cclio's «do now» pick was wrong: a headless run cannot queue a prompt; stays on the next refresh-cc-mods run

18:36 probed now (dima 18:33: «why not a claude -p probe?» — right, stream-json queues a second prompt): cc 2.1.296, the queued prompt's fake key is saved RAW in 3 records (queue-operation enqueue + remove, the queued_command attachment), 2 attachments masked. a real leak → mods todo 24
<!-- SECTION:NOTES:END -->
