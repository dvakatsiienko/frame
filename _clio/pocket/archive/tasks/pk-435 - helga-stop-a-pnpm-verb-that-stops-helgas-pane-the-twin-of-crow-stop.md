---
id: PK-435
title: 'helga:stop: a pnpm verb that stops helga''s pane, the twin of crow:stop'
status: done
assignee: []
created_date: '2026-11-15T20:01:00Z'
updated_date: '2026-11-15T20:03:00Z'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 80000
---

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PK-435:W1 (2026-11-15 22:01, dima): let's maybe have a script for stopping helga the same way as crow.
note 22:02: tonight crow:stop failed too («crow pid 83662 is a cli session, but no herdr terminal matches cwd ~/.local/state/crow») and hc ls --label seat=helga found nothing: both stop doors miss the panes; one fix for both

close: 22:03 — PK-435:W1 done: pnpm helga:stop added, crow:stop's pane match fixed (herdr's claude-code agent name); both stopped crow t6k and helga t6j live
<!-- SECTION:NOTES:END -->
