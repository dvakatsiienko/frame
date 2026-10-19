---
id: PK-197
title: 'n8n: one more workflow that unloads cclio — pick the chore, draw it, build it'
status: open
assignee: []
created_date: '2026-10-19 12:20'
updated_date: '2026-10-19 14:34'
due_date: '2026-10-21'
labels:
  - s
dependencies: []
priority: next
type: wish
ordinal: 10900
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CST 10-18 first-act 2: dima asks for one more n8n workflow that unloads cclio (after the pm flow and composer-receipts / ci-watch ones). pick the chore cclio does by hand that n8n can own, draw it (cclio:author-blueprint), build it. ids so far: pm flow Bl9E59tC1PAuKHuf, composer receipts wKzQdHFvCe4lNanM, ci watch 7RX1k5SibxFz9EAg.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
10-19 17:30, dima asked whether the skill-scan scripts could be n8n instead (exploring, no push). candidates from the FRM-238/239 scan that fit n8n (scheduled, no session, no model): (1) the github notifications sweep — mark read every notification whose pr merged or closed, now halt phase 1.7, nightly; (2) evergreen's gather — renovate prs as rows (tier, age, ci) into an n8n table each morning, so the helper card starts from a table; (3) the until:-ids check — every until: FRM-N line whose ticket closed, posted as a row. session-bound reads (dima's chat lines, the helper count) stay scripts. pick: (1), smallest and fully mechanical.

10-19 17:40, dima o55 ✓: the workflow is the nightly github notifications sweep (out of halt phase 1.7 / halt-sweep.ts's notifications part) — blueprint first (cclio:author-blueprint), then build.
<!-- SECTION:NOTES:END -->
