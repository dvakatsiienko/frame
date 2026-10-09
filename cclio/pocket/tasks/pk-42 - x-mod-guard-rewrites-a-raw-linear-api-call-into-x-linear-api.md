---
id: PK-42
title: x-mod-guard rewrites a raw linear api call into x linear api
status: done
assignee: []
created_date: '2026-10-09 13:20'
updated_date: '2026-10-09 17:55'
due_date: '2026-10-10'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10400
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
census 10-08: raw `linear api` 60 calls outside x vs 15 through `x linear api`. dima 10-09 16:19: no new verb — an x-mod-guard rule rewrites the raw call before it runs, the way it quotes option globs. a mods-coder item after FRM-366; it becomes a ticket under FRM-304 when the coder takes it
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
shipped as FRM-370 (raw linear api → x linear api), closed 20:17
<!-- SECTION:NOTES:END -->
