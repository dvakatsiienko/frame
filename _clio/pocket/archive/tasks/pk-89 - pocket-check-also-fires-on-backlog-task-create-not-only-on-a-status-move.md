---
id: PK-89
title: 'pocket-check also fires on backlog task create, not only on a status move'
status: done
assignee: []
created_date: '2026-10-12 11:17'
updated_date: '2026-10-12 17:41'
due_date: '2026-10-14'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 100050
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ccrow 2026-10-12 14:16: the 14:09 cap stumble was logged with a firmer intention, which habit-cto bans. the guard exists (pocket-check), but backlog.config.yml fires it on onStatusChange only, so a bulk create past ≤5 open / ≤3 now / the ordinal bands stays silent until a later status move. fix: a PostToolUse Bash hook on «backlog task create|edit» that runs pocket-check and returns the red to the session (cclio hook: proven with a fixture-HOME driver + a mutation script).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
parked: queued under the ≤5 open cap, 2026-10-12 — worked in ordinal order after PK-75–79

15:58: folds into the cli lane as `x pocket new` (exit 3b), ccrow's catch on the re-plan

done 20:42: cclio PostToolUse hook (.claude/hooks/pocket-check-on-write.sh) runs pocket-check after a backlog create/edit or a pocket/tasks write and blocks with the red lines; 4 tests, red under a trigger and a verdict mutation
<!-- SECTION:NOTES:END -->
