---
id: PK-210
title: >-
  dataviz built-in: was it disabled fully, where — and which other unused
  built-ins still sit as dead weight
status: waiting
assignee: []
created_date: '2026-10-20 11:02'
updated_date: '2026-10-20 15:32'
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
**waiting for:** the next fresh Code tab session: its skill list must show no x-cw:* skill and no web-artifacts-builder (this post-compact session still lists anthropic-skills:web-artifacts-builder)
inbox 2026-10-20, dima: yesterday i asked you to disable it fully, because we now use n8n or obsidian for diagramming. did you disable it? i missed your report. if yes, where is it disabled? also go see and tell what other similar built-in stuff you still have enabled that i don't use and that sits as dead weight. note: the dataviz skill is still listed in this 10-20 session's skill list.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-20 15:20: dima's yes on the dedup. found: x-cw, desktop-commander and humanize are claude.ai account plugins the desktop app syncs into every Code tab session (Claude/local-agent-mode-sessions/.../rpm/manifest.json); anthropic-skills (theme-factory, web-artifacts-builder, docx…) is the desktop's own plugin, not cc's. cc's own bundled set is dataviz plus the core cc skills. applied: enabledPlugins «x-cw@dotfiles»: false in home/.claude/settings.json — whole plugin, so a skill added to the cw mirror later stays out too. UNPROVEN: whether the desktop honors enabledPlugins for a synced plugin; proof = the next fresh Code tab session lists no x-cw:* skill (check at the next boot). dataviz verdict waits on dima's look at the samples artifact.

18:32 ccrow probe (cli --bg, cc 2.1.304): no x-cw:*, no anthropic-skills:* in her list — inconclusive, a cli session never gets the desktop's synced plugins. this desktop session (started 13:58, before the 15:20 change) still lists anthropic-skills:web-artifacts-builder. the proof stays a fresh desktop Code tab session.
<!-- SECTION:NOTES:END -->
