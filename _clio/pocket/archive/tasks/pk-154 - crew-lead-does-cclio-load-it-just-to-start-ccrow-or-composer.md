---
id: PK-154
title: 'crew-lead: does cclio load it just to start ccrow or composer'
status: done
assignee: []
created_date: '2026-10-16 10:24'
updated_date: '2026-10-16 10:39'
due_date: '2026-10-16'
labels:
  - xs
dependencies: []
priority: next
type: question
ordinal: 10102
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-16, Q: crew-lead was sliced out of the resident state because cclio sometimes runs without coders (like the two recent days). do ccrow and composer still need it loaded? if yes, the boot negates the gain — the skill should load only for real lane spawns (coder, verifier, designer).
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answered 10-16: sidecars start from cclio:boot, subagents from the open x:crew-subagent; crew-lead only for lane members. FRM-368 carries the squad note.
<!-- SECTION:NOTES:END -->
