---
id: PK-75
title: 'commit frame''s uncommitted work, minus the crew-coder and crew-verifier deltas'
status: open
assignee: []
created_date: '2026-10-12 11:08'
due_date: '2026-10-12'
labels:
  - s
dependencies: []
priority: now
type: task
ordinal: 1100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
dima, boot 2026-10-12: commit everything in frame that can be committed, except the coder and verifier skill deltas — those get reviewed later, as the first skills of the skills groom. the untracked runtime state stays untracked on purpose (shelf/lanes.json, shelf/lanes/, shelf/pr-verified.json, shelf/stash/, x/go/x).
<!-- SECTION:DESCRIPTION:END -->
