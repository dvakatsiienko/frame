---
id: PK-104
title: >-
  jev stays optional: every jev flow has a fallback, written where the jev flows
  are parked
status: done
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-13 11:17'
due_date: '2026-10-14'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 10104
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-13: «we lost jev by going overboard with jev benches — most of its free quota in one session. anything we build on jev should be non-blocking for us and the fleet; if jev dies, the fleet keeps working or has a reliable fallback. save it in the AGENTS.md where all jev flows are parked.»
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
landed: the rule heads script/lib/jev.ts (every jev flow imports it). audit: inbox-triage, flawlog-triage, skill-route all catch a 402 / budget error and fall back (proven live at the 10-13 boot: 402 → unlaned, router OFF).
<!-- SECTION:NOTES:END -->
