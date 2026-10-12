---
id: PK-97
title: >-
  index-run copies only the commit's tree, so no peer's staged file can red
  another commit
status: done
assignee: []
created_date: '2026-10-12 17:46'
updated_date: '2026-10-12 19:12'
due_date: '2026-10-19'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 113000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
wishkeeper 20:47 + flawlog 20:13: 34e0651f fixed the two tests that list git files; any new test built the same way brings the blocker back. the root: script/index-run.sh builds its copy from the full index. fix at the root so every test sees exactly what the commit holds.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
retro fold 10-12: also `x lane commit` waits out a live `.git/index.lock` (≤30 s) instead of failing (mods coder part C)

done 22:12 by arm A via .scratch/index-run/spec.md: f64f6343 (gate copy gets a private git dir; ENOENT red → 20/20 green, a live commit landed with a peer file staged) + eb6754bd (x lane commit waits out index.lock 30 s, fails naming path + age). exits 1–5 met; cclio's 3 doc lines owed
<!-- SECTION:NOTES:END -->
