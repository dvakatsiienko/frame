---
id: PK-91
title: ccrow's wake packet carries the 5h + weekly meter line
status: done
assignee: []
created_date: '2026-10-12 11:25'
updated_date: '2026-10-12 11:33'
due_date: '2026-10-12'
labels:
  - xs
dependencies: []
priority: later
type: task
ordinal: 100070
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ccrow 2026-10-12 14:24 (packet: line): her budget hunt is blind — no 5h or weekly meter in the packet. fix: packWake (ccrow/lib.ts) adds one line read from ~/.claude/shelf/cc-usage-window.json.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: xs, solved at the 2026-10-12 siesta (the open cap holds PK-75–79)

done 14:41: meterLine in ccrow/lib.ts, 2 tests (red-proven)
<!-- SECTION:NOTES:END -->
