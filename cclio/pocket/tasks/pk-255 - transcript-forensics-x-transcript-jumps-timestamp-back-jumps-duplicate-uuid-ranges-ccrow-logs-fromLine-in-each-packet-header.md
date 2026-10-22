---
id: PK-255
title: >-
  transcript forensics: x transcript jumps (timestamp back-jumps, duplicate-uuid
  ranges) + ccrow logs fromLine in each packet header
status: waiting
assignee: []
created_date: '2026-10-22T17:12:00Z'
updated_date: '2026-10-22T17:12:00Z'
due_date: '2026-10-25'
labels:
  - s
dependencies: []
priority: later
type: task
ordinal: 156000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**waiting for:** cli lane 2 (FRM-383, FRM-384) — the verb rides it; the ccrow header line goes with the next ccrow touch

the PK-254 coder retro's automation candidates (invariant 5): one jq back-jump scan cracked the compaction replay; a packet that names its fromLine makes a later replay reconstructable (the 19:50 offset had to be rebuilt from a packet's mtime).
<!-- SECTION:DESCRIPTION:END -->
