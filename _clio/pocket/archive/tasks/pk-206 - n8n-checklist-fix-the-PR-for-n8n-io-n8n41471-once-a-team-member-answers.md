---
id: PK-206
title: 'n8n checklist fix: the PR for n8n-io/n8n#41471, once a team member answers'
status: done
assignee: []
created_date: '2026-10-19 16:15'
updated_date: '2026-10-25T11:47:00Z'
due_date: '2026-11-02'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** an n8n team reply on https://github.com/n8n-io/n8n/issues/41471 (asked to take it 2026-10-19: https://github.com/n8n-io/n8n/issues/41471#issuecomment-6271773316).
dima, 2026-10-19 (o82): ask first, build only after a team member answers.
the build: shallow fork + clone outside ~/frame, the watcher in packages/frontend/editor-ui/src/app/components/WorkflowProductionChecklist.vue reads the settings before the first-time check, a regression unit test failing on master, the CLA signed, a conventional-commit PR title per .github/pull_request_title_conventions.md; reply to review within 14 days or it auto-closes; delete the fork after merge.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
close: moved to memory/_reminders.md as a condition reminder; changedetector watches n8n#41471 (pocket migration, dima's o45, 2026-10-25)
<!-- SECTION:NOTES:END -->
