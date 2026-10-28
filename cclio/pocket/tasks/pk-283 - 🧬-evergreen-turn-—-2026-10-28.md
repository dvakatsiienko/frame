---
id: PK-283
title: 🧬 evergreen turn — 2026-10-28
status: done
assignee: []
created_date: '2026-10-28T11:45:00Z'
updated_date: '2026-10-28T12:29:00Z'
due_date: '2026-10-28'
labels:
  - xs
dependencies: []
priority: now
type: task
ordinal: 9998
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
seeded by the boot digest: apps lane due or 1 security PR(s). run cclio:evergreen; done when its § the day completes.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: evergreen 10-28 — #112 merged, #113 held for the mods lane end, page v5, os entries added, apps marked

W1 (2026-10-28 14:27, dima): something is wrong with evergreen — pnpm outdated -r in both frame and bytes shows a large outdated list; why does renovate not work? after each evergreen everything should be upgraded, the packages in each repo included, not just brew and pnpm. → read.md gathers pnpm outdated -r per repo and the dashboard's age (red past 2 days); bytes' renovate silence is orbit o7
<!-- SECTION:NOTES:END -->
