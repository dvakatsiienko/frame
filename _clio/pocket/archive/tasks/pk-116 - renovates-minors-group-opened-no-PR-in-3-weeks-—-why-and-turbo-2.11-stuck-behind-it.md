---
id: PK-116
title: >-
  renovate's minors group opened no PR in 3 weeks — why, and turbo 2.11 stuck
  behind it
status: done
assignee: []
created_date: '2026-10-13 13:50'
updated_date: '2026-10-13 14:49'
due_date: '2026-10-16'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10250
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
bytes renovate.json: group «minors», schedule `* 9-12 * * 3`. since 2026-09-25 only patches and motion v14 opened (gh pr list, 2026-10-13); turbo 2.11 (2026-09-18) never reached bytes. find the cause (the dependency dashboard issue, renovate logs), fix it, and say what else waits behind it. born from the refresh-monorepo run #2 (dima o149 ✓).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
17:47 cause: the minors window (4 h, 9-12 Kyiv, Mon until 10-10, Wed since) — renovate's hosted app opens PRs mostly 01-03 UTC and hit the window once in 6 weeks (09-21 09:53Z); the dashboard lists minors incl. turbo 2.11.7 «awaiting schedule». fix: both minors rules → `* * * * 3` (all Wednesday), validated (renovate-config-validator). lands when pushed before 10-14; the 2.11 bump PR then needs agentGuidance:false added on its branch (BYT-125).

17:50 pushed b86146d9 (renovate.json alone, dima o150 ✓); the next Wednesday run should open the minors pr with turbo 2.11.7
<!-- SECTION:NOTES:END -->
