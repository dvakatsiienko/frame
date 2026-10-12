---
id: PK-98
title: >-
  re-probe: does cc 2.1.295's raw-prompt fix reach x-mod-redact's session.append
  rewrite
status: open
assignee: []
created_date: '2026-10-12 18:07'
labels:
  - xs
dependencies: []
priority: later
ordinal: 114000
type: task
due_date: '2026-10-17'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
moved out of mods/AGENTS.md at the r33 split (dima o93 ticked the move). cc 2.1.295 fixed a prompt a prompt.submit hook rewrote being saved raw; redact rewrites in session.append, so the fix may not reach the queued-prompt queue-operation record. one headless probe with a fake key, at the next refresh-cc-mods run.
<!-- SECTION:DESCRIPTION:END -->
