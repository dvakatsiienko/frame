---
id: PK-242
title: >-
  cli lane: a spawn verb that runs preflight steps 2–5 and 7–12, plus the
  brief's «before sending» checks as a gate
status: done
assignee: []
created_date: '2026-10-21T16:27:00Z'
updated_date: '2026-10-25T11:47:00Z'
due_date: '2026-10-28'
labels:
  - m
dependencies: []
priority: later
type: task
ordinal: 151000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** the cli lane (FRM-401 → 403 → 405 → 404 first)
W1 preflight is 12 hand steps every spawn; only x brief check and wish-cover are mechanical — a spawn verb could run steps 2–5 and 7–12 (x:crew-lead § preflight)
W2 the 15 «before sending» checks in crew-lead/briefing.md live in memory only; nothing fails a brief that skips them — the mechanical ones join x brief check
source: the crew-lead board's weak spots W1 and W3, dima's yes (o113, 2026-10-21): https://www.figma.com/board/hVVKYtLdMTKASUS3mwG3Uz
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
ticket: FRM-432
close: W1 W2 moved to FRM-432, its wish block carries them (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
