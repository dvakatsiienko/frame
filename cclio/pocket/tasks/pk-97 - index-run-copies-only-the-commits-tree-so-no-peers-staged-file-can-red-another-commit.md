---
id: PK-97
title: >-
  index-run copies only the commit's tree, so no peer's staged file can red
  another commit
status: open
assignee: []
created_date: '2026-10-12 17:46'
labels:
  - s
dependencies: []
priority: later
ordinal: 113000
type: task
due_date: '2026-10-19'
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
wishkeeper 20:47 + flawlog 20:13: 34e0651f fixed the two tests that list git files; any new test built the same way brings the blocker back. the root: script/index-run.sh builds its copy from the full index. fix at the root so every test sees exactly what the commit holds.
<!-- SECTION:DESCRIPTION:END -->
