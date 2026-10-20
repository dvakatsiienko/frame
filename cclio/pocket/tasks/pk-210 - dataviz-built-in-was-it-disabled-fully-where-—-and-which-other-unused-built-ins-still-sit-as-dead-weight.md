---
id: PK-210
title: >-
  dataviz built-in: was it disabled fully, where — and which other unused
  built-ins still sit as dead weight
status: open
assignee: []
created_date: '2026-10-20 11:02'
updated_date: '2026-10-20 12:15'
due_date: '2026-10-23'
labels:
  - s
dependencies: []
priority: next
type: question
ordinal: 99100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 2026-10-20, dima: yesterday i asked you to disable it fully, because we now use n8n or obsidian for diagramming. did you disable it? i missed your report. if yes, where is it disabled? also go see and tell what other similar built-in stuff you still have enabled that i don't use and that sits as dead weight. note: the dataviz skill is still listed in this 10-20 session's skill list.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 15:20: dima's yes on the dedup. found: x-cw, desktop-commander and humanize are claude.ai account plugins the desktop app syncs into every Code tab session (Claude/local-agent-mode-sessions/.../rpm/manifest.json); anthropic-skills (theme-factory, web-artifacts-builder, docx…) is the desktop's own plugin, not cc's. cc's own bundled set is dataviz plus the core cc skills. applied: enabledPlugins «x-cw@dotfiles»: false in home/.claude/settings.json — whole plugin, so a skill added to the cw mirror later stays out too. UNPROVEN: whether the desktop honors enabledPlugins for a synced plugin; proof = the next fresh Code tab session lists no x-cw:* skill (check at the next boot). dataviz verdict waits on dima's look at the samples artifact.
<!-- SECTION:NOTES:END -->
