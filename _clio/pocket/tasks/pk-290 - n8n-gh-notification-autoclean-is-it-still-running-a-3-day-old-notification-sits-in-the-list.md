---
id: PK-290
title: >-
  n8n gh-notification autoclean: is it still running? a 3-day-old notification
  sits in the list
status: done
assignee: []
created_date: '2026-11-01T11:42:00Z'
updated_date: '2026-11-01T14:20:00Z'
labels:
  - xs
dependencies: []
priority: next
type: task
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
W1 (2026-11-01 inbox, dima) ❓ does my n8n notification-autocleaning flow work? i see a 3-day-old gh notification in the list — seems like n8n stopped working?
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
raw drop (2026-11-01 inbox, dima): my notification autocleaning n8n flow — does it works? i see a 3-day old gh notification in a list. seems like n8n stopped working?

close: 2026-11-01 16:21 — the flow runs nightly (green 10-22…10-31); today's run was missed at 10:00 while the mac slept and n8n replays no missed trigger; the catch-up ran by hand in the pane, «Workflow executed successfully». the 3-day-old notification is an unread issue (n8n-io checklist), which the sweep never touches by design. the missed-trigger fix is orbit's ask

close: W1 done — answered: the flow works; the old notification is an unread issue it never sweeps; the missed run caught up by hand
<!-- SECTION:NOTES:END -->
