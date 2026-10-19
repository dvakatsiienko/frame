---
id: PK-195
title: >-
  cw memory refresh: review the uncommitted diffs cw's project coord left,
  verify or fix, commit
status: done
assignee: []
created_date: '2026-10-19 12:17'
updated_date: '2026-10-19 12:51'
due_date: '2026-10-19'
labels:
  - s
dependencies: []
priority: next
type: task
ordinal: 10030
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-19 (wish): yesterday dima refreshed cw memory; he asked the cw project coordinator to revisit the current cc memory system and revamp the comment tags that map the memory pieces cw wanted. the diffs after that are uncommitted. review them, verify all good (or fix), then commit. scope: the 5 files cw touched 10-19 03:18 — home/.claude/CLAUDE.md, rules/fleet-doors.md, rules/fleet-identity.md, rules/fleet-vibe.md, plugin-x-cw/skills/memory-update/SKILL.md. not in scope: cclio/AGENTS.md (the «todos» convention cut, 10-17) and craft-fleet-flow.md (his freebie question comment, 10-17) — asked on the boot board. full text: inbox-composer.md W2
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
10-19: reviewed — 4 files tags-only (sync: cw / cc), memory-update source-sha256 → sha256 matches script/lib/memory-sync-mirror.ts; mirror renders 30752/32768 chars; committed.
<!-- SECTION:NOTES:END -->
