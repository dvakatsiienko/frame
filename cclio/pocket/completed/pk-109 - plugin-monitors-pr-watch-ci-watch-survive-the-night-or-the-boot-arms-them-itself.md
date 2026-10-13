---
id: PK-109
title: >-
  plugin monitors (pr-watch, ci-watch) survive the night, or the boot arms them
  itself
status: done
assignee: []
created_date: '2026-10-13 10:43'
updated_date: '2026-10-13 11:19'
due_date: '2026-10-15'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10109
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
down at three boots running (10-11, 10-12, 10-13); the boot arms them by hand each time. invariant 5: a script or a hook, not a habit. pick: the boot-prefetch arms both when it finds 0/2 instead of printing FAIL.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
root cause (cc docs, code.claude.com/docs/en/plugins/loading): a project-scope plugin starts no background monitors, so plugin-cclio/monitors/monitors.json never runs. the boot arming both is the mechanism, not a stopgap; boot-prefetch now says so instead of a FAIL. open for dima: trash the dead monitors.json (orbit).
<!-- SECTION:NOTES:END -->
