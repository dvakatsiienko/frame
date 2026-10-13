---
id: PK-102
title: 'mods: use the free bottom half of the desktop left sidebar for the board'
status: done
assignee: []
created_date: '2026-10-13 10:40'
updated_date: '2026-10-13 11:19'
due_date: '2026-10-20'
labels:
  - s
dependencies: []
priority: later
type: wish
ordinal: 100103
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
inbox 10-13: «i have a lot of unused space on my display; the desktop app is 99.8 % of my time. in the left sidebar, the bottom half is free. the board UI doesn't have enough space. how to make it useful?» an engine question first (can a mod draw in the sidebar?), likely a PK-52 engine gap.
<!-- SECTION:DESCRIPTION:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
answer (api-map.md ui.render sites, cc 2.1.296): a mod draws only in AbovePrompt (the band) and Pane, plus the engine's own rows; the desktop left sidebar is no RenderComponent, so no mod reaches it. options for dima (orbit): more board room through a second Pane or a denser board, and an upstream feature request for a sidebar slot, watched under PK-52.
<!-- SECTION:NOTES:END -->
